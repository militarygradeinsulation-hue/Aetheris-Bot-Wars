/**
 * Component damage, thermal/cryo loads, flips and loose debris.
 * Shared by the client simulation and the authoritative server.
 */
import type {
  ArenaSnapshot,
  ArmorZones,
  BotComponents,
  BotPhysicsState,
  CombatEvent,
  DamageKind,
  DebrisKind,
  DebrisPiece,
  WeaponId,
} from './types.ts';
import { getBotWeapons } from './types.ts';

type Emit = (ev: Omit<CombatEvent, 'id'>) => void;

const ZONES: Array<keyof ArmorZones> = ['front', 'left', 'right', 'rear'];
const MAX_DEBRIS = 42;
const BOT_RADIUS = 1.15;
let nextDebrisId = 1;

/** Weapons that sit on the deck or hang off the front and stop when the bot is inverted. */
const TOP_MOUNTED: WeaponId[] = ['hbar', 'hammer', 'tesla', 'mortar', 'railgun', 'missiles', 'magnet'];
/** Weapons that shed big chunks when they fail. */
const HEAVY_WEAPONS: WeaponId[] = ['vspinner', 'hbar', 'drum', 'sawblade', 'hammer', 'crush_jaw', 'lance'];

/** Local corner positions of the four drive units in bot space (front = +z). */
const WHEEL_LOCAL: Array<[number, number]> = [
  [-0.96, 0.56],
  [0.96, 0.56],
  [-0.96, -0.62],
  [0.96, -0.62],
];

export function initComponents(bot: BotPhysicsState) {
  const n = getBotWeapons(bot.config).length;
  bot.components = {
    wheels: [100, 100, 100, 100],
    weapons: Array.from({ length: n }, () => 100),
    battery: 100,
    motor: 100,
  };
  bot.heat = 0;
  bot.chill = 0;
  bot.frozenTimer = 0;
  bot.meltZones = { front: 0, left: 0, right: 0, rear: 0 };
  bot.flipped = false;
  bot.flipAngle = 0;
  bot.flipTimer = 0;
  bot.selfRightCooldown = 0;
}

function comps(bot: BotPhysicsState): BotComponents {
  if (!bot.components) initComponents(bot);
  const c = bot.components!;
  const n = getBotWeapons(bot.config).length;
  while (c.weapons.length < n) c.weapons.push(100);
  return c;
}

export function isWeaponSlotOnline(bot: BotPhysicsState, slot: number, weaponId: WeaponId): boolean {
  if ((bot.frozenTimer ?? 0) > 0) return false;
  const c = bot.components;
  if (c && (c.weapons[slot] ?? 100) <= 0) return false;
  if (bot.flipped && TOP_MOUNTED.includes(weaponId) && weaponId !== 'railgun') return false;
  return true;
}

function localToWorld(bot: BotPhysicsState, lx: number, lz: number): [number, number] {
  const s = bot.scale || 1;
  const c = Math.cos(bot.yaw);
  const sn = Math.sin(bot.yaw);
  // Bot forward is (sin yaw, cos yaw); right is (cos yaw, -sin yaw)
  return [bot.x + (lx * c + lz * sn) * s, bot.z + (-lx * sn + lz * c) * s];
}

export function spawnDebris(
  snapshot: ArenaSnapshot | null,
  bot: BotPhysicsState,
  kind: DebrisKind,
  lx: number,
  lz: number,
  power: number,
  extra: Partial<DebrisPiece> = {},
) {
  if (!snapshot) return;
  const list = snapshot.debris ?? (snapshot.debris = []);
  const [wx, wz] = localToWorld(bot, lx, lz);
  let dx = wx - bot.x;
  let dz = wz - bot.z;
  const d = Math.hypot(dx, dz) || 1;
  dx /= d;
  dz /= d;
  const spec: Record<DebrisKind, { radius: number; mass: number }> = {
    wheel: { radius: 0.32, mass: 0.9 },
    armor: { radius: 0.55, mass: 1.6 },
    weapon: { radius: 0.5, mass: 1.4 },
    scrap: { radius: 0.22, mass: 0.35 },
    battery: { radius: 0.3, mass: 1.1 },
  };
  const sp = spec[kind];
  const scale = bot.scale || 1;
  list.push({
    id: `d${nextDebrisId++}`,
    kind,
    x: wx,
    y: 0.5 * scale,
    z: wz,
    vx: bot.vx * 0.6 + dx * (3 + power * 2.5) + (Math.random() - 0.5) * 2,
    vy: 3 + power * 2.2 + Math.random() * 1.5,
    vz: bot.vz * 0.6 + dz * (3 + power * 2.5) + (Math.random() - 0.5) * 2,
    rx: Math.random() * Math.PI,
    ry: Math.random() * Math.PI * 2,
    rz: Math.random() * Math.PI,
    spin: 6 + Math.random() * 10,
    radius: sp.radius * scale,
    mass: sp.mass * scale,
    color: kind === 'armor' ? bot.config.primaryColor : kind === 'weapon' ? '#9ca3af' : kind === 'battery' ? '#facc15' : '#475569',
    sourceId: bot.id,
    ...extra,
  });
  // Keep the floor readable: drop the oldest small scrap first, then the oldest piece
  while (list.length > MAX_DEBRIS) {
    const scrapIdx = list.findIndex((p) => p.kind === 'scrap');
    list.splice(scrapIdx >= 0 ? scrapIdx : 0, 1);
  }
}

/**
 * Route damage that got past (or through) the armor into the parts behind it.
 * Returns true when a part was lost this hit.
 */
export function applyComponentDamage(
  snapshot: ArenaSnapshot | null,
  victim: BotPhysicsState,
  damage: number,
  zone: keyof ArmorZones,
  armorLeft: number,
  hitLocalY: number,
  hitLocalZ: number,
  kind: DamageKind,
  weaponId: WeaponId | undefined,
  emit: Emit,
): boolean {
  if (victim.isDead || damage <= 0) return false;
  const c = comps(victim);
  const weapons = getBotWeapons(victim.config);
  // Intact armor soaks most of the shock; bare frames pass it all through
  const through = armorLeft > 0 ? 0.28 : 1.0;
  const blast = weaponId === 'mortar' || weaponId === 'missiles';
  const dmg = damage * through * (kind === 'blade' ? 1.25 : kind === 'crush' ? 1.15 : 1);
  let lost = false;

  const hurtWheel = (i: number, amount: number) => {
    if (c.wheels[i] <= 0) return;
    c.wheels[i] = Math.max(0, c.wheels[i] - amount);
    if (c.wheels[i] <= 0) {
      lost = true;
      const [lx, lz] = WHEEL_LOCAL[i];
      spawnDebris(snapshot, victim, 'wheel', lx * 1.1, lz, 1.2);
      emit({
        type: 'part_detach',
        x: victim.x,
        y: victim.y + 0.3,
        z: victim.z,
        intensity: 1.1,
        targetId: victim.id,
        label: 'wheel',
        callout: `${victim.config.name}: WHEEL TORN OFF!`,
      });
    }
  };
  const hurtWeapon = (slot: number, amount: number) => {
    if (slot >= c.weapons.length || c.weapons[slot] <= 0) return;
    c.weapons[slot] = Math.max(0, c.weapons[slot] - amount);
    if (c.weapons[slot] <= 0) {
      lost = true;
      const wId = weapons[slot];
      const lz = slot === 0 ? 1.0 : slot === 1 ? 0.1 : -0.8;
      spawnDebris(snapshot, victim, 'weapon', 0, lz, HEAVY_WEAPONS.includes(wId) ? 1.6 : 1.0, { weapon: wId });
      if (victim.weaponSpins) victim.weaponSpins[slot] = 0;
      if (victim.weaponActives) victim.weaponActives[slot] = false;
      emit({
        type: 'part_detach',
        x: victim.x,
        y: victim.y + 0.6,
        z: victim.z,
        intensity: 1.3,
        targetId: victim.id,
        weapon: wId,
        label: 'weapon',
        callout: `${victim.config.name}: WEAPON DESTROYED!`,
      });
    }
  };

  const front = hitLocalZ >= 0;
  if (zone === 'left') {
    hurtWheel(front ? 0 : 2, dmg * 1.35);
    hurtWheel(front ? 2 : 0, dmg * 0.25);
  } else if (zone === 'right') {
    hurtWheel(front ? 1 : 3, dmg * 1.35);
    hurtWheel(front ? 3 : 1, dmg * 0.25);
  } else if (zone === 'front') {
    hurtWeapon(0, dmg * 0.95);
    hurtWheel(0, dmg * 0.35);
    hurtWheel(1, dmg * 0.35);
  } else {
    const batteryBefore = c.battery;
    c.battery = Math.max(0, c.battery - dmg * 1.05);
    c.motor = Math.max(0, c.motor - dmg * 0.7);
    hurtWheel(2, dmg * 0.4);
    hurtWheel(3, dmg * 0.4);
    if (batteryBefore > 0 && c.battery <= 0) {
      lost = true;
      victim.burnTimer = Math.max(victim.burnTimer, 3.5);
      spawnDebris(snapshot, victim, 'battery', 0, -0.7, 1.0);
      emit({
        type: 'part_detach',
        x: victim.x,
        y: victim.y + 0.5,
        z: victim.z,
        intensity: 1.2,
        targetId: victim.id,
        label: 'battery',
        callout: `${victim.config.name}: BATTERY RUPTURED!`,
      });
    }
  }
  // Overhead strikes and shells land on the deck: top weapons and the battery
  if (hitLocalY > 0.75 || blast || weaponId === 'hammer') {
    for (let s = 1; s < weapons.length; s++) hurtWeapon(s, dmg * (blast ? 0.45 : 0.7));
    c.battery = Math.max(0, c.battery - dmg * 0.45);
  }
  if (blast) {
    for (let i = 0; i < 4; i++) hurtWheel(i, dmg * 0.22);
  }
  // Scrap flakes off on heavy hits
  if (damage > 14 && Math.random() < Math.min(0.85, damage / 40)) {
    spawnDebris(snapshot, victim, 'scrap', (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.6, 0.8);
  }
  return lost;
}

/** Armor plate fell off: drop it on the floor as an obstacle. */
export function dropArmorPlate(snapshot: ArenaSnapshot | null, victim: BotPhysicsState, zone: keyof ArmorZones) {
  const pos: Record<keyof ArmorZones, [number, number]> = {
    front: [0, 1.1],
    rear: [0, -1.0],
    left: [-1.05, 0],
    right: [1.05, 0],
  };
  const [lx, lz] = pos[zone];
  spawnDebris(snapshot, victim, 'armor', lx, lz, 1.0);
}

/** Drop the wreck's loose parts when a bot is knocked out. */
export function shatterWreck(snapshot: ArenaSnapshot | null, bot: BotPhysicsState) {
  const c = comps(bot);
  c.wheels.forEach((w, i) => {
    if (w > 0 && Math.random() < 0.5) {
      c.wheels[i] = 0;
      spawnDebris(snapshot, bot, 'wheel', WHEEL_LOCAL[i][0] * 1.1, WHEEL_LOCAL[i][1], 1.6);
    }
  });
  for (let k = 0; k < 3; k++) {
    spawnDebris(snapshot, bot, 'scrap', (Math.random() - 0.5) * 1.8, (Math.random() - 0.5) * 1.8, 1.4);
  }
}

export function addHeat(bot: BotPhysicsState, amount: number) {
  if (bot.isDead) return;
  const resist = bot.config.armor === 'ceramic' ? 0.55 : bot.config.armor === 'aetherium' ? 0.8 : 1;
  bot.heat = Math.min(100, (bot.heat ?? 0) + amount * resist);
  // Fire drives the ice off
  bot.chill = Math.max(0, (bot.chill ?? 0) - amount * 1.5);
}

export function addChill(bot: BotPhysicsState, amount: number, emit: Emit) {
  if (bot.isDead || (bot.frozenTimer ?? 0) > 0) return;
  const resist = bot.config.armor === 'ceramic' ? 0.6 : 1;
  bot.chill = Math.min(100, (bot.chill ?? 0) + amount * resist);
  bot.heat = Math.max(0, (bot.heat ?? 0) - amount * 1.2);
  bot.freezeTimer = Math.max(bot.freezeTimer ?? 0, 0.6);
  if (bot.chill >= 100) {
    bot.frozenTimer = 2.2;
    bot.vx *= 0.2;
    bot.vz *= 0.2;
    bot.angularVel = 0;
    emit({
      type: 'frozen_solid',
      x: bot.x,
      y: bot.y + 0.6,
      z: bot.z,
      intensity: 1.2,
      targetId: bot.id,
      callout: `${bot.config.name} FROZEN SOLID!`,
    });
  }
}

/** Big lift and twisting hits can put a bot on its back. */
export function tryFlip(bot: BotPhysicsState, lift: number, mass: number, twist: number, emit: Emit, reason = '') {
  if (bot.isDead || bot.flipped) return;
  const gyro = bot.skills.gyroStabilizer ?? 0;
  const lowProfile = bot.config.chassis === 'wedge' || bot.config.drive === 'hover' ? 0.8 : 1;
  const leverage = (lift / Math.max(0.8, mass)) * (1 + Math.abs(twist) * 0.6) * lowProfile;
  const threshold = 5.2 + gyro * 0.7;
  if (leverage < threshold) return;
  const chance = Math.min(0.9, (leverage - threshold) / 6 + 0.25);
  if (Math.random() > chance) return;
  bot.flipped = true;
  bot.flipTimer = 0;
  bot.selfRightCooldown = 1.2;
  bot.vy = Math.max(bot.vy, 4.5);
  bot.angularVel += twist * 2;
  emit({
    type: 'flip',
    x: bot.x,
    y: bot.y + 0.6,
    z: bot.z,
    intensity: 1.4,
    targetId: bot.id,
    label: 'inverted',
    callout: `${bot.config.name} FLIPPED OVER${reason ? ` BY ${reason}` : ''}!`,
  });
}

export function trySelfRight(bot: BotPhysicsState, emit: Emit): boolean {
  if (!bot.flipped || (bot.selfRightCooldown ?? 0) > 0 || bot.y > 0.2) return false;
  const c = comps(bot);
  if (c.battery <= 0 || bot.energy < 22) return false;
  bot.energy -= 22;
  bot.flipped = false;
  bot.flipTimer = 0;
  bot.vy = 4.2;
  bot.selfRightCooldown = 2.5;
  emit({
    type: 'self_right',
    x: bot.x,
    y: bot.y + 0.4,
    z: bot.z,
    intensity: 0.9,
    targetId: bot.id,
    callout: `${bot.config.name} SELF-RIGHTED!`,
  });
  return true;
}

export interface ConditionMods {
  /** Multiplier on drive force and top speed. */
  drive: number;
  /** Multiplier on turning. */
  turn: number;
  /** Yaw pull per unit throttle from uneven traction (rad/s). */
  pull: number;
  /** Multiplier on energy regen. */
  regen: number;
  /** Bot cannot act at all. */
  frozen: boolean;
}

/** Per-tick decay of heat/chill, melting, freeze, and drive penalties. */
export function stepConditions(
  snapshot: ArenaSnapshot | null,
  bot: BotPhysicsState,
  dt: number,
  emit: Emit,
): ConditionMods {
  const c = comps(bot);
  if (!bot.meltZones) bot.meltZones = { front: 0, left: 0, right: 0, rear: 0 };
  bot.selfRightCooldown = Math.max(0, (bot.selfRightCooldown ?? 0) - dt);

  // Flip animation and inverted timer
  const targetAngle = bot.flipped ? Math.PI : 0;
  const fa = bot.flipAngle ?? 0;
  bot.flipAngle = fa + (targetAngle - fa) * Math.min(1, dt * 7);
  if (Math.abs(bot.flipAngle - targetAngle) < 0.01) bot.flipAngle = targetAngle;

  if (bot.isDead) {
    bot.heat = Math.max(0, (bot.heat ?? 0) - 6 * dt);
    bot.chill = Math.max(0, (bot.chill ?? 0) - 10 * dt);
    return { drive: 0, turn: 0, pull: 0, regen: 0, frozen: true };
  }

  if (bot.flipped) {
    bot.flipTimer = (bot.flipTimer ?? 0) + dt;
    // AI and the srimech kick in on their own after a few seconds
    if (bot.flipTimer > (bot.isBot ? 2.2 : 4.5)) trySelfRight(bot, emit);
  }

  // Heat: cools off, melts armor while hot, cooks the battery and tires
  let heat = bot.heat ?? 0;
  if (bot.burnTimer > 0) heat = Math.min(100, heat + 4 * dt);
  heat = Math.max(0, heat - (bot.burnTimer > 0 ? 4 : 14) * dt);
  bot.heat = heat;
  if (heat > 55) {
    const meltRate = ((heat - 55) / 45) * 0.07 * dt;
    for (const z of ZONES) {
      const before = bot.meltZones[z];
      bot.meltZones[z] = Math.min(1, before + meltRate * (z === 'rear' ? 1.2 : 1));
      if (bot.armorZones[z] > 0) {
        bot.armorZones[z] = Math.max(0, bot.armorZones[z] - bot.maxArmorZone * meltRate * 0.9);
        if (bot.armorZones[z] <= 0) {
          dropArmorPlate(snapshot, bot, z);
          emit({
            type: 'melt',
            x: bot.x,
            y: bot.y + 0.5,
            z: bot.z,
            intensity: 1,
            zone: z,
            targetId: bot.id,
            callout: `${z.toUpperCase()} ARMOR MELTED AWAY!`,
          });
        }
      }
      if (before < 0.5 && bot.meltZones[z] >= 0.5) {
        emit({ type: 'melt', x: bot.x, y: bot.y + 0.5, z: bot.z, intensity: 0.7, zone: z, targetId: bot.id });
      }
    }
    for (let i = 0; i < 4; i++) {
      if (c.wheels[i] > 0) c.wheels[i] = Math.max(1, c.wheels[i] - (heat - 55) * 0.05 * dt);
    }
    c.battery = Math.max(0, c.battery - (heat - 55) * 0.04 * dt);
  }

  // Chill: thaws, freezes solid at full load
  if ((bot.frozenTimer ?? 0) > 0) {
    bot.frozenTimer = Math.max(0, (bot.frozenTimer ?? 0) - dt);
    if (bot.frozenTimer <= 0) bot.chill = 45;
  } else {
    bot.chill = Math.max(0, (bot.chill ?? 0) - 14 * dt);
  }
  const frozen = (bot.frozenTimer ?? 0) > 0;

  // Traction from drive units per side
  const unit = (h: number) => (h <= 0 ? 0 : 0.45 + 0.55 * (h / 100));
  const left = (unit(c.wheels[0]) + unit(c.wheels[2])) / 2;
  const right = (unit(c.wheels[1]) + unit(c.wheels[3])) / 2;
  const traction = Math.max(0.08, (left + right) / 2);
  const motor = 0.55 + 0.45 * (c.motor / 100);
  const battery = c.battery <= 0 ? 0.55 : 0.85 + 0.15 * (c.battery / 100);
  const inverted = bot.flipped ? 0.42 : 1;

  return {
    drive: frozen ? 0 : traction * motor * battery * inverted,
    turn: frozen ? 0 : Math.max(0.25, Math.min(1, Math.min(left, right) * 2)) * (bot.flipped ? 0.6 : 1),
    pull: (left - right) * 1.6,
    regen: c.battery <= 0 ? 0.15 : 0.5 + 0.5 * (c.battery / 100),
    frozen,
  };
}

/** Loose parts: ballistic flight, bouncing, sliding, and shoving bots around. */
export function stepDebris(snapshot: ArenaSnapshot, halfSize: number, gravity: number, dt: number, emit: Emit) {
  const list = snapshot.debris;
  if (!list || list.length === 0) return;
  const lim = halfSize - 0.4;
  for (const p of list) {
    if (!p.settled || p.y > 0.01 || Math.abs(p.vx) + Math.abs(p.vz) > 0.02) {
      p.settled = false;
      p.vy -= gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const groundY = p.kind === 'wheel' ? 0.12 : p.kind === 'armor' ? 0.05 : 0.08;
      if (p.y <= groundY) {
        p.y = groundY;
        if (p.vy < -1.5) {
          p.vy = -p.vy * 0.32;
          p.spin *= 0.6;
        } else {
          p.vy = 0;
        }
        const fr = Math.exp(-(p.kind === 'wheel' ? 1.6 : 4.2) * dt);
        p.vx *= fr;
        p.vz *= fr;
        p.spin *= Math.exp(-5 * dt);
        // Lie flat once grounded
        p.rx += (Math.round(p.rx / Math.PI) * Math.PI - p.rx) * Math.min(1, dt * 6);
        p.rz += (Math.round(p.rz / Math.PI) * Math.PI - p.rz) * Math.min(1, dt * 6);
        if (p.vy === 0 && Math.hypot(p.vx, p.vz) < 0.05) {
          p.vx = 0;
          p.vz = 0;
          p.settled = true;
        }
      } else {
        p.rx += p.spin * dt;
        p.rz += p.spin * 0.6 * dt;
      }
      p.ry += p.spin * 0.3 * dt;
      if (Math.abs(p.x) > lim) {
        p.x = Math.sign(p.x) * lim;
        p.vx *= -0.4;
      }
      if (Math.abs(p.z) > lim) {
        p.z = Math.sign(p.z) * lim;
        p.vz *= -0.4;
      }
    }
  }

  // Bot vs debris: parts are real obstacles that get shoved and slow bots down
  for (const b of snapshot.bots) {
    if (b.y > 1.2) continue;
    const br = BOT_RADIUS * (b.scale || 1) * 0.82;
    for (const p of list) {
      if (p.y > 0.9 || p.sourceId === b.id && !p.settled) continue;
      const dx = p.x - b.x;
      const dz = p.z - b.z;
      const d = Math.hypot(dx, dz);
      const minD = br + p.radius;
      if (d >= minD || d < 0.0001) continue;
      const nx = dx / d;
      const nz = dz / d;
      const overlap = minD - d;
      const botMass = 4 * Math.pow(b.scale || 1, 2);
      const total = botMass + p.mass;
      b.x -= nx * overlap * (p.mass / total);
      b.z -= nz * overlap * (p.mass / total);
      p.x += nx * overlap * (botMass / total);
      p.z += nz * overlap * (botMass / total);
      const rel = (b.vx - p.vx) * nx + (b.vz - p.vz) * nz;
      if (rel > 0) {
        const j = ((1 + 0.25) * rel) / (1 / botMass + 1 / p.mass);
        b.vx -= (j / botMass) * nx;
        b.vz -= (j / botMass) * nz;
        p.vx += (j / p.mass) * nx;
        p.vz += (j / p.mass) * nz;
        p.settled = false;
        p.spin += rel * 0.8;
        // Driving into a part jolts the chassis
        b.pitch -= Math.min(0.22, rel * 0.03 * p.mass);
        b.roll += (Math.random() - 0.5) * Math.min(0.2, rel * 0.03);
        if (rel > 3.5 && p.mass > 0.8) {
          p.vy = Math.max(p.vy, rel * 0.35);
          emit({ type: 'debris_hit', x: p.x, y: 0.3, z: p.z, intensity: Math.min(1.2, rel / 6), targetId: b.id });
        }
      }
    }
  }

  // Debris vs debris (cheap pairwise; list is capped)
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.y > 0.6) continue;
    for (let k = i + 1; k < list.length; k++) {
      const c = list[k];
      if (c.y > 0.6) continue;
      const dx = c.x - a.x;
      const dz = c.z - a.z;
      const d = Math.hypot(dx, dz);
      const minD = (a.radius + c.radius) * 0.85;
      if (d >= minD || d < 0.0001) continue;
      const push = (minD - d) / 2;
      a.x -= (dx / d) * push;
      a.z -= (dz / d) * push;
      c.x += (dx / d) * push;
      c.z += (dz / d) * push;
    }
  }
}
