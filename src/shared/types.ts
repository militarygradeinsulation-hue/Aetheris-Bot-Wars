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
  | 'claw'
  | 'scorpion'
  | 'juggernaut'
  | 'hover_disc'
  | 'hydra';

export type ArmorId =
  | 'titanium'
  | 'ceramic'
  | 'kevlar'
  | 'steel'
  | 'aetherium'
  | 'reactive_era'
  | 'tungsten'
  | 'nanoweave';

export type WeaponId =
  | 'vspinner'
  | 'hbar'
  | 'sawblade'
  | 'flipper'
  | 'hammer'
  | 'flame'
  | 'tesla'
  | 'railgun'
  | 'cryo_jet'
  | 'crush_jaw'
  | 'drum'
  | 'mortar';

export type WheelLayoutId =
  | '4wd_wide'
  | '4wd_tucked'
  | '6wd_inline'
  | 'rear_trike'
  | 'outboard'
  | '8wd_crawler'
  | 'omni_quad';

export type DriveId =
  | 'omni'
  | 'tracks'
  | 'turbo'
  | 'heavy_torque'
  | 'mecanum'
  | 'maglev'
  | 'crawler_nuclear';

export type FinishStyleId =
  | 'standard'
  | 'chrome'
  | 'matte'
  | 'iridescent'
  | 'gold_leaf'
  | 'carbon_stealth';

export type AccessoryId =
  | 'none'
  | 'halo_crown'
  | 'twin_flags'
  | 'radar_dish'
  | 'thruster_wings'
  | 'tesla_horns'
  | 'boss_spikes';

export type BotWeightClass = 'Lightweight' | 'Middleweight' | 'Heavyweight' | 'Titan';

export type ArenaId =
  | 'foundry'
  | 'cryo'
  | 'reactor'
  | 'colosseum'
  | 'aether_nexus'
  | 'toxic_scrapyard'
  | 'volcano_caldera'
  | 'cyber_grid';

export type GameMode =
  | 'duel_1v1'
  | 'brawl_4bot'
  | 'team_2v2'
  | 'boss_raid'
  | 'gauntlet'
  | 'practice'
  | 'multiplayer';

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
  finishStyle?: FinishStyleId;
  accessory?: AccessoryId;
  underglowColor?: string;
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
  weaponTorque: number; // 0..5: +Weapon damage & spin speed
  gyroStabilizer: number; // 0..5: +Knockback resistance & stability
  kineticArmor: number; // 0..5: +Armor zone durability & deflection
  batteryCore: number; // 0..5: +Energy capacity & regen
  coolingSystem?: number; // 0..5: -Weapon cooldowns & burn/freeze recovery
  naniteRepair?: number; // 0..5: Passive HP & armor repair in combat
  overclockCore?: number; // 0..5: +Overdrive duration & boost power
}

export interface BotComputedStats {
  maxHp: number;
  armorZoneHp: number;
  maxShieldHp: number;
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
  shieldHp?: number;
  maxShieldHp?: number;
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
  freezeTimer?: number;
  shockTimer?: number;
  damageBoostTimer?: number;
  eraBlocksRemaining?: number;
  naniteTickTimer?: number;
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
  kind:
    | 'crate'
    | 'barrel'
    | 'pillar'
    | 'pickup_repair'
    | 'pickup_energy'
    | 'pickup_overcharge'
    | 'pickup_shield';
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
  kind:
    | 'saw'
    | 'flipper_pad'
    | 'emp_ring'
    | 'spinner_blade'
    | 'crusher'
    | 'lava_vent'
    | 'acid_pool';
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
  | 'tesla_arc'
  | 'rail_shot'
  | 'cryo_blast'
  | 'mortar_blast'
  | 'era_blast'
  | 'shield_hit'
  | 'ko';

export type DamageKind = 'kinetic' | 'scorch' | 'blade' | 'crush';

export interface CombatEvent {
  id: number;
  type: CombatEventType;
  x: number;
  y: number;
  z: number;
  targetX?: number;
  targetY?: number;
  targetZ?: number;
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
  callout?: string;
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
  winningTeam?: number | null;
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
  perkLabel?: string;
  bannerColor?: string;
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
  badgeTitle?: string;
  endsAt: string;
}

export interface PlayerProfile {
  id: string;
  callsign: string;
  pilotTitle?: string;
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
  savedLoadouts?: BotConfig[];
  activeLoadoutSlot?: number;
  selectedWingmanIndex?: number;
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
  specialPerk: string;
  hpBonus: number;
  zoneHp: number;
  shieldBonus: number;
  massBonus: number;
  speedMult: number;
  roughness: number;
  metalness: number;
}

export interface WeaponSpec {
  id: WeaponId;
  label: string;
  subtitle: string;
  category: 'Rotor' | 'Kinetic' | 'Thermal' | 'Energy' | 'Artillery';
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

export interface FinishStyleSpec {
  id: FinishStyleId;
  label: string;
  subtitle: string;
  roughnessMult: number;
  metalnessAdd: number;
  clearcoat: number;
  iridescence: number;
}

export interface AccessorySpec {
  id: AccessoryId;
  label: string;
  subtitle: string;
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
    subtitle: 'Circular flying-saucer hull deflecting hits from all sides',
    baseHp: 350,
    baseMass: 1.22,
    bodyScale: 1.1,
    sizeTag: 'Saucer',
    speedMult: 1.02,
    frontDeflect: 0.44,
  },
  tripod: {
    id: 'tripod',
    label: 'Mantis Tri-Pod',
    subtitle: 'Y-shaped insectoid frame with splayed forward mandibles',
    baseHp: 310,
    baseMass: 1.06,
    bodyScale: 1.04,
    sizeTag: 'Tri-Pod',
    speedMult: 1.06,
    frontDeflect: 0.24,
  },
  monolith: {
    id: 'monolith',
    label: 'Tall Monolith',
    subtitle: 'Towering narrow armored obelisk built like a steel pillar',
    baseHp: 445,
    baseMass: 1.48,
    bodyScale: 0.94,
    sizeTag: 'Tall Spire',
    speedMult: 0.85,
    frontDeflect: 0.3,
  },
  claw: {
    id: 'claw',
    label: 'Crescent Claw',
    subtitle: 'Horseshoe crab pincer hull built to trap opponents',
    baseHp: 375,
    baseMass: 1.34,
    bodyScale: 1.16,
    sizeTag: 'Pincer',
    speedMult: 0.92,
    frontDeflect: 0.38,
  },
  scorpion: {
    id: 'scorpion',
    label: 'Scorpion Tail-Striker',
    subtitle: 'Predatory arched frame with elevated dorsal strike bridge',
    baseHp: 345,
    baseMass: 1.2,
    bodyScale: 1.06,
    sizeTag: 'Stinger',
    speedMult: 1.04,
    frontDeflect: 0.32,
  },
  juggernaut: {
    id: 'juggernaut',
    label: 'Cathedral Juggernaut',
    subtitle: 'Multi-turreted siege dreadnought with sloped prow & armored skirts',
    baseHp: 520,
    baseMass: 1.82,
    bodyScale: 1.26,
    sizeTag: 'Dreadnought',
    speedMult: 0.76,
    frontDeflect: 0.38,
  },
  hover_disc: {
    id: 'hover_disc',
    label: 'Aether Mag-Ring',
    subtitle: 'Futuristic chamfered flux ring hull with glowing plasma vents',
    baseHp: 325,
    baseMass: 1.08,
    bodyScale: 1.06,
    sizeTag: 'Flux Ring',
    speedMult: 1.1,
    frontDeflect: 0.42,
  },
  hydra: {
    id: 'hydra',
    label: 'Hydra Twin-Hull',
    subtitle: 'Dual-pontoon catamaran combat frame engineered for multi-weapons',
    baseHp: 390,
    baseMass: 1.36,
    bodyScale: 1.14,
    sizeTag: 'Twin-Hull',
    speedMult: 0.95,
    frontDeflect: 0.35,
  },
};

export const ARMOR_CATALOG: Record<ArmorId, ArmorSpec> = {
  titanium: {
    id: 'titanium',
    label: 'Titanium Alloy',
    subtitle: 'Balanced aerospace plating with crisp specular finish',
    specialPerk: 'Balanced weight-to-durability ratio',
    hpBonus: 85,
    zoneHp: 115,
    shieldBonus: 0,
    massBonus: 0.15,
    speedMult: 0.97,
    roughness: 0.26,
    metalness: 0.88,
  },
  ceramic: {
    id: 'ceramic',
    label: 'Reactive Ceramic',
    subtitle: 'Ablative composite plates that absorb heavy shock & thermal heat',
    specialPerk: '-40% Burn & Plasma duration',
    hpBonus: 115,
    zoneHp: 145,
    shieldBonus: 0,
    massBonus: 0.22,
    speedMult: 0.93,
    roughness: 0.42,
    metalness: 0.3,
  },
  kevlar: {
    id: 'kevlar',
    label: 'Carbon-Kevlar',
    subtitle: 'Featherweight woven shell for maximum agility and flank speed',
    specialPerk: '+9% Top Speed & zero armor mass penalty',
    hpBonus: 40,
    zoneHp: 85,
    shieldBonus: 0,
    massBonus: 0.0,
    speedMult: 1.09,
    roughness: 0.58,
    metalness: 0.18,
  },
  steel: {
    id: 'steel',
    label: 'Hardened Steel',
    subtitle: 'Ultra-dense rolled armor slabs for heavy ramming power',
    specialPerk: '+20% Collision ramming damage',
    hpBonus: 185,
    zoneHp: 195,
    shieldBonus: 0,
    massBonus: 0.46,
    speedMult: 0.82,
    roughness: 0.34,
    metalness: 0.92,
  },
  aetherium: {
    id: 'aetherium',
    label: 'Aetherium Lattice',
    subtitle: 'Iridescent quantum alloy projecting a regenerating energy barrier',
    specialPerk: '+85 Regenerating Energy Shield & EMP resist',
    hpBonus: 95,
    zoneHp: 125,
    shieldBonus: 85,
    massBonus: 0.14,
    speedMult: 1.0,
    roughness: 0.16,
    metalness: 0.94,
  },
  reactive_era: {
    id: 'reactive_era',
    label: 'Explosive ERA Blocks',
    subtitle: 'Military reactive bricks that detonate outward when struck hard',
    specialPerk: '3 ERA charges blast attackers & halve heavy hit dmg',
    hpBonus: 150,
    zoneHp: 175,
    shieldBonus: 0,
    massBonus: 0.34,
    speedMult: 0.88,
    roughness: 0.48,
    metalness: 0.68,
  },
  tungsten: {
    id: 'tungsten',
    label: 'Tungsten Carbide',
    subtitle: 'Super-heavy dreadnought plating with extreme frontal deflection',
    specialPerk: 'Maximum 240 Zone HP & knockback immunity',
    hpBonus: 235,
    zoneHp: 240,
    shieldBonus: 0,
    massBonus: 0.62,
    speedMult: 0.76,
    roughness: 0.22,
    metalness: 0.96,
  },
  nanoweave: {
    id: 'nanoweave',
    label: 'Self-Healing Nanoweave',
    subtitle: 'Bio-metallic smart mesh that continuously reconstructs damaged plates',
    specialPerk: 'Regenerates +6 HP & +4 Armor Zone HP every 1.5s',
    hpBonus: 75,
    zoneHp: 110,
    shieldBonus: 25,
    massBonus: 0.08,
    speedMult: 1.03,
    roughness: 0.3,
    metalness: 0.78,
  },
};

export const WEAPON_CATALOG: Record<WeaponId, WeaponSpec> = {
  vspinner: {
    id: 'vspinner',
    label: 'Vertical Spinner',
    subtitle: 'High-RPM toothed flywheel uppercutting rivals skyward',
    category: 'Rotor',
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
    category: 'Rotor',
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
    category: 'Rotor',
    damage: 8,
    impulse: 3.4,
    lift: 0.8,
    range: 2.35,
    cooldown: 0.34,
    energyCost: 5,
  },
  drum: {
    id: 'drum',
    label: 'Wide Drum Spinner',
    subtitle: 'Ultra-high-RPM cylindrical drum that corkscrews enemies into the air',
    category: 'Rotor',
    damage: 15,
    impulse: 8.6,
    lift: 7.2,
    range: 2.35,
    cooldown: 0.58,
    energyCost: 7,
  },
  flipper: {
    id: 'flipper',
    label: 'Pneumatic Flipper',
    subtitle: 'CO2-driven wedge catapulting bots for ring-out slams',
    category: 'Kinetic',
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
    category: 'Kinetic',
    damage: 25,
    impulse: 6.5,
    lift: 1.2,
    range: 2.45,
    cooldown: 1.2,
    energyCost: 15,
  },
  crush_jaw: {
    id: 'crush_jaw',
    label: 'Hydraulic Jaws',
    subtitle: 'Twin tungsten pincer fangs that clamp and shear armor plates',
    category: 'Kinetic',
    damage: 29,
    impulse: 4.5,
    lift: 2.4,
    range: 2.4,
    cooldown: 1.3,
    energyCost: 16,
  },
  flame: {
    id: 'flame',
    label: 'Plasma Flame',
    subtitle: 'Long-reach thermal torch scorching armor and igniting bots',
    category: 'Thermal',
    damage: 7,
    impulse: 1.2,
    lift: 0.0,
    range: 4.1,
    cooldown: 0.42,
    energyCost: 6,
  },
  cryo_jet: {
    id: 'cryo_jet',
    label: 'Cryo-Freeze Jet',
    subtitle: 'Sub-zero nitrogen cannon that slows enemies & makes armor brittle',
    category: 'Thermal',
    damage: 6,
    impulse: 1.8,
    lift: 0.0,
    range: 4.4,
    cooldown: 0.44,
    energyCost: 7,
  },
  tesla: {
    id: 'tesla',
    label: 'Tesla Arc Coils',
    subtitle: 'High-voltage lightning emitters that chain-shock and drain energy',
    category: 'Energy',
    damage: 16,
    impulse: 5.0,
    lift: 1.5,
    range: 5.2,
    cooldown: 0.95,
    energyCost: 14,
  },
  railgun: {
    id: 'railgun',
    label: 'Gauss Rail Spike',
    subtitle: 'Long-range electromagnetic slug cannon with devastating penetration',
    category: 'Energy',
    damage: 31,
    impulse: 12.0,
    lift: 2.2,
    range: 10.5,
    cooldown: 1.85,
    energyCost: 24,
  },
  mortar: {
    id: 'mortar',
    label: 'Plasma Mortar',
    subtitle: 'Dorsal siege howitzer lobbing explosive shockwave plasma shells',
    category: 'Artillery',
    damage: 24,
    impulse: 9.5,
    lift: 5.8,
    range: 7.8,
    cooldown: 1.65,
    energyCost: 20,
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
  '8wd_crawler': {
    id: '8wd_crawler',
    label: '8WD Siege Crawler',
    subtitle: 'Eight heavy bogie wheels for immovable stance (+45 zone armor)',
    turnMult: 0.8,
    speedMult: 0.9,
    knockbackResistMult: 1.42,
    sideArmorBonus: 45,
  },
  omni_quad: {
    id: 'omni_quad',
    label: '45° Vector Quad',
    subtitle: 'Angled corner pods for lightning-fast 360° turret rotation',
    turnMult: 1.32,
    speedMult: 1.04,
    knockbackResistMult: 0.96,
    sideArmorBonus: 10,
  },
};

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
  maglev: {
    id: 'maglev',
    label: 'Aether Mag-Drive',
    subtitle: 'Electromagnetic hover-thrusters with explosive acceleration & pivot',
    maxSpeed: 8.5,
    accel: 26,
    turnRate: 3.15,
    knockbackResist: 0.92,
  },
  crawler_nuclear: {
    id: 'crawler_nuclear',
    label: 'Reactor Torque Core',
    subtitle: 'Nuclear-geared siege transmission with massive shove & energy output',
    maxSpeed: 6.4,
    accel: 28,
    turnRate: 2.45,
    knockbackResist: 1.55,
  },
};

export const FINISH_CATALOG: Record<FinishStyleId, FinishStyleSpec> = {
  standard: {
    id: 'standard',
    label: 'Factory Satin',
    subtitle: 'Balanced machined clearcoat with brushed metal grain',
    roughnessMult: 1.0,
    metalnessAdd: 0.0,
    clearcoat: 0.65,
    iridescence: 0.0,
  },
  chrome: {
    id: 'chrome',
    label: 'Mirror Chrome',
    subtitle: 'Ultra-polished liquid metal reflection',
    roughnessMult: 0.35,
    metalnessAdd: 0.25,
    clearcoat: 1.0,
    iridescence: 0.1,
  },
  matte: {
    id: 'matte',
    label: 'Tactical Matte',
    subtitle: 'Non-reflective stealth military powdercoat',
    roughnessMult: 1.65,
    metalnessAdd: -0.25,
    clearcoat: 0.08,
    iridescence: 0.0,
  },
  iridescent: {
    id: 'iridescent',
    label: 'Aether Prismatic',
    subtitle: 'Color-shifting quantum thin-film interference finish',
    roughnessMult: 0.55,
    metalnessAdd: 0.15,
    clearcoat: 0.95,
    iridescence: 0.95,
  },
  gold_leaf: {
    id: 'gold_leaf',
    label: 'Anodized Specular',
    subtitle: 'High-gloss championship metallic sheen',
    roughnessMult: 0.45,
    metalnessAdd: 0.2,
    clearcoat: 0.9,
    iridescence: 0.35,
  },
  carbon_stealth: {
    id: 'carbon_stealth',
    label: 'Forged Carbon',
    subtitle: 'Deep composite weave with satin clearcoat',
    roughnessMult: 1.15,
    metalnessAdd: -0.1,
    clearcoat: 0.75,
    iridescence: 0.15,
  },
};

export const ACCESSORY_CATALOG: Record<AccessoryId, AccessorySpec> = {
  none: {
    id: 'none',
    label: 'Clean Deck',
    subtitle: 'Standard low-profile combat deck',
  },
  halo_crown: {
    id: 'halo_crown',
    label: 'Aether Halo Ring',
    subtitle: 'Floating illuminated quantum energy ring above the core',
  },
  twin_flags: {
    id: 'twin_flags',
    label: 'Clan War Pennants',
    subtitle: 'Twin dorsal battle standards bearing your accent colors',
  },
  radar_dish: {
    id: 'radar_dish',
    label: 'Tactical Radar Dome',
    subtitle: 'Rotating target-acquisition dish & telemetry array',
  },
  thruster_wings: {
    id: 'thruster_wings',
    label: 'Aero Booster Fins',
    subtitle: 'Swept supersonic stabilizer wings with glowing afterburners',
  },
  tesla_horns: {
    id: 'tesla_horns',
    label: 'Arc Bull Horns',
    subtitle: 'Menacing twin chrome horns with glowing plasma tips',
  },
  boss_spikes: {
    id: 'boss_spikes',
    label: 'Dreadnought Spikes',
    subtitle: 'Row of hardened steel dorsal spikes along the hull spine',
  },
};

export const UNDERGLOW_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'Off', value: 'none' },
  { label: 'Amber Forge', value: '#F59E0B' },
  { label: 'Cryo Cyan', value: '#38BDF8' },
  { label: 'Aether Violet', value: '#A855F7' },
  { label: 'Venom Emerald', value: '#10B981' },
  { label: 'Crimson Fury', value: '#EF4444' },
  { label: 'Cyber Magenta', value: '#EC4899' },
];

export interface ArenaSpec {
  id: ArenaId;
  name: string;
  subtitle: string;
  hazardTag: string;
  halfSize: number;
  friction: number;
  gravityMult?: number;
  energyRegenMult: number;
  skyHex: string;
  floorHex: string;
  accentHex: string;
}

export const ARENA_CATALOG: Record<ArenaId, ArenaSpec> = {
  foundry: {
    id: 'foundry',
    name: 'Molten Foundry',
    subtitle: 'Floor saw slots, explosive fuel drums & hydraulic crushers',
    hazardTag: 'Saws · Crushers · Drums',
    halfSize: 18,
    friction: 5.4,
    gravityMult: 1.0,
    energyRegenMult: 1.0,
    skyHex: '#101318',
    floorHex: '#1B2028',
    accentHex: '#F59E0B',
  },
  cryo: {
    id: 'cryo',
    name: 'Sub-Zero Cryo Pit',
    subtitle: 'Low-friction ice deck with pneumatic launch pads & cryo vents',
    hazardTag: 'Ice Drift · Flippers',
    halfSize: 18,
    friction: 2.7,
    gravityMult: 1.0,
    energyRegenMult: 1.05,
    skyHex: '#0C141D',
    floorHex: '#19293A',
    accentHex: '#38BDF8',
  },
  reactor: {
    id: 'reactor',
    name: 'Overcharge Reactor',
    subtitle: 'Fast energy recharge with periodic EMP discharge rings',
    hazardTag: '+55% Energy · EMP Rings',
    halfSize: 18,
    friction: 5.5,
    gravityMult: 1.0,
    energyRegenMult: 1.55,
    skyHex: '#121019',
    floorHex: '#1E1A2B',
    accentHex: '#A855F7',
  },
  colosseum: {
    id: 'colosseum',
    name: 'Apex Colosseum',
    subtitle: 'Championship stadium floor with corner saws, flipper & packed stands',
    hazardTag: 'Championship Stadium',
    halfSize: 18,
    friction: 5.8,
    gravityMult: 1.0,
    energyRegenMult: 1.15,
    skyHex: '#12151C',
    floorHex: '#202631',
    accentHex: '#EF4444',
  },
  aether_nexus: {
    id: 'aether_nexus',
    name: 'Aetheris Quantum Nexus',
    subtitle: 'Low-gravity orbital platform with +40% energy flux & twin EMP rings',
    hazardTag: 'Low Gravity · +40% Energy',
    halfSize: 19,
    friction: 4.8,
    gravityMult: 0.68,
    energyRegenMult: 1.4,
    skyHex: '#090D1A',
    floorHex: '#131C31',
    accentHex: '#06B6D4',
  },
  toxic_scrapyard: {
    id: 'toxic_scrapyard',
    name: 'Acid Scrapyard',
    subtitle: 'Corrosive reclamation pit with bubbling acid pools & heavy crushers',
    hazardTag: 'Acid Pools · Extra Crates',
    halfSize: 18,
    friction: 5.1,
    gravityMult: 1.0,
    energyRegenMult: 1.1,
    skyHex: '#0B1510',
    floorHex: '#16261E',
    accentHex: '#10B981',
  },
  volcano_caldera: {
    id: 'volcano_caldera',
    name: 'Magma Caldera',
    subtitle: 'Superheated volcanic forge with erupting lava vents & quad saws',
    hazardTag: 'Lava Vents · Thermal Burn',
    halfSize: 18,
    friction: 5.6,
    gravityMult: 1.0,
    energyRegenMult: 1.2,
    skyHex: '#1A0D0A',
    floorHex: '#2B1612',
    accentHex: '#F97316',
  },
  cyber_grid: {
    id: 'cyber_grid',
    name: 'Neon Cyber Grid',
    subtitle: 'High-traction synthwave circuit with hyper-flippers & sweeping rotors',
    hazardTag: 'High Grip · +35% Energy',
    halfSize: 18,
    friction: 6.4,
    gravityMult: 0.92,
    energyRegenMult: 1.35,
    skyHex: '#13091C',
    floorHex: '#221330',
    accentHex: '#EC4899',
  },
};

export const PAINT_PRESETS = [
  { label: 'Aetheris Prime', primary: '#0F172A', accent: '#38BDF8', underglow: '#38BDF8' },
  { label: 'Molten Amber', primary: '#D97706', accent: '#FBBF24', underglow: '#F59E0B' },
  { label: 'Crimson Forge', primary: '#B91C1C', accent: '#F87171', underglow: '#EF4444' },
  { label: 'Cobalt Steel', primary: '#1D4ED8', accent: '#60A5FA', underglow: '#38BDF8' },
  { label: 'Gunmetal Slate', primary: '#334155', accent: '#F59E0B', underglow: '#F59E0B' },
  { label: 'Emerald Venom', primary: '#047857', accent: '#34D399', underglow: '#10B981' },
  { label: 'Obsidian Gold', primary: '#18181B', accent: '#EAB308', underglow: '#F59E0B' },
  { label: 'Quantum Violet', primary: '#5B21B6', accent: '#C084FC', underglow: '#A855F7' },
  { label: 'Cyber Synth', primary: '#9D174D', accent: '#F472B6', underglow: '#EC4899' },
  { label: 'Arctic Zero', primary: '#E2E8F0', accent: '#0284C7', underglow: '#38BDF8' },
  { label: 'Toxic Hazard', primary: '#3F6212', accent: '#A3E635', underglow: '#10B981' },
  { label: 'Blood Sovereign', primary: '#450A0A', accent: '#FB7185', underglow: '#EF4444' },
];

export const DEFAULT_SKILLS: SkillTree = {
  chassisReinforcement: 1,
  weaponTorque: 1,
  gyroStabilizer: 1,
  kineticArmor: 1,
  batteryCore: 1,
  coolingSystem: 1,
  naniteRepair: 0,
  overclockCore: 1,
};

export const DEFAULT_BOT_CONFIG: BotConfig = {
  name: 'Aetheris MK-V',
  chassis: 'wedge',
  chassisStyles: ['wedge'],
  armor: 'titanium',
  weapon: 'vspinner',
  weapons: ['vspinner'],
  wheelLayout: '4wd_wide',
  drive: 'omni',
  primaryColor: '#0F172A',
  accentColor: '#38BDF8',
  finishStyle: 'standard',
  accessory: 'halo_crown',
  underglowColor: '#38BDF8',
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

  const coolingRank = skills.coolingSystem ?? 0;
  const naniteRank = skills.naniteRepair ?? 0;
  const overclockRank = skills.overclockCore ?? 0;

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

  const maxHp = Math.round(
    (primaryCh.baseHp + hybridHpBonus + ar.hpBonus) *
      (1 + skills.chassisReinforcement * 0.09 + naniteRank * 0.03),
  );
  const armorZoneHp = Math.round(
    (ar.zoneHp + wl.sideArmorBonus + extraStyles.length * 18) * (1 + skills.kineticArmor * 0.14),
  );
  const maxShieldHp = Math.round(
    ar.shieldBonus > 0 ? ar.shieldBonus * (1 + skills.batteryCore * 0.08 + overclockRank * 0.06) : 0,
  );
  const mass = Number((primaryCh.baseMass + hybridMass + ar.massBonus + extraWeaponMass).toFixed(2));
  const maxSpeed = Number(
    (
      dr.maxSpeed *
      primaryCh.speedMult *
      hybridSpeedMult *
      ar.speedMult *
      wl.speedMult *
      extraWeaponSpeedDrag *
      (1 + overclockRank * 0.025)
    ).toFixed(2),
  );
  const accel = Number(
    (dr.accel * primaryCh.speedMult * ar.speedMult * extraWeaponSpeedDrag * (1 + overclockRank * 0.03)).toFixed(2),
  );
  const turnRate = Number((dr.turnRate * wl.turnMult * (1 + skills.gyroStabilizer * 0.04)).toFixed(2));
  const weaponDamage = Number(((primaryWp.damage + extraWeaponDamage) * (1 + skills.weaponTorque * 0.075)).toFixed(1));
  const weaponImpulse = Number(
    ((primaryWp.impulse + extraWeaponImpulse) * (1 + skills.weaponTorque * 0.05)).toFixed(2),
  );
  const weaponLift = Number(combinedLift.toFixed(2));
  const weaponRange = Number(combinedRange.toFixed(2));
  const weaponCooldown = Number(
    Math.max(
      0.22,
      primaryWp.cooldown *
        (1 + extraWeapons.length * 0.09) *
        (1 - skills.weaponTorque * 0.035 - coolingRank * 0.045),
    ).toFixed(2),
  );
  const frontDeflect = Math.min(0.72, primaryCh.frontDeflect + hybridDeflect + skills.kineticArmor * 0.035);
  const knockbackResist = Number(
    (
      dr.knockbackResist *
      wl.knockbackResistMult *
      (1 + extraStyles.length * 0.06 + skills.gyroStabilizer * 0.08)
    ).toFixed(2),
  );
  const driveEnergyBonus = config.drive === 'crawler_nuclear' ? 18 : config.drive === 'maglev' ? 10 : 0;
  const maxEnergy = Math.round(100 + driveEnergyBonus + skills.batteryCore * 14 + overclockRank * 6);
  const energyRegen = Number(
    (
      14 +
      (config.drive === 'crawler_nuclear' ? 3.2 : 0) +
      skills.batteryCore * 2.4 +
      coolingRank * 1.1
    ).toFixed(1),
  );

  const weightClass: BotWeightClass =
    mass >= 2.05 || maxHp >= 700
      ? 'Titan'
      : mass >= 1.52 || maxHp >= 520
        ? 'Heavyweight'
        : mass <= 1.05 && maxSpeed >= 7.6
          ? 'Lightweight'
          : 'Middleweight';

  const totalSkillRanks =
    skills.chassisReinforcement +
    skills.weaponTorque +
    skills.gyroStabilizer +
    skills.kineticArmor +
    skills.batteryCore +
    coolingRank +
    naniteRank +
    overclockRank;

  const powerScore = Math.round(
    maxHp * 0.6 +
      maxShieldHp * 0.75 +
      (weaponDamage / Math.max(0.24, weaponCooldown)) * 2.4 +
      maxSpeed * 14 +
      armorZoneHp * 0.55 +
      totalSkillRanks * 18,
  );

  return {
    maxHp,
    armorZoneHp,
    maxShieldHp,
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
