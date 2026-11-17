import {
  ARMOR_CATALOG,
  CHASSIS_CATALOG,
  DEFAULT_BOT_CONFIG,
  DEFAULT_SKILLS,
  DRIVE_CATALOG,
  getBotChassisStyles,
  getBotWeapons,
  type PlayerProfile,
  WEAPON_CATALOG,
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
  };
}

export function loadPlayerProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
      const fallback = makeDefaultProfile();
      const mergedBot = { ...fallback.botConfig, ...(parsed.botConfig || {}) };
      if (!CHASSIS_CATALOG[mergedBot.chassis]) mergedBot.chassis = fallback.botConfig.chassis;
      if (!ARMOR_CATALOG[mergedBot.armor]) mergedBot.armor = fallback.botConfig.armor;
      if (!WEAPON_CATALOG[mergedBot.weapon]) mergedBot.weapon = fallback.botConfig.weapon;
      if (!WHEEL_LAYOUT_CATALOG[mergedBot.wheelLayout]) mergedBot.wheelLayout = fallback.botConfig.wheelLayout;
      if (!DRIVE_CATALOG[mergedBot.drive]) mergedBot.drive = fallback.botConfig.drive;
      mergedBot.weapons = getBotWeapons(mergedBot);
      mergedBot.weapon = mergedBot.weapons[0];
      mergedBot.chassisStyles = getBotChassisStyles(mergedBot);
      mergedBot.chassis = mergedBot.chassisStyles[0];

      return {
        ...fallback,
        ...parsed,
        botConfig: mergedBot,
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
