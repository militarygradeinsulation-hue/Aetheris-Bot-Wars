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
  | 'hydra'
  | 'shell_spinner';

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
  | 'laser'
  | 'railgun'
  | 'cryo_jet'
  | 'crush_jaw'
  | 'drum'
  | 'mortar'
  | 'lance'
  | 'magnet'
  | 'missiles'
  | 'body_spinner'
  | 'lightning_strike'
  | 'bomb_drop';

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
  | 'crawler_nuclear'
  | 'hover';

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
  | 'cyber_grid'
  | 'skyforge'
  | 'storm';

export type GameMode =
  | 'duel_1v1'
  | 'brawl_4bot'
  | 'team_2v2'
  | 'boss_raid'
  | 'gauntlet'
  | 'practice'
  | 'multiplayer'
  | 'team_3v3'
  | 'survival'
  | 'king_hill'
  | 'campaign';

// ---- Livery patterns ----
export type PatternId = 'none' | 'stripes' | 'flames' | 'digital_camo' | 'hex' | 'checker' | 'tiger' | 'circuit';
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
  | 'traditional_rules'
  | 'low_gravity'
  | 'double_damage'
  | 'armor_off'
  | 'no_hazards'
  | 'chaos_events'
  | 'giants'
  | 'turbo'
  | 'vampire';

export const MATCH_MODIFIERS: Record<MatchModifierId, { id: MatchModifierId; label: string; note: string }> = {
  traditional_rules: {
    id: 'traditional_rules',
    label: 'Traditional Mode',
    note: 'Classic BattleBox rules: normal arenas & mechanical weapons only',
  },
  low_gravity: { id: 'low_gravity', label: 'Low Gravity', note: 'Flips send bots sky-high' },
  double_damage: { id: 'double_damage', label: 'Double Damage', note: 'Every hit counts twice' },
  armor_off: { id: 'armor_off', label: 'Naked Chassis', note: 'All armor zones start stripped' },
  no_hazards: { id: 'no_hazards', label: 'Clean Floor', note: 'Arena hazards disabled' },
  chaos_events: { id: 'chaos_events', label: 'Chaos Mode', note: 'Arena events fire 3x as often' },
  giants: { id: 'giants', label: 'Giant Bots', note: 'Every bot scaled up 25%' },
  turbo: { id: 'turbo', label: 'Turbo Motors', note: '+30% speed for everyone' },
  vampire: { id: 'vampire', label: 'Vampire Cores', note: 'Heal 20% of damage dealt' },
};

export const TRADITIONAL_WEAPON_IDS: WeaponId[] = [
  'vspinner',
  'hbar',
  'drum',
  'sawblade',
  'flipper',
  'hammer',
  'crush_jaw',
  'flame',
  'body_spinner',
  'lance',
];

export const TRADITIONAL_ARENA_IDS: ArenaId[] = [
  'colosseum',
  'foundry',
  'toxic_scrapyard',
];

export function isTraditionalWeapon(id: WeaponId): boolean {
  return TRADITIONAL_WEAPON_IDS.includes(id);
}

export function isTraditionalArena(id: ArenaId): boolean {
  return TRADITIONAL_ARENA_IDS.includes(id);
}

export function sanitizeConfigForTraditionalMode(config: BotConfig): BotConfig {
  const curWeapons = getBotWeapons(config);
  const tradWeapons = curWeapons.filter((w) => isTraditionalWeapon(w));
  const finalWeapons: WeaponId[] =
    tradWeapons.length > 0 ? tradWeapons : ['vspinner'];
  const tradArmors: ArmorId[] = ['titanium', 'steel', 'kevlar', 'ceramic', 'tungsten'];
  const finalArmor: ArmorId = tradArmors.includes(config.armor) ? config.armor : 'titanium';
  return {
    ...config,
    armor: finalArmor,
    weapon: finalWeapons[0],
    weapons: finalWeapons,
  };
}

// ---- In-match arena events ----
export type ArenaEventKind =
  | 'supply_drop'
  | 'power_surge'
  | 'low_gravity'
  | 'hazard_frenzy'
  | 'blackout'
  | 'bounty'
  | 'bomb_barrage'
  | 'lightning_storm';

export const ARENA_EVENT_INFO: Record<ArenaEventKind, { label: string; note: string; duration: number }> = {
  supply_drop: { label: 'Supply Drop', note: 'Repair, energy and overcharge orbs incoming', duration: 6 },
  power_surge: { label: 'Power Surge', note: 'Energy regen x2.5, weapons hit 15% harder', duration: 10 },
  low_gravity: { label: 'Gravity Failure', note: 'Arena gravity cut to 40%', duration: 10 },
  hazard_frenzy: { label: 'Hazard Frenzy', note: 'All traps cycle 70% faster', duration: 12 },
  blackout: { label: 'Blackout', note: 'Arena lights down, hunt by visor glow', duration: 10 },
  bounty: { label: 'Bounty Target', note: 'Marked bot takes +40% damage', duration: 14 },
  bomb_barrage: { label: 'Bomb Barrage', note: 'Aerial bombs dropping across the arena floor!', duration: 12 },
  lightning_storm: { label: 'Lightning Storm', note: 'High-voltage arc bolts striking across the deck!', duration: 12 },
};

export type TimedBattleDuration = 90 | 150 | 180 | 300;
export type BatteryMode = 'eco' | 'balanced' | 'ultra';

export const TIMED_BATTLE_OPTIONS: Array<{ seconds: TimedBattleDuration; label: string; tag: string }> = [
  { seconds: 90, label: '1:30', tag: 'Blitz' },
  { seconds: 150, label: '2:30', tag: 'Standard' },
  { seconds: 180, label: '3:00', tag: 'Regulation' },
  { seconds: 300, label: '5:00', tag: 'Endurance' },
];

export type WeaponMountZone = 'front' | 'left' | 'right' | 'rear' | 'top_front' | 'top_rear';

export interface WeaponPlacementConfig {
  zone: WeaponMountZone;
  offsetX: number; // -0.85 .. +0.85 lateral offset
  offsetY: number; // -0.25 .. +0.55 vertical offset
  offsetZ: number; // -0.85 .. +0.85 fore/aft offset
  yawDeg: number; // -180 .. +180 degrees relative aim
  scale: number; // 0.75 .. 1.35 scale multiplier
}

export const WEAPON_MOUNT_ZONES: Array<{
  id: WeaponMountZone;
  label: string;
  defaultYawDeg: number;
}> = [
  { id: 'front', label: 'Front Nose', defaultYawDeg: 0 },
  { id: 'top_front', label: 'Top Deck', defaultYawDeg: 0 },
  { id: 'left', label: 'Left Flank', defaultYawDeg: 90 },
  { id: 'right', label: 'Right Flank', defaultYawDeg: -90 },
  { id: 'rear', label: 'Rear Tail', defaultYawDeg: 180 },
  { id: 'top_rear', label: 'Rear Turret', defaultYawDeg: 0 },
];

export interface BotConfig {
  name: string;
  chassis: ChassisId;
  chassisStyles?: ChassisId[];
  armor: ArmorId;
  weapon: WeaponId;
  weapons?: WeaponId[];
  weaponPlacements?: WeaponPlacementConfig[];
  wheelLayout: WheelLayoutId;
  drive: DriveId;
  primaryColor: string;
  accentColor: string;
  finishStyle?: FinishStyleId;
  accessory?: AccessoryId;
  underglowColor?: string;
  pattern?: PatternId;
  raceNumber?: number;
  fusionParents?: [string, string];
  aiStyle?: string;
}

export function getBotWeapons(config: BotConfig): WeaponId[] {
  if (Array.isArray(config.weapons)) {
    const list: WeaponId[] = [];
    for (const w of config.weapons) {
      if (WEAPON_CATALOG[w] && !list.includes(w)) {
        list.push(w);
      }
    }
    return list.slice(0, 3);
  }
  if (WEAPON_CATALOG[config.weapon]) {
    return [config.weapon];
  }
  return ['vspinner'];
}

export function getDefaultWeaponPlacement(wId: WeaponId, slotIdx: number): WeaponPlacementConfig {
  if (wId === 'mortar' || wId === 'missiles' || wId === 'bomb_drop') {
    return {
      zone: slotIdx === 0 ? 'top_front' : 'top_rear',
      offsetX: slotIdx === 1 ? -0.35 : slotIdx === 2 ? 0.35 : 0,
      offsetY: 0,
      offsetZ: 0,
      yawDeg: 0,
      scale: 1.0,
    };
  }
  if (wId === 'railgun' || wId === 'tesla' || wId === 'laser' || wId === 'hammer' || wId === 'lightning_strike') {
    return {
      zone: 'top_front',
      offsetX: slotIdx === 1 ? -0.32 : slotIdx === 2 ? 0.32 : 0,
      offsetY: 0,
      offsetZ: 0,
      yawDeg: 0,
      scale: 1.0,
    };
  }
  return {
    zone: slotIdx === 0 ? 'front' : slotIdx === 1 ? 'top_front' : 'top_rear',
    offsetX: slotIdx === 1 ? -0.45 : slotIdx === 2 ? 0.45 : 0,
    offsetY: 0,
    offsetZ: 0,
    yawDeg: 0,
    scale: 1.0,
  };
}

export function getBotWeaponPlacements(config: BotConfig): WeaponPlacementConfig[] {
  const weapons = getBotWeapons(config);
  const raw = Array.isArray(config.weaponPlacements) ? config.weaponPlacements : [];
  return weapons.map((wId, idx) => {
    const p = raw[idx];
    const def = getDefaultWeaponPlacement(wId, idx);
    if (!p) return def;
    const validZone = WEAPON_MOUNT_ZONES.some((z) => z.id === p.zone) ? p.zone : def.zone;
    return {
      zone: validZone,
      offsetX: Number(Math.max(-0.85, Math.min(0.85, Number(p.offsetX) || 0)).toFixed(2)),
      offsetY: Number(Math.max(-0.25, Math.min(0.55, Number(p.offsetY) || 0)).toFixed(2)),
      offsetZ: Number(Math.max(-0.85, Math.min(0.85, Number(p.offsetZ) || 0)).toFixed(2)),
      yawDeg: Math.round(Math.max(-180, Math.min(180, Number(p.yawDeg) || 0))),
      scale: Number(Math.max(0.75, Math.min(1.35, Number(p.scale) || 1.0)).toFixed(2)),
    };
  });
}

export function getWeaponSlotLocalYawRad(config: BotConfig, slotIdx: number): number {
  const placements = getBotWeaponPlacements(config);
  const p = placements[slotIdx];
  if (!p) return 0;
  return (p.yawDeg * Math.PI) / 180;
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
  boostFuel?: number;
  maxBoostFuel?: number;
  isBoosting?: boolean;
  boostLockout?: boolean;
  isDrifting?: boolean;
  driftCharge?: number;
  driftBoostTimer?: number;
  slipTimer?: number;
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
  pinnedTimer?: number;
  isBoss?: boolean;
  isBounty?: boolean;
  dmgMult?: number;
  speedMult?: number;
  /** Per-component integrity (0-100). Hit location decides which part takes damage. */
  components?: BotComponents;
  /** Thermal load from flame/lava, 0-100. Above 55 armor starts to melt. */
  heat?: number;
  /** Cryo load, 0-100. Slows the bot; at 100 it freezes solid. */
  chill?: number;
  /** Seconds left frozen solid (no drive, no weapons). */
  frozenTimer?: number;
  /** Cumulative melt per zone, 0-1. Melted armor deflects less and sags. */
  meltZones?: ArmorZones;
  /** Bot landed upside down. */
  flipped?: boolean;
  /** Visual flip rotation 0..PI, animated by the engine. */
  flipAngle?: number;
  /** Seconds spent inverted, drives auto self-right. */
  flipTimer?: number;
  /** Seconds before the bot may self-right again. */
  selfRightCooldown?: number;
  /** Mortar hold-to-charge timer (0..1.4s): short click shoots close, long press shoots far. */
  mortarCharge?: number;
  mortarArmed?: boolean;
  /** Distinct AI combat driving persona & phase timer. */
  aiStyle?: string;
  aiPhaseTimer?: number;
  /** Out-of-the-Arena (OOTA) ring-out state when launched over the BattleBox wall. */
  outOfRing?: boolean;
  outOfRingTimer?: number;
  lastAttackerId?: string;
}

/** Drive unit order: front-left, front-right, rear-left, rear-right. */
export interface BotComponents {
  wheels: number[];
  weapons: number[];
  battery: number;
  motor: number;
}

export type DebrisKind = 'wheel' | 'armor' | 'weapon' | 'scrap' | 'battery';

export interface DebrisPiece {
  id: string;
  kind: DebrisKind;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  spin: number;
  radius: number;
  mass: number;
  color: string;
  weapon?: WeaponId;
  sourceId?: string;
  settled?: boolean;
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
  kind?: 'missile' | 'shell';
  vy?: number;
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
  kind:
    | 'crate'
    | 'barrel'
    | 'pillar'
    | 'ramp'
    | 'debris_chunk'
    | 'pickup_repair'
    | 'pickup_energy'
    | 'pickup_overcharge'
    | 'pickup_shield';
  x: number;
  y: number;
  z: number;
  yaw?: number;
  radius: number;
  hp: number;
  maxHp: number;
  destroyed: boolean;
  color?: string;
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
    | 'acid_pool'
    | 'pit'
    | 'lightning'
    | 'bomb_drop'
    | 'oil_slick'
    | 'laser_grid';
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
  bombY?: number;
  ignited?: boolean;
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
  | 'laser_beam'
  | 'bomb_blast'
  | 'oil_slip'
  | 'cryo_blast'
  | 'mortar_blast'
  | 'era_blast'
  | 'shield_hit'
  | 'ko'
  | 'missile_launch'
  | 'pit_fall'
  | 'lightning'
  | 'arena_event'
  | 'wave_start'
  | 'hill_move'
  | 'lance'
  | 'magnet_pull'
  | 'part_detach'
  | 'frozen_solid'
  | 'melt'
  | 'self_right'
  | 'debris_hit'
  | 'mortar_launch'
  | 'weapon_clash'
  | 'thermal_shock'
  | 'ring_out';

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
  label?: string;
}

export interface PlayerInputState {
  throttle: number; // -1..1
  steer: number; // -1..1
  fireWeapon: boolean;
  fireWeapons?: boolean[];
  boost: boolean;
  drift?: boolean;
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
  finishReason?: 'ko' | 'ring_out' | 'time' | 'objective';
  phase: 'countdown' | 'active' | 'finished';
  countdown: number;
  bots: BotPhysicsState[];
  props: DestructibleProp[];
  hazards: HazardState[];
  events: CombatEvent[];
  winnerId: string | null;
  winningTeam?: number | null;
  projectiles?: Projectile[];
  modifiers?: MatchModifierId[];
  arenaEvent?: ActiveArenaEvent | null;
  nextArenaEventAt?: number;
  hill?: HillZone | null;
  survivalWave?: number;
  survivalKills?: number;
  waveStartedAt?: number;
  gravityMult?: number;
  debris?: DebrisPiece[];
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

/** Server-authoritative record from live matches between real pilots. */
export interface PvpRecord {
  id: string;
  name: string;
  clanTag: string;
  botName: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  kos: number;
  streak: number;
  bestStreak: number;
  lastMatchAt: string;
}

export interface PvpMatchResult {
  playerId: string;
  outcome: 'win' | 'loss' | 'draw';
  ratingDelta: number;
  record: PvpRecord;
  ranked: boolean;
}

export interface OnlinePresence {
  online: number;
  searching: number;
  fighting: number;
  pilots: Array<{ id: string; name: string; clanTag: string; status: 'idle' | 'searching' | 'fighting' }>;
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
  rewardUnlock?: string;
  endsAt: string;
}

export interface FavoriteBuildEntry {
  id: string;
  label: string;
  config: BotConfig;
  savedAt: string;
}

export interface FavoritesList {
  weapons: WeaponId[];
  chassis: ChassisId[];
  arenas: ArenaId[];
  builds: FavoriteBuildEntry[];
}

export type ControlSchemeId = 'wasd_drive' | 'arrows_drive' | 'mouse_drive';
export type DeviceLayoutMode = 'auto' | 'desktop' | 'tablet' | 'mobile';

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
  customGarageBots?: BotConfig[];
  activeLoadoutSlot?: number;
  selectedWingmanIndex?: number;
  skills: SkillTree;
  batteryMode: BatteryMode;
  muted: boolean;
  commentaryMuted?: boolean;
  commentaryDefaultOffApplied?: boolean;
  masterVolume?: number;
  musicVolume?: number;
  sfxVolume?: number;
  crowdVolume?: number;
  commentaryVolume?: number;
  traditionalMode?: boolean;
  touchControlsMode: 'auto' | 'always' | 'off';
  controlScheme?: ControlSchemeId;
  deviceLayoutMode?: DeviceLayoutMode;
  ownedParts?: string[];
  campaignStars?: Record<string, number>;
  arenaWins?: Partial<Record<ArenaId, number>>;
  bestSurvivalWave?: number;
  favorites?: FavoritesList;
  isAdmin?: boolean;
  adminSeat?: 1 | 2;
}

// ---- Part economy: premium parts cost scrap or unlock via campaign & events ----
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
/** Every premium part key a config uses (for granting ownership of builds that predate the economy). */
export function premiumPartsInConfig(config: BotConfig): string[] {
  const keys: string[] = [];
  for (const w of getBotWeapons(config)) if (getPartPrice('weapon', w) > 0) keys.push(partKey('weapon', w));
  for (const c of getBotChassisStyles(config)) if (getPartPrice('chassis', c) > 0) keys.push(partKey('chassis', c));
  if (getPartPrice('armor', config.armor) > 0) keys.push(partKey('armor', config.armor));
  if (getPartPrice('drive', config.drive) > 0) keys.push(partKey('drive', config.drive));
  return keys;
}
export function describePartKey(key: string | undefined): string {
  if (!key) return '';
  const [cat, id] = key.split(':');
  const label =
    cat === 'weapon'
      ? WEAPON_CATALOG[id as WeaponId]?.label
      : cat === 'armor'
        ? ARMOR_CATALOG[id as ArmorId]?.label
        : cat === 'chassis'
          ? CHASSIS_CATALOG[id as ChassisId]?.label
          : DRIVE_CATALOG[id as DriveId]?.label;
  return label ?? id;
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
  price?: number;
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
    price: 360,
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
    price: 480,
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
    price: 420,
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
    price: 440,
  },
  shell_spinner: {
    id: 'shell_spinner',
    label: 'Cyclone Full-Body Spinner',
    subtitle: 'Entire armored outer shell spins at 2,800 RPM as a 360° kinetic weapon',
    baseHp: 385,
    baseMass: 1.38,
    bodyScale: 1.12,
    sizeTag: '360° Shell',
    speedMult: 1.04,
    frontDeflect: 0.48,
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
    price: 700,
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
    price: 560,
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
    price: 520,
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
    price: 620,
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
    price: 350,
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
    price: 400,
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
    price: 420,
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
    price: 520,
  },
  laser: {
    id: 'laser',
    label: 'Aether Laser Beam',
    subtitle: 'Coherent ruby laser cannon that slices armor, melts plates & ignites oil slicks',
    category: 'Energy',
    damage: 14,
    impulse: 3.2,
    lift: 0.6,
    range: 11.5,
    cooldown: 0.36,
    energyCost: 8,
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
    price: 680,
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
    price: 640,
  },
  lance: {
    id: 'lance',
    label: 'Pneumatic Lance',
    subtitle: 'Long piston spike that punches clean through armor plate',
    category: 'Kinetic',
    damage: 22,
    impulse: 9.0,
    lift: 0.6,
    range: 3.5,
    cooldown: 1.05,
    energyCost: 14,
    price: 380,
  },
  magnet: {
    id: 'magnet',
    label: 'Grapple Magnet',
    subtitle: 'Electromagnet that yanks rivals into your other weapons',
    category: 'Energy',
    damage: 5,
    impulse: 11,
    lift: 0,
    range: 7.0,
    cooldown: 1.8,
    energyCost: 16,
    price: 560,
  },
  missiles: {
    id: 'missiles',
    label: 'Micro-Missile Pod',
    subtitle: 'Homing salvo of mini rockets with splash detonation',
    category: 'Artillery',
    damage: 12,
    impulse: 5.5,
    lift: 2.5,
    range: 16,
    cooldown: 2.2,
    energyCost: 22,
    price: 720,
  },
  body_spinner: {
    id: 'body_spinner',
    label: '360° Full-Body Shell',
    subtitle: 'Whole-body toothed outer shell spins around the bot, shredding any contact',
    category: 'Rotor',
    damage: 21,
    impulse: 11.8,
    lift: 4.6,
    range: 2.85,
    cooldown: 0.65,
    energyCost: 9,
  },
  lightning_strike: {
    id: 'lightning_strike',
    label: 'Lightning Strike Spire',
    subtitle: 'Calls down a targeted sky-to-deck lightning bolt onto enemy bots, scrambling systems with massive EMP shock',
    category: 'Energy',
    damage: 34,
    impulse: 8.8,
    lift: 3.4,
    range: 13.5,
    cooldown: 1.55,
    energyCost: 22,
  },
  bomb_drop: {
    id: 'bomb_drop',
    label: 'Aerial Bomb Drop',
    subtitle: 'Deploys an aerial ordnance bomb strike onto enemy coordinates with a high-explosive shockwave',
    category: 'Artillery',
    damage: 38,
    impulse: 12.2,
    lift: 6.2,
    range: 14.0,
    cooldown: 1.65,
    energyCost: 24,
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
    price: 600,
  },
  crawler_nuclear: {
    id: 'crawler_nuclear',
    label: 'Reactor Torque Core',
    subtitle: 'Nuclear-geared siege transmission with massive shove & energy output',
    maxSpeed: 6.4,
    accel: 28,
    turnRate: 2.45,
    knockbackResist: 1.55,
    price: 560,
  },
  hover: {
    id: 'hover',
    label: 'Hover Skirt',
    subtitle: 'Ducted-fan cushion floats over saws, floor blades, lava and acid',
    maxSpeed: 8.2,
    accel: 17,
    turnRate: 3.0,
    knockbackResist: 0.78,
    price: 650,
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
    subtitle: 'Smelting pit with ignitable oil slicks, aerial bomb drops, lava vents & crushers',
    hazardTag: 'Oil Slicks · Bomb Drops · Crushers',
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
    subtitle: 'Ultra-drift sub-zero ice deck with sweeping cryo laser grids, launch flippers & crushers',
    hazardTag: 'Ice Drift · Laser Grid · Flippers',
    halfSize: 18,
    friction: 2.4,
    gravityMult: 1.0,
    energyRegenMult: 1.05,
    skyHex: '#0C141D',
    floorHex: '#19293A',
    accentHex: '#38BDF8',
  },
  reactor: {
    id: 'reactor',
    name: 'Overcharge Reactor',
    subtitle: 'High-voltage core with sweeping ruby laser grids, arc lightning & EMP rings',
    hazardTag: 'Ruby Lasers · Lightning · +55% EN',
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
    subtitle: 'Championship stadium floor with aerial bomb drops, oil slicks, saws & flippers',
    hazardTag: 'Bomb Drops · Oil Slicks · Saws',
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
    subtitle: 'Low-gravity nexus with omni-hazards: laser grids, lightning, bombs & oil slicks',
    hazardTag: 'Lasers · Bombs · Lightning · Low-G',
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
    subtitle: 'Chemical salvage pit with waste oil slicks, acid pools, crushers & bomb drops',
    hazardTag: 'Oil Slicks · Acid Pools · Bombs',
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
    subtitle: 'Volcanic crater with heavy aerial bomb barrages, burning oil slicks & lava geysers',
    hazardTag: 'Bomb Barrages · Lava · Burning Oil',
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
    subtitle: 'Holo-circuit with crossfire laser grids, lightning bolts & turbo drift grip',
    hazardTag: 'Crossfire Lasers · Lightning · Flippers',
    halfSize: 18,
    friction: 6.4,
    gravityMult: 0.92,
    energyRegenMult: 1.35,
    skyHex: '#13091C',
    floorHex: '#221330',
    accentHex: '#EC4899',
  },
  skyforge: {
    id: 'skyforge',
    name: 'Skyforge Platform',
    subtitle: 'Stratosphere platform with ejector drop pits, orbital bomb drops & laser turrets',
    hazardTag: 'Drop Pits · Orbital Bombs · Lasers',
    halfSize: 18,
    friction: 5.0,
    gravityMult: 0.82,
    energyRegenMult: 1.1,
    skyHex: '#1A2740',
    floorHex: '#26303F',
    accentHex: '#22D3EE',
  },
  storm: {
    id: 'storm',
    name: 'Tesla Stormcage',
    subtitle: 'High-voltage thunderdome with relentless lightning strikes, bomb drops & EMP core',
    hazardTag: 'Supercell Lightning · Bombs · EMP',
    halfSize: 18,
    friction: 5.3,
    gravityMult: 1.0,
    energyRegenMult: 1.35,
    skyHex: '#0A0D1A',
    floorHex: '#141A2E',
    accentHex: '#60A5FA',
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
  const primaryWp = weapons.length > 0 ? WEAPON_CATALOG[weapons[0]] || WEAPON_CATALOG.vspinner : null;
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
  const extraWeaponMass = weapons.length === 0 ? -0.06 : extraWeapons.length * 0.14;
  const extraWeaponSpeedDrag = weapons.length === 0 ? 1.04 : Math.max(0.84, 1 - extraWeapons.length * 0.055);
  const combinedLift = primaryWp ? Math.max(primaryWp.lift, ...extraWeapons.map((w) => w.lift * 0.85)) : 0;
  const combinedRange = primaryWp ? Math.max(primaryWp.range, ...extraWeapons.map((w) => w.range)) : 0;

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
      1.18 *
      primaryCh.speedMult *
      hybridSpeedMult *
      ar.speedMult *
      wl.speedMult *
      extraWeaponSpeedDrag *
      (1 + overclockRank * 0.025)
    ).toFixed(2),
  );
  const accel = Number(
    (
      dr.accel *
      1.22 *
      primaryCh.speedMult *
      ar.speedMult *
      extraWeaponSpeedDrag *
      (1 + overclockRank * 0.03)
    ).toFixed(2),
  );
  const turnRate = Number((dr.turnRate * 1.1 * wl.turnMult * (1 + skills.gyroStabilizer * 0.04)).toFixed(2));
  const weaponDamage = primaryWp
    ? Number(((primaryWp.damage + extraWeaponDamage) * (1 + skills.weaponTorque * 0.075)).toFixed(1))
    : 0;
  const weaponImpulse = primaryWp
    ? Number(((primaryWp.impulse + extraWeaponImpulse) * (1 + skills.weaponTorque * 0.05)).toFixed(2))
    : 0;
  const weaponLift = Number(combinedLift.toFixed(2));
  const weaponRange = Number(combinedRange.toFixed(2));
  const weaponCooldown = primaryWp
    ? Number(
        Math.max(
          0.22,
          primaryWp.cooldown *
            (1 + extraWeapons.length * 0.09) *
            (1 - skills.weaponTorque * 0.035 - coolingRank * 0.045),
        ).toFixed(2),
      )
    : 0.5;
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

  const fusionSynergy = config.fusionParents && config.fusionParents.length === 2 ? 1.08 : 1.0;
  const finalMaxHp = Math.round(maxHp * fusionSynergy);
  const finalWeaponDamage = Number((weaponDamage * fusionSynergy).toFixed(1));
  const finalMaxSpeed = Number((maxSpeed * (fusionSynergy > 1 ? 1.04 : 1)).toFixed(2));

  const powerScore = Math.round(
    finalMaxHp * 0.6 +
      maxShieldHp * 0.75 +
      (finalWeaponDamage / Math.max(0.24, weaponCooldown)) * 2.4 +
      finalMaxSpeed * 14 +
      armorZoneHp * 0.55 +
      totalSkillRanks * 18,
  );

  return {
    maxHp: finalMaxHp,
    armorZoneHp,
    maxShieldHp,
    mass,
    bodyScale,
    maxSpeed: finalMaxSpeed,
    accel,
    turnRate,
    weaponDamage: finalWeaponDamage,
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

/** Fuse 2 parent bots into a single hybrid Fusion Bot combining their chassis, weapons, drive, armor & livery. */
export function fuseTwoBotConfigs(botA: BotConfig, botB: BotConfig, customName?: string): BotConfig {
  const stylesA = getBotChassisStyles(botA);
  const stylesB = getBotChassisStyles(botB);
  const mergedStyles: ChassisId[] = [];
  for (const s of [...stylesA, ...stylesB]) {
    if (CHASSIS_CATALOG[s] && !mergedStyles.includes(s)) mergedStyles.push(s);
  }
  const finalStyles = mergedStyles.slice(0, 3);

  const wepsA = getBotWeapons(botA);
  const wepsB = getBotWeapons(botB);
  const mergedWeps: WeaponId[] = [];
  for (const w of [...wepsA, ...wepsB]) {
    if (WEAPON_CATALOG[w] && !mergedWeps.includes(w)) mergedWeps.push(w);
  }
  const finalWeps = mergedWeps.slice(0, 3);
  if (finalWeps.length === 0) finalWeps.push('vspinner');

  const arA = ARMOR_CATALOG[botA.armor] || ARMOR_CATALOG.titanium;
  const arB = ARMOR_CATALOG[botB.armor] || ARMOR_CATALOG.titanium;
  const chosenArmor =
    arA.hpBonus + arA.zoneHp + arA.shieldBonus >= arB.hpBonus + arB.zoneHp + arB.shieldBonus ? botA.armor : botB.armor;

  const drA = DRIVE_CATALOG[botA.drive] || DRIVE_CATALOG.omni;
  const drB = DRIVE_CATALOG[botB.drive] || DRIVE_CATALOG.omni;
  const chosenDrive =
    drA.maxSpeed * 12 + drA.accel >= drB.maxSpeed * 12 + drB.accel ? botA.drive : botB.drive;

  const namePartA = botA.name.split(/\s+/)[0] || 'Aether';
  const namePartB = botB.name.split(/\s+/).slice(-1)[0] || 'Apex';
  const defaultFusionName = `${namePartA}-${namePartB} X`;

  return {
    name: (customName && customName.trim()) || defaultFusionName,
    chassis: finalStyles[0] || 'wedge',
    chassisStyles: finalStyles,
    armor: chosenArmor,
    weapon: finalWeps[0],
    weapons: finalWeps,
    weaponPlacements: finalWeps.map((w, idx) => getDefaultWeaponPlacement(w, idx)),
    wheelLayout: botA.wheelLayout || botB.wheelLayout || '4wd_wide',
    drive: chosenDrive,
    primaryColor: botA.primaryColor || '#0F172A',
    accentColor: botB.accentColor || '#38BDF8',
    finishStyle: botA.finishStyle === 'standard' ? botB.finishStyle || 'iridescent' : botA.finishStyle || 'iridescent',
    accessory: botA.accessory && botA.accessory !== 'none' ? botA.accessory : botB.accessory || 'halo_crown',
    underglowColor: botB.underglowColor && botB.underglowColor !== 'none' ? botB.underglowColor : botA.underglowColor || '#38BDF8',
    pattern: botA.pattern && botA.pattern !== 'none' ? botA.pattern : botB.pattern || 'circuit',
    fusionParents: [botA.name, botB.name],
  };
}

const BOT_NAME_PREFIXES = [
  'Aether',
  'Apex',
  'Obsidian',
  'Volt',
  'Cryo',
  'Hyperion',
  'Vortex',
  'Titan',
  'Phantom',
  'Iron',
  'Magma',
  'Omega',
  'Havoc',
  'Cobalt',
  'Ragnarok',
  'Nemesis',
  'Thunder',
  'Brimstone',
  'Quantum',
  'Crimson',
  'Tungsten',
  'Solaris',
  'Valkyrie',
  'Shadow',
];

const BOT_NAME_CORES = [
  'Juggernaut',
  'Reaper',
  'Striker',
  'Colossus',
  'Maelstrom',
  'Executioner',
  'Centurion',
  'Scorpion',
  'Howitzer',
  'Catapult',
  'Crusher',
  'Hydra',
  'Cyclone',
  'Drifter',
  'Warden',
  'Behemoth',
  'Viper',
  'Tempest',
  'Harbinger',
  'Sentinel',
  'Ravager',
  'Goliath',
  'Fang',
  'Barrage',
];

const BOT_NAME_SUFFIXES = ['', '', '', ' MK-IX', ' Prime', ' X', ' V2', ' Zero', ' Omega', ' GT'];

export function generateRandomBotName(currentName?: string): string {
  for (let attempt = 0; attempt < 8; attempt++) {
    const p = BOT_NAME_PREFIXES[Math.floor(Math.random() * BOT_NAME_PREFIXES.length)];
    const c = BOT_NAME_CORES[Math.floor(Math.random() * BOT_NAME_CORES.length)];
    const s = BOT_NAME_SUFFIXES[Math.floor(Math.random() * BOT_NAME_SUFFIXES.length)];
    const candidate = `${p} ${c}${s}`.slice(0, 18).trim();
    if (candidate !== currentName) return candidate;
  }
  return `Aether Striker ${Math.floor(10 + Math.random() * 89)}`;
}


