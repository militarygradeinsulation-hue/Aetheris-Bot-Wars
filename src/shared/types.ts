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
  | 'stinger'
  | 'dozer';
export type ArmorId = 'titanium' | 'ceramic' | 'kevlar' | 'steel' | 'tungsten' | 'nanoweave' | 'reactive' | 'plasma';
export type WeaponId =
  | 'vspinner'
  | 'hbar'
  | 'sawblade'
  | 'flipper'
  | 'hammer'
  | 'flame'
  | 'drum'
  | 'jaws'
  | 'tesla'
  | 'missiles'
  | 'lance'
  | 'magnet';
export type WeaponKind = 'rotor' | 'channel' | 'strike' | 'projectile';
export type WheelLayoutId = '4wd_wide' | '4wd_tucked' | '6wd_inline' | 'rear_trike' | 'outboard';
export type DriveId = 'omni' | 'tracks' | 'turbo' | 'heavy_torque' | 'mecanum' | 'hover';
export type BotWeightClass = 'Lightweight' | 'Middleweight' | 'Heavyweight' | 'Titan';
export type ArenaId = 'foundry' | 'cryo' | 'reactor' | 'colosseum' | 'skyforge' | 'junkyard' | 'storm';
export type GameMode =
  | 'duel_1v1'
  | 'brawl_4bot'
  | 'gauntlet'
  | 'practice'
  | 'multiplayer'
  | 'team_2v2'
  | 'team_3v3'
  | 'survival'
  | 'king_hill'
  | 'boss_raid'
  | 'campaign';
export type TimedBattleDuration = 90 | 150 | 180 | 300;
export type BatteryMode = 'eco' | 'balanced' | 'ultra';

// ---- Livery / cosmetic customization ----
export type FinishId = 'gloss' | 'matte' | 'chrome' | 'carbon' | 'pearl' | 'neon';
export type PatternId = 'none' | 'stripes' | 'flames' | 'digital_camo' | 'hex' | 'checker' | 'tiger' | 'circuit';

export const FINISH_CATALOG: Record<FinishId, { id: FinishId; label: string; subtitle: string }> = {
  gloss: { id: 'gloss', label: 'Factory Gloss', subtitle: 'Clearcoated paint with crisp reflections' },
  matte: { id: 'matte', label: 'Stealth Matte', subtitle: 'Flat low-sheen coat that drinks light' },
  chrome: { id: 'chrome', label: 'Mirror Chrome', subtitle: 'Polished plating that mirrors the arena' },
  carbon: { id: 'carbon', label: 'Raw Carbon', subtitle: 'Exposed woven composite under resin' },
  pearl: { id: 'pearl', label: 'Pearl Shift', subtitle: 'Iridescent coat that shifts hue with angle' },
  neon: { id: 'neon', label: 'Neon Edge', subtitle: 'Self-lit paint that glows in the dark' },
};

export const PATTERN_CATALOG: Record<PatternId, { id: PatternId; label: string }> = {
  none: { id: 'none', label: 'Solid' },
  stripes: { id: 'stripes', label: 'Racing Stripes' },
  flames: { id: 'flames', label: 'Hot Rod Flames' },
  digital_camo: { id: 'digital_camo', label: 'Digital Camo' },
  hex: { id: 'hex', label: 'Hex Mesh' },
  checker: { id: 'checker', label: 'Checkered Flag' },
  tiger: { id: 'tiger', label: 'Tiger Slash' },
  circuit: { id: 'circuit', label: 'Circuit Trace' },
};

// ---- Match modifiers (mutators) ----
export type MatchModifierId =
  | 'low_gravity'
  | 'double_damage'
  | 'armor_off'
  | 'no_hazards'
  | 'chaos_events'
  | 'giants'
  | 'turbo'
  | 'vampire';

export const MATCH_MODIFIERS: Record<MatchModifierId, { id: MatchModifierId; label: string; note: string }> = {
  low_gravity: { id: 'low_gravity', label: 'Low Gravity', note: 'Flips send bots sky-high' },
  double_damage: { id: 'double_damage', label: 'Double Damage', note: 'Every hit counts twice' },
  armor_off: { id: 'armor_off', label: 'Naked Chassis', note: 'All armor zones start stripped' },
  no_hazards: { id: 'no_hazards', label: 'Clean Floor', note: 'Arena hazards disabled' },
  chaos_events: { id: 'chaos_events', label: 'Chaos Mode', note: 'Arena events fire 3x as often' },
  giants: { id: 'giants', label: 'Giant Bots', note: 'Every bot scaled up 25%' },
  turbo: { id: 'turbo', label: 'Turbo Motors', note: '+30% speed for everyone' },
  vampire: { id: 'vampire', label: 'Vampire Cores', note: 'Heal 20% of damage dealt' },
};

// ---- In-match arena events ----
export type ArenaEventKind = 'supply_drop' | 'power_surge' | 'low_gravity' | 'hazard_frenzy' | 'blackout' | 'bounty';

export const ARENA_EVENT_INFO: Record<ArenaEventKind, { label: string; note: string; duration: number }> = {
  supply_drop: { label: 'Supply Drop', note: 'Repair and energy crates incoming', duration: 6 },
  power_surge: { label: 'Power Surge', note: 'Energy regen x2.5, weapons hit 15% harder', duration: 10 },
  low_gravity: { label: 'Gravity Failure', note: 'Arena gravity cut to 40%', duration: 10 },
  hazard_frenzy: { label: 'Hazard Frenzy', note: 'All traps cycle 70% faster', duration: 12 },
  blackout: { label: 'Blackout', note: 'Arena lights down, hunt by visor glow', duration: 10 },
  bounty: { label: 'Bounty Target', note: 'Marked bot takes +40% damage', duration: 14 },
};

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
  finish?: FinishId;
  pattern?: PatternId;
  glowColor?: string;
  underglow?: boolean;
  raceNumber?: number;
}

export function getWeaponKind(id: WeaponId): WeaponKind {
  return WEAPON_CATALOG[id]?.kind ?? 'strike';
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
  // Status effects & armor trait state
  stunTimer?: number;
  pinnedTimer?: number;
  lastHitAt?: number;
  shieldFlash?: number;
  teslaDmgCooldown?: number;
  isBoss?: boolean;
  isBounty?: boolean;
  dmgMult?: number;
  speedMult?: number;
}

export interface Projectile {
  id: string;
  ownerId: string;
  team: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  life: number;
  damage: number;
  targetId?: string;
}

export interface HillZone {
  x: number;
  z: number;
  radius: number;
  scores: Record<number, number>;
  owner: number | null;
  contested: boolean;
  target: number;
  moveTimer: number;
}

export interface ActiveArenaEvent {
  kind: ArenaEventKind;
  label: string;
  timeLeft: number;
  duration: number;
  x?: number;
  z?: number;
  targetId?: string;
}

export interface DestructibleProp {
  id: string;
  kind: 'crate' | 'barrel' | 'pillar' | 'pickup_repair' | 'pickup_energy' | 'pickup_armor' | 'scrap_heap';
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
  kind: 'saw' | 'flipper_pad' | 'emp_ring' | 'spinner_blade' | 'crusher' | 'pit' | 'lightning' | 'magnet_crane' | 'lava';
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
  | 'ko'
  | 'arc'
  | 'lightning'
  | 'missile_launch'
  | 'pit_fall'
  | 'arena_event'
  | 'wave_start'
  | 'hill_move'
  | 'reflect'
  | 'shield_block'
  | 'lance'
  | 'magnet_pull';

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
  x2?: number;
  y2?: number;
  z2?: number;
  label?: string;
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
  finishReason?: 'ko' | 'time' | 'objective';
  phase: 'countdown' | 'active' | 'finished';
  countdown: number;
  bots: BotPhysicsState[];
  props: DestructibleProp[];
  hazards: HazardState[];
  events: CombatEvent[];
  winnerId: string | null;
  winnerTeam?: number | null;
  projectiles?: Projectile[];
  modifiers?: MatchModifierId[];
  arenaEvent?: ActiveArenaEvent | null;
  nextArenaEventAt?: number;
  hill?: HillZone | null;
  survivalWave?: number;
  survivalKills?: number;
  gravityMult?: number;
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
  rewardUnlock?: string;
  endsAt: string;
}

export function getSeasonalEventProgress(profile: Pick<PlayerProfile, 'arenaWins'>, ev: SeasonalEvent): number {
  return Math.min(ev.targetWins, profile.arenaWins?.[ev.arenaId] ?? 0);
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
  ownedParts?: string[];
  campaignStars?: Record<string, number>;
  arenaWins?: Partial<Record<ArenaId, number>>;
  bestSurvivalWave?: number;
  savedLoadouts?: BotConfig[];
}

export type PartCategory = 'weapon' | 'armor' | 'chassis' | 'drive';
export function partKey(cat: PartCategory, id: string): string {
  return `${cat}:${id}`;
}
export function getPartPrice(cat: PartCategory, id: string): number {
  if (cat === 'weapon') return WEAPON_CATALOG[id as WeaponId]?.price ?? 0;
  if (cat === 'armor') return ARMOR_CATALOG[id as ArmorId]?.price ?? 0;
  if (cat === 'chassis') return CHASSIS_CATALOG[id as ChassisId]?.price ?? 0;
  return DRIVE_CATALOG[id as DriveId]?.price ?? 0;
}
export function isPartOwned(profile: Pick<PlayerProfile, 'ownedParts'>, cat: PartCategory, id: string): boolean {
  if (getPartPrice(cat, id) <= 0) return true;
  return (profile.ownedParts ?? []).includes(partKey(cat, id));
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
  price?: number;
}

export type ArmorTrait = 'none' | 'regen' | 'energy_shield' | 'reflect' | 'heat_sink';

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
  /** Incoming damage multiplier per damage kind (1 = neutral, <1 resists) */
  resist: Record<DamageKind, number>;
  trait: ArmorTrait;
  traitLabel?: string;
  price?: number;
}

export interface WeaponSpec {
  id: WeaponId;
  label: string;
  subtitle: string;
  kind: WeaponKind;
  damage: number;
  impulse: number;
  lift: number;
  range: number;
  cooldown: number;
  energyCost: number;
  /** Ignores front-deflect and shreds armor zones faster */
  armorPierce?: number;
  price?: number;
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
  price?: number;
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
  stinger: {
    id: 'stinger',
    label: 'Scorpion Stinger',
    subtitle: 'Low arachnid body with an arched dorsal tail spine',
    baseHp: 300,
    baseMass: 1.02,
    bodyScale: 1.0,
    sizeTag: 'Arched Tail',
    speedMult: 1.1,
    frontDeflect: 0.28,
    price: 380,
  },
  dozer: {
    id: 'dozer',
    label: 'Siege Dozer',
    subtitle: 'Industrial plow-blade brick that bulldozes rivals into traps',
    baseHp: 410,
    baseMass: 1.58,
    bodyScale: 1.12,
    sizeTag: 'Plow 1.12×',
    speedMult: 0.86,
    frontDeflect: 0.5,
    price: 420,
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
    resist: { kinetic: 0.92, blade: 0.92, crush: 0.95, scorch: 0.95 },
    trait: 'none',
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
    resist: { kinetic: 0.82, blade: 1.05, crush: 0.8, scorch: 0.7 },
    trait: 'heat_sink',
    traitLabel: 'Heat Sink: burn wears off 2x faster',
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
    resist: { kinetic: 1.0, blade: 0.78, crush: 1.12, scorch: 1.15 },
    trait: 'none',
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
    resist: { kinetic: 0.85, blade: 0.88, crush: 0.9, scorch: 1.0 },
    trait: 'none',
  },
  tungsten: {
    id: 'tungsten',
    label: 'Tungsten Carbide',
    subtitle: 'Densest plating in the pit; blades skate right off it',
    hpBonus: 215,
    zoneHp: 230,
    massBonus: 0.62,
    speedMult: 0.76,
    roughness: 0.3,
    metalness: 0.95,
    resist: { kinetic: 0.82, blade: 0.6, crush: 0.95, scorch: 1.05 },
    trait: 'none',
    price: 520,
  },
  nanoweave: {
    id: 'nanoweave',
    label: 'Nanoweave Mesh',
    subtitle: 'Self-knitting nanite skin that rebuilds plates mid-fight',
    hpBonus: 70,
    zoneHp: 110,
    massBonus: 0.08,
    speedMult: 1.02,
    roughness: 0.45,
    metalness: 0.55,
    resist: { kinetic: 0.95, blade: 0.95, crush: 1.0, scorch: 0.95 },
    trait: 'regen',
    traitLabel: 'Self-Repair: rebuilds armor + hull after 2.5s out of combat',
    price: 640,
  },
  reactive: {
    id: 'reactive',
    label: 'Explosive Reactive',
    subtitle: 'Charged tiles blast back at anything that hits them',
    hpBonus: 95,
    zoneHp: 125,
    massBonus: 0.2,
    speedMult: 0.94,
    roughness: 0.5,
    metalness: 0.6,
    resist: { kinetic: 0.9, blade: 0.9, crush: 0.85, scorch: 1.1 },
    trait: 'reflect',
    traitLabel: 'Thorns: 30% of melee damage blasts back at the attacker',
    price: 580,
  },
  plasma: {
    id: 'plasma',
    label: 'Plasma Barrier',
    subtitle: 'Light frame wrapped in a battery-fed force field',
    hpBonus: 55,
    zoneHp: 95,
    massBonus: 0.05,
    speedMult: 1.04,
    roughness: 0.2,
    metalness: 0.4,
    resist: { kinetic: 0.95, blade: 0.95, crush: 0.95, scorch: 0.9 },
    trait: 'energy_shield',
    traitLabel: 'Force Field: 45% of damage drained from energy instead of hull',
    price: 820,
  },
};

export const WEAPON_CATALOG: Record<WeaponId, WeaponSpec> = {
  vspinner: {
    id: 'vspinner',
    label: 'Vertical Spinner',
    subtitle: 'High-RPM toothed flywheel uppercutting rivals skyward',
    kind: 'rotor',
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
    kind: 'rotor',
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
    kind: 'rotor',
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
    kind: 'strike',
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
    kind: 'strike',
    damage: 25,
    impulse: 6.5,
    lift: 1.2,
    range: 2.45,
    cooldown: 1.2,
    energyCost: 15,
    armorPierce: 0.35,
  },
  flame: {
    id: 'flame',
    label: 'Plasma Flame',
    subtitle: 'Long-reach thermal torch scorching armor and igniting bots',
    kind: 'channel',
    damage: 7,
    impulse: 1.2,
    lift: 0.0,
    range: 4.1,
    cooldown: 0.42,
    energyCost: 6,
  },
  drum: {
    id: 'drum',
    label: 'Eggbeater Drum',
    subtitle: 'Stubby high-inertia drum that punts bots end over end',
    kind: 'rotor',
    damage: 21,
    impulse: 6.0,
    lift: 8.6,
    range: 2.05,
    cooldown: 0.82,
    energyCost: 9,
    price: 450,
  },
  jaws: {
    id: 'jaws',
    label: 'Hydraulic Jaws',
    subtitle: 'Piercing crusher beak that pins its prey in place',
    kind: 'strike',
    damage: 30,
    impulse: 2.2,
    lift: 0.4,
    range: 2.0,
    cooldown: 1.5,
    energyCost: 20,
    armorPierce: 0.6,
    price: 520,
  },
  tesla: {
    id: 'tesla',
    label: 'Tesla Coil',
    subtitle: 'Arcing lightning that chains between rivals and jams motors',
    kind: 'channel',
    damage: 6,
    impulse: 0.6,
    lift: 0,
    range: 3.8,
    cooldown: 0.3,
    energyCost: 7,
    price: 680,
  },
  missiles: {
    id: 'missiles',
    label: 'Micro-Missile Pod',
    subtitle: 'Homing salvo of mini rockets with splash detonation',
    kind: 'projectile',
    damage: 12,
    impulse: 5.5,
    lift: 2.5,
    range: 16,
    cooldown: 2.2,
    energyCost: 22,
    price: 760,
  },
  lance: {
    id: 'lance',
    label: 'Pneumatic Lance',
    subtitle: 'Long piston spike punching clean through armor plate',
    kind: 'strike',
    damage: 22,
    impulse: 9.0,
    lift: 0.6,
    range: 3.5,
    cooldown: 1.05,
    energyCost: 14,
    armorPierce: 0.45,
    price: 400,
  },
  magnet: {
    id: 'magnet',
    label: 'Grapple Magnet',
    subtitle: 'Electromagnet yanks rivals into your other weapons',
    kind: 'strike',
    damage: 5,
    impulse: -11,
    lift: 0,
    range: 7.0,
    cooldown: 1.8,
    energyCost: 16,
    price: 600,
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
  hover: {
    id: 'hover',
    label: 'Hover Skirt',
    subtitle: 'Ducted-fan cushion floats over saws, lava and floor blades',
    maxSpeed: 8.2,
    accel: 17,
    turnRate: 3.0,
    knockbackResist: 0.78,
    price: 700,
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
  floorLineHex: string;
  outerDeckHex: string;
  accentHex: string;
  gravityMult?: number;
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
    floorLineHex: '#2E3745',
    outerDeckHex: '#0D1015',
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
    floorHex: '#16283A',
    floorLineHex: '#34587A',
    outerDeckHex: '#0B141E',
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
    floorHex: '#191529',
    floorLineHex: '#3B2E5E',
    outerDeckHex: '#100C1B',
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
    floorHex: '#202630',
    floorLineHex: '#3B4454',
    outerDeckHex: '#10131A',
    accentHex: '#EF4444',
  },
  skyforge: {
    id: 'skyforge',
    name: 'Skyforge Platform',
    subtitle: 'High-altitude deck with opening drop pits and thin air',
    halfSize: 18,
    friction: 5.0,
    energyRegenMult: 1.1,
    skyHex: '#1A2740',
    floorHex: '#26303F',
    floorLineHex: '#4A5A72',
    outerDeckHex: '#14203A',
    accentHex: '#22D3EE',
    gravityMult: 0.82,
  },
  junkyard: {
    id: 'junkyard',
    name: 'Scrapyard Crucible',
    subtitle: 'Cluttered wreck lot with a magnet crane and slag pools',
    halfSize: 18,
    friction: 6.2,
    energyRegenMult: 0.95,
    skyHex: '#16130F',
    floorHex: '#2A241C',
    floorLineHex: '#4A3F30',
    outerDeckHex: '#14110C',
    accentHex: '#84CC16',
  },
  storm: {
    id: 'storm',
    name: 'Tesla Stormcage',
    subtitle: 'Lightning strikes the deck on a timer; EMP core at center',
    halfSize: 18,
    friction: 5.3,
    energyRegenMult: 1.35,
    skyHex: '#0A0D1A',
    floorHex: '#141A2E',
    floorLineHex: '#2C3A66',
    outerDeckHex: '#090C18',
    accentHex: '#60A5FA',
  },
};

export const PAINT_PRESETS = [
  { label: 'Molten Amber', primary: '#D97706', accent: '#FBBF24' },
  { label: 'Crimson Forge', primary: '#B91C1C', accent: '#F87171' },
  { label: 'Cobalt Steel', primary: '#1D4ED8', accent: '#60A5FA' },
  { label: 'Gunmetal Slate', primary: '#334155', accent: '#F59E0B' },
  { label: 'Emerald Spec', primary: '#047857', accent: '#34D399' },
  { label: 'Obsidian Gold', primary: '#18181B', accent: '#EAB308' },
  { label: 'Arctic Ops', primary: '#E2E8F0', accent: '#38BDF8' },
  { label: 'Toxic Waste', primary: '#3F6212', accent: '#A3E635' },
  { label: 'Royal Violet', primary: '#5B21B6', accent: '#C084FC' },
  { label: 'Desert Storm', primary: '#A16207', accent: '#FDE68A' },
  { label: 'Hot Pink Riot', primary: '#BE185D', accent: '#F9A8D4' },
  { label: 'Marine Corps', primary: '#3F4A2E', accent: '#C2B280' },
  { label: 'Teal Reef', primary: '#0F766E', accent: '#5EEAD4' },
  { label: 'Blood Orange', primary: '#C2410C', accent: '#FED7AA' },
  { label: 'Ghost White', primary: '#F8FAFC', accent: '#94A3B8' },
  { label: 'Midnight Ion', primary: '#0B1120', accent: '#22D3EE' },
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
