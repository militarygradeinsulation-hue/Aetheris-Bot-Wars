export type ChassisId =
  | 'wedge'
  | 'brawler'
  | 'hex'
  | 'rammer'
  | 'turtle'
  | 'spider'
  | 'micro'
  | 'behemoth'
  | 'ufo'
  | 'tripod'
  | 'monolith'
  | 'claw';
export type ArmorId = 'titanium' | 'ceramic' | 'kevlar' | 'steel';
export type WeaponId = 'vspinner' | 'hbar' | 'sawblade' | 'flipper' | 'hammer' | 'flame';
export type WheelLayoutId = '4wd_wide' | '4wd_tucked' | '6wd_inline' | 'rear_trike' | 'outboard';
export type DriveId = 'omni' | 'tracks' | 'turbo' | 'heavy_torque' | 'mecanum';
export type BotWeightClass = 'Lightweight' | 'Middleweight' | 'Heavyweight' | 'Titan';
export type ArenaId = 'foundry' | 'cryo' | 'reactor' | 'colosseum';
export type GameMode = 'duel_1v1' | 'brawl_4bot' | 'gauntlet' | 'practice' | 'multiplayer';
export type TimedBattleDuration = 90 | 150 | 180 | 300;
export type BatteryMode = 'eco' | 'balanced' | 'ultra';

export const TIMED_BATTLE_OPTIONS: Array<{ seconds: TimedBattleDuration; label: string; tag: string }> = [
  { seconds: 90, label: '1:30', tag: 'Blitz' },
  { seconds: 150, label: '2:30', tag: 'Standard' },
  { seconds: 180, label: '3:00', tag: 'Regulation' },
  { seconds: 300, label: '5:00', tag: 'Endurance' },
];

export interface BotConfig {
  name: string;
  chassis: ChassisId;
  chassisStyles?: ChassisId[];
  armor: ArmorId;
  weapon: WeaponId;
  weapons?: WeaponId[];
  wheelLayout: WheelLayoutId;
  drive: DriveId;
  primaryColor: string;
  accentColor: string;
}

export function getBotWeapons(config: BotConfig): WeaponId[] {
  const list: WeaponId[] = [];
  if (Array.isArray(config.weapons)) {
    for (const w of config.weapons) {
      if (WEAPON_CATALOG[w] && !list.includes(w)) {
        list.push(w);
      }
    }
  }
  if (WEAPON_CATALOG[config.weapon] && !list.includes(config.weapon)) {
    list.unshift(config.weapon);
  }
  if (list.length === 0) list.push('vspinner');
  return list.slice(0, 3);
}

export function getBotChassisStyles(config: BotConfig): ChassisId[] {
  const list: ChassisId[] = [];
  if (Array.isArray(config.chassisStyles)) {
    for (const c of config.chassisStyles) {
      if (CHASSIS_CATALOG[c] && !list.includes(c)) {
        list.push(c);
      }
    }
  }
  if (CHASSIS_CATALOG[config.chassis] && !list.includes(config.chassis)) {
    list.unshift(config.chassis);
  }
  if (list.length === 0) list.push('wedge');
  return list.slice(0, 3);
}

export interface SkillTree {
  chassisReinforcement: number; // 0..5: +Max HP
  weaponTorque: number; // 0..5: +Weapon damage & spin/cooldown speed
  gyroStabilizer: number; // 0..5: +Knockback resistance & stability
  kineticArmor: number; // 0..5: +Armor zone durability & deflection
  batteryCore: number; // 0..5: +Energy capacity & regen
}

export interface BotComputedStats {
  maxHp: number;
  armorZoneHp: number;
  mass: number;
  bodyScale: number;
  maxSpeed: number;
  accel: number;
  turnRate: number;
  weaponDamage: number;
  weaponImpulse: number;
  weaponLift: number;
  weaponRange: number;
  weaponCooldown: number;
  frontDeflect: number;
  knockbackResist: number;
  maxEnergy: number;
  energyRegen: number;
  powerScore: number;
  weightClass: BotWeightClass;
}

export interface ArmorZones {
  front: number;
  left: number;
  right: number;
  rear: number;
}

export interface BotPhysicsState {
  id: string;
  name: string;
  clanTag: string;
  botLevel: number;
  weightClass: BotWeightClass;
  scale: number;
  config: BotConfig;
  skills: SkillTree;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  angularVel: number;
  pitch: number;
  roll: number;
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  armorZones: ArmorZones;
  maxArmorZone: number;
  weaponSpin: number;
  weaponAngle: number;
  weaponActive: boolean;
  weaponCooldown: number;
  weaponSpins?: number[];
  weaponAngles?: number[];
  weaponActives?: boolean[];
  weaponCooldowns?: number[];
  boostCooldown: number;
  overdriveTimer: number;
  burnTimer: number;
  collisionDmgCooldown?: number;
  flameDmgCooldown?: number;
  burnTickTimer?: number;
  isDead: boolean;
  hitsDealt: number;
  damageDealt: number;
  kos: number;
  isBot: boolean;
  team: number;
}

export interface DestructibleProp {
  id: string;
  kind: 'crate' | 'barrel' | 'pillar' | 'pickup_repair' | 'pickup_energy';
  x: number;
  y: number;
  z: number;
  radius: number;
  hp: number;
  maxHp: number;
  destroyed: boolean;
}

export interface HazardState {
  id: string;
  kind: 'saw' | 'flipper_pad' | 'emp_ring' | 'spinner_blade' | 'crusher';
  x: number;
  z: number;
  radius: number;
  active: boolean;
  warning?: boolean;
  phase: number;
  tickCooldown?: number;
  unlockAt?: number;
  cyclePeriod?: number;
  activeDuration?: number;
  warningDuration?: number;
  sweepAngle?: number;
  armLength?: number;
  crusherY?: number;
  intensityLevel?: number;
}

export type CombatEventType =
  | 'hit'
  | 'crit'
  | 'flip'
  | 'flame'
  | 'explosion'
  | 'crate_break'
  | 'pillar_break'
  | 'armor_break'
  | 'pickup'
  | 'crusher_slam'
  | 'hazard_warn'
  | 'ko';

export type DamageKind = 'kinetic' | 'scorch' | 'blade' | 'crush';

export interface CombatEvent {
  id: number;
  type: CombatEventType;
  x: number;
  y: number;
  z: number;
  intensity: number;
  force?: number;
  damageKind?: DamageKind;
  hitLocalX?: number;
  hitLocalY?: number;
  hitLocalZ?: number;
  normalX?: number;
  normalY?: number;
  normalZ?: number;
  color?: string;
  zone?: keyof ArmorZones;
  weapon?: WeaponId;
  targetId?: string;
  sourceId?: string;
}

export interface PlayerInputState {
  throttle: number; // -1..1
  steer: number; // -1..1
  fireWeapon: boolean;
  fireWeapons?: boolean[];
  boost: boolean;
  overdrive: boolean;
}

export interface ArenaSnapshot {
  tick: number;
  mode: GameMode;
  arenaId: ArenaId;
  timeRemaining: number;
  durationSeconds?: number;
  elapsedTime?: number;
  escalationStage?: number;
  finishReason?: 'ko' | 'time';
  phase: 'countdown' | 'active' | 'finished';
  countdown: number;
  bots: BotPhysicsState[];
  props: DestructibleProp[];
  hazards: HazardState[];
  events: CombatEvent[];
  winnerId: string | null;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  clanTag: string;
  rating: number;
  wins: number;
  losses: number;
  kos: number;
  botName: string;
  weapon: WeaponId;
  armor: ArmorId;
  powerScore: number;
  updatedAt: string;
}

export interface ClanChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
}

export interface ClanInfo {
  id: string;
  name: string;
  tag: string;
  motto: string;
  warPoints: number;
  memberCount: number;
  wins: number;
  tournamentSeed: number;
  chat: ClanChatMessage[];
}

export interface SeasonalEvent {
  id: string;
  seasonName: string;
  title: string;
  description: string;
  arenaId: ArenaId;
  modifierLabel: string;
  targetWins: number;
  rewardScrap: number;
  rewardSkillPoints: number;
  endsAt: string;
}

export interface PlayerProfile {
  id: string;
  callsign: string;
  clanId: string | null;
  clanTag: string;
  rating: number;
  level: number;
  xp: number;
  scrap: number;
  skillPoints: number;
  wins: number;
  losses: number;
  kos: number;
  gauntletStage: number;
  claimedEvents: string[];
  botConfig: BotConfig;
  skills: SkillTree;
  batteryMode: BatteryMode;
  muted: boolean;
  touchControlsMode: 'auto' | 'always' | 'off';
}

export interface ChassisSpec {
  id: ChassisId;
  label: string;
  subtitle: string;
  baseHp: number;
  baseMass: number;
  bodyScale: number;
  sizeTag: string;
  speedMult: number;
  frontDeflect: number;
}

export interface ArmorSpec {
  id: ArmorId;
  label: string;
  subtitle: string;
  hpBonus: number;
  zoneHp: number;
  massBonus: number;
  speedMult: number;
  roughness: number;
  metalness: number;
}

export interface WeaponSpec {
  id: WeaponId;
  label: string;
  subtitle: string;
  damage: number;
  impulse: number;
  lift: number;
  range: number;
  cooldown: number;
  energyCost: number;
}

export interface WheelLayoutSpec {
  id: WheelLayoutId;
  label: string;
  subtitle: string;
  turnMult: number;
  speedMult: number;
  knockbackResistMult: number;
  sideArmorBonus: number;
}

export interface DriveSpec {
  id: DriveId;
  label: string;
  subtitle: string;
  maxSpeed: number;
  accel: number;
  turnRate: number;
  knockbackResist: number;
}

export const CHASSIS_CATALOG: Record<ChassisId, ChassisSpec> = {
  wedge: {
    id: 'wedge',
    label: 'Wedge Interceptor',
    subtitle: 'Low sloped prow deflects frontal kinetic impacts',
    baseHp: 265,
    baseMass: 0.92,
    bodyScale: 0.96,
    sizeTag: 'Compact',
    speedMult: 1.12,
    frontDeflect: 0.4,
  },
  brawler: {
    id: 'brawler',
    label: 'Brawler Frame',
    subtitle: 'Balanced armored hull with reinforced side rails',
    baseHp: 335,
    baseMass: 1.18,
    bodyScale: 1.0,
    sizeTag: 'Standard',
    speedMult: 0.98,
    frontDeflect: 0.24,
  },
  hex: {
    id: 'hex',
    label: 'Hex Fortress',
    subtitle: 'Heavy six-sided armored core built to outlast',
    baseHp: 430,
    baseMass: 1.52,
    bodyScale: 1.08,
    sizeTag: 'Wide 1.08×',
    speedMult: 0.84,
    frontDeflect: 0.3,
  },
  rammer: {
    id: 'rammer',
    label: 'V-Plow Rammer',
    subtitle: 'Twin bullhorn forks trap and channel rivals into weapons',
    baseHp: 360,
    baseMass: 1.32,
    bodyScale: 1.02,
    sizeTag: 'Standard',
    speedMult: 0.94,
    frontDeflect: 0.34,
  },
  turtle: {
    id: 'turtle',
    label: 'Dome Turtle',
    subtitle: 'Domed sloped shell sheds overhead & flank blows',
    baseHp: 400,
    baseMass: 1.38,
    bodyScale: 1.04,
    sizeTag: 'Domed',
    speedMult: 0.88,
    frontDeflect: 0.36,
  },
  spider: {
    id: 'spider',
    label: 'Outrigger Striker',
    subtitle: 'Wide stabilizer wings for crisp agility and flip defense',
    baseHp: 285,
    baseMass: 1.0,
    bodyScale: 1.0,
    sizeTag: 'Wide Wing',
    speedMult: 1.08,
    frontDeflect: 0.22,
  },
  micro: {
    id: 'micro',
    label: 'Micro Swarm',
    subtitle: 'Tiny featherweight dart that slips past heavy swings',
    baseHp: 195,
    baseMass: 0.62,
    bodyScale: 0.72,
    sizeTag: 'Tiny 0.72×',
    speedMult: 1.24,
    frontDeflect: 0.34,
  },
  behemoth: {
    id: 'behemoth',
    label: 'Titan Behemoth',
    subtitle: 'Colossal wide-body juggernaut with huge crushing mass',
    baseHp: 560,
    baseMass: 1.95,
    bodyScale: 1.32,
    sizeTag: 'Giant 1.32×',
    speedMult: 0.72,
    frontDeflect: 0.32,
  },
  ufo: {
    id: 'ufo',
    label: 'Gyro Saucer',
    subtitle: 'Weird circular flying-saucer hull deflecting hits from all sides',
    baseHp: 350,
    baseMass: 1.22,
    bodyScale: 1.1,
    sizeTag: 'Weird Saucer',
    speedMult: 1.02,
    frontDeflect: 0.44,
  },
  tripod: {
    id: 'tripod',
    label: 'Mantis Tri-Pod',
    subtitle: 'Weird Y-shaped insectoid frame with splayed forward mandibles',
    baseHp: 310,
    baseMass: 1.06,
    bodyScale: 1.04,
    sizeTag: 'Weird Tri-Pod',
    speedMult: 1.06,
    frontDeflect: 0.24,
  },
  monolith: {
    id: 'monolith',
    label: 'Tall Monolith',
    subtitle: 'Weird towering narrow armored obelisk built like a steel pillar',
    baseHp: 445,
    baseMass: 1.48,
    bodyScale: 0.94,
    sizeTag: 'Weird Tall',
    speedMult: 0.85,
    frontDeflect: 0.3,
  },
  claw: {
    id: 'claw',
    label: 'Crescent Claw',
    subtitle: 'Weird horseshoe crab pincer hull built to trap opponents',
    baseHp: 375,
    baseMass: 1.34,
    bodyScale: 1.16,
    sizeTag: 'Weird Claw',
    speedMult: 0.92,
    frontDeflect: 0.38,
  },
};

export const ARMOR_CATALOG: Record<ArmorId, ArmorSpec> = {
  titanium: {
    id: 'titanium',
    label: 'Titanium Alloy',
    subtitle: 'Balanced aerospace plating with crisp specular finish',
    hpBonus: 85,
    zoneHp: 115,
    massBonus: 0.15,
    speedMult: 0.97,
    roughness: 0.26,
    metalness: 0.88,
  },
  ceramic: {
    id: 'ceramic',
    label: 'Reactive Ceramic',
    subtitle: 'Ablative composite plates that absorb heavy shock',
    hpBonus: 115,
    zoneHp: 145,
    massBonus: 0.22,
    speedMult: 0.93,
    roughness: 0.42,
    metalness: 0.3,
  },
  kevlar: {
    id: 'kevlar',
    label: 'Carbon-Kevlar',
    subtitle: 'Featherweight woven shell for maximum agility',
    hpBonus: 40,
    zoneHp: 85,
    massBonus: 0.0,
    speedMult: 1.09,
    roughness: 0.58,
    metalness: 0.18,
  },
  steel: {
    id: 'steel',
    label: 'Hardened Steel',
    subtitle: 'Ultra-dense armor slabs for heavy ramming power',
    hpBonus: 185,
    zoneHp: 195,
    massBonus: 0.46,
    speedMult: 0.82,
    roughness: 0.34,
    metalness: 0.92,
  },
};

export const WEAPON_CATALOG: Record<WeaponId, WeaponSpec> = {
  vspinner: {
    id: 'vspinner',
    label: 'Vertical Spinner',
    subtitle: 'High-RPM toothed flywheel uppercutting rivals skyward',
    damage: 17,
    impulse: 7.5,
    lift: 5.5,
    range: 2.3,
    cooldown: 0.72,
    energyCost: 8,
  },
  hbar: {
    id: 'hbar',
    label: 'Horizontal Blade',
    subtitle: 'Wide tungsten bar delivering heavy lateral knockback',
    damage: 19,
    impulse: 10.5,
    lift: 2.0,
    range: 2.65,
    cooldown: 0.88,
    energyCost: 10,
  },
  sawblade: {
    id: 'sawblade',
    label: 'Twin Saw Blades',
    subtitle: 'Dual rapid circular saws shredding armor on close contact',
    damage: 8,
    impulse: 3.4,
    lift: 0.8,
    range: 2.35,
    cooldown: 0.34,
    energyCost: 5,
  },
  flipper: {
    id: 'flipper',
    label: 'Pneumatic Flipper',
    subtitle: 'CO2-driven wedge catapulting bots for ring-out slams',
    damage: 11,
    impulse: 6.2,
    lift: 12.8,
    range: 2.45,
    cooldown: 1.35,
    energyCost: 18,
  },
  hammer: {
    id: 'hammer',
    label: 'Overhead Hammer',
    subtitle: 'Armor-piercing striker smashing top decks and plates',
    damage: 25,
    impulse: 6.5,
    lift: 1.2,
    range: 2.45,
    cooldown: 1.2,
    energyCost: 15,
  },
  flame: {
    id: 'flame',
    label: 'Plasma Flame',
    subtitle: 'Long-reach thermal torch scorching armor and igniting bots',
    damage: 7,
    impulse: 1.2,
    lift: 0.0,
    range: 4.1,
    cooldown: 0.42,
    energyCost: 6,
  },
};

export const WHEEL_LAYOUT_CATALOG: Record<WheelLayoutId, WheelLayoutSpec> = {
  '4wd_wide': {
    id: '4wd_wide',
    label: '4WD Wide Stance',
    subtitle: 'Balanced four-corner stability and predictable steering',
    turnMult: 1.0,
    speedMult: 1.0,
    knockbackResistMult: 1.0,
    sideArmorBonus: 0,
  },
  '4wd_tucked': {
    id: '4wd_tucked',
    label: '4WD Tucked Skirts',
    subtitle: 'Wheels protected inside armor skirts (+35 zone armor)',
    turnMult: 0.94,
    speedMult: 0.98,
    knockbackResistMult: 1.08,
    sideArmorBonus: 35,
  },
  '6wd_inline': {
    id: '6wd_inline',
    label: '6WD Heavy Inline',
    subtitle: 'Six driven wheels for maximum traction and pushing power',
    turnMult: 0.84,
    speedMult: 0.93,
    knockbackResistMult: 1.28,
    sideArmorBonus: 20,
  },
  rear_trike: {
    id: 'rear_trike',
    label: 'Rear-Drive Trike',
    subtitle: 'Wide rear power axle + nimble nose for sharp pivots',
    turnMult: 1.24,
    speedMult: 1.05,
    knockbackResistMult: 0.92,
    sideArmorBonus: 0,
  },
  outboard: {
    id: 'outboard',
    label: 'Outboard Pods',
    subtitle: 'Extended wide outrigger axles resist flips & rolls',
    turnMult: 0.96,
    speedMult: 1.02,
    knockbackResistMult: 1.22,
    sideArmorBonus: 12,
  },
};

// Recalibrated slower, weighty BattleBot arena speeds
export const DRIVE_CATALOG: Record<DriveId, DriveSpec> = {
  omni: {
    id: 'omni',
    label: 'Grip Rubber',
    subtitle: 'Crisp cornering and balanced arena pacing',
    maxSpeed: 7.4,
    accel: 21,
    turnRate: 2.75,
    knockbackResist: 1.0,
  },
  tracks: {
    id: 'tracks',
    label: 'Tank Treads',
    subtitle: 'High traction on ice floors and strong knockback defense',
    maxSpeed: 6.1,
    accel: 24,
    turnRate: 2.3,
    knockbackResist: 1.35,
  },
  turbo: {
    id: 'turbo',
    label: 'Brushless Turbo',
    subtitle: 'Fast flank speed for hit-and-run weaving strikes',
    maxSpeed: 8.8,
    accel: 19,
    turnRate: 2.65,
    knockbackResist: 0.88,
  },
  heavy_torque: {
    id: 'heavy_torque',
    label: 'Geared Torque',
    subtitle: 'Slow heavy drive engineered to shove rivals into hazards',
    maxSpeed: 5.5,
    accel: 27,
    turnRate: 2.15,
    knockbackResist: 1.48,
  },
  mecanum: {
    id: 'mecanum',
    label: 'Mecanum Rollers',
    subtitle: 'Rapid on-axis rotation for keeping weapons aimed on target',
    maxSpeed: 7.0,
    accel: 20,
    turnRate: 3.35,
    knockbackResist: 0.96,
  },
};

export interface ArenaSpec {
  id: ArenaId;
  name: string;
  subtitle: string;
  halfSize: number;
  friction: number;
  energyRegenMult: number;
  skyHex: string;
  floorHex: string;
  accentHex: string;
}

export const ARENA_CATALOG: Record<ArenaId, ArenaSpec> = {
  foundry: {
    id: 'foundry',
    name: 'Molten Foundry',
    subtitle: 'Floor saw slots, explosive fuel drums & perimeter bumpers',
    halfSize: 18,
    friction: 5.4,
    energyRegenMult: 1.0,
    skyHex: '#101318',
    floorHex: '#1B2028',
    accentHex: '#F59E0B',
  },
  cryo: {
    id: 'cryo',
    name: 'Sub-Zero Cryo Pit',
    subtitle: 'Low-friction ice deck with pneumatic launch pads',
    halfSize: 18,
    friction: 2.7,
    energyRegenMult: 1.05,
    skyHex: '#0C141D',
    floorHex: '#19293A',
    accentHex: '#38BDF8',
  },
  reactor: {
    id: 'reactor',
    name: 'Overcharge Reactor',
    subtitle: 'Fast energy recharge with periodic EMP discharge rings',
    halfSize: 18,
    friction: 5.5,
    energyRegenMult: 1.55,
    skyHex: '#121019',
    floorHex: '#1E1A2B',
    accentHex: '#A855F7',
  },
  colosseum: {
    id: 'colosseum',
    name: 'Apex Colosseum',
    subtitle: 'Championship stadium floor with corner saws, flipper & packed stands',
    halfSize: 18,
    friction: 5.8,
    energyRegenMult: 1.15,
    skyHex: '#12151C',
    floorHex: '#202631',
    accentHex: '#EF4444',
  },
};

export const PAINT_PRESETS = [
  { label: 'Molten Amber', primary: '#D97706', accent: '#FBBF24' },
  { label: 'Crimson Forge', primary: '#B91C1C', accent: '#F87171' },
  { label: 'Cobalt Steel', primary: '#1D4ED8', accent: '#60A5FA' },
  { label: 'Gunmetal Slate', primary: '#334155', accent: '#F59E0B' },
  { label: 'Emerald Spec', primary: '#047857', accent: '#34D399' },
  { label: 'Obsidian Gold', primary: '#18181B', accent: '#EAB308' },
];

export const DEFAULT_SKILLS: SkillTree = {
  chassisReinforcement: 1,
  weaponTorque: 1,
  gyroStabilizer: 1,
  kineticArmor: 1,
  batteryCore: 1,
};

export const DEFAULT_BOT_CONFIG: BotConfig = {
  name: 'Valkyrie MK-IV',
  chassis: 'wedge',
  chassisStyles: ['wedge'],
  armor: 'titanium',
  weapon: 'vspinner',
  weapons: ['vspinner'],
  wheelLayout: '4wd_wide',
  drive: 'omni',
  primaryColor: '#D97706',
  accentColor: '#FBBF24',
};

export function computeBotStats(config: BotConfig, skills: SkillTree): BotComputedStats {
  const styles = getBotChassisStyles(config);
  const weapons = getBotWeapons(config);

  const primaryCh = CHASSIS_CATALOG[styles[0]] || CHASSIS_CATALOG.wedge;
  const extraStyles = styles.slice(1).map((id) => CHASSIS_CATALOG[id]);
  const ar = ARMOR_CATALOG[config.armor] || ARMOR_CATALOG.titanium;
  const primaryWp = WEAPON_CATALOG[weapons[0]] || WEAPON_CATALOG.vspinner;
  const extraWeapons = weapons.slice(1).map((id) => WEAPON_CATALOG[id]);
  const wl = WHEEL_LAYOUT_CATALOG[config.wheelLayout || '4wd_wide'] || WHEEL_LAYOUT_CATALOG['4wd_wide'];
  const dr = DRIVE_CATALOG[config.drive] || DRIVE_CATALOG.omni;

  // Hybrid body style fusion: core chassis + reinforced structural modules
  const hybridHpBonus = extraStyles.reduce((acc, s) => acc + s.baseHp * 0.16, 0);
  const hybridMass = extraStyles.reduce((acc, s) => acc + s.baseMass * 0.18, 0);
  const hybridSpeedMult = extraStyles.reduce((acc, s) => acc * (0.97 + (s.speedMult - 1) * 0.25), 1);
  const hybridDeflect = extraStyles.reduce((acc, s) => acc + s.frontDeflect * 0.22, 0);
  const bodyScale = Number(
    Math.max(
      0.7,
      Math.min(
        1.36,
        primaryCh.bodyScale + extraStyles.reduce((acc, s) => acc + (s.bodyScale - 1) * 0.22, 0),
      ),
    ).toFixed(2),
  );

  // Multi-weapon fusion: primary weapon + auxiliary mounted weapons (with mass/cooldown trade-off)
  const extraWeaponDamage = extraWeapons.reduce((acc, w, idx) => acc + w.damage * (idx === 0 ? 0.36 : 0.26), 0);
  const extraWeaponImpulse = extraWeapons.reduce((acc, w, idx) => acc + w.impulse * (idx === 0 ? 0.42 : 0.32), 0);
  const extraWeaponMass = extraWeapons.length * 0.14;
  const extraWeaponSpeedDrag = Math.max(0.84, 1 - extraWeapons.length * 0.055);
  const combinedLift = Math.max(primaryWp.lift, ...extraWeapons.map((w) => w.lift * 0.85));
  const combinedRange = Math.max(primaryWp.range, ...extraWeapons.map((w) => w.range));

  const maxHp = Math.round((primaryCh.baseHp + hybridHpBonus + ar.hpBonus) * (1 + skills.chassisReinforcement * 0.09));
  const armorZoneHp = Math.round(
    (ar.zoneHp + wl.sideArmorBonus + extraStyles.length * 18) * (1 + skills.kineticArmor * 0.14),
  );
  const mass = Number((primaryCh.baseMass + hybridMass + ar.massBonus + extraWeaponMass).toFixed(2));
  const maxSpeed = Number(
    (dr.maxSpeed * primaryCh.speedMult * hybridSpeedMult * ar.speedMult * wl.speedMult * extraWeaponSpeedDrag).toFixed(
      2,
    ),
  );
  const accel = Number((dr.accel * primaryCh.speedMult * ar.speedMult * extraWeaponSpeedDrag).toFixed(2));
  const turnRate = Number((dr.turnRate * wl.turnMult * (1 + skills.gyroStabilizer * 0.04)).toFixed(2));
  const weaponDamage = Number(((primaryWp.damage + extraWeaponDamage) * (1 + skills.weaponTorque * 0.075)).toFixed(1));
  const weaponImpulse = Number(
    ((primaryWp.impulse + extraWeaponImpulse) * (1 + skills.weaponTorque * 0.05)).toFixed(2),
  );
  const weaponLift = Number(combinedLift.toFixed(2));
  const weaponRange = Number(combinedRange.toFixed(2));
  const weaponCooldown = Number(
    (primaryWp.cooldown * (1 + extraWeapons.length * 0.1) * (1 - skills.weaponTorque * 0.035)).toFixed(2),
  );
  const frontDeflect = Math.min(0.68, primaryCh.frontDeflect + hybridDeflect + skills.kineticArmor * 0.035);
  const knockbackResist = Number(
    (
      dr.knockbackResist *
      wl.knockbackResistMult *
      (1 + extraStyles.length * 0.06 + skills.gyroStabilizer * 0.08)
    ).toFixed(2),
  );
  const maxEnergy = Math.round(100 + skills.batteryCore * 14);
  const energyRegen = Number((14 + skills.batteryCore * 2.4).toFixed(1));

  const weightClass: BotWeightClass =
    mass >= 2.05 || maxHp >= 700
      ? 'Titan'
      : mass >= 1.52 || maxHp >= 520
        ? 'Heavyweight'
        : mass <= 1.05 && maxSpeed >= 7.6
          ? 'Lightweight'
          : 'Middleweight';

  const powerScore = Math.round(
    maxHp * 0.6 +
      (weaponDamage / Math.max(0.24, weaponCooldown)) * 2.4 +
      maxSpeed * 14 +
      armorZoneHp * 0.55 +
      (skills.chassisReinforcement +
        skills.weaponTorque +
        skills.gyroStabilizer +
        skills.kineticArmor +
        skills.batteryCore) *
        20,
  );

  return {
    maxHp,
    armorZoneHp,
    mass,
    bodyScale,
    maxSpeed,
    accel,
    turnRate,
    weaponDamage,
    weaponImpulse,
    weaponLift,
    weaponRange,
    weaponCooldown,
    frontDeflect,
    knockbackResist,
    maxEnergy,
    energyRegen,
    powerScore,
    weightClass,
  };
}
