import {
  ARENA_CATALOG,
  ARENA_EVENT_INFO,
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
} from './types.ts';
import {
  addChill,
  addHeat,
  applyComponentDamage,
  dropArmorPlate,
  initComponents,
  isWeaponSlotOnline,
  shatterWreck,
  stepConditions,
  stepDebris,
  trySelfRight,
  tryFlip,
} from './damageModel.ts';

const BASE_BOT_RADIUS = 1.15;
const BASE_GRAVITY = 28;

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
  name: string;
  clanTag: string;
  roleTag: string;
  botLevel: number;
  weightClass: BotWeightClass;
  scale: number;
  hpMult: number;
  speedMult: number;
  dmgMult: number;
  config: BotConfig;
}

// 12 Distinct Bot Archetypes spanning all weight classes, clans, new weapons, armors & chassis
export const AI_RIVAL_PRESETS: RivalArchetypePreset[] = [
  {
    name: 'Volt Wasp',
    clanTag: 'VOLT',
    roleTag: 'Swarm Scout',
    botLevel: 1,
    weightClass: 'Lightweight',
    scale: 0.74,
    hpMult: 0.85,
    speedMult: 1.22,
    dmgMult: 0.76,
    config: {
      name: 'Volt Wasp',
      chassis: 'micro',
      armor: 'kevlar',
      weapon: 'sawblade',
      weapons: ['sawblade', 'tesla'],
      wheelLayout: 'rear_trike',
      drive: 'turbo',
      primaryColor: '#1D4ED8',
      accentColor: '#60A5FA',
      finishStyle: 'chrome',
      accessory: 'thruster_wings',
      underglowColor: '#38BDF8',
    },
  },
  {
    name: 'Frostbite Zero',
    clanTag: 'CRYO',
    roleTag: 'Cryo Controller',
    botLevel: 2,
    weightClass: 'Lightweight',
    scale: 0.92,
    hpMult: 0.94,
    speedMult: 1.14,
    dmgMult: 0.86,
    config: {
      name: 'Frostbite Zero',
      chassis: 'hover_disc',
      chassisStyles: ['hover_disc', 'wedge'],
      armor: 'aetherium',
      weapon: 'cryo_jet',
      weapons: ['cryo_jet', 'drum'],
      wheelLayout: 'omni_quad',
      drive: 'maglev',
      primaryColor: '#E2E8F0',
      accentColor: '#38BDF8',
      finishStyle: 'iridescent',
      accessory: 'halo_crown',
      underglowColor: '#38BDF8',
    },
  },
  {
    name: 'Torch Mantis',
    clanTag: 'APEX',
    roleTag: 'Thermal Striker',
    botLevel: 2,
    weightClass: 'Lightweight',
    scale: 0.96,
    hpMult: 0.92,
    speedMult: 1.12,
    dmgMult: 0.85,
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
      finishStyle: 'standard',
      accessory: 'twin_flags',
      underglowColor: '#F59E0B',
    },
  },
  {
    name: 'Aether Sovereign',
    clanTag: 'AETH',
    roleTag: 'Quantum Duelist',
    botLevel: 3,
    weightClass: 'Middleweight',
    scale: 1.04,
    hpMult: 1.08,
    speedMult: 1.05,
    dmgMult: 1.05,
    config: {
      name: 'Aether Sovereign',
      chassis: 'scorpion',
      chassisStyles: ['scorpion', 'wedge'],
      armor: 'aetherium',
      weapon: 'tesla',
      weapons: ['tesla', 'vspinner'],
      wheelLayout: 'omni_quad',
      drive: 'maglev',
      primaryColor: '#5B21B6',
      accentColor: '#C084FC',
      finishStyle: 'iridescent',
      accessory: 'halo_crown',
      underglowColor: '#A855F7',
    },
  },
  {
    name: 'Gyro Saucer',
    clanTag: 'APEX',
    roleTag: '360° Rotor Disc',
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
      finishStyle: 'gold_leaf',
      accessory: 'radar_dish',
      underglowColor: '#EF4444',
    },
  },
  {
    name: 'Pincer Jack',
    clanTag: 'VENM',
    roleTag: 'Grapple Crusher',
    botLevel: 3,
    weightClass: 'Middleweight',
    scale: 1.12,
    hpMult: 1.06,
    speedMult: 0.98,
    dmgMult: 1.04,
    config: {
      name: 'Pincer Jack',
      chassis: 'claw',
      chassisStyles: ['claw', 'spider'],
      armor: 'nanoweave',
      weapon: 'crush_jaw',
      weapons: ['crush_jaw', 'flipper'],
      wheelLayout: 'outboard',
      drive: 'omni',
      primaryColor: '#047857',
      accentColor: '#34D399',
      finishStyle: 'carbon_stealth',
      accessory: 'boss_spikes',
      underglowColor: '#10B981',
    },
  },
  {
    name: 'Gauss Stalker',
    clanTag: 'NOVA',
    roleTag: 'Rail Sniper',
    botLevel: 4,
    weightClass: 'Middleweight',
    scale: 1.02,
    hpMult: 1.12,
    speedMult: 1.04,
    dmgMult: 1.18,
    config: {
      name: 'Gauss Stalker',
      chassis: 'hydra',
      chassisStyles: ['hydra', 'wedge'],
      armor: 'ceramic',
      weapon: 'railgun',
      weapons: ['railgun', 'drum'],
      wheelLayout: '4wd_wide',
      drive: 'turbo',
      primaryColor: '#0F172A',
      accentColor: '#38BDF8',
      finishStyle: 'matte',
      accessory: 'radar_dish',
      underglowColor: '#38BDF8',
    },
  },
  {
    name: 'Obelisk Siege',
    clanTag: 'IRON',
    roleTag: 'Anvil Fortress',
    botLevel: 4,
    weightClass: 'Heavyweight',
    scale: 1.06,
    hpMult: 1.38,
    speedMult: 0.82,
    dmgMult: 1.25,
    config: {
      name: 'Obelisk Siege',
      chassis: 'monolith',
      chassisStyles: ['monolith', 'hex'],
      armor: 'reactive_era',
      weapon: 'hammer',
      weapons: ['hammer', 'sawblade'],
      wheelLayout: '6wd_inline',
      drive: 'heavy_torque',
      primaryColor: '#334155',
      accentColor: '#F59E0B',
      finishStyle: 'matte',
      accessory: 'tesla_horns',
      underglowColor: '#F59E0B',
    },
  },
  {
    name: 'Hellfire Howitzer',
    clanTag: 'NOVA',
    roleTag: 'Siege Artillery',
    botLevel: 4,
    weightClass: 'Heavyweight',
    scale: 1.16,
    hpMult: 1.42,
    speedMult: 0.84,
    dmgMult: 1.28,
    config: {
      name: 'Hellfire Howitzer',
      chassis: 'juggernaut',
      chassisStyles: ['juggernaut', 'turtle'],
      armor: 'reactive_era',
      weapon: 'mortar',
      weapons: ['mortar', 'flame', 'hbar'],
      wheelLayout: '8wd_crawler',
      drive: 'crawler_nuclear',
      primaryColor: '#7C2D12',
      accentColor: '#FB923C',
      finishStyle: 'standard',
      accessory: 'twin_flags',
      underglowColor: '#F97316',
    },
  },
  {
    name: 'Cryo Leviathan',
    clanTag: 'CRYO',
    roleTag: 'Glacier Dreadnought',
    botLevel: 4,
    weightClass: 'Heavyweight',
    scale: 1.18,
    hpMult: 1.45,
    speedMult: 0.82,
    dmgMult: 1.22,
    config: {
      name: 'Cryo Leviathan',
      chassis: 'hex',
      chassisStyles: ['hex', 'rammer'],
      armor: 'tungsten',
      weapon: 'drum',
      weapons: ['drum', 'cryo_jet', 'flipper'],
      wheelLayout: '8wd_crawler',
      drive: 'tracks',
      primaryColor: '#1E3A8A',
      accentColor: '#38BDF8',
      finishStyle: 'chrome',
      accessory: 'boss_spikes',
      underglowColor: '#38BDF8',
    },
  },
  {
    name: 'Titan Behemoth',
    clanTag: 'TITN',
    roleTag: 'Colossus Warlord',
    botLevel: 5,
    weightClass: 'Titan',
    scale: 1.32,
    hpMult: 1.62,
    speedMult: 0.72,
    dmgMult: 1.36,
    config: {
      name: 'Titan Behemoth',
      chassis: 'behemoth',
      chassisStyles: ['behemoth', 'rammer'],
      armor: 'tungsten',
      weapon: 'vspinner',
      weapons: ['vspinner', 'flame', 'hammer'],
      wheelLayout: '8wd_crawler',
      drive: 'tracks',
      primaryColor: '#18181B',
      accentColor: '#EAB308',
      finishStyle: 'gold_leaf',
      accessory: 'boss_spikes',
      underglowColor: '#F59E0B',
    },
  },
  {
    name: 'Sting Ray',
    clanTag: 'TIDE',
    roleTag: 'Hover Lancer',
    botLevel: 2,
    weightClass: 'Lightweight',
    scale: 0.9,
    hpMult: 0.9,
    speedMult: 1.15,
    dmgMult: 0.85,
    config: {
      name: 'Sting Ray',
      chassis: 'scorpion',
      armor: 'kevlar',
      weapon: 'lance',
      weapons: ['lance', 'sawblade'],
      wheelLayout: '4wd_wide',
      drive: 'hover',
      primaryColor: '#0F766E',
      accentColor: '#5EEAD4',
      finishStyle: 'iridescent',
      accessory: 'thruster_wings',
      underglowColor: '#38BDF8',
      pattern: 'stripes',
    },
  },
  {
    name: 'Scrap Jaw',
    clanTag: 'RUST',
    roleTag: 'Grapple Brawler',
    botLevel: 3,
    weightClass: 'Middleweight',
    scale: 1.1,
    hpMult: 1.06,
    speedMult: 0.96,
    dmgMult: 1.02,
    config: {
      name: 'Scrap Jaw',
      chassis: 'claw',
      armor: 'reactive_era',
      weapon: 'crush_jaw',
      weapons: ['crush_jaw', 'magnet'],
      wheelLayout: '6wd_inline',
      drive: 'omni',
      primaryColor: '#3F6212',
      accentColor: '#A3E635',
      finishStyle: 'matte',
      accessory: 'radar_dish',
      underglowColor: '#10B981',
      pattern: 'digital_camo',
    },
  },
  {
    name: 'Rocket Hex',
    clanTag: 'BOOM',
    roleTag: 'Missile Artillery',
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
      finishStyle: 'standard',
      accessory: 'twin_flags',
      underglowColor: '#EF4444',
      pattern: 'hex',
    },
  },
  {
    name: 'Omega Prime',
    clanTag: 'AETH',
    roleTag: 'Apex Raid Boss',
    botLevel: 5,
    weightClass: 'Titan',
    scale: 1.36,
    hpMult: 1.85,
    speedMult: 0.78,
    dmgMult: 1.45,
    config: {
      name: 'Omega Prime',
      chassis: 'juggernaut',
      chassisStyles: ['juggernaut', 'behemoth', 'scorpion'],
      armor: 'aetherium',
      weapon: 'railgun',
      weapons: ['railgun', 'tesla', 'mortar'],
      wheelLayout: '8wd_crawler',
      drive: 'crawler_nuclear',
      primaryColor: '#3B0764',
      accentColor: '#38BDF8',
      finishStyle: 'iridescent',
      accessory: 'halo_crown',
      underglowColor: '#EC4899',
    },
  },
];

let nextEventId = 1;
const emitInto = (events: CombatEvent[]) => (p: Omit<CombatEvent, 'id'>) => {
  events.push(makeEvent(p));
};

function makeEvent(partial: Omit<CombatEvent, 'id'>): CombatEvent {
  return {
    id: nextEventId++,
    ...partial,
  };
}

// Raid / campaign bosses: huge, slow, multi-weapon monsters (Omega Prime stays in the main roster)
export const BOSS_PRESETS: RivalArchetypePreset[] = [
  {
    name: 'The Overlord',
    clanTag: 'BOSS',
    roleTag: 'League Owner Colossus',
    botLevel: 6,
    weightClass: 'Titan',
    scale: 1.52,
    hpMult: 3.2,
    speedMult: 0.66,
    dmgMult: 1.3,
    config: {
      name: 'THE OVERLORD',
      chassis: 'behemoth',
      chassisStyles: ['behemoth', 'juggernaut', 'monolith'],
      armor: 'tungsten',
      weapon: 'drum',
      weapons: ['drum', 'tesla', 'missiles'],
      wheelLayout: '8wd_crawler',
      drive: 'tracks',
      primaryColor: '#0B1120',
      accentColor: '#EF4444',
      finishStyle: 'chrome',
      accessory: 'boss_spikes',
      underglowColor: '#EF4444',
      pattern: 'tiger',
    },
  },
  {
    name: 'Iron Maw',
    clanTag: 'BOSS',
    roleTag: 'Grapple Crusher Boss',
    botLevel: 6,
    weightClass: 'Titan',
    scale: 1.46,
    hpMult: 2.9,
    speedMult: 0.72,
    dmgMult: 1.25,
    config: {
      name: 'IRON MAW',
      chassis: 'claw',
      chassisStyles: ['claw', 'behemoth'],
      armor: 'reactive_era',
      weapon: 'crush_jaw',
      weapons: ['crush_jaw', 'magnet', 'hammer'],
      wheelLayout: '6wd_inline',
      drive: 'heavy_torque',
      primaryColor: '#3F4A2E',
      accentColor: '#A3E635',
      finishStyle: 'matte',
      accessory: 'tesla_horns',
      underglowColor: '#10B981',
      pattern: 'digital_camo',
    },
  },
  {
    name: 'Storm Queen',
    clanTag: 'BOSS',
    roleTag: 'Hovering Lightning Boss',
    botLevel: 6,
    weightClass: 'Titan',
    scale: 1.4,
    hpMult: 2.7,
    speedMult: 0.84,
    dmgMult: 1.2,
    config: {
      name: 'STORM QUEEN',
      chassis: 'hover_disc',
      chassisStyles: ['hover_disc', 'ufo', 'turtle'],
      armor: 'aetherium',
      weapon: 'tesla',
      weapons: ['tesla', 'hbar', 'missiles'],
      wheelLayout: 'outboard',
      drive: 'hover',
      primaryColor: '#1E1B4B',
      accentColor: '#60A5FA',
      finishStyle: 'iridescent',
      accessory: 'halo_crown',
      underglowColor: '#38BDF8',
      pattern: 'circuit',
    },
  },
];

export function presetKey(p: RivalArchetypePreset): string {
  return p.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export function getRivalPreset(key: string): RivalArchetypePreset {
  return (
    AI_RIVAL_PRESETS.find((p) => presetKey(p) === key) ??
    BOSS_PRESETS.find((p) => presetKey(p) === key) ??
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
  const isBoss = BOSS_PRESETS.includes(preset) || preset.roleTag.toLowerCase().includes('boss');
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
    isBoss,
    config: preset.config,
    skills: {
      chassisReinforcement: lvl,
      weaponTorque: lvl,
      gyroStabilizer: Math.max(1, lvl - 1),
      kineticArmor: lvl,
      batteryCore: Math.max(1, lvl - 1),
      coolingSystem: Math.max(0, lvl - 2),
      naniteRepair: 0,
      overclockCore: Math.max(0, lvl - 2),
    },
    isBot: true,
    team,
  };
}

export interface SnapshotOptions {
  modifiers?: MatchModifierId[];
}

let nextProjectileId = 1;
// Active snapshot context for damage resolution (set per physics step)
let activeSnap: ArenaSnapshot | null = null;

function hasMod(snap: ArenaSnapshot | null, mod: MatchModifierId): boolean {
  return Boolean(snap?.modifiers?.includes(mod));
}

function isUntimedMode(mode: GameMode): boolean {
  return mode === 'practice' || mode === 'survival';
}

function isRotorWeapon(w: WeaponId): boolean {
  return w === 'vspinner' || w === 'hbar' || w === 'sawblade' || w === 'drum';
}

function makeBotState(
  entry: BotRosterTemplate,
  spawn: [number, number, number],
  modifiers: MatchModifierId[],
): BotPhysicsState {
  const stats = computeBotStats(entry.config, entry.skills);
  const botWeapons = getBotWeapons(entry.config);
  const scaledHp = Math.round(stats.maxHp * (entry.hpMult ?? 1));
  const maxShield = Math.round(stats.maxShieldHp * (entry.hpMult ?? 1));
  const zoneHp = modifiers.includes('armor_off') ? 0 : stats.armorZoneHp;
  const giant = modifiers.includes('giants') ? 1.25 : 1;
  const state: BotPhysicsState = {
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
    shieldHp: maxShield,
    maxShieldHp: maxShield,
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
    freezeTimer: 0,
    shockTimer: 0,
    damageBoostTimer: 0,
    eraBlocksRemaining: entry.config.armor === 'reactive_era' ? 3 : 0,
    naniteTickTimer: 1.4,
    collisionDmgCooldown: 0,
    flameDmgCooldown: 0,
    burnTickTimer: 0,
    pinnedTimer: 0,
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
  initComponents(state);
  return state;
}

/** Team-aware spawns: free-for-all uses the four corners; squads line up on opposite sides. */
function computeSpawns(roster: BotRosterTemplate[]): Array<[number, number, number]> {
  const legacy: Array<[number, number, number]> = [
    [-10, 10, Math.PI * 0.75],
    [10, -10, -Math.PI * 0.25],
    [-10, -10, Math.PI * 0.25],
    [10, 10, -Math.PI * 0.75],
    [-12, 0, Math.PI * 0.5],
    [12, 0, -Math.PI * 0.5],
  ];
  const teamOrder: number[] = [];
  for (const r of roster) if (!teamOrder.includes(r.team)) teamOrder.push(r.team);
  if (teamOrder.length === roster.length) {
    return roster.map((_, idx) => legacy[idx % legacy.length]);
  }
  const counters: Record<number, number> = {};
  const sizes: Record<number, number> = {};
  for (const r of roster) sizes[r.team] = (sizes[r.team] ?? 0) + 1;
  return roster.map((r) => {
    const tIdx = teamOrder.indexOf(r.team);
    const memberIdx = counters[r.team] ?? 0;
    counters[r.team] = memberIdx + 1;
    const theta = Math.PI + (tIdx * Math.PI * 2) / Math.max(2, teamOrder.length);
    const radius = 11;
    const cx = Math.sin(theta) * radius;
    const cz = Math.cos(theta) * radius;
    const spread = (memberIdx - (sizes[r.team] - 1) / 2) * 3.6;
    const x = cx + Math.cos(theta) * spread;
    const z = cz - Math.sin(theta) * spread;
    return [x, z, Math.atan2(-x, -z)];
  });
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
  const bots: BotPhysicsState[] = roster.map((entry, idx) => makeBotState(entry, spawns[idx], modifiers));

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

  if (arenaId === 'skyforge') {
    // Pits sit on the E/W/N/S lanes: keep those lanes clear of pillars
    for (const pr of props) if (pr.kind === 'barrel') pr.destroyed = true;
  }
  if (arenaId === 'storm') {
    props.push(
      { id: 'rod_n', kind: 'pillar', x: 0, y: 0, z: -11, radius: 1.05, hp: 95, maxHp: 95, destroyed: false },
      { id: 'rod_s', kind: 'pillar', x: 0, y: 0, z: 11, radius: 1.05, hp: 95, maxHp: 95, destroyed: false },
    );
  }
  if (arenaId === 'toxic_scrapyard' || arenaId === 'aether_nexus') {
    props.push(
      { id: 'crate_nw_extra', kind: 'crate', x: -9.2, y: 0, z: -4.2, radius: 0.85, hp: 22, maxHp: 22, destroyed: false },
      { id: 'crate_se_extra', kind: 'crate', x: 9.2, y: 0, z: 4.2, radius: 0.85, hp: 22, maxHp: 22, destroyed: false },
    );
  }

  const effectiveDuration = isUntimedMode(mode) ? 600 : Math.max(60, Math.min(600, durationSeconds));
  const tier2Unlock = mode === 'practice' ? 8 : Math.min(26, Math.round(effectiveDuration * 0.2));
  const tier3Unlock = mode === 'practice' ? 16 : Math.min(54, Math.round(effectiveDuration * 0.44));

  const pit = (id: string, x: number, z: number, phase: number, unlockAt: number): HazardState => ({
    id, kind: 'pit', x, z, radius: 1.8, active: false, warning: false, phase, unlockAt, cyclePeriod: 9, warningDuration: 1.4, activeDuration: 5,
  });
  const bolt = (id: string, x: number, z: number, phase: number, unlockAt: number): HazardState => ({
    id, kind: 'lightning', x, z, radius: 2.3, active: false, warning: false, phase, unlockAt, cyclePeriod: 5.5, warningDuration: 1.5, activeDuration: 0.3,
  });
  const arenaHazards: HazardState[] =
    arenaId === 'skyforge'
      ? [
          pit('pit_w', -7.4, 0, 0, 0),
          pit('pit_e', 7.4, 0, 4.5, 0),
          pit('pit_n', 0, -7.4, 2.2, tier2Unlock),
          pit('pit_s', 0, 7.4, 6.7, tier2Unlock),
          { id: 'flip_c', kind: 'flipper_pad', x: 0, z: 0, radius: 1.75, active: false, warning: false, phase: 1.0, unlockAt: 0, cyclePeriod: 5.0, warningDuration: 0.9, activeDuration: 0.5 },
          { id: 'sblade_nw', kind: 'spinner_blade', x: -9, z: -9, radius: 1.15, armLength: 2.85, active: false, warning: false, phase: 1.2, unlockAt: tier3Unlock, cyclePeriod: 10.5, warningDuration: 1.5, activeDuration: 5.4, sweepAngle: 0 },
          { id: 'sblade_se', kind: 'spinner_blade', x: 9, z: 9, radius: 1.15, armLength: 2.85, active: false, warning: false, phase: 6.4, unlockAt: tier3Unlock, cyclePeriod: 10.5, warningDuration: 1.5, activeDuration: 5.4, sweepAngle: Math.PI * 0.5 },
        ]
      : arenaId === 'storm'
        ? [
            { id: 'emp_c', kind: 'emp_ring', x: 0, z: 0, radius: 2.9, active: false, warning: false, phase: 0, unlockAt: 0, cyclePeriod: 7.0, warningDuration: 1.1, activeDuration: 1.6 },
            bolt('bolt_1', -6, -6, 0, 3),
            bolt('bolt_2', 6, 6, 2.75, 3),
            bolt('bolt_3', 6, -6, 1.4, tier2Unlock),
            { id: 'saw_w', kind: 'saw', x: -11, z: 0, radius: 1.45, active: true, warning: false, phase: 0.6, unlockAt: 0 },
            { id: 'saw_e', kind: 'saw', x: 11, z: 0, radius: 1.45, active: true, warning: false, phase: 2.6, unlockAt: 0 },
            { id: 'sblade_sw', kind: 'spinner_blade', x: -4.2, z: 4.2, radius: 1.15, armLength: 2.85, active: false, warning: false, phase: 1.2, unlockAt: tier3Unlock, cyclePeriod: 10.5, warningDuration: 1.5, activeDuration: 5.4, sweepAngle: 0 },
            { id: 'sblade_ne', kind: 'spinner_blade', x: 4.2, z: -4.2, radius: 1.15, armLength: 2.85, active: false, warning: false, phase: 6.4, unlockAt: tier3Unlock, cyclePeriod: 10.5, warningDuration: 1.5, activeDuration: 5.4, sweepAngle: Math.PI * 0.5 },
          ]
        : arenaId === 'foundry'
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
          : arenaId === 'aether_nexus'
            ? [
                { id: 'emp_nw', kind: 'emp_ring', x: -4.5, z: -4.5, radius: 2.6, active: false, warning: false, phase: 0, unlockAt: 0, cyclePeriod: 5.8, warningDuration: 1.1, activeDuration: 1.5 },
                { id: 'emp_se', kind: 'emp_ring', x: 4.5, z: 4.5, radius: 2.6, active: false, warning: false, phase: 2.9, unlockAt: 0, cyclePeriod: 5.8, warningDuration: 1.1, activeDuration: 1.5 },
                { id: 'flip_c', kind: 'flipper_pad', x: 0, z: 0, radius: 1.8, active: false, warning: false, phase: 1.2, unlockAt: 0, cyclePeriod: 4.6, warningDuration: 0.8, activeDuration: 0.5 },
                { id: 'sblade_ne', kind: 'spinner_blade', x: 4.2, z: -4.2, radius: 1.15, armLength: 3.1, active: false, warning: false, phase: 0.5, unlockAt: tier2Unlock, cyclePeriod: 9.8, warningDuration: 1.4, activeDuration: 5.6, sweepAngle: 0 },
                { id: 'sblade_sw', kind: 'spinner_blade', x: -4.2, z: 4.2, radius: 1.15, armLength: 3.1, active: false, warning: false, phase: 5.4, unlockAt: tier2Unlock, cyclePeriod: 9.8, warningDuration: 1.4, activeDuration: 5.6, sweepAngle: Math.PI * 0.5 },
              ]
            : arenaId === 'toxic_scrapyard'
              ? [
                  { id: 'acid_c', kind: 'acid_pool', x: 0, z: 0, radius: 2.7, active: true, warning: false, phase: 0, unlockAt: 0, cyclePeriod: 5.0, warningDuration: 1.0, activeDuration: 2.6 },
                  { id: 'saw_w', kind: 'saw', x: -5.2, z: 0, radius: 1.45, active: true, warning: false, phase: 0, unlockAt: 0 },
                  { id: 'saw_e', kind: 'saw', x: 5.2, z: 0, radius: 1.45, active: true, warning: false, phase: Math.PI, unlockAt: 0 },
                  { id: 'crusher_n', kind: 'crusher', x: 0, z: -6.0, radius: 1.9, active: false, warning: false, phase: 1.2, unlockAt: tier2Unlock, cyclePeriod: 10.5, warningDuration: 1.7, activeDuration: 1.0, crusherY: 1 },
                  { id: 'crusher_s', kind: 'crusher', x: 0, z: 6.0, radius: 1.9, active: false, warning: false, phase: 6.4, unlockAt: tier2Unlock, cyclePeriod: 10.5, warningDuration: 1.7, activeDuration: 1.0, crusherY: 1 },
                ]
              : arenaId === 'volcano_caldera'
                ? [
                    { id: 'lava_c', kind: 'lava_vent', x: 0, z: 0, radius: 2.6, active: false, warning: false, phase: 0, unlockAt: 0, cyclePeriod: 5.4, warningDuration: 1.1, activeDuration: 1.8 },
                    { id: 'saw_nw', kind: 'saw', x: -4.8, z: -4.8, radius: 1.45, active: true, warning: false, phase: 0, unlockAt: 0 },
                    { id: 'saw_ne', kind: 'saw', x: 4.8, z: -4.8, radius: 1.45, active: true, warning: false, phase: 1.5, unlockAt: 0 },
                    { id: 'saw_sw', kind: 'saw', x: -4.8, z: 4.8, radius: 1.45, active: true, warning: false, phase: 3.0, unlockAt: 0 },
                    { id: 'saw_se', kind: 'saw', x: 4.8, z: 4.8, radius: 1.45, active: true, warning: false, phase: 4.5, unlockAt: 0 },
                    { id: 'crusher_w', kind: 'crusher', x: -6.2, z: 0, radius: 1.85, active: false, warning: false, phase: 2.0, unlockAt: tier2Unlock, cyclePeriod: 11.0, warningDuration: 1.7, activeDuration: 1.0, crusherY: 1 },
                    { id: 'crusher_e', kind: 'crusher', x: 6.2, z: 0, radius: 1.85, active: false, warning: false, phase: 7.5, unlockAt: tier2Unlock, cyclePeriod: 11.0, warningDuration: 1.7, activeDuration: 1.0, crusherY: 1 },
                  ]
                : arenaId === 'cyber_grid'
                  ? [
                      { id: 'flip_w', kind: 'flipper_pad', x: -4.6, z: 0, radius: 1.7, active: false, warning: false, phase: 0, unlockAt: 0, cyclePeriod: 4.4, warningDuration: 0.8, activeDuration: 0.5 },
                      { id: 'flip_e', kind: 'flipper_pad', x: 4.6, z: 0, radius: 1.7, active: false, warning: false, phase: 2.2, unlockAt: 0, cyclePeriod: 4.4, warningDuration: 0.8, activeDuration: 0.5 },
                      { id: 'emp_c', kind: 'emp_ring', x: 0, z: 0, radius: 2.8, active: false, warning: false, phase: 1.0, unlockAt: 0, cyclePeriod: 6.2, warningDuration: 1.1, activeDuration: 1.5 },
                      { id: 'sblade_n', kind: 'spinner_blade', x: 0, z: -5.2, radius: 1.15, armLength: 3.0, active: false, warning: false, phase: 0.5, unlockAt: tier2Unlock, cyclePeriod: 9.5, warningDuration: 1.4, activeDuration: 5.5, sweepAngle: 0 },
                      { id: 'sblade_s', kind: 'spinner_blade', x: 0, z: 5.2, radius: 1.15, armLength: 3.0, active: false, warning: false, phase: 5.2, unlockAt: tier2Unlock, cyclePeriod: 9.5, warningDuration: 1.4, activeDuration: 5.5, sweepAngle: Math.PI * 0.5 },
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
  const hazards = modifiers.includes('no_hazards') ? [] : arenaHazards;

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
    winningTeam: null,
    projectiles: [],
    debris: [],
    modifiers,
    arenaEvent: null,
    nextArenaEventAt: modifiers.includes('chaos_events') ? 8 : 20 + Math.random() * 6,
    hill:
      mode === 'king_hill'
        ? { x: 0, z: 0, radius: 3.4, scores: {}, owner: null, contested: false, target: 100, moveTimer: 30 }
        : null,
    survivalWave: mode === 'survival' ? 0 : undefined,
    survivalKills: mode === 'survival' ? 0 : undefined,
    gravityMult: ARENA_CATALOG[arenaId]?.gravityMult ?? 1,
  };
  if (mode === 'survival') {
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
  if (weaponId === 'flame' || weaponId === 'tesla' || weaponId === 'mortar') return 'scorch';
  if (weaponId === 'hammer' || weaponId === 'crush_jaw') return 'crush';
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
) {
  if (victim.isDead) return 0;

  const stats = computeBotStats(victim.config, victim.skills);
  let mult = 1.0;

  // Railgun pierces 60% of frontal deflection
  const deflectFactor =
    weaponId === 'railgun' ? stats.frontDeflect * 0.4 : weaponId === 'lance' ? stats.frontDeflect * 0.55 : stats.frontDeflect;

  if (zone === 'front') {
    mult *= 1 - deflectFactor;
  } else if (zone === 'rear') {
    mult *= 1.28;
  } else {
    mult *= 1.1;
  }

  // Brittle frozen armor takes +20% kinetic/blade/crush damage
  if ((victim.freezeTimer ?? 0) > 0 && weaponId !== 'flame' && weaponId !== 'cryo_jet') {
    mult *= 1.2;
  }

  // Attacker Overcharge damage boost orb (+35% damage)
  if (attacker && (attacker.damageBoostTimer ?? 0) > 0) {
    mult *= 1.35;
  }

  // Match modifiers, arena events and roster damage scaling
  if (hasMod(activeSnap, 'double_damage')) mult *= 2;
  if (victim.isBounty) mult *= 1.4;
  if (attacker) {
    mult *= attacker.dmgMult ?? 1;
    if (activeSnap?.arenaEvent?.kind === 'power_surge') mult *= 1.15;
  }

  const zoneArmor = victim.armorZones[zone];
  if (zoneArmor <= 0) {
    mult *= 1.2;
  }
  // Softened (melted) plates give way more easily
  mult *= 1 + (victim.meltZones?.[zone] ?? 0) * 0.35;

  let finalDamage = Math.max(2, Math.round(rawDamage * mult));

  // Explosive Reactive Armor (ERA) passive blast on heavy hits
  if (
    victim.config.armor === 'reactive_era' &&
    (victim.eraBlocksRemaining ?? 0) > 0 &&
    finalDamage >= 13 &&
    attacker &&
    attacker.id !== victim.id
  ) {
    victim.eraBlocksRemaining = (victim.eraBlocksRemaining ?? 1) - 1;
    finalDamage = Math.max(3, Math.round(finalDamage * 0.55));
    const dx = attacker.x - victim.x;
    const dz = attacker.z - victim.z;
    const dist = Math.hypot(dx, dz) || 1;
    attacker.vx += (dx / dist) * 7.5;
    attacker.vz += (dz / dist) * 7.5;
    events.push(
      makeEvent({
        type: 'era_blast',
        x: victim.x,
        y: victim.y + 0.55,
        z: victim.z,
        intensity: 1.3,
        targetId: victim.id,
        sourceId: attacker.id,
        callout: 'ERA REACTIVE BLAST!',
      }),
    );
  }

  // Aetherium Energy Shield absorbs 70% of incoming damage while active
  if ((victim.shieldHp ?? 0) > 0) {
    const absorbed = Math.min(victim.shieldHp!, Math.ceil(finalDamage * 0.7));
    victim.shieldHp = Math.max(0, victim.shieldHp! - absorbed);
    finalDamage = Math.max(1, finalDamage - absorbed);
    events.push(
      makeEvent({
        type: 'shield_hit',
        x: victim.x,
        y: victim.y + 0.65,
        z: victim.z,
        intensity: 0.9,
        targetId: victim.id,
      }),
    );
  }

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
    const armorShredMult = weaponId === 'crush_jaw' || weaponId === 'sawblade' || weaponId === 'lance' ? 1.25 : 0.85;
    const nextZone = Math.max(0, zoneArmor - finalDamage * armorShredMult);
    victim.armorZones[zone] = nextZone;
    if (nextZone === 0) {
      dropArmorPlate(activeSnap, victim, zone);
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
          callout: `${zone.toUpperCase()} ARMOR SHATTERED!`,
        }),
      );
    }
  }

  victim.hp = Math.max(0, victim.hp - finalDamage);
  if (eventTypeOverride !== 'flame' || weaponId) {
    applyComponentDamage(activeSnap, victim, finalDamage, zone, zoneArmor, hy, hz, dmgKind, weaponId, emitInto(events));
  }

  if (attacker) {
    attacker.hitsDealt += 1;
    attacker.damageDealt += finalDamage;
    if (hasMod(activeSnap, 'vampire') && !attacker.isDead) {
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + finalDamage * 0.2);
    }
  }

  const isCritEvent = zone === 'rear' || isWeaponCrit;
  events.push(
    makeEvent({
      type: eventTypeOverride ?? (isCritEvent ? 'crit' : 'hit'),
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
      callout: isCritEvent && finalDamage >= 18 ? `CRITICAL ${finalDamage} DMG!` : undefined,
    }),
  );

  if (victim.hp <= 0) {
    victim.isDead = true;
    victim.vx *= 0.4;
    victim.vz *= 0.4;
    victim.vy = 5.6;
    victim.angularVel += (Math.random() - 0.5) * 6;
    victim.isBounty = false;
    victim.flipped = false;
    shatterWreck(activeSnap, victim);
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
        callout: `KNOCKOUT! ${victim.config.name} DESTROYED!`,
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

  // Target selection: nearest rival, pulled toward bounty marks and nearly-dead bots
  let target = enemies[0];
  let bestScore = Infinity;
  for (const e of enemies) {
    const d = Math.hypot(e.x - bot.x, e.z - bot.z);
    const score = d - (e.isBounty ? 5 : 0) - (e.hp < e.maxHp * 0.25 ? 2.5 : 0);
    if (score < bestScore) {
      bestScore = score;
      target = e;
    }
  }
  const minDist = Math.hypot(target.x - bot.x, target.z - bot.z);
  let targetX = target.x;
  let targetZ = target.z;

  // King of the Hill: contest the zone when our team isn't holding it
  const hill = snapshot.hill;
  if (hill) {
    const dHill = Math.hypot(hill.x - bot.x, hill.z - bot.z);
    const held = hill.owner === bot.team && !hill.contested;
    if (!held && dHill > hill.radius * 0.6 && minDist > 4.5) {
      targetX = hill.x;
      targetZ = hill.z;
    }
  }

  // Seek pickups when damaged or when an Overcharge/Shield orb is nearby
  for (const p of snapshot.props) {
    if (p.destroyed) continue;
    const isOrb =
      (bot.hp < bot.maxHp * 0.55 && p.kind === 'pickup_repair') ||
      p.kind === 'pickup_overcharge' ||
      p.kind === 'pickup_shield';
    if (isOrb) {
      const d = Math.hypot(p.x - bot.x, p.z - bot.z);
      if (d < 11) {
        targetX = p.x;
        targetZ = p.z;
        break;
      }
    }
  }

  const hovering = bot.config.drive === 'hover';
  for (const h of snapshot.hazards) {
    if (!h.active && !h.warning) continue;
    if (hovering && (h.kind === 'saw' || h.kind === 'spinner_blade' || h.kind === 'lava_vent' || h.kind === 'acid_pool')) continue;
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
    throttle = -0.32;
  }
  throttle *= 0.78 + difficulty * 0.18;

  const weapons = getBotWeapons(bot.config);
  const aimDiff = Math.abs(normalizeAngle(Math.atan2(target.x - bot.x, target.z - bot.z) - bot.yaw));
  const fireWeapons = weapons.map((w, idx) => {
    if (w === 'missiles') return minDist < 15 && aimDiff < 0.55 && bot.energy > 28 && (bot.weaponCooldowns?.[idx] ?? 0) <= 0;
    if (w === 'magnet') return minDist > 3.2 && minDist < 7.5 && aimDiff < 0.45;
    if (w === 'lance') return minDist < 4.4 && aimDiff < 0.35;
    if (w === 'vspinner' || w === 'hbar' || w === 'sawblade' || w === 'drum') return minDist < 8.5;
    if (w === 'railgun') return minDist < 10.2 && Math.abs(diff) < 0.28;
    if (w === 'mortar') return minDist > 2.2 && minDist < 8.5 && Math.abs(diff) < 0.45;
    if (w === 'tesla') return minDist < 5.2 && Math.abs(diff) < 0.55;
    if (w === 'flame' || w === 'cryo_jet') return minDist < 5.0 && Math.abs(diff) < 0.5;
    return minDist < 3.9 && Math.abs(diff) < 0.48;
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
  const arena = ARENA_CATALOG[snapshot.arenaId] || ARENA_CATALOG.foundry;
  let gravity = BASE_GRAVITY * (arena.gravityMult ?? 1.0);

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
  gravity *= (hasMod(snapshot, 'low_gravity') ? 0.5 : 1) * (arenaEventKind === 'low_gravity' ? 0.4 : 1);
  const turboMult = hasMod(snapshot, 'turbo') ? 1.3 : 1;

  const freshlySlammedCrushers = new Set<string>();
  const freshlyStruckBolts = new Set<string>();

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
      h.phase = activeElapsed * cadenceMult;
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
    } else if (h.kind === 'pit' || h.kind === 'lightning') {
      const period = (h.cyclePeriod ?? 8) / cadenceMult;
      const warnDur = h.warningDuration ?? 1.2;
      const activeDur = h.activeDuration ?? 2;
      const cyclePos = (activeElapsed + h.phase) % period;
      h.warning = cyclePos >= period - warnDur - activeDur && cyclePos < period - activeDur;
      h.active = cyclePos >= period - activeDur;
      if (h.kind === 'lightning') {
        if (!wasWarning && h.warning) {
          // Re-target: usually near a live bot (leading its motion), sometimes a random patch of deck
          const live = snapshot.bots.filter((b) => !b.isDead);
          const lim = arena.halfSize - 3;
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
            makeEvent({ type: 'lightning', x: h.x, y: 0.1, z: h.z, targetX: h.x, targetY: 16, targetZ: h.z, intensity: 1.4 + (escalation - 1) * 0.2 }),
          );
        }
      }
    } else if (h.kind === 'emp_ring' || h.kind === 'lava_vent' || h.kind === 'acid_pool') {
      const period = (h.cyclePeriod ?? 5.8) / cadenceMult;
      const warnDur = h.warningDuration ?? 1.1;
      const activeDur = h.activeDuration ?? 1.8;
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

    if (!wasWarning && h.warning && (h.kind === 'crusher' || h.kind === 'spinner_blade' || h.kind === 'pit' || h.kind === 'lightning')) {
      events.push(makeEvent({ type: 'hazard_warn', x: h.x, y: 0.5, z: h.z, intensity: 0.7 }));
    }
  }

  for (const bot of snapshot.bots) {
    const stats = computeBotStats(bot.config, bot.skills);
    const classSpeedMult =
      bot.weightClass === 'Titan' ? 0.72 : bot.weightClass === 'Heavyweight' ? 0.85 : bot.weightClass === 'Lightweight' ? 1.12 : 1.0;
    const classDmgMult =
      bot.weightClass === 'Titan' ? 1.24 : bot.weightClass === 'Heavyweight' ? 1.14 : bot.weightClass === 'Lightweight' ? 0.8 : 1.0;

    const rawInput = bot.isBot
      ? computeAiInput(bot, snapshot, aiDifficulty)
      : inputsByBotId[bot.id] ?? { throttle: 0, steer: 0, fireWeapon: false, boost: false, overdrive: false };
    const input: PlayerInputState = { ...rawInput, fireWeapons: rawInput.fireWeapons ? [...rawInput.fireWeapons] : undefined };

    bot.weaponCooldown = Math.max(0, bot.weaponCooldown - clampedDt);
    bot.boostCooldown = Math.max(0, bot.boostCooldown - clampedDt);
    bot.overdriveTimer = Math.max(0, bot.overdriveTimer - clampedDt);
    bot.freezeTimer = Math.max(0, (bot.freezeTimer ?? 0) - clampedDt);
    bot.shockTimer = Math.max(0, (bot.shockTimer ?? 0) - clampedDt);
    bot.damageBoostTimer = Math.max(0, (bot.damageBoostTimer ?? 0) - clampedDt);
    bot.collisionDmgCooldown = Math.max(0, (bot.collisionDmgCooldown ?? 0) - clampedDt);
    bot.flameDmgCooldown = Math.max(0, (bot.flameDmgCooldown ?? 0) - clampedDt);
    bot.burnTickTimer = Math.max(0, (bot.burnTickTimer ?? 0) - clampedDt);
    bot.pinnedTimer = Math.max(0, (bot.pinnedTimer ?? 0) - clampedDt);
    const speedMod = (1 + ((bot.speedMult ?? 1) - 1) * 0.5) * turboMult;
    const emit = emitInto(events);
    const cond = stepConditions(snapshot, bot, clampedDt, emit);
    if (!bot.isDead && (cond.frozen || bot.flipped)) {
      // Frozen bots are statues; inverted bots spend boost on the self-righting kick
      const wantsRight = bot.flipped && input.boost;
      input.boost = false;
      if (cond.frozen) {
        input.throttle = 0;
        input.steer = 0;
        input.fireWeapon = false;
        input.fireWeapons = input.fireWeapons?.map(() => false);
        input.overdrive = false;
      }
      if (wantsRight) trySelfRight(bot, emit);
    }

    // Passive Nanoweave Armor & Nanite Repair Skill Regeneration
    const naniteRank = bot.skills.naniteRepair ?? 0;
    if (!bot.isDead && (bot.config.armor === 'nanoweave' || naniteRank > 0)) {
      bot.naniteTickTimer = (bot.naniteTickTimer ?? 1.5) - clampedDt;
      if (bot.naniteTickTimer <= 0) {
        bot.naniteTickTimer = 1.5;
        const hpHeal = (bot.config.armor === 'nanoweave' ? 5 : 0) + naniteRank * 2;
        const zoneHeal = (bot.config.armor === 'nanoweave' ? 4 : 0) + naniteRank * 1.5;
        bot.hp = Math.min(bot.maxHp, bot.hp + hpHeal);
        (['front', 'left', 'right', 'rear'] as Array<keyof ArmorZones>).forEach((z) => {
          if (bot.armorZones[z] > 0) {
            bot.armorZones[z] = Math.min(bot.maxArmorZone, bot.armorZones[z] + zoneHeal);
          }
        });
      }
    }

    // Passive Aetherium Shield Recharge
    if (!bot.isDead && (bot.maxShieldHp ?? 0) > 0 && (bot.shieldHp ?? 0) < (bot.maxShieldHp ?? 0)) {
      bot.shieldHp = Math.min(bot.maxShieldHp!, (bot.shieldHp ?? 0) + 4.5 * clampedDt);
    }

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

    // Thermal burn damage over time from Plasma Flame or Lava Vents
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
      bot.energy + stats.energyRegen * arena.energyRegenMult * (arenaEventKind === 'power_surge' ? 2.5 : 1) * cond.regen * clampedDt,
    );

    const overclockRank = bot.skills.overclockCore ?? 0;
    if (input.overdrive && bot.energy >= 40 && bot.overdriveTimer <= 0) {
      bot.energy -= 40;
      bot.overdriveTimer = 4.5 + overclockRank * 0.45;
      bot.freezeTimer = 0;
      bot.shockTimer = 0;
      bot.hp = Math.min(bot.maxHp, bot.hp + Math.round(bot.maxHp * 0.14));
      events.push(
        makeEvent({
          type: 'pickup',
          x: bot.x,
          y: bot.y + 0.7,
          z: bot.z,
          intensity: 0.9,
          callout: `${bot.config.name} OVERDRIVE!`,
        }),
      );
    }

    const freezeSlowMult = cond.frozen ? 0 : 1 - 0.65 * ((bot.chill ?? 0) / 100);
    const shockTurnMult = (bot.shockTimer ?? 0) > 0 ? 0.52 : 1.0;
    const overdriveMult = (bot.overdriveTimer > 0 ? 1.22 : 1.0) * freezeSlowMult;

    const hasExplicitSlotArray = Array.isArray(input.fireWeapons);
    const isSlotFiring = (slotIdx: number) =>
      (hasExplicitSlotArray ? Boolean(input.fireWeapons![slotIdx]) : Boolean(input.fireWeapon)) &&
      isWeaponSlotOnline(bot, slotIdx, botWeapons[slotIdx]);

    const firedDiscreteSlots: Array<{ slotIdx: number; weaponId: WeaponId }> = [];
    let flameFiringSlotIdx = -1;
    let cryoFiringSlotIdx = -1;

    const coolingRank = bot.skills.coolingSystem ?? 0;
    for (let slotIdx = 0; slotIdx < botWeapons.length; slotIdx++) {
      const wId = botWeapons[slotIdx];
      const wSpec = WEAPON_CATALOG[wId];
      const slotFiring = isSlotFiring(slotIdx);
      const slotCooldownDur = Number(
        Math.max(0.2, wSpec.cooldown * (1 - bot.skills.weaponTorque * 0.035 - coolingRank * 0.045)).toFixed(2),
      );

      if (isRotorWeapon(wId)) {
        const baseTarget = wId === 'drum' ? 28 : 24;
        const slotAlive = isWeaponSlotOnline(bot, slotIdx, wId);
        const targetSpin = !slotAlive ? 0 : slotFiring ? baseTarget * overdriveMult : 9 * freezeSlowMult;
        bot.weaponSpins[slotIdx] += (targetSpin - bot.weaponSpins[slotIdx]) * Math.min(1, clampedDt * 5);
        bot.weaponAngles[slotIdx] += bot.weaponSpins[slotIdx] * clampedDt;
        bot.weaponActives[slotIdx] = slotFiring;
        if (slotFiring && bot.energy > 1) {
          bot.energy = Math.max(0, bot.energy - 2.4 * clampedDt);
        }
      } else if (wId === 'flame' || wId === 'cryo_jet') {
        const firingStream = slotFiring && bot.energy > 3;
        bot.weaponActives[slotIdx] = firingStream;
        bot.weaponSpins[slotIdx] = firingStream ? 1.0 : 0;
        if (firingStream) {
          if (wId === 'flame') flameFiringSlotIdx = slotIdx;
          else cryoFiringSlotIdx = slotIdx;
          bot.energy = Math.max(0, bot.energy - 9.0 * clampedDt);
        }
      } else {
        // Discrete strike / ranged weapons (flipper / hammer / crush_jaw / tesla / railgun / mortar)
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

    bot.weaponSpin = bot.weaponSpins[0] ?? 0;
    bot.weaponAngle = bot.weaponAngles[0] ?? 0;
    bot.weaponActive = bot.weaponActives.some(Boolean);
    bot.weaponCooldown = bot.weaponCooldowns[0] ?? 0;

    const fx = Math.sin(bot.yaw);
    const fz = Math.cos(bot.yaw);
    const steerFactor = Math.max(-1, Math.min(1, input.steer)) * shockTurnMult * cond.turn * Math.max(0.2, freezeSlowMult);
    const pinned = (bot.pinnedTimer ?? 0) > 0;
    const throttleFactor = Math.max(-1, Math.min(1, input.throttle)) * (pinned ? 0.15 : 1);

    const rotDamp = Math.exp(-(6.5 + bot.skills.gyroStabilizer * 0.9) * clampedDt);
    bot.angularVel *= rotDamp;
    // Uneven traction drags the bot toward its damaged side under power
    const tractionPull = bot.y <= 0.15 ? throttleFactor * cond.pull : 0;
    bot.yaw = normalizeAngle(bot.yaw + (steerFactor * stats.turnRate + bot.angularVel + tractionPull) * clampedDt);

    if (input.boost && bot.boostCooldown <= 0 && bot.energy >= 24) {
      bot.energy -= 24;
      bot.boostCooldown = Math.max(1.7, 2.4 - coolingRank * 0.1);
      const impulse = (6.2 + overclockRank * 0.35) * overdriveMult * classSpeedMult * speedMod;
      bot.vx += fx * impulse;
      bot.vz += fz * impulse;
      bot.pitch = -0.1;
    }

    if (bot.y <= 0.15) {
      const driveForce = throttleFactor * stats.accel * overdriveMult * classSpeedMult * speedMod * cond.drive;
      bot.vx += fx * driveForce * clampedDt;
      bot.vz += fz * driveForce * clampedDt;

      const rx = Math.cos(bot.yaw);
      const rz = -Math.sin(bot.yaw);
      const forwardSpeed = bot.vx * fx + bot.vz * fz;
      const lateralSpeed = bot.vx * rx + bot.vz * rz;

      const lateralGrip =
        arena.friction *
        (bot.config.drive === 'tracks' || bot.config.drive === 'crawler_nuclear'
          ? 1.55
          : bot.config.drive === 'hover'
            ? 0.5
            : 1.05);
      const dampedLateral = lateralSpeed * Math.exp(-lateralGrip * clampedDt);
      const forwardDrag = Math.abs(throttleFactor) < 0.05 ? arena.friction * 1.05 : 1.05;
      const dampedForward = forwardSpeed * Math.exp(-forwardDrag * clampedDt);

      bot.vx = fx * dampedForward + rx * dampedLateral;
      bot.vz = fz * dampedForward + rz * dampedLateral;

      const speed = Math.hypot(bot.vx, bot.vz);
      const cap = stats.maxSpeed * overdriveMult * classSpeedMult * speedMod * Math.max(0.25, cond.drive);
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

    // Flame & Cryo Stream Cone Attacks
    if ((flameFiringSlotIdx >= 0 || cryoFiringSlotIdx >= 0) && (bot.flameDmgCooldown ?? 0) <= 0) {
      bot.flameDmgCooldown = 0.36;
      const isCryo = cryoFiringSlotIdx >= 0 && flameFiringSlotIdx < 0;
      const activeStreamSlot = isCryo ? cryoFiringSlotIdx : flameFiringSlotIdx;
      const streamSpec = isCryo ? WEAPON_CATALOG.cryo_jet : WEAPON_CATALOG.flame;

      events.push(
        makeEvent({
          type: isCryo ? 'cryo_blast' : 'flame',
          x: bot.x + fx * 1.8,
          y: bot.y + 0.45,
          z: bot.z + fz * 1.8,
          intensity: 0.75,
          weapon: isCryo ? 'cryo_jet' : 'flame',
        }),
      );

      const streamRange = Math.max(streamSpec.range, stats.weaponRange);
      const streamDmg =
        streamSpec.damage *
        (activeStreamSlot === 0 ? 1.0 : 0.78) *
        (1 + bot.skills.weaponTorque * 0.075) *
        overdriveMult *
        classDmgMult;

      for (const other of snapshot.bots) {
        if (other.id === bot.id || other.isDead || other.team === bot.team) continue;
        const dx = other.x - bot.x;
        const dz = other.z - bot.z;
        const dist = Math.hypot(dx, dz);
        if (dist <= streamRange + BASE_BOT_RADIUS * other.scale && dist > 0.01) {
          const nx = dx / dist;
          const nz = dz / dist;
          const dot = nx * fx + nz * fz;
          if (dot > 0.55) {
            const zone = getHitZone(other, nx, nz);
            const geo = worldDirToVictimLocal(other, -nx, -nz, 0.2, 0.42, 0.35);
            const resistMult = other.config.armor === 'ceramic' ? 0.6 : 1.0;
            if (isCryo) {
              other.freezeTimer = Math.max(other.freezeTimer ?? 0, 2.6 * resistMult);
              addChill(other, 19 * (1 - Math.max(0, dist - 1.5) / (streamRange * 2)), emitInto(events));
            } else {
              other.burnTimer = Math.max(other.burnTimer, 2.2 * resistMult);
              addHeat(other, 10 * (1 - Math.max(0, dist - 1.5) / (streamRange * 2)));
            }
            applyDamage(
              other,
              bot,
              streamDmg,
              zone,
              events,
              false,
              isCryo ? 'cryo_blast' : 'flame',
              isCryo ? 'cryo_jet' : 'flame',
              {
                ...geo,
                force: 5.2,
                damageKind: 'scorch',
              },
            );
          }
        }
      }
    }

    // Discrete & Ranged Weapons: Flipper, Hammer, Hydraulic Jaws, Tesla Arc, Gauss Railgun, Plasma Mortar
    for (const { slotIdx, weaponId: strikeWeapon } of firedDiscreteSlots) {
      const strikeSpec = WEAPON_CATALOG[strikeWeapon];
      const slotDmg =
        strikeSpec.damage *
        (slotIdx === 0 ? 1.0 : 0.8) *
        (1 + bot.skills.weaponTorque * 0.075) *
        overdriveMult *
        classDmgMult;
      const slotImpBase = strikeSpec.impulse * (1 + bot.skills.weaponTorque * 0.05);

      if (strikeWeapon === 'mortar') {
        // Artillery Mortar: lob a ballistic shell; it lands where the target is heading
        let targetX = bot.x + fx * 5.2;
        let targetZ = bot.z + fz * 5.2;
        const flight = 0.95;
        for (const other of snapshot.bots) {
          if (other.id === bot.id || other.isDead || other.team === bot.team) continue;
          const dx = other.x - bot.x;
          const dz = other.z - bot.z;
          const d = Math.hypot(dx, dz);
          if (d >= 2.0 && d <= strikeSpec.range && (dx * fx + dz * fz) / d > 0.45) {
            targetX = other.x + other.vx * flight * 0.7;
            targetZ = other.z + other.vz * flight * 0.7;
            break;
          }
        }
        targetX = Math.max(-botHalf, Math.min(botHalf, targetX));
        targetZ = Math.max(-botHalf, Math.min(botHalf, targetZ));
        const sx = bot.x + fx * 0.3;
        const sy = bot.y + 1.0;
        const sz = bot.z + fz * 0.3;
        const projs = snapshot.projectiles ?? (snapshot.projectiles = []);
        projs.push({
          id: `s${nextProjectileId++}`,
          ownerId: bot.id,
          team: bot.team,
          kind: 'shell',
          x: sx,
          y: sy,
          z: sz,
          vx: (targetX - sx) / flight,
          vz: (targetZ - sz) / flight,
          vy: (0.3 - sy + 0.5 * gravity * flight * flight) / flight,
          yaw: bot.yaw,
          life: flight + 0.6,
          damage: slotDmg,
        });
        bot.pitch = 0.1;
        events.push(
          makeEvent({
            type: 'mortar_launch',
            x: sx,
            y: sy,
            z: sz,
            targetX,
            targetY: 0.3,
            targetZ,
            intensity: 1,
            weapon: 'mortar',
            sourceId: bot.id,
          }),
        );
        continue;
      }

      if (strikeWeapon === 'railgun') {
        // Long-range electromagnetic rail slug
        let hitTarget: BotPhysicsState | null = null;
        let bestDist = strikeSpec.range + 1.5;
        for (const other of snapshot.bots) {
          if (other.id === bot.id || other.isDead || other.team === bot.team) continue;
          const dx = other.x - bot.x;
          const dz = other.z - bot.z;
          const dist = Math.hypot(dx, dz);
          if (dist <= strikeSpec.range + BASE_BOT_RADIUS * other.scale && dist > 0.01) {
            const nx = dx / dist;
            const nz = dz / dist;
            const dot = nx * fx + nz * fz;
            if (dot > 0.82 && dist < bestDist) {
              bestDist = dist;
              hitTarget = other;
            }
          }
        }

        const endX = hitTarget ? hitTarget.x : bot.x + fx * strikeSpec.range;
        const endZ = hitTarget ? hitTarget.z : bot.z + fz * strikeSpec.range;
        events.push(
          makeEvent({
            type: 'rail_shot',
            x: bot.x + fx * 1.2,
            y: bot.y + 0.52,
            z: bot.z + fz * 1.2,
            targetX: endX,
            targetY: 0.52,
            targetZ: endZ,
            intensity: 1.5,
            weapon: 'railgun',
            sourceId: bot.id,
            targetId: hitTarget?.id,
          }),
        );

        // Recoil kick
        bot.vx -= fx * 2.4;
        bot.vz -= fz * 2.4;
        bot.pitch = 0.14;

        if (hitTarget) {
          const dx = hitTarget.x - bot.x;
          const dz = hitTarget.z - bot.z;
          const dist = Math.hypot(dx, dz) || 1;
          const nx = dx / dist;
          const nz = dz / dist;
          const otherStats = computeBotStats(hitTarget.config, hitTarget.skills);
          const imp = (slotImpBase * 1.25) / Math.max(0.8, otherStats.mass * otherStats.knockbackResist);
          hitTarget.vx += nx * imp;
          hitTarget.vz += nz * imp;
          hitTarget.vy = Math.max(hitTarget.vy, strikeSpec.lift);
          const zone = getHitZone(hitTarget, nx, nz);
          const geo = worldDirToVictimLocal(hitTarget, -nx, -nz, 0.1, 0.42, 0.18);
          applyDamage(hitTarget, bot, slotDmg, zone, events, true, undefined, 'railgun', {
            ...geo,
            force: imp * 1.5,
            damageKind: 'kinetic',
          });
        }
        continue;
      }

      if (strikeWeapon === 'tesla') {
        // Chain-lightning Tesla arc hitting up to 2 enemies in front cone
        let arcsFired = 0;
        for (const other of snapshot.bots) {
          if (other.id === bot.id || other.isDead || other.team === bot.team) continue;
          const dx = other.x - bot.x;
          const dz = other.z - bot.z;
          const dist = Math.hypot(dx, dz);
          if (dist <= strikeSpec.range + BASE_BOT_RADIUS * other.scale && dist > 0.01) {
            const nx = dx / dist;
            const nz = dz / dist;
            if (nx * fx + nz * fz > 0.35) {
              arcsFired++;
              const empResist = other.config.armor === 'aetherium' ? 0.5 : 1.0;
              other.energy = Math.max(0, other.energy - 16 * empResist);
              other.shockTimer = Math.max(other.shockTimer ?? 0, 1.8 * empResist);
              other.vx += nx * slotImpBase * 0.6;
              other.vz += nz * slotImpBase * 0.6;
              const zone = getHitZone(other, nx, nz);
              const geo = worldDirToVictimLocal(other, -nx, -nz, 0.25, 0.48, 0.3);
              events.push(
                makeEvent({
                  type: 'tesla_arc',
                  x: bot.x + fx * 1.0,
                  y: bot.y + 0.55,
                  z: bot.z + fz * 1.0,
                  targetX: other.x,
                  targetY: other.y + 0.5,
                  targetZ: other.z,
                  intensity: 1.2,
                  weapon: 'tesla',
                  targetId: other.id,
                  sourceId: bot.id,
                }),
              );
              applyDamage(other, bot, slotDmg, zone, events, true, 'tesla_arc', 'tesla', {
                ...geo,
                force: slotImpBase,
                damageKind: 'scorch',
              });
              if (arcsFired >= 2) break;
            }
          }
        }
        if (arcsFired === 0) {
          events.push(
            makeEvent({
              type: 'tesla_arc',
              x: bot.x + fx * 1.8,
              y: bot.y + 0.55,
              z: bot.z + fz * 1.8,
              intensity: 0.7,
              weapon: 'tesla',
              sourceId: bot.id,
            }),
          );
        }
        continue;
      }

      if (strikeWeapon === 'missiles') {
        launchMissileSalvo(snapshot, bot, slotIdx === 0 ? 3 : 2, slotDmg, events);
        continue;
      }

      if (strikeWeapon === 'magnet' || strikeWeapon === 'lance') {
        const target = findStrikeTargets(snapshot, bot, strikeSpec.range, strikeWeapon === 'lance' ? 0.82 : 0.55, true)[0];
        if (strikeWeapon === 'lance') {
          const reach = target ? Math.hypot(target.x - bot.x, target.z - bot.z) : strikeSpec.range;
          events.push(
            makeEvent({
              type: 'lance',
              x: bot.x + fx * 0.9,
              y: bot.y + 0.4,
              z: bot.z + fz * 0.9,
              targetX: bot.x + fx * reach,
              targetY: bot.y + 0.4,
              targetZ: bot.z + fz * reach,
              intensity: target ? 1 : 0.4,
              weapon: 'lance',
            }),
          );
        }
        if (target) {
          const dx = target.x - bot.x;
          const dz = target.z - bot.z;
          const dist = Math.hypot(dx, dz) || 1;
          const nx = dx / dist;
          const nz = dz / dist;
          const tStats = computeBotStats(target.config, target.skills);
          const tMass = Math.max(0.7, tStats.mass * Math.pow(target.scale, 1.35) * tStats.knockbackResist);
          const zone = getHitZone(target, nx, nz);
          if (strikeWeapon === 'magnet') {
            // Grapple: yank the target into our front weapons
            const pull = slotImpBase / tMass;
            target.vx -= nx * pull;
            target.vz -= nz * pull;
            target.shockTimer = Math.max(target.shockTimer ?? 0, 0.5);
            events.push(
              makeEvent({
                type: 'magnet_pull',
                x: bot.x + fx * 0.9,
                y: bot.y + 0.55,
                z: bot.z + fz * 0.9,
                targetX: target.x,
                targetY: target.y + 0.5,
                targetZ: target.z,
                intensity: 1,
                weapon: 'magnet',
              }),
            );
            const geo = worldDirToVictimLocal(target, -nx, -nz, 0.1, 0.4, 0.3);
            applyDamage(target, bot, slotDmg, zone, events, false, undefined, 'magnet', { ...geo, force: 3, damageKind: 'kinetic' });
          } else {
            const imp = (slotImpBase * (1 + slotDmg / 32)) / tMass;
            target.vx += nx * imp;
            target.vz += nz * imp;
            target.vy = Math.max(target.vy, strikeSpec.lift);
            target.pitch = -0.4 / Math.max(0.7, tMass);
            bot.vx -= fx * 1.2;
            bot.vz -= fz * 1.2;
            const geo = worldDirToVictimLocal(target, -nx, -nz, -0.05, 0.34, 0.18);
            applyDamage(target, bot, slotDmg, zone, events, true, undefined, 'lance', {
              ...geo,
              force: Math.max(6, imp * 1.5),
              damageKind: 'kinetic',
            });
          }
        }
        continue;
      }

      // Close-range discrete strikes: Flipper, Overhead Hammer, Hydraulic Jaws
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

            if (strikeWeapon === 'crush_jaw') {
              // Hydraulic jaws clamp and pull/pin the target briefly
              other.vx *= 0.25;
              other.vz *= 0.25;
              other.vy = Math.max(other.vy, 2.2);
              other.pinnedTimer = Math.max(other.pinnedTimer ?? 0, 0.9);
            } else {
              other.vx += nx * imp;
              other.vz += nz * imp;
              other.vy = Math.max(
                other.vy,
                (strikeSpec.lift * overdriveMult) / Math.max(0.75, victimEffMass),
              );
            }

            const crossYaw = fx * nz - fz * nx;
            other.angularVel += crossYaw * (imp * 0.65);
            other.pitch =
              strikeWeapon === 'hammer' || strikeWeapon === 'crush_jaw'
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
                damageKind: strikeWeapon === 'hammer' || strikeWeapon === 'crush_jaw' ? 'crush' : 'kinetic',
              },
            );
            if (strikeWeapon === 'flipper' || strikeWeapon === 'hammer') {
              tryFlip(
                other,
                strikeWeapon === 'flipper' ? strikeSpec.lift * overdriveMult * 1.7 : strikeSpec.lift * 0.6,
                victimEffMass,
                crossYaw,
                emitInto(events),
                strikeWeapon === 'flipper' ? bot.config.name.toUpperCase() : '',
              );
            }
            if (strikeWeapon === 'flipper') {
              events.push(
                makeEvent({
                  type: 'flip',
                  x: (bot.x + other.x) * 0.5,
                  y: other.y + 0.6,
                  z: (bot.z + other.z) * 0.5,
                  intensity: Math.min(1.8, imp / 5.5),
                  weapon: 'flipper',
                  callout: 'PNEUMATIC LAUNCH!',
                }),
              );
            }
          }
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
      if (p.kind === 'shell') {
        p.vy = (p.vy ?? 0) - gravity * clampedDt;
        p.x += p.vx * clampedDt;
        p.y += (p.vy ?? 0) * clampedDt;
        p.z += p.vz * clampedDt;
        p.yaw = Math.atan2(p.vx, p.vz);
        if (p.y <= 0.3 || p.life <= 0) {
          p.y = 0.3;
          detonateMortar(snapshot, p, events);
          projs.splice(i, 1);
        }
        continue;
      }
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

  stepDebris(snapshot, arena.halfSize, gravity, clampedDt, emitInto(events));

  // Bot-to-Bot Collisions & Continuous Rotor/Saw/Drum Power Hits
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

          const spinTransfer = Math.max(-4.5, Math.min(4.5, velAlongTangent * 0.45));
          a.angularVel -= (spinTransfer * massB) / totalMass;
          b.angularVel += (spinTransfer * massA) / totalMass;

          const impactSpeed = -velAlongNormal;
          if (impactSpeed > 3.6 && a.team !== b.team) {
            const reducedMass = (massA * massB) / totalMass;
            const kineticEnergy = 0.5 * reducedMass * impactSpeed * impactSpeed;
            const ramBonusA = a.config.armor === 'steel' || a.config.armor === 'tungsten' ? 1.22 : 1.0;
            const ramBonusB = b.config.armor === 'steel' || b.config.armor === 'tungsten' ? 1.22 : 1.0;

            if (!a.isDead && (b.collisionDmgCooldown ?? 0) <= 0) {
              b.collisionDmgCooldown = 0.28;
              const zoneB = getHitZone(b, nx, nz);
              const ramDmgA = Math.min(13, kineticEnergy * 0.36 * (massA / massB) * ramBonusA);
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
              const ramDmgB = Math.min(13, kineticEnergy * 0.36 * (massB / massA) * ramBonusB);
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

        // Spinner / Blade / Saw / Drum contact engagement
        const weaponsA = getBotWeapons(a.config);
        const weaponsB = getBotWeapons(b.config);
        const isRotor = isRotorWeapon;

        if (a.team !== b.team) {
          const afx = Math.sin(a.yaw);
          const afz = Math.cos(a.yaw);
          const aFacingB = afx * nx + afz * nz;
          if (!a.isDead && !b.isDead && aFacingB > 0.25) {
            for (let slotIdx = 0; slotIdx < weaponsA.length; slotIdx++) {
              const rotorA = weaponsA[slotIdx];
              if (!isRotor(rotorA)) continue;
              if (!isWeaponSlotOnline(a, slotIdx, rotorA)) continue;
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

              if (rotorA === 'hbar' || rotorA === 'drum') {
                b.angularVel += (afx * nz - afz * nx >= 0 ? 1 : -1) * Math.min(7.5, imp * 0.85);
              }
              b.roll += (Math.random() - 0.5) * Math.min(0.85, imp * 0.1);
              b.pitch -= Math.min(0.55, wSpec.lift * 0.06);
              tryFlip(b, wSpec.lift * powerMult * (rotorA === 'drum' || rotorA === 'vspinner' ? 1.25 : 0.7), massB, b.roll, emitInto(events), a.config.name.toUpperCase());

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
              if (!isRotor(rotorB)) continue;
              if (!isWeaponSlotOnline(b, slotIdx, rotorB)) continue;
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

              if (rotorB === 'hbar' || rotorB === 'drum') {
                a.angularVel += (bfx * -nz - bfz * -nx >= 0 ? 1 : -1) * Math.min(7.5, imp * 0.85);
              }
              a.roll += (Math.random() - 0.5) * Math.min(0.85, imp * 0.1);
              a.pitch -= Math.min(0.55, wSpec.lift * 0.06);
              tryFlip(a, wSpec.lift * powerMult * (rotorB === 'drum' || rotorB === 'vspinner' ? 1.25 : 0.7), massA, a.roll, emitInto(events), b.config.name.toUpperCase());

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
    if (prop.hp <= 0 && !prop.kind.startsWith('pickup')) {
      // Cracked open by missile splash
      prop.destroyed = true;
      events.push(
        makeEvent({
          type: prop.kind === 'pillar' ? 'pillar_break' : prop.kind === 'barrel' ? 'explosion' : 'crate_break',
          x: prop.x,
          y: 0.6,
          z: prop.z,
          intensity: prop.kind === 'barrel' ? 1.2 : 1,
        }),
      );
      if (prop.kind === 'crate') {
        spawnedPickups.push({ id: `pickup_${prop.id}_${snapshot.tick}`, kind: 'pickup_repair', x: prop.x, y: 0, z: prop.z, radius: 0.75, hp: 1, maxHp: 1, destroyed: false });
      }
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
          bot.armorZones.front = Math.min(bot.maxArmorZone, bot.armorZones.front + 20);
          events.push(
            makeEvent({
              type: 'pickup',
              x: prop.x,
              y: 0.6,
              z: prop.z,
              intensity: 1,
              targetId: bot.id,
              callout: 'NANO REPAIR +28% HP!',
            }),
          );
          break;
        }
        if (prop.kind === 'pickup_energy') {
          prop.destroyed = true;
          bot.energy = bot.maxEnergy;
          events.push(
            makeEvent({
              type: 'pickup',
              x: prop.x,
              y: 0.6,
              z: prop.z,
              intensity: 1,
              targetId: bot.id,
              callout: 'MAX ENERGY CELL!',
            }),
          );
          break;
        }
        if (prop.kind === 'pickup_overcharge') {
          prop.destroyed = true;
          bot.damageBoostTimer = 8.0;
          bot.weaponCooldown = 0;
          if (bot.weaponCooldowns) bot.weaponCooldowns = bot.weaponCooldowns.map(() => 0);
          events.push(
            makeEvent({
              type: 'pickup',
              x: prop.x,
              y: 0.6,
              z: prop.z,
              intensity: 1.3,
              targetId: bot.id,
              callout: 'OVERCHARGE +35% DMG!',
            }),
          );
          break;
        }
        if (prop.kind === 'pickup_shield') {
          prop.destroyed = true;
          bot.maxShieldHp = Math.max(bot.maxShieldHp ?? 0, 65);
          bot.shieldHp = Math.min(bot.maxShieldHp, (bot.shieldHp ?? 0) + 65);
          (['front', 'left', 'right', 'rear'] as Array<keyof ArmorZones>).forEach((z) => {
            bot.armorZones[z] = Math.min(bot.maxArmorZone, bot.armorZones[z] + 25);
          });
          events.push(
            makeEvent({
              type: 'pickup',
              x: prop.x,
              y: 0.6,
              z: prop.z,
              intensity: 1.2,
              targetId: bot.id,
              callout: 'AETHER SHIELD +65!',
            }),
          );
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
            const roll = Math.random();
            const dropKind: DestructibleProp['kind'] =
              roll < 0.34
                ? 'pickup_repair'
                : roll < 0.62
                  ? 'pickup_energy'
                  : roll < 0.82
                    ? 'pickup_overcharge'
                    : 'pickup_shield';
            spawnedPickups.push({
              id: `pickup_${prop.id}_${snapshot.tick}`,
              kind: dropKind,
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

  // Arena Hazards
  for (const h of snapshot.hazards) {
    if (!h.active) continue;
    const escBonus = Math.max(0, (h.intensityLevel ?? 1) - 1);

    if (h.kind === 'spinner_blade') {
      const armLen = h.armLength ?? 2.85;
      const angle = h.sweepAngle ?? 0;
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
          bot.shockTimer = Math.max(bot.shockTimer ?? 0, 1.4);
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


    for (const bot of snapshot.bots) {
      if (bot.isDead || bot.y > 0.7) continue;
      if (bot.config.drive === 'hover' && (h.kind === 'saw' || h.kind === 'lava_vent' || h.kind === 'acid_pool')) continue;
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
            bot.shockTimer = Math.max(bot.shockTimer ?? 0, 1.2);
            applyDamage(bot, null, 5 + escBonus, 'rear', events, false, 'tesla_arc', undefined, {
              ...zoneFallbackHit('rear', 'scorch', 5),
            });
          }
        } else if (h.kind === 'lava_vent') {
          if ((h.tickCooldown ?? 0) <= 0) {
            h.tickCooldown = 0.5;
            bot.burnTimer = Math.max(bot.burnTimer, 2.5);
            bot.vy = Math.max(bot.vy, 4.2);
            applyDamage(bot, null, 8 + escBonus * 2, 'rear', events, false, 'flame', 'flame', {
              ...zoneFallbackHit('rear', 'scorch', 7),
            });
          }
        } else if (h.kind === 'acid_pool') {
          if ((h.tickCooldown ?? 0) <= 0) {
            h.tickCooldown = 0.55;
            (['front', 'left', 'right', 'rear'] as Array<keyof ArmorZones>).forEach((z) => {
              bot.armorZones[z] = Math.max(0, bot.armorZones[z] - 5);
            });
            applyDamage(bot, null, 6 + escBonus, 'rear', events, false, undefined, undefined, {
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
      snapshot.winningTeam = null;
    } else if (enemiesAlive.length === 0 || elapsed - (snapshot.waveStartedAt ?? 0) > 70) {
      // Next wave on a clear, or reinforcements if a wave drags on
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
      snapshot.winningTeam = survivor ? survivor.team : null;
    } else if (hillWinner) {
      const team = Number(hillWinner[0]);
      snapshot.phase = 'finished';
      snapshot.finishReason = 'objective';
      snapshot.winningTeam = team;
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
      snapshot.winningTeam = bestTeam;
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

function detonateMortar(snapshot: ArenaSnapshot, p: Projectile, events: CombatEvent[]) {
  const owner = snapshot.bots.find((b) => b.id === p.ownerId) ?? null;
  const spec = WEAPON_CATALOG.mortar;
  const impBase = spec.impulse * (1 + (owner?.skills.weaponTorque ?? 0) * 0.05);
  events.push(
    makeEvent({ type: 'mortar_blast', x: p.x, y: 0.4, z: p.z, intensity: 1.4, weapon: 'mortar', sourceId: p.ownerId }),
  );
  // Blast also throws loose parts around
  for (const d of snapshot.debris ?? []) {
    const dd = Math.hypot(d.x - p.x, d.z - p.z);
    if (dd < 4) {
      const f = 1 - dd / 4;
      d.vx += ((d.x - p.x) / (dd || 1)) * 7 * f;
      d.vz += ((d.z - p.z) / (dd || 1)) * 7 * f;
      d.vy += 5 * f;
      d.settled = false;
    }
  }
  for (const other of snapshot.bots) {
    if (other.isDead || other.team === p.team) continue;
    const bdx = other.x - p.x;
    const bdz = other.z - p.z;
    const bDist = Math.hypot(bdx, bdz);
    if (bDist >= 4.2) continue;
    const falloff = Math.max(0.35, 1 - bDist / 4.2);
    const nx = bDist > 0.01 ? bdx / bDist : Math.sin(p.yaw);
    const nz = bDist > 0.01 ? bdz / bDist : Math.cos(p.yaw);
    const vStats = computeBotStats(other.config, other.skills);
    const mass = vStats.mass * Math.pow(other.scale, 1.35);
    other.vx += nx * impBase * falloff;
    other.vz += nz * impBase * falloff;
    other.vy = Math.max(other.vy, spec.lift * falloff);
    tryFlip(other, spec.lift * falloff * 1.3, mass, (Math.random() - 0.5) * 2, emitInto(events), 'MORTAR');
    const zone = getHitZone(other, nx, nz);
    const geo = worldDirToVictimLocal(other, -nx, -nz, 0.5, 0.85, 0.35);
    applyDamage(other, owner, p.damage * falloff, zone, events, falloff > 0.75, 'mortar_blast', 'mortar', {
      ...geo,
      force: impBase * falloff,
      damageKind: 'scorch',
    });
  }
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
    tryFlip(victim, WEAPON_CATALOG.missiles.lift * falloff * 1.2, mass, victim.roll, emitInto(events), 'MISSILES');
    const zone = getHitZone(victim, nx, nz);
    const geo = worldDirToVictimLocal(victim, -nx, -nz, 0.3, 0.45, 0.4);
    applyDamage(victim, owner, p.damage * (0.45 + 0.55 * falloff), zone, events, falloff > 0.8, undefined, 'missiles', {
      ...geo,
      force: 6 * falloff + 3,
      damageKind: 'kinetic',
    });
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
    const kinds: DestructibleProp['kind'][] = ['pickup_repair', 'pickup_energy', 'pickup_overcharge', 'pickup_shield'];
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
  events.push(
    makeEvent({
      type: 'arena_event',
      x: ev.x ?? 0,
      y: 0.5,
      z: ev.z ?? 0,
      intensity: 1,
      label: kind,
      targetId: ev.targetId,
      callout: `ARENA EVENT: ${info.label.toUpperCase()}!`,
    }),
  );
}

/** Spawns the next survival wave (also called at match creation for wave 1). */
export function spawnSurvivalWave(snapshot: ArenaSnapshot, events: CombatEvent[] = []) {
  const wave = (snapshot.survivalWave ?? 0) + 1;
  snapshot.survivalWave = wave;
  snapshot.waveStartedAt = snapshot.elapsedTime ?? 0;
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
    snapshot.bots.push(makeBotState(entry, [cx, cz, Math.atan2(-cx, -cz)], modifiers));
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
  const waveLabel = isBossWave ? `BOSS WAVE ${wave}` : `WAVE ${wave}`;
  events.push(makeEvent({ type: 'wave_start', x: 0, y: 0.5, z: 0, intensity: isBossWave ? 1.6 : 1, label: waveLabel, callout: `${waveLabel} INCOMING!` }));
}
