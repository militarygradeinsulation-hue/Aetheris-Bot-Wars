import {
  ARENA_CATALOG,
  type ArenaId,
  type ArenaSnapshot,
  type ArmorZones,
  type BotConfig,
  type BotPhysicsState,
  type BotWeightClass,
  type CombatEvent,
  type DamageKind,
  type DestructibleProp,
  type GameMode,
  type HazardState,
  type PlayerInputState,
  type SkillTree,
  WEAPON_CATALOG,
  type WeaponId,
  computeBotStats,
  getBotChassisStyles,
  getBotWeapons,
} from './types.ts';

const BASE_BOT_RADIUS = 1.15;
const GRAVITY = 28;

export interface BotRosterTemplate {
  id: string;
  name: string;
  clanTag: string;
  botLevel?: number;
  weightClassOverride?: BotWeightClass;
  scaleOverride?: number;
  hpMult?: number;
  speedMult?: number;
  dmgMult?: number;
  config: BotConfig;
  skills: SkillTree;
  isBot: boolean;
  team: number;
}

export interface RivalArchetypePreset {
  name: string;
  clanTag: string;
  botLevel: number;
  weightClass: BotWeightClass;
  scale: number;
  hpMult: number;
  speedMult: number;
  dmgMult: number;
  config: BotConfig;
}

// Distinct bot tiers/levels: fast nimble strikers (must hit multiple times), balanced middleweights, slow heavy juggernauts, and Titan bosses
export const AI_RIVAL_PRESETS: RivalArchetypePreset[] = [
  {
    name: 'Volt Wasp',
    clanTag: 'VOLT',
    botLevel: 1,
    weightClass: 'Lightweight',
    scale: 0.74,
    hpMult: 0.85,
    speedMult: 1.2,
    dmgMult: 0.74,
    config: {
      name: 'Volt Wasp',
      chassis: 'micro',
      armor: 'kevlar',
      weapon: 'sawblade',
      wheelLayout: 'rear_trike',
      drive: 'turbo',
      primaryColor: '#1D4ED8',
      accentColor: '#60A5FA',
    },
  },
  {
    name: 'Torch Mantis',
    clanTag: 'APEX',
    botLevel: 2,
    weightClass: 'Lightweight',
    scale: 0.96,
    hpMult: 0.92,
    speedMult: 1.12,
    dmgMult: 0.82,
    config: {
      name: 'Torch Mantis',
      chassis: 'tripod',
      armor: 'kevlar',
      weapon: 'flame',
      weapons: ['flame', 'sawblade'],
      wheelLayout: 'outboard',
      drive: 'mecanum',
      primaryColor: '#D97706',
      accentColor: '#FBBF24',
    },
  },
  {
    name: 'Gyro Saucer',
    clanTag: 'APEX',
    botLevel: 3,
    weightClass: 'Middleweight',
    scale: 1.08,
    hpMult: 1.05,
    speedMult: 1.02,
    dmgMult: 1.0,
    config: {
      name: 'Gyro Saucer',
      chassis: 'ufo',
      armor: 'titanium',
      weapon: 'hbar',
      weapons: ['hbar', 'flame'],
      wheelLayout: '4wd_tucked',
      drive: 'omni',
      primaryColor: '#B91C1C',
      accentColor: '#F87171',
    },
  },
  {
    name: 'Pincer Jack',
    clanTag: 'CRYO',
    botLevel: 3,
    weightClass: 'Middleweight',
    scale: 1.12,
    hpMult: 1.04,
    speedMult: 0.98,
    dmgMult: 1.0,
    config: {
      name: 'Pincer Jack',
      chassis: 'claw',
      armor: 'ceramic',
      weapon: 'flipper',
      weapons: ['flipper', 'vspinner'],
      wheelLayout: 'outboard',
      drive: 'omni',
      primaryColor: '#047857',
      accentColor: '#34D399',
    },
  },
  {
    name: 'Obelisk Siege',
    clanTag: 'IRON',
    botLevel: 4,
    weightClass: 'Heavyweight',
    scale: 1.0,
    hpMult: 1.38,
    speedMult: 0.8,
    dmgMult: 1.25,
    config: {
      name: 'Obelisk Siege',
      chassis: 'monolith',
      chassisStyles: ['monolith', 'hex'],
      armor: 'steel',
      weapon: 'hammer',
      weapons: ['hammer', 'sawblade'],
      wheelLayout: '6wd_inline',
      drive: 'heavy_torque',
      primaryColor: '#334155',
      accentColor: '#F59E0B',
    },
  },
  {
    name: 'Titan Behemoth',
    clanTag: 'IRON',
    botLevel: 5,
    weightClass: 'Titan',
    scale: 1.32,
    hpMult: 1.62,
    speedMult: 0.7,
    dmgMult: 1.36,
    config: {
      name: 'Titan Behemoth',
      chassis: 'behemoth',
      chassisStyles: ['behemoth', 'rammer'],
      armor: 'steel',
      weapon: 'vspinner',
      weapons: ['vspinner', 'flame', 'hammer'],
      wheelLayout: '6wd_inline',
      drive: 'tracks',
      primaryColor: '#18181B',
      accentColor: '#EAB308',
    },
  },
];

let nextEventId = 1;
function makeEvent(partial: Omit<CombatEvent, 'id'>): CombatEvent {
  return {
    id: nextEventId++,
    ...partial,
  };
}

export function createInitialSnapshot(
  mode: GameMode,
  arenaId: ArenaId,
  roster: BotRosterTemplate[],
  durationSeconds = 180,
): ArenaSnapshot {
  const spawnPositions: Array<[number, number, number]> = [
    [-10, 10, Math.PI * 0.75],
    [10, -10, -Math.PI * 0.25],
    [-10, -10, Math.PI * 0.25],
    [10, 10, -Math.PI * 0.75],
  ];

  const bots: BotPhysicsState[] = roster.map((entry, idx) => {
    const stats = computeBotStats(entry.config, entry.skills);
    const botWeapons = getBotWeapons(entry.config);
    const spawn = spawnPositions[idx % spawnPositions.length];
    const scaledHp = Math.round(stats.maxHp * (entry.hpMult ?? 1));
    return {
      id: entry.id,
      name: entry.name,
      clanTag: entry.clanTag,
      botLevel: entry.botLevel ?? 1,
      weightClass: entry.weightClassOverride ?? stats.weightClass,
      scale: entry.scaleOverride ?? stats.bodyScale,
      config: {
        ...entry.config,
        chassisStyles: getBotChassisStyles(entry.config),
        weapons: botWeapons,
        wheelLayout: entry.config.wheelLayout || '4wd_wide',
      },
      skills: entry.skills,
      x: spawn[0],
      y: 0,
      z: spawn[1],
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: spawn[2],
      angularVel: 0,
      pitch: 0,
      roll: 0,
      hp: scaledHp,
      maxHp: scaledHp,
      energy: stats.maxEnergy,
      maxEnergy: stats.maxEnergy,
      armorZones: {
        front: stats.armorZoneHp,
        left: stats.armorZoneHp,
        right: stats.armorZoneHp,
        rear: stats.armorZoneHp,
      },
      maxArmorZone: stats.armorZoneHp,
      weaponSpin: 0,
      weaponAngle: 0,
      weaponActive: false,
      weaponCooldown: 0,
      weaponSpins: botWeapons.map(() => 0),
      weaponAngles: botWeapons.map(() => 0),
      weaponActives: botWeapons.map(() => false),
      weaponCooldowns: botWeapons.map(() => 0),
      boostCooldown: 0,
      overdriveTimer: 0,
      burnTimer: 0,
      collisionDmgCooldown: 0,
      flameDmgCooldown: 0,
      burnTickTimer: 0,
      isDead: false,
      hitsDealt: 0,
      damageDealt: 0,
      kos: 0,
      isBot: entry.isBot,
      team: entry.team,
    };
  });

  const props: DestructibleProp[] = [
    { id: 'pillar_nw', kind: 'pillar', x: -6.2, y: 0, z: -6.2, radius: 1.05, hp: 75, maxHp: 75, destroyed: false },
    { id: 'pillar_ne', kind: 'pillar', x: 6.2, y: 0, z: -6.2, radius: 1.05, hp: 75, maxHp: 75, destroyed: false },
    { id: 'pillar_sw', kind: 'pillar', x: -6.2, y: 0, z: 6.2, radius: 1.05, hp: 75, maxHp: 75, destroyed: false },
    { id: 'pillar_se', kind: 'pillar', x: 6.2, y: 0, z: 6.2, radius: 1.05, hp: 75, maxHp: 75, destroyed: false },
    { id: 'barrel_n', kind: 'barrel', x: 0, y: 0, z: -9.5, radius: 0.72, hp: 20, maxHp: 20, destroyed: false },
    { id: 'barrel_s', kind: 'barrel', x: 0, y: 0, z: 9.5, radius: 0.72, hp: 20, maxHp: 20, destroyed: false },
    { id: 'barrel_w', kind: 'barrel', x: -9.5, y: 0, z: 0, radius: 0.72, hp: 20, maxHp: 20, destroyed: false },
    { id: 'barrel_e', kind: 'barrel', x: 9.5, y: 0, z: 0, radius: 0.72, hp: 20, maxHp: 20, destroyed: false },
    { id: 'crate_1', kind: 'crate', x: -3.2, y: 0, z: 0, radius: 0.85, hp: 24, maxHp: 24, destroyed: false },
    { id: 'crate_2', kind: 'crate', x: 3.2, y: 0, z: 0, radius: 0.85, hp: 24, maxHp: 24, destroyed: false },
    { id: 'crate_3', kind: 'crate', x: 0, y: 0, z: -3.2, radius: 0.85, hp: 24, maxHp: 24, destroyed: false },
    { id: 'crate_4', kind: 'crate', x: 0, y: 0, z: 3.2, radius: 0.85, hp: 24, maxHp: 24, destroyed: false },
  ];

  const effectiveDuration = mode === 'practice' ? 300 : Math.max(60, Math.min(600, durationSeconds));
  const tier2Unlock = mode === 'practice' ? 8 : Math.min(26, Math.round(effectiveDuration * 0.2));
  const tier3Unlock = mode === 'practice' ? 16 : Math.min(54, Math.round(effectiveDuration * 0.44));

  const hazards: HazardState[] =
    arenaId === 'foundry'
      ? [
          { id: 'saw_1', kind: 'saw', x: -4.2, z: 0, radius: 1.45, active: true, warning: false, phase: 0, unlockAt: 0 },
          { id: 'saw_2', kind: 'saw', x: 4.2, z: 0, radius: 1.45, active: true, warning: false, phase: Math.PI, unlockAt: 0 },
          { id: 'flip_c', kind: 'flipper_pad', x: 0, z: 0, radius: 1.65, active: false, warning: false, phase: 0, unlockAt: 0, cyclePeriod: 5.5, warningDuration: 0.9, activeDuration: 0.5 },
          { id: 'crusher_n', kind: 'crusher', x: 0, z: -6.2, radius: 1.85, active: false, warning: false, phase: 2.0, unlockAt: tier2Unlock, cyclePeriod: 11.5, warningDuration: 1.8, activeDuration: 1.0, crusherY: 1 },
          { id: 'crusher_s', kind: 'crusher', x: 0, z: 6.2, radius: 1.85, active: false, warning: false, phase: 7.75, unlockAt: tier2Unlock, cyclePeriod: 11.5, warningDuration: 1.8, activeDuration: 1.0, crusherY: 1 },
          { id: 'sblade_nw', kind: 'spinner_blade', x: -3.8, z: -3.8, radius: 1.15, armLength: 2.85, active: false, warning: false, phase: 1.0, unlockAt: tier3Unlock, cyclePeriod: 10.5, warningDuration: 1.5, activeDuration: 5.4, sweepAngle: 0 },
          { id: 'sblade_se', kind: 'spinner_blade', x: 3.8, z: 3.8, radius: 1.15, armLength: 2.85, active: false, warning: false, phase: 6.25, unlockAt: tier3Unlock, cyclePeriod: 10.5, warningDuration: 1.5, activeDuration: 5.4, sweepAngle: Math.PI * 0.5 },
        ]
      : arenaId === 'cryo'
        ? [
            { id: 'flip_1', kind: 'flipper_pad', x: -4.5, z: 4.5, radius: 1.65, active: false, warning: false, phase: 0, unlockAt: 0, cyclePeriod: 4.8, warningDuration: 0.9, activeDuration: 0.5 },
            { id: 'flip_2', kind: 'flipper_pad', x: 4.5, z: -4.5, radius: 1.65, active: false, warning: false, phase: 2.4, unlockAt: 0, cyclePeriod: 4.8, warningDuration: 0.9, activeDuration: 0.5 },
            { id: 'saw_c', kind: 'saw', x: 0, z: 0, radius: 1.55, active: true, warning: false, phase: 0, unlockAt: 0 },
            { id: 'crusher_n', kind: 'crusher', x: 0, z: -6.2, radius: 1.85, active: false, warning: false, phase: 1.5, unlockAt: tier2Unlock, cyclePeriod: 11.5, warningDuration: 1.8, activeDuration: 1.0, crusherY: 1 },
            { id: 'crusher_s', kind: 'crusher', x: 0, z: 6.2, radius: 1.85, active: false, warning: false, phase: 7.25, unlockAt: tier2Unlock, cyclePeriod: 11.5, warningDuration: 1.8, activeDuration: 1.0, crusherY: 1 },
            { id: 'sblade_nw', kind: 'spinner_blade', x: -3.8, z: -3.8, radius: 1.15, armLength: 2.85, active: false, warning: false, phase: 0.8, unlockAt: tier3Unlock, cyclePeriod: 10.5, warningDuration: 1.5, activeDuration: 5.4, sweepAngle: 0 },
            { id: 'sblade_se', kind: 'spinner_blade', x: 3.8, z: 3.8, radius: 1.15, armLength: 2.85, active: false, warning: false, phase: 6.05, unlockAt: tier3Unlock, cyclePeriod: 10.5, warningDuration: 1.5, activeDuration: 5.4, sweepAngle: Math.PI * 0.5 },
          ]
        : arenaId === 'colosseum'
          ? [
              { id: 'flip_c', kind: 'flipper_pad', x: 0, z: 0, radius: 1.75, active: false, warning: false, phase: 0.4, unlockAt: 0, cyclePeriod: 5.2, warningDuration: 0.9, activeDuration: 0.5 },
              { id: 'saw_nw', kind: 'saw', x: -5.2, z: -5.2, radius: 1.45, active: true, warning: false, phase: 0, unlockAt: 0 },
              { id: 'saw_se', kind: 'saw', x: 5.2, z: 5.2, radius: 1.45, active: true, warning: false, phase: Math.PI, unlockAt: 0 },
              { id: 'crusher_n', kind: 'crusher', x: 0, z: -6.2, radius: 1.85, active: false, warning: false, phase: 2.2, unlockAt: tier2Unlock, cyclePeriod: 11.5, warningDuration: 1.8, activeDuration: 1.0, crusherY: 1 },
              { id: 'crusher_s', kind: 'crusher', x: 0, z: 6.2, radius: 1.85, active: false, warning: false, phase: 7.95, unlockAt: tier2Unlock, cyclePeriod: 11.5, warningDuration: 1.8, activeDuration: 1.0, crusherY: 1 },
              { id: 'sblade_sw', kind: 'spinner_blade', x: -4.0, z: 4.0, radius: 1.15, armLength: 2.85, active: false, warning: false, phase: 1.2, unlockAt: tier3Unlock, cyclePeriod: 10.5, warningDuration: 1.5, activeDuration: 5.4, sweepAngle: 0 },
              { id: 'sblade_ne', kind: 'spinner_blade', x: 4.0, z: -4.0, radius: 1.15, armLength: 2.85, active: false, warning: false, phase: 6.45, unlockAt: tier3Unlock, cyclePeriod: 10.5, warningDuration: 1.5, activeDuration: 5.4, sweepAngle: Math.PI * 0.5 },
            ]
          : [
              { id: 'emp_c', kind: 'emp_ring', x: 0, z: 0, radius: 2.9, active: false, warning: false, phase: 0, unlockAt: 0, cyclePeriod: 6.0, warningDuration: 1.1, activeDuration: 1.6 },
              { id: 'saw_n', kind: 'saw', x: 0, z: -6.5, radius: 1.4, active: true, warning: false, phase: 0.5, unlockAt: 0 },
              { id: 'saw_s', kind: 'saw', x: 0, z: 6.5, radius: 1.4, active: true, warning: false, phase: 2.1, unlockAt: 0 },
              { id: 'crusher_w', kind: 'crusher', x: -6.2, z: 0, radius: 1.85, active: false, warning: false, phase: 1.8, unlockAt: tier2Unlock, cyclePeriod: 11.5, warningDuration: 1.8, activeDuration: 1.0, crusherY: 1 },
              { id: 'crusher_e', kind: 'crusher', x: 6.2, z: 0, radius: 1.85, active: false, warning: false, phase: 7.55, unlockAt: tier2Unlock, cyclePeriod: 11.5, warningDuration: 1.8, activeDuration: 1.0, crusherY: 1 },
              { id: 'sblade_nw', kind: 'spinner_blade', x: -3.6, z: -3.6, radius: 1.15, armLength: 2.85, active: false, warning: false, phase: 0.9, unlockAt: tier3Unlock, cyclePeriod: 10.5, warningDuration: 1.5, activeDuration: 5.4, sweepAngle: 0 },
              { id: 'sblade_se', kind: 'spinner_blade', x: 3.6, z: 3.6, radius: 1.15, armLength: 2.85, active: false, warning: false, phase: 6.15, unlockAt: tier3Unlock, cyclePeriod: 10.5, warningDuration: 1.5, activeDuration: 5.4, sweepAngle: Math.PI * 0.5 },
            ];

  return {
    tick: 0,
    mode,
    arenaId,
    timeRemaining: effectiveDuration,
    durationSeconds: effectiveDuration,
    elapsedTime: 0,
    escalationStage: 1,
    finishReason: undefined,
    phase: mode === 'practice' ? 'active' : 'countdown',
    countdown: mode === 'practice' ? 0 : 2.6,
    bots,
    props,
    hazards,
    events: [],
    winnerId: null,
  };
}

function normalizeAngle(a: number): number {
  let out = a;
  while (out > Math.PI) out -= Math.PI * 2;
  while (out < -Math.PI) out += Math.PI * 2;
  return out;
}

function getHitZone(victim: BotPhysicsState, impactDirX: number, impactDirZ: number): keyof ArmorZones {
  const fx = Math.sin(victim.yaw);
  const fz = Math.cos(victim.yaw);
  const rx = Math.cos(victim.yaw);
  const rz = -Math.sin(victim.yaw);

  const inX = -impactDirX;
  const inZ = -impactDirZ;
  const frontDot = inX * fx + inZ * fz;
  const rightDot = inX * rx + inZ * rz;

  if (frontDot > 0.45) return 'front';
  if (frontDot < -0.45) return 'rear';
  return rightDot > 0 ? 'right' : 'left';
}

interface HitGeometryInfo {
  hitLocalX: number;
  hitLocalY: number;
  hitLocalZ: number;
  normalX: number;
  normalY: number;
  normalZ: number;
  force: number;
  damageKind: DamageKind;
}

function worldDirToVictimLocal(
  victim: BotPhysicsState,
  outwardWorldX: number,
  outwardWorldZ: number,
  verticalNormal = 0,
  hitHeight = 0.36,
  jitter = 0.24,
): Omit<HitGeometryInfo, 'force' | 'damageKind'> {
  const cos = Math.cos(victim.yaw);
  const sin = Math.sin(victim.yaw);
  const nx = outwardWorldX * cos - outwardWorldZ * sin;
  const nz = outwardWorldX * sin + outwardWorldZ * cos;
  const ny = verticalNormal;
  const len = Math.hypot(nx, ny, nz) || 1;
  const unx = nx / len;
  const uny = ny / len;
  const unz = nz / len;

  // Tangent jitter so repeated hits spread across the hull plates realistically
  const tx = -unz;
  const tz = unx;
  const spread = (Math.random() - 0.5) * jitter;
  const yJitter = (Math.random() - 0.5) * 0.14;

  return {
    hitLocalX: unx * 0.94 + tx * spread,
    hitLocalY: Math.max(0.18, Math.min(0.68, hitHeight + yJitter)),
    hitLocalZ: unz * 0.94 + tz * spread,
    normalX: unx,
    normalY: uny,
    normalZ: unz,
  };
}

function zoneFallbackHit(zone: keyof ArmorZones, damageKind: DamageKind, force: number): HitGeometryInfo {
  const spread = (Math.random() - 0.5) * 0.35;
  if (zone === 'front') {
    return { hitLocalX: spread, hitLocalY: 0.36, hitLocalZ: 0.95, normalX: 0, normalY: 0.2, normalZ: 0.98, force, damageKind };
  }
  if (zone === 'rear') {
    return { hitLocalX: spread, hitLocalY: 0.38, hitLocalZ: -0.95, normalX: 0, normalY: 0.15, normalZ: -0.98, force, damageKind };
  }
  if (zone === 'left') {
    return { hitLocalX: -0.94, hitLocalY: 0.36, hitLocalZ: spread, normalX: -0.98, normalY: 0.15, normalZ: 0, force, damageKind };
  }
  return { hitLocalX: 0.94, hitLocalY: 0.36, hitLocalZ: spread, normalX: 0.98, normalY: 0.15, normalZ: 0, force, damageKind };
}

function damageKindFromWeapon(weaponId?: WeaponId): DamageKind {
  if (weaponId === 'flame') return 'scorch';
  if (weaponId === 'hammer') return 'crush';
  if (weaponId === 'vspinner' || weaponId === 'hbar' || weaponId === 'sawblade') return 'blade';
  return 'kinetic';
}

function applyDamage(
  victim: BotPhysicsState,
  attacker: BotPhysicsState | null,
  rawDamage: number,
  zone: keyof ArmorZones,
  events: CombatEvent[],
  isWeaponCrit = false,
  eventTypeOverride?: CombatEvent['type'],
  weaponId?: WeaponId,
  hitInfo?: Partial<HitGeometryInfo>,
) {
  if (victim.isDead) return 0;

  const stats = computeBotStats(victim.config, victim.skills);
  let mult = 1.0;

  if (zone === 'front') {
    mult *= 1 - stats.frontDeflect;
  } else if (zone === 'rear') {
    mult *= 1.28;
  } else {
    mult *= 1.1;
  }

  const zoneArmor = victim.armorZones[zone];
  if (zoneArmor <= 0) {
    mult *= 1.2;
  }

  const finalDamage = Math.max(2, Math.round(rawDamage * mult));
  const dmgKind: DamageKind =
    hitInfo?.damageKind ?? (eventTypeOverride === 'flame' ? 'scorch' : damageKindFromWeapon(weaponId));
  const impactForce = hitInfo?.force ?? Math.max(2, finalDamage * 0.45);
  const fallbackGeo = zoneFallbackHit(zone, dmgKind, impactForce);
  const hx = hitInfo?.hitLocalX ?? fallbackGeo.hitLocalX;
  const hy = hitInfo?.hitLocalY ?? fallbackGeo.hitLocalY;
  const hz = hitInfo?.hitLocalZ ?? fallbackGeo.hitLocalZ;
  const nx = hitInfo?.normalX ?? fallbackGeo.normalX;
  const ny = hitInfo?.normalY ?? fallbackGeo.normalY;
  const nz = hitInfo?.normalZ ?? fallbackGeo.normalZ;

  if (zoneArmor > 0) {
    const nextZone = Math.max(0, zoneArmor - finalDamage * 0.85);
    victim.armorZones[zone] = nextZone;
    if (nextZone === 0) {
      events.push(
        makeEvent({
          type: 'armor_break',
          x: victim.x,
          y: victim.y + 0.6,
          z: victim.z,
          intensity: 1.0,
          force: impactForce,
          damageKind: dmgKind,
          hitLocalX: hx,
          hitLocalY: hy,
          hitLocalZ: hz,
          normalX: nx,
          normalY: ny,
          normalZ: nz,
          zone,
          weapon: weaponId,
          targetId: victim.id,
          color: victim.config.primaryColor,
        }),
      );
    }
  }

  victim.hp = Math.max(0, victim.hp - finalDamage);

  if (attacker) {
    attacker.hitsDealt += 1;
    attacker.damageDealt += finalDamage;
  }

  events.push(
    makeEvent({
      type: eventTypeOverride ?? (zone === 'rear' || isWeaponCrit ? 'crit' : 'hit'),
      x: victim.x,
      y: victim.y + 0.55,
      z: victim.z,
      intensity: Math.min(2.0, finalDamage / 16),
      force: impactForce,
      damageKind: dmgKind,
      hitLocalX: hx,
      hitLocalY: hy,
      hitLocalZ: hz,
      normalX: nx,
      normalY: ny,
      normalZ: nz,
      zone,
      weapon: weaponId,
      targetId: victim.id,
      sourceId: attacker?.id,
    }),
  );

  if (victim.hp <= 0) {
    victim.isDead = true;
    victim.vx *= 0.4;
    victim.vz *= 0.4;
    victim.vy = 5.6;
    victim.angularVel += (Math.random() - 0.5) * 6;
    if (attacker) attacker.kos += 1;
    events.push(
      makeEvent({
        type: 'ko',
        x: victim.x,
        y: victim.y + 0.8,
        z: victim.z,
        intensity: 1.6,
        force: Math.max(10, impactForce),
        damageKind: 'scorch',
        hitLocalX: 0,
        hitLocalY: 0.55,
        hitLocalZ: 0,
        normalX: 0,
        normalY: 1,
        normalZ: 0,
        targetId: victim.id,
        sourceId: attacker?.id,
      }),
    );
  }

  return finalDamage;
}

export function computeAiInput(
  bot: BotPhysicsState,
  snapshot: ArenaSnapshot,
  difficulty = 0.85,
): PlayerInputState {
  if (bot.isDead) {
    return { throttle: 0, steer: 0, fireWeapon: false, boost: false, overdrive: false };
  }

  const enemies = snapshot.bots.filter((b) => !b.isDead && b.id !== bot.id && b.team !== bot.team);
  if (enemies.length === 0) {
    return { throttle: 0, steer: 0, fireWeapon: false, boost: false, overdrive: false };
  }

  let targetX = enemies[0].x;
  let targetZ = enemies[0].z;
  let minDist = Infinity;
  for (const e of enemies) {
    const d = Math.hypot(e.x - bot.x, e.z - bot.z);
    if (d < minDist) {
      minDist = d;
      targetX = e.x;
      targetZ = e.z;
    }
  }

  if (bot.hp < bot.maxHp * 0.52) {
    for (const p of snapshot.props) {
      if (!p.destroyed && p.kind === 'pickup_repair') {
        const d = Math.hypot(p.x - bot.x, p.z - bot.z);
        if (d < 14) {
          targetX = p.x;
          targetZ = p.z;
          break;
        }
      }
    }
  }

  for (const h of snapshot.hazards) {
    if (!h.active && !h.warning) continue;
    const dx = bot.x - h.x;
    const dz = bot.z - h.z;
    const dist = Math.hypot(dx, dz);
    const dangerRadius = h.kind === 'spinner_blade' ? (h.armLength ?? 2.85) + 1.4 : h.radius + 1.9;
    if (dist < dangerRadius && dist > 0.01) {
      targetX = bot.x + (dx / dist) * 5.5;
      targetZ = bot.z + (dz / dist) * 5.5;
    }
  }

  const desiredYaw = Math.atan2(targetX - bot.x, targetZ - bot.z);
  const diff = normalizeAngle(desiredYaw - bot.yaw);
  const steer = Math.max(-1, Math.min(1, diff * 1.75));

  const arenaHalf = ARENA_CATALOG[snapshot.arenaId].halfSize - 1.5;
  const nearWall = Math.abs(bot.x) > arenaHalf || Math.abs(bot.z) > arenaHalf;
  let throttle = Math.abs(diff) > 1.7 ? 0.35 : 0.92;
  if (nearWall && Math.abs(diff) > 1.2) {
    throttle = -0.65;
  } else if (minDist < 2.2 && bot.weaponCooldown > 0.28) {
    // Brief tactical spacing/re-angle after a strike instead of brainless nose-to-nose grinding
    throttle = -0.32;
  }
  throttle *= 0.78 + difficulty * 0.18;

  const weapons = getBotWeapons(bot.config);
  const fireWeapons = weapons.map((w) => {
    if (w === 'vspinner' || w === 'hbar' || w === 'sawblade') return minDist < 8.5;
    if (w === 'flame') return minDist < 5.0;
    return minDist < 3.9;
  });
  const fireWeapon = fireWeapons.some(Boolean);
  const boost = minDist > 5.0 && minDist < 12 && Math.abs(diff) < 0.32 && bot.energy > 55 && Math.random() < 0.025;
  const overdrive = bot.hp < bot.maxHp * 0.5 && bot.energy > 65 && bot.overdriveTimer <= 0 && Math.random() < 0.025;

  return { throttle, steer, fireWeapon, fireWeapons, boost, overdrive };
}

export function stepArenaPhysics(
  snapshot: ArenaSnapshot,
  inputsByBotId: Record<string, PlayerInputState>,
  dt: number,
  aiDifficulty = 0.85,
): CombatEvent[] {
  const clampedDt = Math.min(dt, 0.05);
  const events: CombatEvent[] = [];
  const arena = ARENA_CATALOG[snapshot.arenaId];
  const half = arena.halfSize - BASE_BOT_RADIUS;

  snapshot.tick += 1;

  if (snapshot.phase === 'countdown') {
    snapshot.countdown = Math.max(0, snapshot.countdown - clampedDt);
    if (snapshot.countdown <= 0) {
      snapshot.phase = 'active';
    }
    snapshot.events = [];
    return events;
  }

  if (snapshot.phase === 'finished') {
    snapshot.events = [];
    return events;
  }

  snapshot.elapsedTime = (snapshot.elapsedTime ?? 0) + clampedDt;
  if (snapshot.mode !== 'practice') {
    snapshot.timeRemaining = Math.max(0, snapshot.timeRemaining - clampedDt);
  }

  const elapsed = snapshot.elapsedTime;
  const totalDur = snapshot.durationSeconds || 180;
  const tier2Unlock = snapshot.mode === 'practice' ? 8 : Math.min(26, Math.round(totalDur * 0.2));
  const tier3Unlock = snapshot.mode === 'practice' ? 16 : Math.min(54, Math.round(totalDur * 0.44));
  const escalation = elapsed >= tier3Unlock ? 3 : elapsed >= tier2Unlock ? 2 : 1;
  snapshot.escalationStage = escalation;
  const cadenceMult = 1 + (escalation - 1) * 0.22;

  const freshlySlammedCrushers = new Set<string>();

  for (const h of snapshot.hazards) {
    h.tickCooldown = Math.max(0, (h.tickCooldown ?? 0) - clampedDt);
    h.intensityLevel = escalation;
    const unlockAt = h.unlockAt ?? 0;

    if (elapsed < unlockAt) {
      h.active = false;
      h.warning = unlockAt - elapsed <= 2.2;
      if (h.kind === 'crusher') h.crusherY = 1;
      continue;
    }

    const activeElapsed = elapsed - unlockAt;
    const wasWarning = Boolean(h.warning);
    const wasActive = h.active;

    if (h.kind === 'saw') {
      h.phase = activeElapsed * cadenceMult + (h.phase % (Math.PI * 2)) * 0;
      const sawCycle = activeElapsed * cadenceMult + (h.id.includes('2') || h.id.includes('se') ? Math.PI : h.id.includes('s') ? 1.6 : 0);
      h.active = Math.sin(sawCycle * 1.15) > -0.35;
      h.warning = !h.active && Math.sin((sawCycle + 0.65) * 1.15) > -0.35;
    } else if (h.kind === 'flipper_pad') {
      const period = (h.cyclePeriod ?? 5.0) / cadenceMult;
      const warnDur = h.warningDuration ?? 0.85;
      const activeDur = h.activeDuration ?? 0.5;
      const cyclePos = (activeElapsed + h.phase) % period;
      h.warning = cyclePos >= period - warnDur - activeDur && cyclePos < period - activeDur;
      h.active = cyclePos >= period - activeDur;
    } else if (h.kind === 'emp_ring') {
      const period = (h.cyclePeriod ?? 6.0) / cadenceMult;
      const warnDur = h.warningDuration ?? 1.1;
      const activeDur = h.activeDuration ?? 1.6;
      const cyclePos = (activeElapsed + h.phase) % period;
      h.warning = cyclePos >= period - warnDur - activeDur && cyclePos < period - activeDur;
      h.active = cyclePos >= period - activeDur;
    } else if (h.kind === 'crusher') {
      const period = (h.cyclePeriod ?? 11.5) / cadenceMult;
      const warnDur = h.warningDuration ?? 1.8;
      const slamDur = h.activeDuration ?? 1.0;
      const cyclePos = (activeElapsed + h.phase) % period;
      const warnStart = period - warnDur - slamDur;
      const slamStart = period - slamDur;

      if (cyclePos < warnStart) {
        h.warning = false;
        h.active = false;
        h.crusherY = 1;
      } else if (cyclePos < slamStart) {
        h.warning = true;
        h.active = false;
        const t = (cyclePos - warnStart) / Math.max(0.1, warnDur);
        h.crusherY = 0.92 - t * 0.18;
      } else {
        const slamElapsed = cyclePos - slamStart;
        h.warning = false;
        if (slamElapsed < 0.13) {
          h.crusherY = Math.max(0, 0.74 * (1 - slamElapsed / 0.13));
          h.active = slamElapsed >= 0.08;
        } else if (slamElapsed < slamDur - 0.24) {
          h.crusherY = 0;
          h.active = true;
        } else {
          h.crusherY = Math.min(1, (slamElapsed - (slamDur - 0.24)) / 0.24);
          h.active = false;
        }
        if (!wasActive && h.active) {
          freshlySlammedCrushers.add(h.id);
          events.push(
            makeEvent({
              type: 'crusher_slam',
              x: h.x,
              y: 0.25,
              z: h.z,
              intensity: 1.3 + (escalation - 1) * 0.2,
              damageKind: 'crush',
            }),
          );
        }
      }
    } else if (h.kind === 'spinner_blade') {
      const period = (h.cyclePeriod ?? 10.5) / cadenceMult;
      const warnDur = h.warningDuration ?? 1.5;
      const activeDur = period * (escalation >= 3 ? 0.62 : 0.52);
      const cyclePos = (activeElapsed + h.phase) % period;
      const warnStart = period - warnDur - activeDur;
      const activeStart = period - activeDur;

      if (cyclePos < warnStart) {
        h.warning = false;
        h.active = false;
      } else if (cyclePos < activeStart) {
        h.warning = true;
        h.active = false;
      } else {
        h.warning = false;
        h.active = true;
        h.sweepAngle = ((h.sweepAngle ?? 0) + clampedDt * (4.4 + escalation * 1.15)) % (Math.PI * 2);
      }
    }

    if (!wasWarning && h.warning && (h.kind === 'crusher' || h.kind === 'spinner_blade')) {
      events.push(makeEvent({ type: 'hazard_warn', x: h.x, y: 0.5, z: h.z, intensity: 0.7 }));
    }
  }

  for (const bot of snapshot.bots) {
    const stats = computeBotStats(bot.config, bot.skills);
    // Weight class speed & damage modifiers for tiered AI/player balance
    const classSpeedMult =
      bot.weightClass === 'Titan' ? 0.72 : bot.weightClass === 'Heavyweight' ? 0.85 : bot.weightClass === 'Lightweight' ? 1.12 : 1.0;
    const classDmgMult =
      bot.weightClass === 'Titan' ? 1.24 : bot.weightClass === 'Heavyweight' ? 1.14 : bot.weightClass === 'Lightweight' ? 0.8 : 1.0;

    const input = bot.isBot
      ? computeAiInput(bot, snapshot, aiDifficulty)
      : inputsByBotId[bot.id] ?? { throttle: 0, steer: 0, fireWeapon: false, boost: false, overdrive: false };

    bot.weaponCooldown = Math.max(0, bot.weaponCooldown - clampedDt);
    bot.boostCooldown = Math.max(0, bot.boostCooldown - clampedDt);
    bot.overdriveTimer = Math.max(0, bot.overdriveTimer - clampedDt);
    bot.collisionDmgCooldown = Math.max(0, (bot.collisionDmgCooldown ?? 0) - clampedDt);
    bot.flameDmgCooldown = Math.max(0, (bot.flameDmgCooldown ?? 0) - clampedDt);
    bot.burnTickTimer = Math.max(0, (bot.burnTickTimer ?? 0) - clampedDt);

    const botWeapons = getBotWeapons(bot.config);
    if (!bot.weaponSpins || bot.weaponSpins.length !== botWeapons.length) {
      bot.weaponSpins = botWeapons.map((_, idx) => bot.weaponSpins?.[idx] ?? 0);
    }
    if (!bot.weaponAngles || bot.weaponAngles.length !== botWeapons.length) {
      bot.weaponAngles = botWeapons.map((_, idx) => bot.weaponAngles?.[idx] ?? 0);
    }
    if (!bot.weaponActives || bot.weaponActives.length !== botWeapons.length) {
      bot.weaponActives = botWeapons.map((_, idx) => bot.weaponActives?.[idx] ?? false);
    }
    if (!bot.weaponCooldowns || bot.weaponCooldowns.length !== botWeapons.length) {
      bot.weaponCooldowns = botWeapons.map((_, idx) => bot.weaponCooldowns?.[idx] ?? 0);
    }
    for (let s = 0; s < botWeapons.length; s++) {
      bot.weaponCooldowns[s] = Math.max(0, (bot.weaponCooldowns[s] ?? 0) - clampedDt);
    }

    // Thermal burn damage over time from Plasma Flame attacks (frame-rate independent 0.65s ticks)
    if (!bot.isDead && bot.burnTimer > 0) {
      bot.burnTimer = Math.max(0, bot.burnTimer - clampedDt);
      if ((bot.burnTickTimer ?? 0) <= 0) {
        bot.burnTickTimer = 0.65;
        applyDamage(bot, null, 3, 'rear', events, false, 'flame');
      }
    }

    const rightingRate = 5.5 + bot.skills.gyroStabilizer * 1.1;
    bot.pitch *= Math.exp(-rightingRate * clampedDt);
    bot.roll *= Math.exp(-rightingRate * clampedDt);

    if (bot.isDead) {
      bot.vy -= GRAVITY * clampedDt;
      bot.x += bot.vx * clampedDt;
      bot.y += bot.vy * clampedDt;
      bot.z += bot.vz * clampedDt;
      if (bot.y <= 0) {
        bot.y = 0;
        bot.vy = 0;
        bot.vx *= Math.exp(-6 * clampedDt);
        bot.vz *= Math.exp(-6 * clampedDt);
      }
      bot.weaponSpin *= Math.exp(-3 * clampedDt);
      bot.weaponActive = false;
      bot.weaponSpins = bot.weaponSpins.map((sp) => sp * Math.exp(-3 * clampedDt));
      bot.weaponActives = bot.weaponActives.map(() => false);
      continue;
    }

    bot.energy = Math.min(
      bot.maxEnergy,
      bot.energy + stats.energyRegen * arena.energyRegenMult * clampedDt,
    );

    if (input.overdrive && bot.energy >= 40 && bot.overdriveTimer <= 0) {
      bot.energy -= 40;
      bot.overdriveTimer = 4.5;
      bot.hp = Math.min(bot.maxHp, bot.hp + Math.round(bot.maxHp * 0.12));
      events.push(makeEvent({ type: 'pickup', x: bot.x, y: bot.y + 0.7, z: bot.z, intensity: 0.9 }));
    }

    const overdriveMult = bot.overdriveTimer > 0 ? 1.2 : 1.0;

    // Independent per-weapon input & animation state across all equipped weapon slots
    const hasExplicitSlotArray = Array.isArray(input.fireWeapons);
    const isSlotFiring = (slotIdx: number) =>
      hasExplicitSlotArray ? Boolean(input.fireWeapons![slotIdx]) : Boolean(input.fireWeapon);

    const firedDiscreteSlots: Array<{ slotIdx: number; weaponId: WeaponId }> = [];
    let flameFiringSlotIdx = -1;

    for (let slotIdx = 0; slotIdx < botWeapons.length; slotIdx++) {
      const wId = botWeapons[slotIdx];
      const wSpec = WEAPON_CATALOG[wId];
      const slotFiring = isSlotFiring(slotIdx);
      const slotCooldownDur = Number((wSpec.cooldown * (1 - bot.skills.weaponTorque * 0.035)).toFixed(2));

      if (wId === 'vspinner' || wId === 'hbar' || wId === 'sawblade') {
        const targetSpin = slotFiring ? 24 * overdriveMult : 9;
        bot.weaponSpins[slotIdx] += (targetSpin - bot.weaponSpins[slotIdx]) * Math.min(1, clampedDt * 5);
        bot.weaponAngles[slotIdx] += bot.weaponSpins[slotIdx] * clampedDt;
        bot.weaponActives[slotIdx] = slotFiring;
        if (slotFiring && bot.energy > 1) {
          bot.energy = Math.max(0, bot.energy - 2.4 * clampedDt);
        }
      } else if (wId === 'flame') {
        const firingFlame = slotFiring && bot.energy > 3;
        bot.weaponActives[slotIdx] = firingFlame;
        bot.weaponSpins[slotIdx] = firingFlame ? 1.0 : 0;
        if (firingFlame) {
          flameFiringSlotIdx = slotIdx;
          bot.energy = Math.max(0, bot.energy - 9.5 * clampedDt);
        }
      } else {
        // Discrete strike weapons (flipper / hammer)
        if (slotFiring && bot.weaponCooldowns[slotIdx] <= 0 && bot.energy >= wSpec.energyCost) {
          bot.energy -= wSpec.energyCost;
          bot.weaponCooldowns[slotIdx] = slotCooldownDur;
          bot.weaponActives[slotIdx] = true;
          bot.weaponSpins[slotIdx] = 1.0;
          firedDiscreteSlots.push({ slotIdx, weaponId: wId });
        } else {
          bot.weaponActives[slotIdx] = false;
          bot.weaponSpins[slotIdx] = Math.max(0, bot.weaponSpins[slotIdx] - clampedDt * 2.6);
        }
      }
    }

    // Keep aggregate legacy weapon scalars synced for HUD/compatibility
    bot.weaponSpin = bot.weaponSpins[0] ?? 0;
    bot.weaponAngle = bot.weaponAngles[0] ?? 0;
    bot.weaponActive = bot.weaponActives.some(Boolean);
    bot.weaponCooldown = bot.weaponCooldowns[0] ?? 0;

    const fx = Math.sin(bot.yaw);
    const fz = Math.cos(bot.yaw);
    const steerFactor = Math.max(-1, Math.min(1, input.steer));
    const throttleFactor = Math.max(-1, Math.min(1, input.throttle));

    // Integrate physical angular momentum (from impacts/torque) + tire rotational damping
    const rotDamp = Math.exp(-(6.5 + bot.skills.gyroStabilizer * 0.9) * clampedDt);
    bot.angularVel *= rotDamp;
    bot.yaw = normalizeAngle(bot.yaw + (steerFactor * stats.turnRate + bot.angularVel) * clampedDt);

    // Calmer, controlled Boost impulse
    if (input.boost && bot.boostCooldown <= 0 && bot.energy >= 24) {
      bot.energy -= 24;
      bot.boostCooldown = 2.4;
      const impulse = 6.2 * overdriveMult * classSpeedMult;
      bot.vx += fx * impulse;
      bot.vz += fz * impulse;
      bot.pitch = -0.1;
    }

    if (bot.y <= 0.15) {
      const driveForce = throttleFactor * stats.accel * overdriveMult * classSpeedMult;
      bot.vx += fx * driveForce * clampedDt;
      bot.vz += fz * driveForce * clampedDt;

      const rx = Math.cos(bot.yaw);
      const rz = -Math.sin(bot.yaw);
      const forwardSpeed = bot.vx * fx + bot.vz * fz;
      const lateralSpeed = bot.vx * rx + bot.vz * rz;

      const lateralGrip = arena.friction * (bot.config.drive === 'tracks' ? 1.55 : 1.05);
      const dampedLateral = lateralSpeed * Math.exp(-lateralGrip * clampedDt);
      const forwardDrag = Math.abs(throttleFactor) < 0.05 ? arena.friction * 1.05 : 1.05;
      const dampedForward = forwardSpeed * Math.exp(-forwardDrag * clampedDt);

      bot.vx = fx * dampedForward + rx * dampedLateral;
      bot.vz = fz * dampedForward + rz * dampedLateral;

      const speed = Math.hypot(bot.vx, bot.vz);
      const cap = stats.maxSpeed * overdriveMult * classSpeedMult;
      if (speed > cap && bot.boostCooldown < 1.8) {
        const blend = cap + (speed - cap) * Math.exp(-7 * clampedDt);
        bot.vx = (bot.vx / speed) * blend;
        bot.vz = (bot.vz / speed) * blend;
      }
    }

    bot.vy -= GRAVITY * clampedDt;
    bot.x += bot.vx * clampedDt;
    bot.y += bot.vy * clampedDt;
    bot.z += bot.vz * clampedDt;

    if (bot.y <= 0) {
      if (bot.vy < -8.5) {
        const slamDmg = Math.round((-bot.vy - 7.5) * 0.9);
        if (slamDmg > 2) {
          applyDamage(bot, null, slamDmg, 'rear', events);
        }
      }
      bot.y = 0;
      bot.vy = Math.abs(bot.vy) > 4 ? -bot.vy * 0.2 : 0;
    }

    const wallBounceHit = (outX: number, outZ: number, wallSpeed: number) => {
      if (wallSpeed > 6.2 && !bot.isDead && (bot.collisionDmgCooldown ?? 0) <= 0) {
        bot.collisionDmgCooldown = 0.3;
        const zone = getHitZone(bot, -outX, -outZ);
        const geo = worldDirToVictimLocal(bot, outX, outZ, 0.1, 0.34, 0.25);
        applyDamage(bot, null, (wallSpeed - 5.5) * 0.75, zone, events, false, undefined, undefined, {
          ...geo,
          force: wallSpeed * 1.15,
          damageKind: 'kinetic',
        });
      }
    };

    const botHalf = arena.halfSize - BASE_BOT_RADIUS * bot.scale;
    if (bot.x < -botHalf) {
      const sp = Math.abs(bot.vx);
      bot.x = -botHalf;
      bot.vx = sp * 0.6 + 1.0;
      wallBounceHit(-1, 0, sp);
    } else if (bot.x > botHalf) {
      const sp = Math.abs(bot.vx);
      bot.x = botHalf;
      bot.vx = -sp * 0.6 - 1.0;
      wallBounceHit(1, 0, sp);
    }
    if (bot.z < -botHalf) {
      const sp = Math.abs(bot.vz);
      bot.z = -botHalf;
      bot.vz = sp * 0.6 + 1.0;
      wallBounceHit(0, -1, sp);
    } else if (bot.z > botHalf) {
      const sp = Math.abs(bot.vz);
      bot.z = botHalf;
      bot.vz = -sp * 0.6 - 1.0;
      wallBounceHit(0, 1, sp);
    }

    // Flame Torch Cone Attack (frame-rate independent 0.36s ticks)
    if (flameFiringSlotIdx >= 0 && (bot.flameDmgCooldown ?? 0) <= 0) {
      bot.flameDmgCooldown = 0.36;
      events.push(
        makeEvent({
          type: 'flame',
          x: bot.x + fx * 1.8,
          y: bot.y + 0.45,
          z: bot.z + fz * 1.8,
          intensity: 0.75,
          weapon: 'flame',
        }),
      );
      const flameRange = Math.max(WEAPON_CATALOG.flame.range, stats.weaponRange);
      const flameDmg =
        WEAPON_CATALOG.flame.damage *
        (flameFiringSlotIdx === 0 ? 1.0 : 0.78) *
        (1 + bot.skills.weaponTorque * 0.075) *
        overdriveMult *
        classDmgMult;
      for (const other of snapshot.bots) {
        if (other.id === bot.id || other.isDead || other.team === bot.team) continue;
        const dx = other.x - bot.x;
        const dz = other.z - bot.z;
        const dist = Math.hypot(dx, dz);
        if (dist <= flameRange + BASE_BOT_RADIUS * other.scale && dist > 0.01) {
          const nx = dx / dist;
          const nz = dz / dist;
          const dot = nx * fx + nz * fz;
          if (dot > 0.58) {
            const zone = getHitZone(other, nx, nz);
            const geo = worldDirToVictimLocal(other, -nx, -nz, 0.2, 0.42, 0.35);
            other.burnTimer = Math.max(other.burnTimer, 2.2);
            applyDamage(other, bot, flameDmg, zone, events, false, 'flame', 'flame', {
              ...geo,
              force: 5.2,
              damageKind: 'scorch',
            });
          }
        }
      }
    }

    // Active Flipper / Hammer discrete strikes (each slot fires independently via its own button!)
    for (const { slotIdx, weaponId: strikeWeapon } of firedDiscreteSlots) {
      const strikeSpec = WEAPON_CATALOG[strikeWeapon];
      const slotDmg =
        strikeSpec.damage *
        (slotIdx === 0 ? 1.0 : 0.8) *
        (1 + bot.skills.weaponTorque * 0.075) *
        overdriveMult *
        classDmgMult;
      const slotImpBase = strikeSpec.impulse * (1 + bot.skills.weaponTorque * 0.05);

      for (const other of snapshot.bots) {
        if (other.id === bot.id || other.isDead || other.team === bot.team) continue;
        const dx = other.x - bot.x;
        const dz = other.z - bot.z;
        const dist = Math.hypot(dx, dz);
        if (dist <= strikeSpec.range + BASE_BOT_RADIUS * other.scale && dist > 0.01) {
          const nx = dx / dist;
          const nz = dz / dist;
          const toTargetDot = nx * fx + nz * fz;
          if (toTargetDot > 0.25) {
            const otherStats = computeBotStats(other.config, other.skills);
            const attackerEffMass = stats.mass * Math.pow(bot.scale, 1.35);
            const victimEffMass = otherStats.mass * Math.pow(other.scale, 1.35);
            const zone = getHitZone(other, nx, nz);

            const hitPower = (1 + slotDmg / 32) * overdriveMult * classDmgMult;
            const imp =
              (slotImpBase * hitPower * 1.15) /
              (victimEffMass * otherStats.knockbackResist);
            other.vx += nx * imp;
            other.vz += nz * imp;
            other.vy = Math.max(
              other.vy,
              (strikeSpec.lift * overdriveMult) / Math.max(0.75, victimEffMass),
            );

            const crossYaw = fx * nz - fz * nx;
            other.angularVel += crossYaw * (imp * 0.65);
            other.pitch =
              strikeWeapon === 'hammer'
                ? 0.45 / Math.max(0.7, victimEffMass)
                : -0.65 / Math.max(0.7, victimEffMass);
            other.roll = crossYaw * (0.85 / Math.max(0.7, victimEffMass));

            const recoil = (imp * 0.24 * victimEffMass) / Math.max(0.7, attackerEffMass);
            bot.vx -= nx * recoil;
            bot.vz -= nz * recoil;

            const geo =
              strikeWeapon === 'hammer'
                ? worldDirToVictimLocal(other, -nx * 0.35, -nz * 0.35, 0.92, 0.62, 0.32)
                : worldDirToVictimLocal(other, -nx, -nz, -0.15, 0.25, 0.22);

            applyDamage(
              other,
              bot,
              slotDmg,
              zone,
              events,
              true,
              undefined,
              strikeWeapon,
              {
                ...geo,
                force: Math.max(5, imp * 1.4),
                damageKind: strikeWeapon === 'hammer' ? 'crush' : 'kinetic',
              },
            );
            if (strikeWeapon === 'flipper') {
              events.push(
                makeEvent({
                  type: 'flip',
                  x: (bot.x + other.x) * 0.5,
                  y: other.y + 0.6,
                  z: (bot.z + other.z) * 0.5,
                  intensity: Math.min(1.8, imp / 5.5),
                  weapon: 'flipper',
                }),
              );
            }
          }
        }
      }
    }
  }

  // Bot-to-Bot Collisions & Continuous Rotor/Saw Power Hits
  for (let i = 0; i < snapshot.bots.length; i++) {
    for (let j = i + 1; j < snapshot.bots.length; j++) {
      const a = snapshot.bots[i];
      const b = snapshot.bots[j];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const dist = Math.hypot(dx, dz);
      const minDist = BASE_BOT_RADIUS * (a.scale + b.scale);

      if (dist < minDist && Math.abs(a.y - b.y) < 1.6 && dist > 0.0001) {
        const nx = dx / dist;
        const nz = dz / dist;
        const tx = -nz;
        const tz = nx;
        const overlap = minDist - dist;

        const statsA = computeBotStats(a.config, a.skills);
        const statsB = computeBotStats(b.config, b.skills);
        const massA = statsA.mass * Math.pow(a.scale, 1.35);
        const massB = statsB.mass * Math.pow(b.scale, 1.35);
        const totalMass = massA + massB;

        a.x -= nx * overlap * (massB / totalMass);
        a.z -= nz * overlap * (massB / totalMass);
        b.x += nx * overlap * (massA / totalMass);
        b.z += nz * overlap * (massA / totalMass);

        const rvx = b.vx - a.vx;
        const rvz = b.vz - a.vz;
        const velAlongNormal = rvx * nx + rvz * nz;
        const velAlongTangent = rvx * tx + rvz * tz;

        if (velAlongNormal < 0) {
          const restitution = 0.62;
          const impulseMag =
            (-(1 + restitution) * velAlongNormal) / (1 / massA + 1 / massB);
          a.vx -= (impulseMag / massA) * nx;
          a.vz -= (impulseMag / massA) * nz;
          b.vx += (impulseMag / massB) * nx;
          b.vz += (impulseMag / massB) * nz;

          // Tangential friction imparts realistic rotational spin on glancing hits
          const spinTransfer = Math.max(-4.5, Math.min(4.5, velAlongTangent * 0.45));
          a.angularVel -= (spinTransfer * massB) / totalMass;
          b.angularVel += (spinTransfer * massA) / totalMass;

          const impactSpeed = -velAlongNormal;
          if (impactSpeed > 3.6 && a.team !== b.team) {
            // Kinetic energy collision scaling (0.5 * reducedMass * v^2) with anti-spam cooldown
            const reducedMass = (massA * massB) / totalMass;
            const kineticEnergy = 0.5 * reducedMass * impactSpeed * impactSpeed;

            if (!a.isDead && (b.collisionDmgCooldown ?? 0) <= 0) {
              b.collisionDmgCooldown = 0.28;
              const zoneB = getHitZone(b, nx, nz);
              const ramDmgA = Math.min(11, kineticEnergy * 0.36 * (massA / massB));
              const geoB = worldDirToVictimLocal(b, -nx, -nz, 0.08, 0.36, 0.24);
              b.pitch += (Math.random() - 0.5) * Math.min(0.45, impactSpeed * 0.04);
              applyDamage(b, a, ramDmgA, zoneB, events, false, undefined, undefined, {
                ...geoB,
                force: impulseMag,
                damageKind: 'kinetic',
              });
            }
            if (!b.isDead && (a.collisionDmgCooldown ?? 0) <= 0) {
              a.collisionDmgCooldown = 0.28;
              const zoneA = getHitZone(a, -nx, -nz);
              const ramDmgB = Math.min(11, kineticEnergy * 0.36 * (massB / massA));
              const geoA = worldDirToVictimLocal(a, nx, nz, 0.08, 0.36, 0.24);
              a.pitch += (Math.random() - 0.5) * Math.min(0.45, impactSpeed * 0.04);
              applyDamage(a, b, ramDmgB, zoneA, events, false, undefined, undefined, {
                ...geoA,
                force: impulseMag,
                damageKind: 'kinetic',
              });
            }
          }
        }

        // Spinner / Blade / Saw contact engagement driven by each rotor slot's independent RPM, cooldown & force
        const weaponsA = getBotWeapons(a.config);
        const weaponsB = getBotWeapons(b.config);

        if (a.team !== b.team) {
          const afx = Math.sin(a.yaw);
          const afz = Math.cos(a.yaw);
          const aFacingB = afx * nx + afz * nz;
          if (!a.isDead && !b.isDead && aFacingB > 0.25) {
            for (let slotIdx = 0; slotIdx < weaponsA.length; slotIdx++) {
              const rotorA = weaponsA[slotIdx];
              if (rotorA !== 'vspinner' && rotorA !== 'hbar' && rotorA !== 'sawblade') continue;
              const slotCd = a.weaponCooldowns?.[slotIdx] ?? a.weaponCooldown;
              if (slotCd > 0) continue;

              const wSpec = WEAPON_CATALOG[rotorA];
              const slotCdDur = Number((wSpec.cooldown * (1 - a.skills.weaponTorque * 0.035)).toFixed(2));
              if (a.weaponCooldowns) a.weaponCooldowns[slotIdx] = slotCdDur;
              if (slotIdx === 0) a.weaponCooldown = slotCdDur;

              const slotSpin = a.weaponSpins?.[slotIdx] ?? a.weaponSpin;
              const slotActive = a.weaponActives?.[slotIdx] ?? a.weaponActive;
              const zoneB = getHitZone(b, nx, nz);
              const rpmFactor = Math.max(0.35, Math.min(1.35, slotSpin / 20));
              const closingBonus = Math.min(0.35, Math.max(0, -velAlongNormal) * 0.05);
              const powerMult = (rpmFactor + closingBonus) * (a.overdriveTimer > 0 ? 1.2 : 1.0);
              const aDmgMult =
                (a.weightClass === 'Titan'
                  ? 1.32
                  : a.weightClass === 'Heavyweight'
                    ? 1.18
                    : a.weightClass === 'Lightweight'
                      ? 0.78
                      : 1.0) * (slotIdx === 0 ? 1.0 : 0.74);

              const slotDmg = wSpec.damage * (1 + a.skills.weaponTorque * 0.075);
              const slotImp = wSpec.impulse * (1 + a.skills.weaponTorque * 0.05);
              const imp =
                (slotImp * powerMult * (massA / Math.max(0.8, massB * 0.85))) /
                statsB.knockbackResist;
              b.vx += nx * imp;
              b.vz += nz * imp;
              b.vy = Math.max(b.vy, (wSpec.lift * powerMult) / Math.max(0.75, massB));

              if (rotorA === 'hbar') {
                b.angularVel += (afx * nz - afz * nx >= 0 ? 1 : -1) * Math.min(7.5, imp * 0.85);
              }
              b.roll += (Math.random() - 0.5) * Math.min(0.85, imp * 0.1);
              b.pitch -= Math.min(0.55, wSpec.lift * 0.06);

              const recoilA = (imp * 0.28 * massB) / Math.max(0.75, massA);
              a.vx -= nx * recoilA;
              a.vz -= nz * recoilA;
              if (a.weaponSpins) a.weaponSpins[slotIdx] *= 0.62;
              if (slotIdx === 0) a.weaponSpin *= 0.62;

              const geoB = worldDirToVictimLocal(b, -nx, -nz, 0.12, 0.36, 0.26);
              applyDamage(
                b,
                a,
                slotDmg * powerMult * aDmgMult,
                zoneB,
                events,
                slotActive && rpmFactor > 0.8,
                undefined,
                rotorA,
                {
                  ...geoB,
                  force: Math.max(5, imp * 1.45),
                  damageKind: 'blade',
                },
              );
            }
          }

          const bfx = Math.sin(b.yaw);
          const bfz = Math.cos(b.yaw);
          const bFacingA = -(bfx * nx + bfz * nz);
          if (!b.isDead && !a.isDead && bFacingA > 0.25) {
            for (let slotIdx = 0; slotIdx < weaponsB.length; slotIdx++) {
              const rotorB = weaponsB[slotIdx];
              if (rotorB !== 'vspinner' && rotorB !== 'hbar' && rotorB !== 'sawblade') continue;
              const slotCd = b.weaponCooldowns?.[slotIdx] ?? b.weaponCooldown;
              if (slotCd > 0) continue;

              const wSpec = WEAPON_CATALOG[rotorB];
              const slotCdDur = Number((wSpec.cooldown * (1 - b.skills.weaponTorque * 0.035)).toFixed(2));
              if (b.weaponCooldowns) b.weaponCooldowns[slotIdx] = slotCdDur;
              if (slotIdx === 0) b.weaponCooldown = slotCdDur;

              const slotSpin = b.weaponSpins?.[slotIdx] ?? b.weaponSpin;
              const slotActive = b.weaponActives?.[slotIdx] ?? b.weaponActive;
              const zoneA = getHitZone(a, -nx, -nz);
              const rpmFactor = Math.max(0.35, Math.min(1.35, slotSpin / 20));
              const closingBonus = Math.min(0.35, Math.max(0, -velAlongNormal) * 0.05);
              const powerMult = (rpmFactor + closingBonus) * (b.overdriveTimer > 0 ? 1.2 : 1.0);
              const bDmgMult =
                (b.weightClass === 'Titan'
                  ? 1.32
                  : b.weightClass === 'Heavyweight'
                    ? 1.18
                    : b.weightClass === 'Lightweight'
                      ? 0.78
                      : 1.0) * (slotIdx === 0 ? 1.0 : 0.74);

              const slotDmg = wSpec.damage * (1 + b.skills.weaponTorque * 0.075);
              const slotImp = wSpec.impulse * (1 + b.skills.weaponTorque * 0.05);
              const imp =
                (slotImp * powerMult * (massB / Math.max(0.8, massA * 0.85))) /
                statsA.knockbackResist;
              a.vx -= nx * imp;
              a.vz -= nz * imp;
              a.vy = Math.max(a.vy, (wSpec.lift * powerMult) / Math.max(0.75, massA));

              if (rotorB === 'hbar') {
                a.angularVel += (bfx * -nz - bfz * -nx >= 0 ? 1 : -1) * Math.min(7.5, imp * 0.85);
              }
              a.roll += (Math.random() - 0.5) * Math.min(0.85, imp * 0.1);
              a.pitch -= Math.min(0.55, wSpec.lift * 0.06);

              const recoilB = (imp * 0.28 * massA) / Math.max(0.75, massB);
              b.vx += nx * recoilB;
              b.vz += nz * recoilB;
              if (b.weaponSpins) b.weaponSpins[slotIdx] *= 0.62;
              if (slotIdx === 0) b.weaponSpin *= 0.62;

              const geoA = worldDirToVictimLocal(a, nx, nz, 0.12, 0.36, 0.26);
              applyDamage(
                a,
                b,
                slotDmg * powerMult * bDmgMult,
                zoneA,
                events,
                slotActive && rpmFactor > 0.8,
                undefined,
                rotorB,
                {
                  ...geoA,
                  force: Math.max(5, imp * 1.45),
                  damageKind: 'blade',
                },
              );
            }
          }
        }
      }
    }
  }

  // Destructible Props & Pickups
  const spawnedPickups: DestructibleProp[] = [];
  for (const prop of snapshot.props) {
    if (prop.destroyed) continue;
    for (const bot of snapshot.bots) {
      if (bot.isDead) continue;
      const dx = bot.x - prop.x;
      const dz = bot.z - prop.z;
      const dist = Math.hypot(dx, dz);
      const minDist = BASE_BOT_RADIUS * bot.scale + prop.radius;
      if (dist < minDist && bot.y < 1.8 && dist > 0.001) {
        if (prop.kind === 'pickup_repair') {
          prop.destroyed = true;
          bot.hp = Math.min(bot.maxHp, bot.hp + Math.round(bot.maxHp * 0.28));
          bot.armorZones.front = Math.min(bot.maxArmorZone, bot.armorZones.front + 15);
          events.push(makeEvent({ type: 'pickup', x: prop.x, y: 0.6, z: prop.z, intensity: 1, targetId: bot.id }));
          break;
        }
        if (prop.kind === 'pickup_energy') {
          prop.destroyed = true;
          bot.energy = bot.maxEnergy;
          events.push(makeEvent({ type: 'pickup', x: prop.x, y: 0.6, z: prop.z, intensity: 1, targetId: bot.id }));
          break;
        }

        const nx = dx / dist;
        const nz = dz / dist;
        const speed = Math.hypot(bot.vx, bot.vz);
        const propDmg = Math.max(8, speed * 2.8 + (bot.weaponActive ? 14 : 0));
        prop.hp -= propDmg;

        bot.x = prop.x + nx * minDist;
        bot.z = prop.z + nz * minDist;
        bot.vx *= 0.45;
        bot.vz *= 0.45;

        if (prop.hp <= 0) {
          prop.destroyed = true;
          if (prop.kind === 'barrel') {
            events.push(makeEvent({ type: 'explosion', x: prop.x, y: 0.7, z: prop.z, intensity: 1.5 }));
            for (const victim of snapshot.bots) {
              if (victim.isDead) continue;
              const bdx = victim.x - prop.x;
              const bdz = victim.z - prop.z;
              const bDist = Math.hypot(bdx, bdz);
              if (bDist < 5.5 && bDist > 0.01) {
                const falloff = 1 - bDist / 5.5;
                const nx = bdx / bDist;
                const nz = bdz / bDist;
                victim.vx += nx * 11 * falloff;
                victim.vz += nz * 11 * falloff;
                victim.vy = Math.max(victim.vy, 6.5 * falloff);
                const zone = getHitZone(victim, nx, nz);
                const geo = worldDirToVictimLocal(victim, -nx, -nz, 0.25, 0.42, 0.35);
                applyDamage(victim, bot, 20 * falloff, zone, events, true, undefined, undefined, {
                  ...geo,
                  force: 11 * falloff,
                  damageKind: 'scorch',
                });
              }
            }
          } else if (prop.kind === 'crate') {
            events.push(makeEvent({ type: 'crate_break', x: prop.x, y: 0.5, z: prop.z, intensity: 1 }));
            spawnedPickups.push({
              id: `pickup_${prop.id}_${snapshot.tick}`,
              kind: Math.random() < 0.6 ? 'pickup_repair' : 'pickup_energy',
              x: prop.x,
              y: 0,
              z: prop.z,
              radius: 0.75,
              hp: 1,
              maxHp: 1,
              destroyed: false,
            });
          } else if (prop.kind === 'pillar') {
            events.push(makeEvent({ type: 'pillar_break', x: prop.x, y: 1.0, z: prop.z, intensity: 1.2 }));
          }
        } else {
          events.push(makeEvent({ type: 'hit', x: prop.x, y: 0.5, z: prop.z, intensity: 0.6 }));
        }
      }
    }
  }
  if (spawnedPickups.length > 0) {
    snapshot.props.push(...spawnedPickups);
  }

  // Arena Hazards (frame-rate independent cooldowns + sweeping floor blades & hydraulic crushers)
  for (const h of snapshot.hazards) {
    if (!h.active) continue;
    const escBonus = Math.max(0, (h.intensityLevel ?? 1) - 1);

    if (h.kind === 'spinner_blade') {
      const armLen = h.armLength ?? 2.85;
      const angle = h.sweepAngle ?? 0;
      // Match Three.js rotation.y = angle: local +X maps to (cos(angle), -sin(angle))
      const bx = Math.cos(angle);
      const bz = -Math.sin(angle);

      for (const bot of snapshot.bots) {
        if (bot.isDead || bot.y > 0.8) continue;
        const relX = bot.x - h.x;
        const relZ = bot.z - h.z;
        const proj = Math.max(-armLen, Math.min(armLen, relX * bx + relZ * bz));
        const closestX = h.x + bx * proj;
        const closestZ = h.z + bz * proj;
        const distToBlade = Math.hypot(bot.x - closestX, bot.z - closestZ);

        if (distToBlade < 0.42 + BASE_BOT_RADIUS * 0.72 * bot.scale && (h.tickCooldown ?? 0) <= 0) {
          h.tickCooldown = 0.34;
          const sign = proj >= 0 ? 1 : -1;
          // Tangential blade sweep velocity + radial push
          const tanX = -Math.sin(angle) * sign;
          const tanZ = -Math.cos(angle) * sign;
          const radLen = Math.hypot(relX, relZ) || 1;
          const nx = tanX * 0.75 + (relX / radLen) * 0.45;
          const nz = tanZ * 0.75 + (relZ / radLen) * 0.45;
          const nLen = Math.hypot(nx, nz) || 1;
          const kx = nx / nLen;
          const kz = nz / nLen;

          const imp = 9.2 + escBonus * 1.4;
          bot.vx += kx * imp;
          bot.vz += kz * imp;
          bot.vy = Math.max(bot.vy, 3.4);
          bot.angularVel += sign * 4.2;
          bot.roll += (Math.random() - 0.5) * 0.5;

          const zone = getHitZone(bot, kx, kz);
          const geo = worldDirToVictimLocal(bot, -kx, -kz, -0.22, 0.28, 0.25);
          applyDamage(bot, null, 12 + escBonus * 2.5, zone, events, true, undefined, 'hbar', {
            ...geo,
            force: imp * 1.35,
            damageKind: 'blade',
          });
        }
      }
      continue;
    }

    if (h.kind === 'crusher') {
      const justSlammed = freshlySlammedCrushers.has(h.id);
      for (const bot of snapshot.bots) {
        if (bot.isDead || bot.y > 1.2) continue;
        const dx = bot.x - h.x;
        const dz = bot.z - h.z;
        const d = Math.hypot(dx, dz);
        if (d < h.radius + BASE_BOT_RADIUS * 0.7 * bot.scale) {
          if (justSlammed || (h.tickCooldown ?? 0) <= 0) {
            if (!justSlammed) h.tickCooldown = 0.65;
            const nx = d > 0.01 ? dx / d : 1;
            const nz = d > 0.01 ? dz / d : 0;
            const knock = justSlammed ? 8.5 : 5.5;
            bot.vx += nx * knock;
            bot.vz += nz * knock;
            bot.vy = Math.max(bot.vy, justSlammed ? 2.2 : 1.2);
            bot.pitch += (Math.random() - 0.5) * 0.45;
            bot.roll += (Math.random() - 0.5) * 0.45;

            const zone = getHitZone(bot, nx, nz);
            const geo = worldDirToVictimLocal(bot, -nx * 0.25, -nz * 0.25, 0.94, 0.64, 0.28);
            applyDamage(
              bot,
              null,
              justSlammed ? 24 + escBonus * 4 : 9,
              zone,
              events,
              justSlammed,
              undefined,
              'hammer',
              {
                ...geo,
                force: justSlammed ? 16 : 7,
                damageKind: 'crush',
              },
            );
          }
        }
      }
      continue;
    }

    for (const bot of snapshot.bots) {
      if (bot.isDead || bot.y > 0.7) continue;
      const d = Math.hypot(bot.x - h.x, bot.z - h.z);
      if (d < h.radius + BASE_BOT_RADIUS * 0.65 * bot.scale) {
        if (h.kind === 'saw') {
          if ((h.tickCooldown ?? 0) <= 0) {
            h.tickCooldown = 0.38;
            const nx = d > 0.01 ? (bot.x - h.x) / d : 1;
            const nz = d > 0.01 ? (bot.z - h.z) / d : 0;
            bot.vx += nx * 6.0;
            bot.vz += nz * 6.0;
            bot.vy = Math.max(bot.vy, 3.0);
            const zone = getHitZone(bot, nx, nz);
            const geo = worldDirToVictimLocal(bot, -nx, -nz, -0.35, 0.22, 0.2);
            applyDamage(bot, null, 6 + escBonus, zone, events, false, undefined, 'sawblade', {
              ...geo,
              force: 7.5,
              damageKind: 'blade',
            });
          }
        } else if (h.kind === 'flipper_pad') {
          if ((h.tickCooldown ?? 0) <= 0) {
            h.tickCooldown = 0.65;
            bot.vy = 11.5 + escBonus * 0.8;
            bot.roll += (Math.random() - 0.5) * 1.0;
            bot.pitch += (Math.random() - 0.5) * 1.0;
            events.push(makeEvent({ type: 'flip', x: h.x, y: 0.4, z: h.z, intensity: 1.1 }));
          }
        } else if (h.kind === 'emp_ring') {
          if ((h.tickCooldown ?? 0) <= 0) {
            h.tickCooldown = 0.55;
            bot.energy = Math.max(0, bot.energy - (12 + escBonus * 3));
            applyDamage(bot, null, 5 + escBonus, 'rear', events, false, undefined, undefined, {
              ...zoneFallbackHit('rear', 'scorch', 5),
            });
          }
        }
      }
    }
  }

  if (snapshot.mode !== 'practice') {
    const aliveTeams = new Set(snapshot.bots.filter((b) => !b.isDead).map((b) => b.team));
    if (aliveTeams.size <= 1) {
      snapshot.phase = 'finished';
      snapshot.finishReason = 'ko';
      const survivor = snapshot.bots.find((b) => !b.isDead);
      snapshot.winnerId = survivor ? survivor.id : null;
    } else if (snapshot.timeRemaining <= 0) {
      snapshot.phase = 'finished';
      snapshot.finishReason = 'time';
      // Timed battle Judges' Decision: weights remaining hull % + damage dealt + KOs
      const judgeScore = (b: BotPhysicsState) =>
        (b.hp / Math.max(1, b.maxHp)) * 100 + b.damageDealt * 0.16 + b.kos * 30;
      const ranked = [...snapshot.bots]
        .filter((b) => !b.isDead)
        .sort((a, b) => judgeScore(b) - judgeScore(a));
      snapshot.winnerId = ranked[0]?.id ?? null;
    }
  }

  snapshot.events = events;
  return events;
}
