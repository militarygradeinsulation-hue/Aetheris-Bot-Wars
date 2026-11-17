import {
  ACCESSORY_CATALOG,
  ARMOR_CATALOG,
  type BotConfig,
  CHASSIS_CATALOG,
  DEFAULT_BOT_CONFIG,
  DEFAULT_SKILLS,
  DRIVE_CATALOG,
  FINISH_CATALOG,
  getBotChassisStyles,
  getBotWeapons,
  type PlayerProfile,
  WEAPON_CATALOG,
  WHEEL_LAYOUT_CATALOG,
} from '../shared/types';

const PROFILE_STORAGE_KEY = 'forgeclash_profile_v1';
const PENDING_SYNC_KEY = 'forgeclash_pending_sync_v1';

const DEFAULT_SAVED_LOADOUTS: BotConfig[] = [
  { ...DEFAULT_BOT_CONFIG },
  {
    name: 'Aether Sovereign',
    chassis: 'scorpion',
    chassisStyles: ['scorpion', 'wedge'],
    armor: 'aetherium',
    weapon: 'tesla',
    weapons: ['tesla', 'drum'],
    wheelLayout: 'omni_quad',
    drive: 'maglev',
    primaryColor: '#5B21B6',
    accentColor: '#C084FC',
    finishStyle: 'iridescent',
    accessory: 'halo_crown',
    underglowColor: '#A855F7',
  },
  {
    name: 'Juggernaut MK-IX',
    chassis: 'juggernaut',
    chassisStyles: ['juggernaut', 'rammer'],
    armor: 'reactive_era',
    weapon: 'railgun',
    weapons: ['railgun', 'mortar', 'crush_jaw'],
    wheelLayout: '8wd_crawler',
    drive: 'crawler_nuclear',
    primaryColor: '#18181B',
    accentColor: '#F59E0B',
    finishStyle: 'gold_leaf',
    accessory: 'boss_spikes',
    underglowColor: '#F59E0B',
  },
];

function sanitizeBotConfig(raw: Partial<BotConfig> | undefined, fallback: BotConfig): BotConfig {
  const merged: BotConfig = { ...fallback, ...(raw || {}) };
  if (!CHASSIS_CATALOG[merged.chassis]) merged.chassis = fallback.chassis;
  if (!ARMOR_CATALOG[merged.armor]) merged.armor = fallback.armor;
  if (!WEAPON_CATALOG[merged.weapon]) merged.weapon = fallback.weapon;
  if (!WHEEL_LAYOUT_CATALOG[merged.wheelLayout]) merged.wheelLayout = fallback.wheelLayout;
  if (!DRIVE_CATALOG[merged.drive]) merged.drive = fallback.drive;
  if (merged.finishStyle && !FINISH_CATALOG[merged.finishStyle]) merged.finishStyle = 'standard';
  if (merged.accessory && !ACCESSORY_CATALOG[merged.accessory]) merged.accessory = 'none';
  merged.weapons = getBotWeapons(merged);
  merged.weapon = merged.weapons[0];
  merged.chassisStyles = getBotChassisStyles(merged);
  merged.chassis = merged.chassisStyles[0];
  return merged;
}

function makeDefaultProfile(): PlayerProfile {
  const randomTag = Math.random().toString(36).slice(2, 6).toUpperCase();
  return {
    id: `pilot_${Date.now().toString(36)}_${randomTag}`,
    callsign: `Pilot-${randomTag}`,
    pilotTitle: 'Aetheris Vanguard',
    clanId: 'clan_aether',
    clanTag: 'AETH',
    rating: 1200,
    level: 1,
    xp: 0,
    scrap: 450,
    skillPoints: 3,
    wins: 0,
    losses: 0,
    kos: 0,
    gauntletStage: 1,
    claimedEvents: [],
    botConfig: { ...DEFAULT_BOT_CONFIG },
    savedLoadouts: DEFAULT_SAVED_LOADOUTS.map((b) => ({ ...b })),
    activeLoadoutSlot: 0,
    selectedWingmanIndex: 3,
    skills: { ...DEFAULT_SKILLS },
    batteryMode: 'balanced',
    muted: false,
    touchControlsMode: 'auto',
  };
}

export function loadPlayerProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
      const fallback = makeDefaultProfile();
      const mergedBot = sanitizeBotConfig(parsed.botConfig, fallback.botConfig);
      const rawLoadouts = Array.isArray(parsed.savedLoadouts) ? parsed.savedLoadouts : [];
      const savedLoadouts: BotConfig[] = [0, 1, 2].map((idx) =>
        sanitizeBotConfig(rawLoadouts[idx], DEFAULT_SAVED_LOADOUTS[idx] || fallback.botConfig),
      );

      return {
        ...fallback,
        ...parsed,
        botConfig: mergedBot,
        savedLoadouts,
        activeLoadoutSlot: typeof parsed.activeLoadoutSlot === 'number' ? parsed.activeLoadoutSlot : 0,
        selectedWingmanIndex: typeof parsed.selectedWingmanIndex === 'number' ? parsed.selectedWingmanIndex : 3,
        skills: { ...fallback.skills, ...(parsed.skills || {}) },
      };
    }
  } catch {
    // Ignore parse errors
  }
  const fresh = makeDefaultProfile();
  savePlayerProfile(fresh);
  return fresh;
}

export function savePlayerProfile(profile: PlayerProfile) {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage quota errors
  }
}

export function markPendingSync(pending: boolean) {
  try {
    if (pending) {
      localStorage.setItem(PENDING_SYNC_KEY, '1');
    } else {
      localStorage.removeItem(PENDING_SYNC_KEY);
    }
  } catch {
    // Ignore
  }
}

export function hasPendingSync(): boolean {
  try {
    return localStorage.getItem(PENDING_SYNC_KEY) === '1';
  } catch {
    return false;
  }
}
