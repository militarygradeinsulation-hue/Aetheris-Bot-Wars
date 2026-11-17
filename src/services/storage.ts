import {
  ARMOR_CATALOG,
  CHASSIS_CATALOG,
  DEFAULT_BOT_CONFIG,
  DEFAULT_SKILLS,
  DRIVE_CATALOG,
  FINISH_CATALOG,
  getBotChassisStyles,
  getBotWeapons,
  type PlayerProfile,
  WEAPON_CATALOG,
  PATTERN_CATALOG,
  type BotConfig,
  WHEEL_LAYOUT_CATALOG,
} from '../shared/types';

const PROFILE_STORAGE_KEY = 'forgeclash_profile_v1';
const PENDING_SYNC_KEY = 'forgeclash_pending_sync_v1';

function makeDefaultProfile(): PlayerProfile {
  const randomTag = Math.random().toString(36).slice(2, 6).toUpperCase();
  return {
    id: `pilot_${Date.now().toString(36)}_${randomTag}`,
    callsign: `Pilot-${randomTag}`,
    clanId: 'clan_iron',
    clanTag: 'IRON',
    rating: 1200,
    level: 1,
    xp: 0,
    scrap: 240,
    skillPoints: 2,
    wins: 0,
    losses: 0,
    kos: 0,
    gauntletStage: 1,
    claimedEvents: [],
    botConfig: { ...DEFAULT_BOT_CONFIG },
    skills: { ...DEFAULT_SKILLS },
    batteryMode: 'balanced',
    muted: false,
    touchControlsMode: 'auto',
    ownedParts: [],
    campaignStars: {},
    arenaWins: {},
    bestSurvivalWave: 0,
    savedLoadouts: [],
  };
}

/** Repairs a stored or incoming bot config so every part id resolves in the current catalogs. */
export function sanitizeBotConfig(raw: Partial<BotConfig> | undefined, fallback: BotConfig): BotConfig {
  const mergedBot: BotConfig = { ...fallback, ...(raw || {}) };
  if (!CHASSIS_CATALOG[mergedBot.chassis]) mergedBot.chassis = fallback.chassis;
  if (!ARMOR_CATALOG[mergedBot.armor]) mergedBot.armor = fallback.armor;
  if (!WEAPON_CATALOG[mergedBot.weapon]) mergedBot.weapon = fallback.weapon;
  if (!WHEEL_LAYOUT_CATALOG[mergedBot.wheelLayout]) mergedBot.wheelLayout = fallback.wheelLayout;
  if (!DRIVE_CATALOG[mergedBot.drive]) mergedBot.drive = fallback.drive;
  if (mergedBot.finish && !FINISH_CATALOG[mergedBot.finish]) mergedBot.finish = 'gloss';
  if (mergedBot.pattern && !PATTERN_CATALOG[mergedBot.pattern]) mergedBot.pattern = 'none';
  mergedBot.weapons = getBotWeapons(mergedBot);
  mergedBot.weapon = mergedBot.weapons[0];
  mergedBot.chassisStyles = getBotChassisStyles(mergedBot);
  mergedBot.chassis = mergedBot.chassisStyles[0];
  return mergedBot;
}

export function loadPlayerProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
      const fallback = makeDefaultProfile();
      const mergedBot = sanitizeBotConfig(parsed.botConfig, fallback.botConfig);
      const loadouts = Array.isArray(parsed.savedLoadouts)
        ? parsed.savedLoadouts.slice(0, 3).map((l) => sanitizeBotConfig(l, fallback.botConfig))
        : [];

      return {
        ...fallback,
        ...parsed,
        botConfig: mergedBot,
        savedLoadouts: loadouts,
        ownedParts: Array.isArray(parsed.ownedParts) ? parsed.ownedParts : [],
        campaignStars: parsed.campaignStars ?? {},
        arenaWins: parsed.arenaWins ?? {},
        bestSurvivalWave: parsed.bestSurvivalWave ?? 0,
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
