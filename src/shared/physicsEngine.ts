import {
  ARENA_CATALOG,
  ARENA_EVENT_INFO,
  ARMOR_CATALOG,
  type ArenaEventKind,
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
  type MatchModifierId,
  type PlayerInputState,
  type Projectile,
  type SkillTree,
  WEAPON_CATALOG,
  type WeaponId,
  computeBotStats,
  getBotChassisStyles,
  getBotWeapons,
  getWeaponKind,
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
  isBoss?: boolean;
  config: BotConfig;
  skills: SkillTree;
  isBot: boolean;
  team: number;
}

export interface RivalArchetypePreset {
  key: string;
  name: string;
  clanTag: string;
  botLevel: number;
  weightClass: BotWeightClass;
  scale: number;
  hpMult: number;
  speedMult: number;
  dmgMult: number;
  isBoss?: boolean;
  config: BotConfig;
}

export interface SnapshotOptions {
  modifiers?: MatchModifierId[];
}

// Distinct bot tiers/levels: fast nimble strikers (must hit multiple times), balanced middleweights, slow heavy juggernauts, and Titan bosses
export const AI_RIVAL_PRESETS: RivalArchetypePreset[] = [
  {
    key: 'volt_wasp',
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
      pattern: 'stripes',
    },
  },
  {
    key: 'torch_mantis',
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
      pattern: 'flames',
    },
  },
  {
    key: 'sting_ray',
    name: 'Sting Ray',
    clanTag: 'TIDE',
    botLevel: 2,
    weightClass: 'Lightweight',
    scale: 0.9,
    hpMult: 0.9,
    speedMult: 1.15,
    dmgMult: 0.85,
    config: {
      name: 'Sting Ray',
      chassis: 'stinger',
      armor: 'kevlar',
      weapon: 'lance',
      weapons: ['lance', 'sawblade'],
      wheelLayout: '4wd_wide',
      drive: 'hover',
      primaryColor: '#0F766E',
      accentColor: '#5EEAD4',
      finish: 'pearl',
      underglow: true,
      glowColor: '#22D3EE',
    },
  },
  {
    key: 'gyro_saucer',
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
    key: 'pincer_jack',
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
    key: 'arc_wraith',
    name: 'Arc Wraith',
    clanTag: 'VOLT',
    botLevel: 3,
    weightClass: 'Middleweight',
    scale: 1.04,
    hpMult: 1.0,
    speedMult: 1.04,
    dmgMult: 1.0,
    config: {
      name: 'Arc Wraith',
      chassis: 'ufo',
      armor: 'plasma',
      weapon: 'tesla',
      weapons: ['tesla', 'vspinner'],
      wheelLayout: '4wd_wide',
      drive: 'mecanum',
      primaryColor: '#5B21B6',
      accentColor: '#C084FC',
      finish: 'neon',
      pattern: 'circuit',
      underglow: true,
      glowColor: '#A855F7',
    },
  },
  {
    key: 'scrap_jaw',
    name: 'Scrap Jaw',
    clanTag: 'RUST',
    botLevel: 3,
    weightClass: 'Middleweight',
    scale: 1.1,
    hpMult: 1.06,
    speedMult: 0.96,
    dmgMult: 1.02,
    config: {
      name: 'Scrap Jaw',
      chassis: 'claw',
      armor: 'reactive',
      weapon: 'jaws',
      weapons: ['jaws', 'magnet'],
      wheelLayout: '6wd_inline',
      drive: 'omni',
      primaryColor: '#3F6212',
      accentColor: '#A3E635',
      finish: 'matte',
      pattern: 'digital_camo',
    },
  },
  {
    key: 'drum_roll',
    name: 'Drum Roll',
    clanTag: 'BEAT',
    botLevel: 3,
    weightClass: 'Middleweight',
    scale: 1.0,
    hpMult: 1.0,
    speedMult: 1.06,
    dmgMult: 1.04,
    config: {
      name: 'Drum Roll',
      chassis: 'wedge',
      chassisStyles: ['wedge', 'rammer'],
      armor: 'titanium',
      weapon: 'drum',
      wheelLayout: '4wd_wide',
      drive: 'turbo',
      primaryColor: '#C2410C',
      accentColor: '#FED7AA',
      pattern: 'checker',
    },
  },
  {
    key: 'obelisk_siege',
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
    key: 'siege_dozer',
    name: 'Siege Dozer',
    clanTag: 'IRON',
    botLevel: 4,
    weightClass: 'Heavyweight',
    scale: 1.1,
    hpMult: 1.32,
    speedMult: 0.82,
    dmgMult: 1.15,
    config: {
      name: 'Siege Dozer',
      chassis: 'dozer',
      armor: 'tungsten',
      weapon: 'hbar',
      weapons: ['hbar', 'missiles'],
      wheelLayout: '6wd_inline',
      drive: 'heavy_torque',
      primaryColor: '#A16207',
      accentColor: '#FDE68A',
      pattern: 'stripes',
      finish: 'matte',
    },
  },
  {
    key: 'rocket_hex',
    name: 'Rocket Hex',
    clanTag: 'BOOM',
    botLevel: 4,
    weightClass: 'Heavyweight',
    scale: 1.06,
    hpMult: 1.28,
    speedMult: 0.86,
    dmgMult: 1.12,
    config: {
      name: 'Rocket Hex',
      chassis: 'hex',
      armor: 'nanoweave',
      weapon: 'missiles',
      weapons: ['missiles', 'flame'],
      wheelLayout: '4wd_tucked',
      drive: 'tracks',
      primaryColor: '#7F1D1D',
      accentColor: '#FCA5A5',
      pattern: 'hex',
    },
  },
  {
    key: 'titan_behemoth',
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
      finish: 'chrome',
    },
  },
];

// Raid / campaign bosses: huge, slow, multi-weapon monsters
export const BOSS_PRESETS: RivalArchetypePreset[] = [
  {
    key: 'overlord',
    name: 'The Overlord',
    clanTag: 'BOSS',
    botLevel: 6,
    weightClass: 'Titan',
    scale: 1.55,
    hpMult: 3.4,
    speedMult: 0.66,
    dmgMult: 1.3,
    isBoss: true,
    config: {
      name: 'THE OVERLORD',
      chassis: 'behemoth',
      chassisStyles: ['behemoth', 'dozer', 'monolith'],
      armor: 'tungsten',
      weapon: 'drum',
      weapons: ['drum', 'tesla', 'missiles'],
      wheelLayout: '6wd_inline',
      drive: 'tracks',
      primaryColor: '#0B1120',
      accentColor: '#EF4444',
      finish: 'chrome',
      pattern: 'tiger',
      underglow: true,
      glowColor: '#EF4444',
    },
  },
  {
    key: 'iron_maw',
    name: 'Iron Maw',
    clanTag: 'BOSS',
    botLevel: 6,
    weightClass: 'Titan',
    scale: 1.48,
    hpMult: 3.0,
    speedMult: 0.72,
    dmgMult: 1.25,
    isBoss: true,
    config: {
      name: 'IRON MAW',
      chassis: 'claw',
      chassisStyles: ['claw', 'behemoth'],
      armor: 'reactive',
      weapon: 'jaws',
      weapons: ['jaws', 'magnet', 'hammer'],
      wheelLayout: '6wd_inline',
      drive: 'heavy_torque',
      primaryColor: '#3F4A2E',
      accentColor: '#A3E635',
      finish: 'matte',
      pattern: 'digital_camo',
      underglow: true,
      glowColor: '#84CC16',
    },
  },
  {
    key: 'storm_queen',
    name: 'Storm Queen',
    clanTag: 'BOSS',
    botLevel: 6,
    weightClass: 'Titan',
    scale: 1.42,
    hpMult: 2.8,
    speedMult: 0.84,
    dmgMult: 1.2,
    isBoss: true,
    config: {
      name: 'STORM QUEEN',
      chassis: 'ufo',
      chassisStyles: ['ufo', 'spider', 'turtle'],
      armor: 'plasma',
      weapon: 'tesla',
      weapons: ['tesla', 'hbar', 'missiles'],
      wheelLayout: 'outboard',
      drive: 'hover',
      primaryColor: '#1E1B4B',
      accentColor: '#60A5FA',
      finish: 'pearl',
      pattern: 'circuit',
      underglow: true,
      glowColor: '#60A5FA',
    },
  },
];

export function getRivalPreset(key: string): RivalArchetypePreset {
  return (
    AI_RIVAL_PRESETS.find((p) => p.key === key) ??
    BOSS_PRESETS.find((p) => p.key === key) ??
    AI_RIVAL_PRESETS[0]
  );
}

export function presetToRoster(
  preset: RivalArchetypePreset,
  id: string,
  team: number,
  skillLevel = 1,
  extra?: { hpMult?: number; dmgMult?: number },
): BotRosterTemplate {
  const lvl = Math.max(0, Math.min(5, skillLevel));
  return {
    id,
    name: preset.config.name,
    clanTag: preset.clanTag,
    botLevel: preset.botLevel,
    weightClassOverride: preset.weightClass,
    scaleOverride: preset.scale,
    hpMult: preset.hpMult * (extra?.hpMult ?? 1),
    speedMult: preset.speedMult,
    dmgMult: preset.dmgMult * (extra?.dmgMult ?? 1),
    isBoss: preset.isBoss,
    config: preset.config,
    skills: {
      chassisReinforcement: lvl,
      weaponTorque: lvl,
      gyroStabilizer: Math.max(1, lvl - 1),
      kineticArmor: lvl,
      batteryCore: Math.max(1, lvl - 1),
    },
    isBot: true,
    team,
  };
}

let nextEventId = 1;
let nextProjectileId = 1;
function makeEvent(partial: Omit<CombatEvent, 'id'>): CombatEvent {
  return {
    id: nextEventId++,
    ...partial,
  };
}

// Active snapshot context for damage resolution (set per physics step)
let activeSnap: ArenaSnapshot | null = null;

function hasMod(snap: ArenaSnapshot | null, mod: MatchModifierId): boolean {
  return Boolean(snap?.modifiers?.includes(mod));
}

export function isTeamMode(mode: GameMode): boolean {
  return mode === 'team_2v2' || mode === 'team_3v3' || mode === 'boss_raid' || mode === 'king_hill';
}

function isUntimedMode(mode: GameMode): boolean {
  return mode === 'practice' || mode === 'survival';
}

function makeBotState(
  entry: BotRosterTemplate,
  x: number,
  z: number,
  yaw: number,
  modifiers: MatchModifierId[],
): BotPhysicsState {
  const stats = computeBotStats(entry.config, entry.skills);
  const botWeapons = getBotWeapons(entry.config);
  const scaledHp = Math.round(stats.maxHp * (entry.hpMult ?? 1));
  const giant = modifiers.includes('giants') ? 1.25 : 1;
  const zoneHp = modifiers.includes('armor_off') ? 0 : stats.armorZoneHp;
  return {
    id: entry.id,
    name: entry.name,
    clanTag: entry.clanTag,
    botLevel: entry.botLevel ?? 1,
    weightClass: entry.weightClassOverride ?? stats.weightClass,
    scale: (entry.scaleOverride ?? stats.bodyScale) * giant,
    config: {
      ...entry.config,
      chassisStyles: getBotChassisStyles(entry.config),
      weapons: botWeapons,
      wheelLayout: entry.config.wheelLayout || '4wd_wide',
    },
    skills: entry.skills,
    x,
    y: 0,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw,
    angularVel: 0,
    pitch: 0,
    roll: 0,
    hp: scaledHp,
    maxHp: scaledHp,
    energy: stats.maxEnergy,
    maxEnergy: stats.maxEnergy,
    armorZones: { front: zoneHp, left: zoneHp, right: zoneHp, rear: zoneHp },
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
    teslaDmgCooldown: 0,
    burnTickTimer: 0,
    stunTimer: 0,
    pinnedTimer: 0,
    lastHitAt: -10,
    shieldFlash: 0,
    isDead: false,
    hitsDealt: 0,
    damageDealt: 0,
    kos: 0,
    isBot: entry.isBot,
    team: entry.team,
    isBoss: entry.isBoss,
    dmgMult: entry.dmgMult ?? 1,
    speedMult: entry.speedMult ?? 1,
  };
}

function computeSpawns(roster: BotRosterTemplate[]): Array<[number, number, number]> {
  const legacy: Array<[number, number, number]> = [
    [-10, 10, Math.PI * 0.75],
    [10, -10, -Math.PI * 0.25],
    [-10, -10, Math.PI * 0.25],
    [10, 10, -Math.PI * 0.75],
  ];
  const teamOrder: number[] = [];
  for (const r of roster) if (!teamOrder.includes(r.team)) teamOrder.push(r.team);
  const everyoneSolo = teamOrder.length === roster.length;
  if (everyoneSolo && roster.length <= 4) {
    return roster.map((_, idx) => legacy[idx % legacy.length]);
  }
  const nTeams = teamOrder.length;
  const counters: Record<number, number> = {};
  const sizes: Record<number, number> = {};
  for (const r of roster) sizes[r.team] = (sizes[r.team] ?? 0) + 1;
  return roster.map((r) => {
    const tIdx = teamOrder.indexOf(r.team);
    const memberIdx = counters[r.team] ?? 0;
    counters[r.team] = memberIdx + 1;
    const theta = Math.PI + (tIdx * Math.PI * 2) / Math.max(2, nTeams);
    const radius = 11;
    const cx = Math.sin(theta) * radius;
    const cz = Math.cos(theta) * radius;
    const tx = Math.cos(theta);
    const tz = -Math.sin(theta);
    const spread = (memberIdx - (sizes[r.team] - 1) / 2) * 3.6;
    const x = cx + tx * spread;
    const z = cz + tz * spread;
    return [x, z, Math.atan2(-x, -z)];
  });
}

function prop(id: string, kind: DestructibleProp['kind'], x: number, z: number, radius: number, hp: number): DestructibleProp {
  return { id, kind, x, y: 0, z, radius, hp, maxHp: hp, destroyed: false };
}

function buildArenaProps(arenaId: ArenaId): DestructibleProp[] {
  if (arenaId === 'junkyard') {
    return [
      prop('heap_nw', 'scrap_heap', -7.5, -7.5, 1.3, 90),
      prop('heap_se', 'scrap_heap', 7.5, 7.5, 1.3, 90),
      prop('pillar_ne', 'pillar', 6.2, -6.2, 1.05, 75),
      prop('pillar_sw', 'pillar', -6.2, 6.2, 1.05, 75),
      prop('barrel_n', 'barrel', 0, -10, 0.72, 20),
      prop('barrel_s', 'barrel', 0, 10, 0.72, 20),
      prop('barrel_w', 'barrel', -10, 0, 0.72, 20),
      prop('barrel_e', 'barrel', 10, 0, 0.72, 20),
      prop('barrel_x1', 'barrel', -12, -3, 0.72, 20),
      prop('barrel_x2', 'barrel', 12, 3, 0.72, 20),
      prop('crate_1', 'crate', -3.6, 3.6, 0.85, 24),
      prop('crate_2', 'crate', 3.6, -3.6, 0.85, 24),
      prop('crate_3', 'crate', -11, 8, 0.85, 24),
      prop('crate_4', 'crate', 11, -8, 0.85, 24),
      prop('crate_5', 'crate', -4, -11, 0.85, 24),
      prop('crate_6', 'crate', 4, 11, 0.85, 24),
    ];
  }
  if (arenaId === 'skyforge') {
    return [
      prop('pillar_n', 'pillar', 0, -11, 1.05, 75),
      prop('pillar_s', 'pillar', 0, 11, 1.05, 75),
      prop('barrel_nw', 'barrel', -9.5, -9.5, 0.72, 20),
      prop('barrel_se', 'barrel', 9.5, 9.5, 0.72, 20),
      prop('crate_1', 'crate', -3.2, -3.2, 0.85, 24),
      prop('crate_2', 'crate', 3.2, 3.2, 0.85, 24),
      prop('crate_3', 'crate', -3.2, 3.2, 0.85, 24),
      prop('crate_4', 'crate', 3.2, -3.2, 0.85, 24),
    ];
  }
  if (arenaId === 'storm') {
    return [
      prop('pillar_nw', 'pillar', -8, -8, 1.05, 90),
      prop('pillar_ne', 'pillar', 8, -8, 1.05, 90),
      prop('pillar_sw', 'pillar', -8, 8, 1.05, 90),
      prop('pillar_se', 'pillar', 8, 8, 1.05, 90),
      prop('barrel_n', 'barrel', 0, -11, 0.72, 20),
      prop('barrel_s', 'barrel', 0, 11, 0.72, 20),
      prop('crate_1', 'crate', -5, 0, 0.85, 24),
      prop('crate_2', 'crate', 5, 0, 0.85, 24),
    ];
  }
  return [
    prop('pillar_nw', 'pillar', -6.2, -6.2, 1.05, 75),
    prop('pillar_ne', 'pillar', 6.2, -6.2, 1.05, 75),
    prop('pillar_sw', 'pillar', -6.2, 6.2, 1.05, 75),
    prop('pillar_se', 'pillar', 6.2, 6.2, 1.05, 75),
    prop('barrel_n', 'barrel', 0, -9.5, 0.72, 20),
    prop('barrel_s', 'barrel', 0, 9.5, 0.72, 20),
    prop('barrel_w', 'barrel', -9.5, 0, 0.72, 20),
    prop('barrel_e', 'barrel', 9.5, 0, 0.72, 20),
    prop('crate_1', 'crate', -3.2, 0, 0.85, 24),
    prop('crate_2', 'crate', 3.2, 0, 0.85, 24),
    prop('crate_3', 'crate', 0, -3.2, 0.85, 24),
    prop('crate_4', 'crate', 0, 3.2, 0.85, 24),
  ];
}

function buildArenaHazards(arenaId: ArenaId, tier2Unlock: number, tier3Unlock: number): HazardState[] {
  const crusher = (id: string, x: number, z: number, phase: number): HazardState => ({
    id, kind: 'crusher', x, z, radius: 1.85, active: false, warning: false, phase, unlockAt: tier2Unlock,
    cyclePeriod: 11.5, warningDuration: 1.8, activeDuration: 1.0, crusherY: 1,
  });
  const sblade = (id: string, x: number, z: number, phase: number, sweep: number): HazardState => ({
    id, kind: 'spinner_blade', x, z, radius: 1.15, armLength: 2.85, active: false, warning: false, phase,
    unlockAt: tier3Unlock, cyclePeriod: 10.5, warningDuration: 1.5, activeDuration: 5.4, sweepAngle: sweep,
  });
  const flip = (id: string, x: number, z: number, phase: number, period = 5.2, radius = 1.65): HazardState => ({
    id, kind: 'flipper_pad', x, z, radius, active: false, warning: false, phase, unlockAt: 0,
    cyclePeriod: period, warningDuration: 0.9, activeDuration: 0.5,
  });
  const saw = (id: string, x: number, z: number, phase: number, radius = 1.45): HazardState => ({
    id, kind: 'saw', x, z, radius, active: true, warning: false, phase, unlockAt: 0,
  });

  switch (arenaId) {
    case 'foundry':
      return [
        saw('saw_1', -4.2, 0, 0),
        saw('saw_2', 4.2, 0, Math.PI),
        flip('flip_c', 0, 0, 0, 5.5),
        crusher('crusher_n', 0, -6.2, 2.0),
        crusher('crusher_s', 0, 6.2, 7.75),
        sblade('sblade_nw', -3.8, -3.8, 1.0, 0),
        sblade('sblade_se', 3.8, 3.8, 6.25, Math.PI * 0.5),
      ];
    case 'cryo':
      return [
        flip('flip_1', -4.5, 4.5, 0, 4.8),
        flip('flip_2', 4.5, -4.5, 2.4, 4.8),
        saw('saw_c', 0, 0, 0, 1.55),
        crusher('crusher_n', 0, -6.2, 1.5),
        crusher('crusher_s', 0, 6.2, 7.25),
        sblade('sblade_nw', -3.8, -3.8, 0.8, 0),
        sblade('sblade_se', 3.8, 3.8, 6.05, Math.PI * 0.5),
      ];
    case 'colosseum':
      return [
        flip('flip_c', 0, 0, 0.4, 5.2, 1.75),
        saw('saw_nw', -5.2, -5.2, 0),
        saw('saw_se', 5.2, 5.2, Math.PI),
        crusher('crusher_n', 0, -6.2, 2.2),
        crusher('crusher_s', 0, 6.2, 7.95),
        sblade('sblade_sw', -4.0, 4.0, 1.2, 0),
        sblade('sblade_ne', 4.0, -4.0, 6.45, Math.PI * 0.5),
      ];
    case 'skyforge':
      return [
        { id: 'pit_w', kind: 'pit', x: -7.4, z: 0, radius: 1.8, active: false, warning: false, phase: 0, unlockAt: 0, cyclePeriod: 9, warningDuration: 1.4, activeDuration: 5 },
        { id: 'pit_e', kind: 'pit', x: 7.4, z: 0, radius: 1.8, active: false, warning: false, phase: 4.5, unlockAt: 0, cyclePeriod: 9, warningDuration: 1.4, activeDuration: 5 },
        { id: 'pit_n', kind: 'pit', x: 0, z: -7.4, radius: 1.8, active: false, warning: false, phase: 2.2, unlockAt: tier2Unlock, cyclePeriod: 9, warningDuration: 1.4, activeDuration: 5 },
        { id: 'pit_s', kind: 'pit', x: 0, z: 7.4, radius: 1.8, active: false, warning: false, phase: 6.7, unlockAt: tier2Unlock, cyclePeriod: 9, warningDuration: 1.4, activeDuration: 5 },
        flip('flip_c', 0, 0, 1.0, 5.0, 1.75),
        sblade('sblade_nw', -9, -9, 1.2, 0),
        sblade('sblade_se', 9, 9, 6.4, Math.PI * 0.5),
      ];
    case 'junkyard':
      return [
        { id: 'magnet_c', kind: 'magnet_crane', x: 0, z: 0, radius: 7.5, active: false, warning: false, phase: 3.0, unlockAt: 0, cyclePeriod: 13, warningDuration: 1.8, activeDuration: 3.4 },
        { id: 'lava_ne', kind: 'lava', x: 7.2, z: -2.2, radius: 1.55, active: true, warning: false, phase: 0, unlockAt: 0 },
        { id: 'lava_sw', kind: 'lava', x: -7.2, z: 2.2, radius: 1.55, active: true, warning: false, phase: 0, unlockAt: 0 },
        saw('saw_ne', 9, -9, 0.8),
        saw('saw_sw', -9, 9, 2.4),
        crusher('crusher_w', -10, -2, 2.0),
        crusher('crusher_e', 10, 2, 7.75),
        sblade('sblade_n', 0, -10, 1.2, 0),
      ];
    case 'storm':
      return [
        { id: 'emp_c', kind: 'emp_ring', x: 0, z: 0, radius: 2.9, active: false, warning: false, phase: 0, unlockAt: 0, cyclePeriod: 7.0, warningDuration: 1.1, activeDuration: 1.6 },
        { id: 'bolt_1', kind: 'lightning', x: -6, z: -6, radius: 2.3, active: false, warning: false, phase: 0, unlockAt: 3, cyclePeriod: 5.5, warningDuration: 1.5, activeDuration: 0.3 },
        { id: 'bolt_2', kind: 'lightning', x: 6, z: 6, radius: 2.3, active: false, warning: false, phase: 2.75, unlockAt: 3, cyclePeriod: 5.5, warningDuration: 1.5, activeDuration: 0.3 },
        { id: 'bolt_3', kind: 'lightning', x: 6, z: -6, radius: 2.3, active: false, warning: false, phase: 1.4, unlockAt: tier2Unlock, cyclePeriod: 5.5, warningDuration: 1.5, activeDuration: 0.3 },
        saw('saw_w', -11, 0, 0.6),
        saw('saw_e', 11, 0, 2.6),
        sblade('sblade_nw', -4.2, 4.2, 1.2, 0),
        sblade('sblade_se', 4.2, -4.2, 6.4, Math.PI * 0.5),
      ];
    default:
      return [
        { id: 'emp_c', kind: 'emp_ring', x: 0, z: 0, radius: 2.9, active: false, warning: false, phase: 0, unlockAt: 0, cyclePeriod: 6.0, warningDuration: 1.1, activeDuration: 1.6 },
        saw('saw_n', 0, -6.5, 0.5, 1.4),
        saw('saw_s', 0, 6.5, 2.1, 1.4),
        crusher('crusher_w', -6.2, 0, 1.8),
        crusher('crusher_e', 6.2, 0, 7.55),
        sblade('sblade_nw', -3.6, -3.6, 0.9, 0),
        sblade('sblade_se', 3.6, 3.6, 6.15, Math.PI * 0.5),
      ];
  }
}

const HILL_SPOTS: Array<[number, number]> = [
  [0, 0],
  [-8, -8],
  [8, 8],
  [-8, 8],
  [8, -8],
  [0, -9],
  [0, 9],
];

export function createInitialSnapshot(
  mode: GameMode,
  arenaId: ArenaId,
  roster: BotRosterTemplate[],
  durationSeconds = 180,
  options: SnapshotOptions = {},
): ArenaSnapshot {
  const modifiers = options.modifiers ?? [];
  const spawns = computeSpawns(roster);
  const bots: BotPhysicsState[] = roster.map((entry, idx) =>
    makeBotState(entry, spawns[idx][0], spawns[idx][1], spawns[idx][2], modifiers),
  );

  const props = buildArenaProps(arenaId);
  const untimed = isUntimedMode(mode);
  const effectiveDuration = untimed ? 600 : Math.max(60, Math.min(600, durationSeconds));
  const tier2Unlock = mode === 'practice' ? 8 : Math.min(26, Math.round(effectiveDuration * 0.2));
  const tier3Unlock = mode === 'practice' ? 16 : Math.min(54, Math.round(effectiveDuration * 0.44));
  const hazards = modifiers.includes('no_hazards') ? [] : buildArenaHazards(arenaId, tier2Unlock, tier3Unlock);

  const snapshot: ArenaSnapshot = {
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
    winnerTeam: null,
    projectiles: [],
    modifiers,
    arenaEvent: null,
    nextArenaEventAt: modifiers.includes('chaos_events') ? 8 : 20 + Math.random() * 6,
    hill:
      mode === 'king_hill'
        ? { x: 0, z: 0, radius: 3.4, scores: {}, owner: null, contested: false, target: 100, moveTimer: 30 }
        : null,
    survivalWave: mode === 'survival' ? 1 : undefined,
    survivalKills: mode === 'survival' ? 0 : undefined,
    gravityMult: ARENA_CATALOG[arenaId].gravityMult ?? 1,
  };
  if (mode === 'survival') {
    snapshot.survivalWave = 0;
    if (!snapshot.bots.some((b) => b.team !== 0)) spawnSurvivalWave(snapshot);
    else snapshot.survivalWave = 1;
  }
  return snapshot;
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
  if (weaponId === 'flame' || weaponId === 'tesla') return 'scorch';
  if (weaponId === 'hammer' || weaponId === 'jaws') return 'crush';
  if (weaponId === 'vspinner' || weaponId === 'hbar' || weaponId === 'sawblade' || weaponId === 'drum') return 'blade';
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
  pierce = 0,
  skipTraits = false,
): number {
  if (victim.isDead) return 0;

  const stats = computeBotStats(victim.config, victim.skills);
  const armorSpec = ARMOR_CATALOG[victim.config.armor] ?? ARMOR_CATALOG.titanium;
  let mult = 1.0;

  if (zone === 'front') {
    mult *= 1 - stats.frontDeflect * (1 - Math.min(1, pierce));
  } else if (zone === 'rear') {
    mult *= 1.28;
  } else {
    mult *= 1.1;
  }

  const zoneArmor = victim.armorZones[zone];
  if (zoneArmor <= 0) {
    mult *= 1.2;
  }

  const dmgKind: DamageKind =
    hitInfo?.damageKind ?? (eventTypeOverride === 'flame' ? 'scorch' : damageKindFromWeapon(weaponId));

  // Armor material resistance profile
  mult *= armorSpec.resist[dmgKind] ?? 1;
  // Match modifiers & arena events
  if (hasMod(activeSnap, 'double_damage')) mult *= 2;
  if (victim.isBounty) mult *= 1.4;
  if (attacker) {
    mult *= attacker.dmgMult ?? 1;
    if (activeSnap?.arenaEvent?.kind === 'power_surge') mult *= 1.15;
  }

  let finalDamage = Math.max(2, Math.round(rawDamage * mult));

  // Plasma Barrier: drain energy to soak part of the hit
  if (!skipTraits && armorSpec.trait === 'energy_shield' && victim.energy > 10) {
    const absorb = Math.min(finalDamage * 0.45, victim.energy - 10);
    if (absorb > 0.5) {
      victim.energy -= absorb;
      finalDamage = Math.max(1, Math.round(finalDamage - absorb));
      victim.shieldFlash = 0.3;
      if (absorb > 4) {
        events.push(
          makeEvent({ type: 'shield_block', x: victim.x, y: victim.y + 0.7, z: victim.z, intensity: Math.min(1.5, absorb / 10), targetId: victim.id }),
        );
      }
    }
  }

  const impactForce = hitInfo?.force ?? Math.max(2, finalDamage * 0.45);
  const fallbackGeo = zoneFallbackHit(zone, dmgKind, impactForce);
  const hx = hitInfo?.hitLocalX ?? fallbackGeo.hitLocalX;
  const hy = hitInfo?.hitLocalY ?? fallbackGeo.hitLocalY;
  const hz = hitInfo?.hitLocalZ ?? fallbackGeo.hitLocalZ;
  const nx = hitInfo?.normalX ?? fallbackGeo.normalX;
  const ny = hitInfo?.normalY ?? fallbackGeo.normalY;
  const nz = hitInfo?.normalZ ?? fallbackGeo.normalZ;

  if (zoneArmor > 0) {
    const nextZone = Math.max(0, zoneArmor - finalDamage * 0.85 * (1 + pierce));
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
  victim.lastHitAt = activeSnap?.elapsedTime ?? 0;

  if (attacker) {
    attacker.hitsDealt += 1;
    attacker.damageDealt += finalDamage;
    if (hasMod(activeSnap, 'vampire') && !attacker.isDead) {
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + finalDamage * 0.2);
    }
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
    victim.isBounty = false;
    if (attacker) {
      attacker.kos += 1;
      if (activeSnap && activeSnap.mode === 'survival' && attacker.team === 0) {
        activeSnap.survivalKills = (activeSnap.survivalKills ?? 0) + 1;
      }
    }
    events.push(
      makeEvent({
        type: 'ko',
        x: victim.x,
        y: victim.y + 0.8,
        z: victim.z,
        intensity: victim.isBoss ? 2.2 : 1.6,
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

  // Explosive Reactive armor: blast a share of melee damage back at the attacker
  if (
    !skipTraits &&
    armorSpec.trait === 'reflect' &&
    attacker &&
    attacker.id !== victim.id &&
    !attacker.isDead &&
    dmgKind !== 'scorch'
  ) {
    const dx = attacker.x - victim.x;
    const dz = attacker.z - victim.z;
    if (Math.hypot(dx, dz) < 4.5) {
      const reflected = finalDamage * 0.3;
      if (reflected >= 1.5) {
        events.push(
          makeEvent({ type: 'reflect', x: victim.x, y: victim.y + 0.6, z: victim.z, x2: attacker.x, y2: attacker.y + 0.6, z2: attacker.z, intensity: Math.min(1.4, reflected / 8) }),
        );
        applyDamage(attacker, null, reflected, getHitZone(attacker, -dx, -dz), events, false, undefined, undefined, { damageKind: 'scorch', force: 4 }, 0, true);
      }
    }
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

  // Target selection: nearest enemy, with a pull toward bounty targets and the player-facing threat
  let target = enemies[0];
  let bestScore = Infinity;
  for (const e of enemies) {
    const d = Math.hypot(e.x - bot.x, e.z - bot.z);
    let score = d;
    if (e.isBounty) score -= 5;
    if (e.hp < e.maxHp * 0.25) score -= 2.5; // finish off weak rivals
    if (score < bestScore) {
      bestScore = score;
      target = e;
    }
  }
  const minDist = Math.hypot(target.x - bot.x, target.z - bot.z);
  let targetX = target.x;
  let targetZ = target.z;

  // King of the Hill: contest the zone when it isn't held by our team
  const hill = snapshot.hill;
  if (hill) {
    const dHill = Math.hypot(hill.x - bot.x, hill.z - bot.z);
    const ownTeamHolds = hill.owner === bot.team && !hill.contested;
    if (!ownTeamHolds && dHill > hill.radius * 0.6 && minDist > 4.5) {
      targetX = hill.x;
      targetZ = hill.z;
    }
  }

  if (bot.hp < bot.maxHp * 0.52) {
    for (const p of snapshot.props) {
      if (!p.destroyed && (p.kind === 'pickup_repair' || p.kind === 'pickup_armor')) {
        const d = Math.hypot(p.x - bot.x, p.z - bot.z);
        if (d < 14) {
          targetX = p.x;
          targetZ = p.z;
          break;
        }
      }
    }
  }

  const hovering = bot.config.drive === 'hover';
  for (const h of snapshot.hazards) {
    if (!h.active && !h.warning) continue;
    if (hovering && (h.kind === 'saw' || h.kind === 'lava' || h.kind === 'spinner_blade')) continue;
    const dx = bot.x - h.x;
    const dz = bot.z - h.z;
    const dist = Math.hypot(dx, dz);
    const dangerRadius =
      h.kind === 'spinner_blade'
        ? (h.armLength ?? 2.85) + 1.4
        : h.kind === 'magnet_crane'
          ? 3.2
          : h.radius + 1.9;
    if (dist < dangerRadius && dist > 0.01) {
      targetX = bot.x + (dx / dist) * 5.5;
      targetZ = bot.z + (dz / dist) * 5.5;
    }
  }

  const desiredYaw = Math.atan2(targetX - bot.x, targetZ - bot.z);
  const diff = normalizeAngle(desiredYaw - bot.yaw);
  const steer = Math.max(-1, Math.min(1, diff * 1.75));
  const aimYaw = Math.atan2(target.x - bot.x, target.z - bot.z);
  const aimDiff = Math.abs(normalizeAngle(aimYaw - bot.yaw));

  const arenaHalf = ARENA_CATALOG[snapshot.arenaId].halfSize - 1.5;
  const nearWall = Math.abs(bot.x) > arenaHalf || Math.abs(bot.z) > arenaHalf;
  let throttle = Math.abs(diff) > 1.7 ? 0.35 : 0.92;
  const weapons = getBotWeapons(bot.config);
  const isRanged = weapons[0] === 'missiles' || weapons[0] === 'magnet';
  if (nearWall && Math.abs(diff) > 1.2) {
    throttle = -0.65;
  } else if (isRanged && minDist < 5 && weapons.length === 1) {
    // Kiting: ranged-only builds back off to keep spacing
    throttle = -0.55;
  } else if (minDist < 2.2 && bot.weaponCooldown > 0.28) {
    // Brief tactical spacing/re-angle after a strike instead of brainless nose-to-nose grinding
    throttle = -0.32;
  }
  throttle *= 0.78 + difficulty * 0.18;

  const fireWeapons = weapons.map((w, idx) => {
    const kind = getWeaponKind(w);
    if (kind === 'rotor') return minDist < 8.5;
    if (w === 'flame') return minDist < 5.0 && aimDiff < 0.9;
    if (w === 'tesla') return minDist < 4.8 && aimDiff < 1.1;
    if (w === 'missiles') return minDist < 15 && aimDiff < 0.55 && bot.energy > 28 && (bot.weaponCooldowns?.[idx] ?? 0) <= 0;
    if (w === 'magnet') return minDist > 3.2 && minDist < 7.5 && aimDiff < 0.45;
    if (w === 'lance') return minDist < 4.4 && aimDiff < 0.35;
    if (w === 'jaws') return minDist < 3.0 && aimDiff < 0.6;
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
  activeSnap = snapshot;
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
  if (!isUntimedMode(snapshot.mode)) {
    snapshot.timeRemaining = Math.max(0, snapshot.timeRemaining - clampedDt);
  }

  const elapsed = snapshot.elapsedTime;
  const totalDur = snapshot.durationSeconds || 180;
  const tier2Unlock = snapshot.mode === 'practice' ? 8 : Math.min(26, Math.round(totalDur * 0.2));
  const tier3Unlock = snapshot.mode === 'practice' ? 16 : Math.min(54, Math.round(totalDur * 0.44));
  const escalation = elapsed >= tier3Unlock ? 3 : elapsed >= tier2Unlock ? 2 : 1;
  snapshot.escalationStage = escalation;
  updateArenaEvent(snapshot, elapsed, clampedDt, events);
  const arenaEventKind = snapshot.arenaEvent?.kind;
  const cadenceMult = (1 + (escalation - 1) * 0.22) * (arenaEventKind === 'hazard_frenzy' ? 1.7 : 1);
  const gravity =
    GRAVITY *
    (snapshot.gravityMult ?? 1) *
    (hasMod(snapshot, 'low_gravity') ? 0.5 : 1) *
    (arenaEventKind === 'low_gravity' ? 0.4 : 1);
  const turboMult = hasMod(snapshot, 'turbo') ? 1.3 : 1;
  const freshlyStruckBolts = new Set<string>();

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
    } else if (h.kind === 'pit' || h.kind === 'magnet_crane' || h.kind === 'lightning') {
      const period = (h.cyclePeriod ?? 8) / cadenceMult;
      const warnDur = h.warningDuration ?? 1.2;
      const activeDur = h.activeDuration ?? 2;
      const cyclePos = (activeElapsed + h.phase) % period;
      h.warning = cyclePos >= period - warnDur - activeDur && cyclePos < period - activeDur;
      h.active = cyclePos >= period - activeDur;
      if (h.kind === 'lightning') {
        if (!wasWarning && h.warning) {
          // Re-target: usually strike near a live bot, sometimes random deck
          const live = snapshot.bots.filter((b) => !b.isDead);
          const lim = ARENA_CATALOG[snapshot.arenaId].halfSize - 3;
          if (live.length > 0 && Math.random() < 0.7) {
            const t = live[Math.floor(Math.random() * live.length)];
            h.x = Math.max(-lim, Math.min(lim, t.x + (Math.random() - 0.5) * 3 + t.vx * 0.9));
            h.z = Math.max(-lim, Math.min(lim, t.z + (Math.random() - 0.5) * 3 + t.vz * 0.9));
          } else {
            h.x = (Math.random() * 2 - 1) * lim;
            h.z = (Math.random() * 2 - 1) * lim;
          }
        }
        if (!wasActive && h.active) {
          freshlyStruckBolts.add(h.id);
          events.push(
            makeEvent({ type: 'lightning', x: h.x, y: 0.1, z: h.z, x2: h.x, y2: 16, z2: h.z, intensity: 1.4 + (escalation - 1) * 0.2 }),
          );
        }
      }
    } else if (h.kind === 'lava') {
      h.active = true;
      h.warning = false;
      h.phase = activeElapsed;
    }

    if (
      !wasWarning &&
      h.warning &&
      (h.kind === 'crusher' || h.kind === 'spinner_blade' || h.kind === 'pit' || h.kind === 'magnet_crane' || h.kind === 'lightning')
    ) {
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
    bot.teslaDmgCooldown = Math.max(0, (bot.teslaDmgCooldown ?? 0) - clampedDt);
    bot.stunTimer = Math.max(0, (bot.stunTimer ?? 0) - clampedDt);
    bot.pinnedTimer = Math.max(0, (bot.pinnedTimer ?? 0) - clampedDt);
    bot.shieldFlash = Math.max(0, (bot.shieldFlash ?? 0) - clampedDt);
    const armorSpec = ARMOR_CATALOG[bot.config.armor] ?? ARMOR_CATALOG.titanium;
    const speedMod = (1 + ((bot.speedMult ?? 1) - 1) * 0.5) * turboMult;

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
      bot.burnTimer = Math.max(0, bot.burnTimer - clampedDt * (armorSpec.trait === 'heat_sink' ? 2 : 1));
      if ((bot.burnTickTimer ?? 0) <= 0) {
        bot.burnTickTimer = 0.65;
        applyDamage(bot, null, 3, 'rear', events, false, 'flame');
      }
    }

    const rightingRate = 5.5 + bot.skills.gyroStabilizer * 1.1;
    bot.pitch *= Math.exp(-rightingRate * clampedDt);
    bot.roll *= Math.exp(-rightingRate * clampedDt);

    if (bot.isDead) {
      bot.vy -= gravity * clampedDt;
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
      bot.energy +
        stats.energyRegen * arena.energyRegenMult * (arenaEventKind === 'power_surge' ? 2.5 : 1) * clampedDt,
    );

    // Nanoweave self-repair once out of combat for a moment
    if (armorSpec.trait === 'regen' && elapsed - (bot.lastHitAt ?? -10) > 2.5) {
      const zoneRegen = bot.maxArmorZone * 0.08 * clampedDt;
      bot.armorZones.front = Math.min(bot.maxArmorZone, bot.armorZones.front + zoneRegen);
      bot.armorZones.left = Math.min(bot.maxArmorZone, bot.armorZones.left + zoneRegen);
      bot.armorZones.right = Math.min(bot.maxArmorZone, bot.armorZones.right + zoneRegen);
      bot.armorZones.rear = Math.min(bot.maxArmorZone, bot.armorZones.rear + zoneRegen);
      bot.hp = Math.min(bot.maxHp, bot.hp + bot.maxHp * 0.012 * clampedDt);
    }

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
    let teslaFiringSlotIdx = -1;

    for (let slotIdx = 0; slotIdx < botWeapons.length; slotIdx++) {
      const wId = botWeapons[slotIdx];
      const wSpec = WEAPON_CATALOG[wId];
      const slotFiring = isSlotFiring(slotIdx);
      const slotCooldownDur = Number((wSpec.cooldown * (1 - bot.skills.weaponTorque * 0.035)).toFixed(2));

      const wKind = getWeaponKind(wId);
      if (wKind === 'rotor') {
        const targetSpin = slotFiring ? 24 * overdriveMult : 9;
        bot.weaponSpins[slotIdx] += (targetSpin - bot.weaponSpins[slotIdx]) * Math.min(1, clampedDt * 5);
        bot.weaponAngles[slotIdx] += bot.weaponSpins[slotIdx] * clampedDt;
        bot.weaponActives[slotIdx] = slotFiring;
        if (slotFiring && bot.energy > 1) {
          bot.energy = Math.max(0, bot.energy - 2.4 * clampedDt);
        }
      } else if (wKind === 'channel') {
        const firingChannel = slotFiring && bot.energy > 3;
        bot.weaponActives[slotIdx] = firingChannel;
        bot.weaponSpins[slotIdx] = firingChannel ? 1.0 : 0;
        bot.weaponAngles[slotIdx] += clampedDt * (firingChannel ? 14 : 2);
        if (firingChannel) {
          if (wId === 'tesla') {
            teslaFiringSlotIdx = slotIdx;
            bot.energy = Math.max(0, bot.energy - 8 * clampedDt);
          } else {
            flameFiringSlotIdx = slotIdx;
            bot.energy = Math.max(0, bot.energy - 9.5 * clampedDt);
          }
        }
      } else {
        // Discrete strike & launcher weapons (flipper / hammer / jaws / lance / magnet / missiles)
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
    const stunned = (bot.stunTimer ?? 0) > 0;
    const pinned = (bot.pinnedTimer ?? 0) > 0;
    const steerFactor = Math.max(-1, Math.min(1, input.steer)) * (stunned ? 0.35 : 1);
    const throttleFactor =
      Math.max(-1, Math.min(1, input.throttle)) * (stunned ? 0.25 : 1) * (pinned ? 0.15 : 1);

    // Integrate physical angular momentum (from impacts/torque) + tire rotational damping
    const rotDamp = Math.exp(-(6.5 + bot.skills.gyroStabilizer * 0.9) * clampedDt);
    bot.angularVel *= rotDamp;
    bot.yaw = normalizeAngle(bot.yaw + (steerFactor * stats.turnRate + bot.angularVel) * clampedDt);

    // Calmer, controlled Boost impulse
    if (input.boost && bot.boostCooldown <= 0 && bot.energy >= 24) {
      bot.energy -= 24;
      bot.boostCooldown = 2.4;
      const impulse = 6.2 * overdriveMult * classSpeedMult * speedMod;
      bot.vx += fx * impulse;
      bot.vz += fz * impulse;
      bot.pitch = -0.1;
    }

    if (bot.y <= 0.15) {
      const driveForce = throttleFactor * stats.accel * overdriveMult * classSpeedMult * speedMod;
      bot.vx += fx * driveForce * clampedDt;
      bot.vz += fz * driveForce * clampedDt;

      const rx = Math.cos(bot.yaw);
      const rz = -Math.sin(bot.yaw);
      const forwardSpeed = bot.vx * fx + bot.vz * fz;
      const lateralSpeed = bot.vx * rx + bot.vz * rz;

      const lateralGrip =
        arena.friction * (bot.config.drive === 'tracks' ? 1.55 : bot.config.drive === 'hover' ? 0.5 : 1.05);
      const dampedLateral = lateralSpeed * Math.exp(-lateralGrip * clampedDt);
      const forwardDrag = Math.abs(throttleFactor) < 0.05 ? arena.friction * 1.05 : 1.05;
      const dampedForward = forwardSpeed * Math.exp(-forwardDrag * clampedDt);

      bot.vx = fx * dampedForward + rx * dampedLateral;
      bot.vz = fz * dampedForward + rz * dampedLateral;

      const speed = Math.hypot(bot.vx, bot.vz);
      const cap = stats.maxSpeed * overdriveMult * classSpeedMult * speedMod;
      if (speed > cap && bot.boostCooldown < 1.8) {
        const blend = cap + (speed - cap) * Math.exp(-7 * clampedDt);
        bot.vx = (bot.vx / speed) * blend;
        bot.vz = (bot.vz / speed) * blend;
      }
    }

    if (pinned) {
      const pinDamp = Math.exp(-9 * clampedDt);
      bot.vx *= pinDamp;
      bot.vz *= pinDamp;
    }

    bot.vy -= gravity * clampedDt;
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

    // Tesla Coil: arcing chain lightning (0.3s ticks) that stuns motors and drains batteries
    if (teslaFiringSlotIdx >= 0 && (bot.teslaDmgCooldown ?? 0) <= 0) {
      bot.teslaDmgCooldown = 0.3;
      const tSpec = WEAPON_CATALOG.tesla;
      const tDmg =
        tSpec.damage *
        (teslaFiringSlotIdx === 0 ? 1.0 : 0.78) *
        (1 + bot.skills.weaponTorque * 0.075) *
        overdriveMult *
        classDmgMult;
      const primary = findStrikeTargets(snapshot, bot, tSpec.range, 0.4, true)[0];
      if (primary) {
        const arcHit = (src: BotPhysicsState, victim: BotPhysicsState, dmg: number) => {
          const dx = victim.x - src.x;
          const dz = victim.z - src.z;
          const dist = Math.hypot(dx, dz) || 1;
          const nx = dx / dist;
          const nz = dz / dist;
          events.push(
            makeEvent({
              type: 'arc',
              x: src.x + (src === bot ? fx * 0.8 : 0),
              y: src.y + 0.95,
              z: src.z + (src === bot ? fz * 0.8 : 0),
              x2: victim.x,
              y2: victim.y + 0.55,
              z2: victim.z,
              intensity: 0.9,
              weapon: 'tesla',
            }),
          );
          victim.stunTimer = Math.max(victim.stunTimer ?? 0, 0.4);
          victim.energy = Math.max(0, victim.energy - 4);
          victim.vx += nx * tSpec.impulse;
          victim.vz += nz * tSpec.impulse;
          const zone = getHitZone(victim, nx, nz);
          const geo = worldDirToVictimLocal(victim, -nx, -nz, 0.3, 0.5, 0.4);
          applyDamage(victim, bot, dmg, zone, events, false, undefined, 'tesla', {
            ...geo,
            force: 3,
            damageKind: 'scorch',
          });
        };
        arcHit(bot, primary, tDmg);
        // Chain to the nearest other rival close to the primary target
        let chainTarget: BotPhysicsState | null = null;
        let chainDist = 3.8;
        for (const o of snapshot.bots) {
          if (o.isDead || o.id === primary.id || o.id === bot.id || o.team === bot.team) continue;
          const d = Math.hypot(o.x - primary.x, o.z - primary.z);
          if (d < chainDist) {
            chainDist = d;
            chainTarget = o;
          }
        }
        if (chainTarget) arcHit(primary, chainTarget, tDmg * 0.6);
      }
    }

    // Discrete strike weapons: each slot fires independently via its own button
    for (const { slotIdx, weaponId: strikeWeapon } of firedDiscreteSlots) {
      const strikeSpec = WEAPON_CATALOG[strikeWeapon];
      const slotDmg =
        strikeSpec.damage *
        (slotIdx === 0 ? 1.0 : 0.8) *
        (1 + bot.skills.weaponTorque * 0.075) *
        overdriveMult *
        classDmgMult;
      const slotImpBase = strikeSpec.impulse * (1 + bot.skills.weaponTorque * 0.05);

      if (strikeWeapon === 'missiles') {
        launchMissileSalvo(snapshot, bot, slotIdx === 0 ? 3 : 2, slotDmg, events);
        continue;
      }

      const minDot = strikeWeapon === 'lance' ? 0.82 : strikeWeapon === 'magnet' ? 0.55 : strikeWeapon === 'jaws' ? 0.45 : 0.25;
      const singleTarget = strikeWeapon === 'lance' || strikeWeapon === 'magnet';
      const targets = findStrikeTargets(snapshot, bot, strikeSpec.range, minDot, singleTarget);

      if (strikeWeapon === 'lance') {
        const reach = targets[0] ? Math.hypot(targets[0].x - bot.x, targets[0].z - bot.z) : strikeSpec.range;
        events.push(
          makeEvent({
            type: 'lance',
            x: bot.x + fx * 0.9,
            y: bot.y + 0.4,
            z: bot.z + fz * 0.9,
            x2: bot.x + fx * reach,
            y2: bot.y + 0.4,
            z2: bot.z + fz * reach,
            intensity: targets.length > 0 ? 1 : 0.4,
          }),
        );
      }

      for (const other of targets) {
        const dx = other.x - bot.x;
        const dz = other.z - bot.z;
        const dist = Math.hypot(dx, dz) || 1;
        const nx = dx / dist;
        const nz = dz / dist;
        const otherStats = computeBotStats(other.config, other.skills);
        const attackerEffMass = stats.mass * Math.pow(bot.scale, 1.35);
        const victimEffMass = otherStats.mass * Math.pow(other.scale, 1.35);
        const zone = getHitZone(other, nx, nz);

        if (strikeWeapon === 'magnet') {
          // Grapple: yank the target toward us and into our front weapons
          const pull = (11 * (1 + bot.skills.weaponTorque * 0.05)) / Math.max(0.7, victimEffMass * otherStats.knockbackResist);
          other.vx -= nx * pull;
          other.vz -= nz * pull;
          other.stunTimer = Math.max(other.stunTimer ?? 0, 0.25);
          events.push(
            makeEvent({
              type: 'magnet_pull',
              x: bot.x + fx * 0.9,
              y: bot.y + 0.55,
              z: bot.z + fz * 0.9,
              x2: other.x,
              y2: other.y + 0.5,
              z2: other.z,
              intensity: 1,
            }),
          );
          const geo = worldDirToVictimLocal(other, -nx, -nz, 0.1, 0.4, 0.3);
          applyDamage(other, bot, slotDmg, zone, events, false, undefined, 'magnet', { ...geo, force: 3, damageKind: 'kinetic' });
          continue;
        }

        const hitPower = (1 + slotDmg / 32) * overdriveMult * classDmgMult;
        const imp = (slotImpBase * hitPower * 1.15) / (victimEffMass * otherStats.knockbackResist);
        other.vx += nx * imp;
        other.vz += nz * imp;
        other.vy = Math.max(other.vy, (strikeSpec.lift * overdriveMult) / Math.max(0.75, victimEffMass));

        const crossYaw = fx * nz - fz * nx;
        other.angularVel += crossYaw * (imp * 0.65);
        const topDown = strikeWeapon === 'hammer' || strikeWeapon === 'jaws';
        other.pitch = topDown ? 0.45 / Math.max(0.7, victimEffMass) : -0.65 / Math.max(0.7, victimEffMass);
        other.roll = crossYaw * (0.85 / Math.max(0.7, victimEffMass));

        if (strikeWeapon === 'jaws') {
          other.pinnedTimer = Math.max(other.pinnedTimer ?? 0, 1.1);
        }

        const recoil = (imp * 0.24 * victimEffMass) / Math.max(0.7, attackerEffMass);
        bot.vx -= nx * recoil;
        bot.vz -= nz * recoil;

        const geo = topDown
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
            damageKind: topDown ? 'crush' : 'kinetic',
          },
          strikeSpec.armorPierce ?? 0,
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

  // Homing micro-missiles: steer, collide, detonate with splash
  {
    const projs = snapshot.projectiles ?? (snapshot.projectiles = []);
    const lim = arena.halfSize - 0.3;
    for (let i = projs.length - 1; i >= 0; i--) {
      const p = projs[i];
      p.life -= clampedDt;
      const tgt = p.targetId ? snapshot.bots.find((b) => b.id === p.targetId && !b.isDead) : undefined;
      if (tgt) {
        const desired = Math.atan2(tgt.x - p.x, tgt.z - p.z);
        const turn = normalizeAngle(desired - p.yaw);
        const maxTurn = 3.4 * clampedDt;
        p.yaw += Math.max(-maxTurn, Math.min(maxTurn, turn));
      }
      const speed = Math.min(19, Math.hypot(p.vx, p.vz) + 12 * clampedDt);
      p.vx = Math.sin(p.yaw) * speed;
      p.vz = Math.cos(p.yaw) * speed;
      p.x += p.vx * clampedDt;
      p.z += p.vz * clampedDt;
      p.y = Math.max(0.45, p.y - 0.25 * clampedDt);

      let detonate = p.life <= 0 || Math.abs(p.x) > lim || Math.abs(p.z) > lim;
      if (!detonate) {
        for (const b of snapshot.bots) {
          if (b.isDead || b.team === p.team || b.y > 2.2) continue;
          if (Math.hypot(b.x - p.x, b.z - p.z) < BASE_BOT_RADIUS * b.scale * 0.85 + 0.3) {
            detonate = true;
            break;
          }
        }
      }
      if (!detonate) {
        for (const pr of snapshot.props) {
          if (pr.destroyed || pr.kind.startsWith('pickup')) continue;
          if (Math.hypot(pr.x - p.x, pr.z - p.z) < pr.radius + 0.3) {
            pr.hp -= 28;
            detonate = true;
            break;
          }
        }
      }
      if (detonate) {
        explodeProjectile(snapshot, p, events);
        projs.splice(i, 1);
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
              if (getWeaponKind(rotorA) !== 'rotor') continue;
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
              if (getWeaponKind(rotorB) !== 'rotor') continue;
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
    // Props cracked open by missiles
    if (prop.hp <= 0 && !prop.kind.startsWith('pickup')) {
      breakProp(snapshot, prop, null, events, spawnedPickups);
      continue;
    }
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
          events.push(makeEvent({ type: 'pickup', x: prop.x, y: 0.6, z: prop.z, intensity: 1, targetId: bot.id, label: 'repair' }));
          break;
        }
        if (prop.kind === 'pickup_energy') {
          prop.destroyed = true;
          bot.energy = bot.maxEnergy;
          events.push(makeEvent({ type: 'pickup', x: prop.x, y: 0.6, z: prop.z, intensity: 1, targetId: bot.id, label: 'energy' }));
          break;
        }
        if (prop.kind === 'pickup_armor') {
          prop.destroyed = true;
          const add = bot.maxArmorZone * 0.5;
          bot.armorZones.front = Math.min(bot.maxArmorZone, bot.armorZones.front + add);
          bot.armorZones.left = Math.min(bot.maxArmorZone, bot.armorZones.left + add);
          bot.armorZones.right = Math.min(bot.maxArmorZone, bot.armorZones.right + add);
          bot.armorZones.rear = Math.min(bot.maxArmorZone, bot.armorZones.rear + add);
          events.push(makeEvent({ type: 'pickup', x: prop.x, y: 0.6, z: prop.z, intensity: 1, targetId: bot.id, label: 'armor' }));
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
          breakProp(snapshot, prop, bot, events, spawnedPickups);
          break;
        } else {
          events.push(makeEvent({ type: 'hit', x: prop.x, y: 0.5, z: prop.z, intensity: 0.6 }));
        }
      }
    }
  }
  if (spawnedPickups.length > 0) {
    snapshot.props.push(...spawnedPickups);
  }
  // Keep the prop list lean: drop consumed pickups
  if (snapshot.props.length > 40) {
    snapshot.props = snapshot.props.filter((p) => !(p.destroyed && p.kind.startsWith('pickup')));
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
        if (bot.isDead || bot.y > 0.8 || bot.config.drive === 'hover') continue;
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

    if (h.kind === 'pit') {
      for (const bot of snapshot.bots) {
        if (bot.isDead || bot.y > 0.35) continue;
        const dx = bot.x - h.x;
        const dz = bot.z - h.z;
        const d = Math.hypot(dx, dz);
        if (d < h.radius * 0.9 && (h.tickCooldown ?? 0) <= 0) {
          h.tickCooldown = 0.9;
          // Drop + emergency ejector: big damage and a launch back toward the center deck
          const toCx = -bot.x;
          const toCz = -bot.z;
          const cl = Math.hypot(toCx, toCz) || 1;
          bot.vx = (toCx / cl) * 8.5;
          bot.vz = (toCz / cl) * 8.5;
          bot.vy = 13;
          bot.roll += (Math.random() - 0.5) * 1.4;
          bot.pitch += (Math.random() - 0.5) * 1.2;
          events.push(makeEvent({ type: 'pit_fall', x: h.x, y: 0.2, z: h.z, intensity: 1.5, targetId: bot.id }));
          applyDamage(bot, null, bot.maxHp * 0.16 + escBonus * 4, 'rear', events, true, undefined, undefined, {
            ...zoneFallbackHit('rear', 'crush', 12),
          });
        }
      }
      continue;
    }

    if (h.kind === 'lightning') {
      if (!freshlyStruckBolts.has(h.id)) continue;
      for (const bot of snapshot.bots) {
        if (bot.isDead) continue;
        const d = Math.hypot(bot.x - h.x, bot.z - h.z);
        if (d < h.radius + BASE_BOT_RADIUS * 0.5 * bot.scale) {
          const falloff = 1 - Math.min(1, d / (h.radius + 1));
          bot.stunTimer = Math.max(bot.stunTimer ?? 0, 0.9);
          bot.energy = Math.max(0, bot.energy - 25);
          bot.vy = Math.max(bot.vy, 3.2);
          applyDamage(bot, null, (16 + escBonus * 3) * (0.55 + falloff * 0.45), 'rear', events, true, undefined, 'tesla', {
            ...zoneFallbackHit('rear', 'scorch', 8),
            normalY: 1,
          });
        }
      }
      continue;
    }

    if (h.kind === 'magnet_crane') {
      for (const bot of snapshot.bots) {
        if (bot.isDead) continue;
        const dx = h.x - bot.x;
        const dz = h.z - bot.z;
        const d = Math.hypot(dx, dz);
        if (d < h.radius && d > 0.05) {
          const botStats = computeBotStats(bot.config, bot.skills);
          const pull = ((15 + escBonus * 3) * (1.15 - d / h.radius)) / Math.max(0.8, botStats.mass * bot.scale);
          bot.vx += (dx / d) * pull * clampedDt;
          bot.vz += (dz / d) * pull * clampedDt;
        }
        if (d < 1.8 && (h.tickCooldown ?? 0) <= 0) {
          h.tickCooldown = 0.45;
          bot.vy = Math.max(bot.vy, 1.6);
          applyDamage(bot, null, 5 + escBonus, 'left', events, false, undefined, 'hammer', {
            ...zoneFallbackHit('left', 'crush', 6),
          });
        }
      }
      continue;
    }

    if (h.kind === 'lava') {
      for (const bot of snapshot.bots) {
        if (bot.isDead || bot.y > 0.3 || bot.config.drive === 'hover') continue;
        const d = Math.hypot(bot.x - h.x, bot.z - h.z);
        if (d < h.radius + BASE_BOT_RADIUS * 0.45 * bot.scale) {
          bot.burnTimer = Math.max(bot.burnTimer, 1.8);
          const slow = Math.exp(-2.5 * clampedDt);
          bot.vx *= slow;
          bot.vz *= slow;
          if ((h.tickCooldown ?? 0) <= 0) {
            h.tickCooldown = 0.5;
            applyDamage(bot, null, 4 + escBonus, 'rear', events, false, 'flame', 'flame', {
              ...zoneFallbackHit('rear', 'scorch', 4),
              normalY: -1,
            });
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
          if (bot.config.drive === 'hover') continue;
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

  // Final containment pass: collision & prop resolution can shove bots past the wall clamp
  for (const b of snapshot.bots) {
    const lim = arena.halfSize - BASE_BOT_RADIUS * b.scale * 0.85;
    if (b.x > lim) b.x = lim;
    else if (b.x < -lim) b.x = -lim;
    if (b.z > lim) b.z = lim;
    else if (b.z < -lim) b.z = -lim;
  }

  // King of the Hill zone scoring
  const hill = snapshot.hill;
  if (hill) {
    const teamsIn = new Set<number>();
    for (const b of snapshot.bots) {
      if (b.isDead) continue;
      if (Math.hypot(b.x - hill.x, b.z - hill.z) < hill.radius) teamsIn.add(b.team);
    }
    hill.contested = teamsIn.size > 1;
    if (teamsIn.size === 1) {
      const t = [...teamsIn][0];
      if (hill.owner !== t) {
        events.push(makeEvent({ type: 'hill_move', x: hill.x, y: 0.2, z: hill.z, intensity: 0.6, label: 'captured' }));
      }
      hill.owner = t;
      hill.scores[t] = Math.min(hill.target, (hill.scores[t] ?? 0) + clampedDt * 7.5);
    }
    hill.moveTimer -= clampedDt;
    if (hill.moveTimer <= 0) {
      const options = HILL_SPOTS.filter(([x, z]) => x !== hill.x || z !== hill.z);
      const [nx, nz] = options[Math.floor(Math.random() * options.length)];
      hill.x = nx;
      hill.z = nz;
      hill.owner = null;
      hill.moveTimer = 30;
      events.push(makeEvent({ type: 'hill_move', x: nx, y: 0.2, z: nz, intensity: 1, label: 'moved' }));
    }
  }

  if (snapshot.mode === 'survival') {
    const playersAlive = snapshot.bots.filter((b) => b.team === 0 && !b.isDead);
    const enemiesAlive = snapshot.bots.filter((b) => b.team !== 0 && !b.isDead);
    if (playersAlive.length === 0) {
      snapshot.phase = 'finished';
      snapshot.finishReason = 'ko';
      snapshot.winnerId = null;
      snapshot.winnerTeam = null;
    } else if (enemiesAlive.length === 0) {
      spawnSurvivalWave(snapshot, events);
    }
  } else if (snapshot.mode !== 'practice') {
    const aliveTeams = new Set(snapshot.bots.filter((b) => !b.isDead).map((b) => b.team));
    const hillWinner = hill
      ? Object.entries(hill.scores).find(([, sc]) => sc >= hill.target)
      : undefined;
    if (aliveTeams.size <= 1) {
      snapshot.phase = 'finished';
      snapshot.finishReason = 'ko';
      const survivor = snapshot.bots.find((b) => !b.isDead && !b.isBot) ?? snapshot.bots.find((b) => !b.isDead);
      snapshot.winnerId = survivor ? survivor.id : null;
      snapshot.winnerTeam = survivor ? survivor.team : null;
    } else if (hillWinner) {
      const team = Number(hillWinner[0]);
      snapshot.phase = 'finished';
      snapshot.finishReason = 'objective';
      snapshot.winnerTeam = team;
      const rep =
        snapshot.bots.find((b) => b.team === team && !b.isBot) ?? snapshot.bots.find((b) => b.team === team);
      snapshot.winnerId = rep?.id ?? null;
    } else if (snapshot.timeRemaining <= 0) {
      snapshot.phase = 'finished';
      snapshot.finishReason = 'time';
      // Timed battle Judges' Decision: weights remaining hull % + damage dealt + KOs (summed per team)
      const judgeScore = (b: BotPhysicsState) =>
        (b.hp / Math.max(1, b.maxHp)) * 100 + b.damageDealt * 0.16 + b.kos * 30;
      const teamScores = new Map<number, number>();
      for (const b of snapshot.bots) {
        const base = hill ? 0 : b.isDead ? b.damageDealt * 0.16 + b.kos * 30 : judgeScore(b);
        teamScores.set(b.team, (teamScores.get(b.team) ?? 0) + base);
      }
      if (hill) {
        for (const [t, sc] of Object.entries(hill.scores)) teamScores.set(Number(t), sc);
      }
      let bestTeam: number | null = null;
      let bestScore = -Infinity;
      teamScores.forEach((sc, t) => {
        if (!aliveTeams.has(t) && !hill) return;
        if (sc > bestScore) {
          bestScore = sc;
          bestTeam = t;
        }
      });
      snapshot.winnerTeam = bestTeam;
      const ranked = snapshot.bots
        .filter((b) => b.team === bestTeam && !b.isDead)
        .sort((a, b) => judgeScore(b) - judgeScore(a));
      snapshot.winnerId = ranked.find((b) => !b.isBot)?.id ?? ranked[0]?.id ?? null;
    }
  }


  snapshot.events = events;
  return events;
}

function findStrikeTargets(
  snapshot: ArenaSnapshot,
  bot: BotPhysicsState,
  range: number,
  minDot: number,
  single: boolean,
): BotPhysicsState[] {
  const fx = Math.sin(bot.yaw);
  const fz = Math.cos(bot.yaw);
  const hits: Array<{ b: BotPhysicsState; d: number }> = [];
  for (const other of snapshot.bots) {
    if (other.id === bot.id || other.isDead || other.team === bot.team) continue;
    const dx = other.x - bot.x;
    const dz = other.z - bot.z;
    const dist = Math.hypot(dx, dz);
    if (dist <= range + BASE_BOT_RADIUS * other.scale && dist > 0.01) {
      const dot = (dx / dist) * fx + (dz / dist) * fz;
      if (dot > minDot) hits.push({ b: other, d: dist });
    }
  }
  hits.sort((a, b) => a.d - b.d);
  return single ? hits.slice(0, 1).map((h) => h.b) : hits.map((h) => h.b);
}

function launchMissileSalvo(
  snapshot: ArenaSnapshot,
  bot: BotPhysicsState,
  count: number,
  damage: number,
  events: CombatEvent[],
) {
  const fx = Math.sin(bot.yaw);
  const fz = Math.cos(bot.yaw);
  // Lock the nearest rival in the forward hemisphere, else the nearest rival anywhere
  let best: BotPhysicsState | undefined;
  let bestScore = Infinity;
  for (const o of snapshot.bots) {
    if (o.isDead || o.team === bot.team) continue;
    const dx = o.x - bot.x;
    const dz = o.z - bot.z;
    const d = Math.hypot(dx, dz) || 1;
    const dot = (dx / d) * fx + (dz / d) * fz;
    const score = d * (dot > 0.2 ? 1 : 2.5);
    if (score < bestScore) {
      bestScore = score;
      best = o;
    }
  }
  const projs = snapshot.projectiles ?? (snapshot.projectiles = []);
  for (let i = 0; i < count; i++) {
    const yaw = bot.yaw + (i - (count - 1) / 2) * 0.32;
    projs.push({
      id: `m${nextProjectileId++}`,
      ownerId: bot.id,
      team: bot.team,
      x: bot.x + fx * 0.6 + Math.cos(bot.yaw) * (i - (count - 1) / 2) * 0.35,
      y: bot.y + 0.95,
      z: bot.z + fz * 0.6 - Math.sin(bot.yaw) * (i - (count - 1) / 2) * 0.35,
      vx: Math.sin(yaw) * 9,
      vz: Math.cos(yaw) * 9,
      yaw,
      life: 2.4,
      damage,
      targetId: best?.id,
    });
  }
  events.push(makeEvent({ type: 'missile_launch', x: bot.x, y: bot.y + 1, z: bot.z, intensity: 0.8, sourceId: bot.id, weapon: 'missiles' }));
}

function explodeProjectile(snapshot: ArenaSnapshot, p: Projectile, events: CombatEvent[]) {
  const owner = snapshot.bots.find((b) => b.id === p.ownerId) ?? null;
  events.push(makeEvent({ type: 'explosion', x: p.x, y: p.y, z: p.z, intensity: 0.55, weapon: 'missiles' }));
  const radius = 2.8;
  for (const victim of snapshot.bots) {
    if (victim.isDead || victim.team === p.team) continue;
    const dx = victim.x - p.x;
    const dz = victim.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > radius + BASE_BOT_RADIUS * victim.scale * 0.5) continue;
    const falloff = Math.max(0.25, 1 - d / (radius + 0.6));
    const nx = d > 0.01 ? dx / d : Math.sin(p.yaw);
    const nz = d > 0.01 ? dz / d : Math.cos(p.yaw);
    const vStats = computeBotStats(victim.config, victim.skills);
    const mass = vStats.mass * Math.pow(victim.scale, 1.35);
    const imp = (WEAPON_CATALOG.missiles.impulse * falloff) / Math.max(0.8, mass * vStats.knockbackResist);
    victim.vx += nx * imp;
    victim.vz += nz * imp;
    victim.vy = Math.max(victim.vy, (WEAPON_CATALOG.missiles.lift * falloff) / Math.max(0.8, mass));
    victim.roll += (Math.random() - 0.5) * 0.4 * falloff;
    const zone = getHitZone(victim, nx, nz);
    const geo = worldDirToVictimLocal(victim, -nx, -nz, 0.3, 0.45, 0.4);
    applyDamage(victim, owner, p.damage * (0.45 + 0.55 * falloff), zone, events, falloff > 0.8, undefined, 'missiles', {
      ...geo,
      force: 6 * falloff + 3,
      damageKind: 'kinetic',
    });
  }
}

function breakProp(
  snapshot: ArenaSnapshot,
  prop: DestructibleProp,
  breaker: BotPhysicsState | null,
  events: CombatEvent[],
  spawnedPickups: DestructibleProp[],
) {
  prop.destroyed = true;
  const pickupAt = (suffix: string, x: number, z: number, kind?: DestructibleProp['kind']) => {
    spawnedPickups.push({
      id: `pickup_${prop.id}_${suffix}_${snapshot.tick}`,
      kind: kind ?? (Math.random() < 0.5 ? 'pickup_repair' : Math.random() < 0.6 ? 'pickup_energy' : 'pickup_armor'),
      x,
      y: 0,
      z,
      radius: 0.75,
      hp: 1,
      maxHp: 1,
      destroyed: false,
    });
  };
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
        applyDamage(victim, breaker && breaker.id !== victim.id ? breaker : null, 20 * falloff, zone, events, true, undefined, undefined, {
          ...geo,
          force: 11 * falloff,
          damageKind: 'scorch',
        });
      }
    }
  } else if (prop.kind === 'crate') {
    events.push(makeEvent({ type: 'crate_break', x: prop.x, y: 0.5, z: prop.z, intensity: 1 }));
    pickupAt('a', prop.x, prop.z, Math.random() < 0.6 ? 'pickup_repair' : 'pickup_energy');
  } else if (prop.kind === 'scrap_heap') {
    events.push(makeEvent({ type: 'crate_break', x: prop.x, y: 0.6, z: prop.z, intensity: 1.4 }));
    events.push(makeEvent({ type: 'pillar_break', x: prop.x, y: 0.8, z: prop.z, intensity: 1 }));
    pickupAt('a', prop.x - 0.9, prop.z, 'pickup_armor');
    pickupAt('b', prop.x + 0.9, prop.z);
  } else if (prop.kind === 'pillar') {
    events.push(makeEvent({ type: 'pillar_break', x: prop.x, y: 1.0, z: prop.z, intensity: 1.2 }));
  }
}

function updateArenaEvent(snapshot: ArenaSnapshot, elapsed: number, dt: number, events: CombatEvent[]) {
  if (snapshot.mode === 'practice') return;
  const chaos = hasMod(snapshot, 'chaos_events');
  const current = snapshot.arenaEvent;
  if (current) {
    current.timeLeft -= dt;
    if (current.timeLeft <= 0) {
      if (current.kind === 'bounty') snapshot.bots.forEach((b) => (b.isBounty = false));
      snapshot.arenaEvent = null;
      snapshot.nextArenaEventAt = elapsed + (chaos ? 6 : 20) + Math.random() * (chaos ? 4 : 9);
    }
    return;
  }
  if (elapsed < (snapshot.nextArenaEventAt ?? 20)) return;

  const alive = snapshot.bots.filter((b) => !b.isDead);
  const pool: ArenaEventKind[] = ['supply_drop', 'power_surge', 'low_gravity', 'blackout'];
  if (snapshot.hazards.length > 0) pool.push('hazard_frenzy');
  if (alive.length >= 3) pool.push('bounty');
  const kind = pool[Math.floor(Math.random() * pool.length)];
  const info = ARENA_EVENT_INFO[kind];
  const ev: NonNullable<ArenaSnapshot['arenaEvent']> = {
    kind,
    label: info.label,
    timeLeft: info.duration,
    duration: info.duration,
  };

  if (kind === 'supply_drop') {
    const lim = ARENA_CATALOG[snapshot.arenaId].halfSize - 4;
    let px = 0;
    let pz = 0;
    for (let attempt = 0; attempt < 8; attempt++) {
      px = (Math.random() * 2 - 1) * lim;
      pz = (Math.random() * 2 - 1) * lim;
      const clear = snapshot.hazards.every((h) => Math.hypot(h.x - px, h.z - pz) > h.radius + 2.5);
      if (clear) break;
    }
    ev.x = px;
    ev.z = pz;
    const kinds: DestructibleProp['kind'][] = ['pickup_repair', 'pickup_energy', 'pickup_armor'];
    kinds.forEach((k, i) => {
      const a = (i / kinds.length) * Math.PI * 2;
      snapshot.props.push({
        id: `drop_${snapshot.tick}_${i}`,
        kind: k,
        x: px + Math.cos(a) * 1.4,
        y: 0,
        z: pz + Math.sin(a) * 1.4,
        radius: 0.75,
        hp: 1,
        maxHp: 1,
        destroyed: false,
      });
    });
  } else if (kind === 'bounty') {
    const ranked = [...alive].sort((a, b) => b.damageDealt + b.kos * 40 - (a.damageDealt + a.kos * 40));
    const mark = ranked[0];
    if (mark) {
      mark.isBounty = true;
      ev.targetId = mark.id;
      ev.x = mark.x;
      ev.z = mark.z;
    }
  }

  snapshot.arenaEvent = ev;
  events.push(makeEvent({ type: 'arena_event', x: ev.x ?? 0, y: 0.5, z: ev.z ?? 0, intensity: 1, label: kind, targetId: ev.targetId }));
}

/** Spawns the next survival wave (also called at match creation for wave 1). */
export function spawnSurvivalWave(snapshot: ArenaSnapshot, events: CombatEvent[] = []) {
  const wave = (snapshot.survivalWave ?? 0) + 1;
  snapshot.survivalWave = wave;
  const modifiers = snapshot.modifiers ?? [];

  // Clear wrecks from the previous wave
  snapshot.bots = snapshot.bots.filter((b) => b.team === 0 || !b.isDead);

  const isBossWave = wave % 5 === 0;
  const pool = AI_RIVAL_PRESETS.filter((p) => {
    if (wave <= 2) return p.weightClass === 'Lightweight';
    if (wave <= 4) return p.weightClass === 'Lightweight' || p.weightClass === 'Middleweight';
    if (wave <= 7) return p.weightClass === 'Middleweight' || p.weightClass === 'Heavyweight';
    return p.weightClass !== 'Lightweight';
  });
  const count = isBossWave ? 1 + Math.floor(wave / 10) : Math.min(4, 1 + Math.floor(wave / 2));
  const hpScale = 1 + (wave - 1) * 0.07;
  const dmgScale = 1 + (wave - 1) * 0.04;
  const skill = Math.min(5, Math.floor(wave / 2));

  const player = snapshot.bots.find((b) => b.team === 0 && !b.isDead);
  const lim = ARENA_CATALOG[snapshot.arenaId].halfSize - 4;
  const corners: Array<[number, number]> = [
    [-lim, -lim],
    [lim, lim],
    [-lim, lim],
    [lim, -lim],
    [0, -lim],
    [0, lim],
  ];
  corners.sort((a, b) => {
    const da = player ? Math.hypot(a[0] - player.x, a[1] - player.z) : 0;
    const db = player ? Math.hypot(b[0] - player.x, b[1] - player.z) : 0;
    return db - da;
  });

  for (let i = 0; i < count; i++) {
    const preset = isBossWave
      ? BOSS_PRESETS[(Math.floor(wave / 5) - 1 + i) % BOSS_PRESETS.length]
      : pool[Math.floor(Math.random() * pool.length)] ?? AI_RIVAL_PRESETS[0];
    const entry = presetToRoster(preset, `wave${wave}_${i}`, 1, skill, {
      hpMult: hpScale * (isBossWave ? 0.5 : 1),
      dmgMult: dmgScale * (isBossWave ? 0.85 : 1),
    });
    const [cx, cz] = corners[i % corners.length];
    snapshot.bots.push(makeBotState(entry, cx, cz, Math.atan2(-cx, -cz), modifiers));
  }

  if (wave > 1) {
    for (const b of snapshot.bots) {
      if (b.team !== 0 || b.isDead) continue;
      b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.25);
      b.energy = b.maxEnergy;
      const add = b.maxArmorZone * 0.3;
      b.armorZones.front = Math.min(b.maxArmorZone, b.armorZones.front + add);
      b.armorZones.left = Math.min(b.maxArmorZone, b.armorZones.left + add);
      b.armorZones.right = Math.min(b.maxArmorZone, b.armorZones.right + add);
      b.armorZones.rear = Math.min(b.maxArmorZone, b.armorZones.rear + add);
    }
  }
  events.push(makeEvent({ type: 'wave_start', x: 0, y: 0.5, z: 0, intensity: isBossWave ? 1.6 : 1, label: isBossWave ? `BOSS WAVE ${wave}` : `WAVE ${wave}` }));
}
