import {
  ACCESSORY_CATALOG,
  applyAdminFullUnlock,
  type ArenaId,
  ARENA_CATALOG,
  ARMOR_CATALOG,
  type BotConfig,
  CHASSIS_CATALOG,
  DEFAULT_BOT_CONFIG,
  DEFAULT_SKILLS,
  DRIVE_CATALOG,
  FINISH_CATALOG,
  getBotChassisStyles,
  getBotWeapons,
  isAdminIdentifier,
  PATTERN_CATALOG,
  type PlayerProfile,
  STARTER_UNLOCKED_ARENAS,
  WEAPON_CATALOG,
  WHEEL_LAYOUT_CATALOG,
} from '../shared/types';

const PROFILE_STORAGE_PREFIX = 'forgeclash_profile_v2';
const ACTIVE_SESSION_UID_KEY = 'forgeclash_active_uid_v1';
const PENDING_SYNC_KEY = 'forgeclash_pending_sync_v1';

export function getSavedSessionUid(): string | null {
  try {
    return localStorage.getItem(ACTIVE_SESSION_UID_KEY);
  } catch {
    return null;
  }
}

export function setSavedSessionUid(uid: string | null) {
  try {
    if (uid) {
      localStorage.setItem(ACTIVE_SESSION_UID_KEY, uid);
    } else {
      localStorage.removeItem(ACTIVE_SESSION_UID_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

function storageKeyForUid(uid?: string): string {
  return uid ? `${PROFILE_STORAGE_PREFIX}_${uid}` : PROFILE_STORAGE_PREFIX;
}

const DEFAULT_SAVED_LOADOUTS: BotConfig[] = [
  { ...DEFAULT_BOT_CONFIG },
  {
    name: 'Striker Wedge',
    chassis: 'wedge',
    chassisStyles: ['wedge'],
    armor: 'titanium',
    weapon: 'hbar',
    weapons: ['hbar'],
    wheelLayout: '4wd_wide',
    drive: 'omni',
    primaryColor: '#1D4ED8',
    accentColor: '#60A5FA',
    finishStyle: 'standard',
    accessory: 'radar_dish',
    underglowColor: '#38BDF8',
    pattern: 'stripes',
  },
  {
    name: 'Iron Fortress',
    chassis: 'rammer',
    chassisStyles: ['rammer', 'brawler'],
    armor: 'steel',
    weapon: 'sawblade',
    weapons: ['sawblade'],
    wheelLayout: '6wd_inline',
    drive: 'tracks',
    primaryColor: '#334155',
    accentColor: '#F59E0B',
    finishStyle: 'matte',
    accessory: 'none',
    underglowColor: '#F59E0B',
    pattern: 'none',
  },
];

export function sanitizeBotConfig(raw: Partial<BotConfig> | undefined, fallback: BotConfig): BotConfig {
  const merged: BotConfig = { ...fallback, ...(raw || {}) };
  if (!CHASSIS_CATALOG[merged.chassis]) merged.chassis = fallback.chassis;
  if (!ARMOR_CATALOG[merged.armor]) merged.armor = fallback.armor;
  if (!WEAPON_CATALOG[merged.weapon]) merged.weapon = fallback.weapon;
  if (!WHEEL_LAYOUT_CATALOG[merged.wheelLayout]) merged.wheelLayout = fallback.wheelLayout;
  if (!DRIVE_CATALOG[merged.drive]) merged.drive = fallback.drive;
  if (merged.finishStyle && !FINISH_CATALOG[merged.finishStyle]) merged.finishStyle = 'standard';
  if (merged.accessory && !ACCESSORY_CATALOG[merged.accessory]) merged.accessory = 'none';
  if (merged.pattern && !PATTERN_CATALOG[merged.pattern]) merged.pattern = 'none';
  if (typeof merged.raceNumber === 'number' && !(merged.raceNumber >= 0 && merged.raceNumber <= 99)) {
    merged.raceNumber = undefined;
  }
  merged.weapons = getBotWeapons(merged);
  merged.weapon = merged.weapons[0] ?? 'vspinner';
  merged.chassisStyles = getBotChassisStyles(merged);
  merged.chassis = merged.chassisStyles[0] ?? 'wedge';
  return merged;
}

export function makeDefaultProfile(uid?: string, email?: string, callsign?: string): PlayerProfile {
  const randomTag = Math.random().toString(36).slice(2, 6).toUpperCase();
  const initialCallsign =
    callsign && callsign.trim().length >= 2
      ? callsign.trim().slice(0, 24)
      : `Pilot_${randomTag}`;
  return {
    id: uid || `pilot_${Date.now().toString(36)}_${randomTag}`,
    email: email || undefined,
    callsign: initialCallsign,
    usernameClaimed: false,
    pilotTitle: 'Aetheris Initiate',
    clanId: 'clan_aether',
    clanTag: 'AETH',
    teamId: null,
    teamName: null,
    rating: 1200,
    level: 1,
    xp: 0,
    coins: 200,
    scrap: 200,
    skillPoints: 2,
    wins: 0,
    losses: 0,
    kos: 0,
    gauntletStage: 1,
    claimedEvents: [],
    botConfig: { ...DEFAULT_BOT_CONFIG },
    savedLoadouts: DEFAULT_SAVED_LOADOUTS.map((b) => ({ ...b })),
    customGarageBots: [],
    activeLoadoutSlot: 0,
    selectedWingmanIndex: 0,
    skills: { ...DEFAULT_SKILLS },
    batteryMode: 'balanced',
    muted: false,
    commentaryMuted: true,
    commentaryDefaultOffApplied: true,
    masterVolume: 0.85,
    musicVolume: 0.65,
    sfxVolume: 0.85,
    crowdVolume: 0.7,
    commentaryVolume: 0.9,
    traditionalMode: false,
    touchControlsMode: 'auto',
    controlScheme: 'wasd_drive',
    deviceLayoutMode: 'auto',
    ownedParts: [],
    unlockedArenas: [...STARTER_UNLOCKED_ARENAS],
    partUpgrades: {},
    campaignStars: {},
    arenaWins: {},
    bestSurvivalWave: 0,
    favorites: {
      weapons: ['vspinner', 'hbar', 'sawblade'],
      chassis: ['wedge', 'brawler', 'rammer'],
      arenas: [...STARTER_UNLOCKED_ARENAS],
      builds: [],
    },
    isAdmin: false,
    adminSeat: undefined,
  };
}

export function sanitizeProfile(
  parsed: Partial<PlayerProfile> | null | undefined,
  uid?: string,
  email?: string,
): PlayerProfile {
  const fallback = makeDefaultProfile(uid, email, parsed?.callsign);
  if (!parsed) return fallback;

  const mergedBot = sanitizeBotConfig(parsed.botConfig, fallback.botConfig);
  const rawLoadouts = Array.isArray(parsed.savedLoadouts) ? parsed.savedLoadouts : [];
  const savedLoadouts: BotConfig[] = [0, 1, 2].map((idx) =>
    sanitizeBotConfig(rawLoadouts[idx], DEFAULT_SAVED_LOADOUTS[idx] || fallback.botConfig),
  );
  const customGarageBots: BotConfig[] = Array.isArray(parsed.customGarageBots)
    ? parsed.customGarageBots.map((b) => sanitizeBotConfig(b, fallback.botConfig))
    : [];

  const rawFav = parsed.favorites;
  const favorites = {
    weapons: Array.isArray(rawFav?.weapons)
      ? rawFav.weapons.filter((w) => Boolean(WEAPON_CATALOG[w]))
      : fallback.favorites!.weapons,
    chassis: Array.isArray(rawFav?.chassis)
      ? rawFav.chassis.filter((c) => Boolean(CHASSIS_CATALOG[c]))
      : fallback.favorites!.chassis,
    arenas: Array.isArray(rawFav?.arenas)
      ? rawFav.arenas.filter((a) => Boolean(ARENA_CATALOG[a]))
      : fallback.favorites!.arenas,
    builds: Array.isArray(rawFav?.builds)
      ? rawFav.builds.map((entry: unknown, idx: number) => {
          if (entry && typeof entry === 'object' && 'config' in (entry as Record<string, unknown>)) {
            const e = entry as { id?: string; label?: string; config?: Partial<BotConfig>; savedAt?: string };
            const cfg = sanitizeBotConfig(e.config, fallback.botConfig);
            return {
              id: e.id || `fav_${idx}`,
              label: e.label || cfg.name,
              config: cfg,
              savedAt: e.savedAt || new Date().toISOString(),
            };
          }
          const cfg = sanitizeBotConfig(entry as Partial<BotConfig>, fallback.botConfig);
          return {
            id: `fav_${idx}`,
            label: cfg.name,
            config: cfg,
            savedAt: new Date().toISOString(),
          };
        })
      : [],
  };

  const currency = Math.max(
    0,
    Math.round(
      typeof parsed.coins === 'number'
        ? parsed.coins
        : typeof parsed.scrap === 'number'
          ? parsed.scrap
          : fallback.scrap,
    ),
  );

  const unlockedArenasSet = new Set<ArenaId>([
    ...STARTER_UNLOCKED_ARENAS,
    ...(Array.isArray(parsed.unlockedArenas)
      ? (parsed.unlockedArenas.filter((a) => Boolean(ARENA_CATALOG[a as ArenaId])) as ArenaId[])
      : []),
  ]);

  const cleanUpgrades: Record<string, number> = {};
  if (parsed.partUpgrades && typeof parsed.partUpgrades === 'object') {
    for (const [k, v] of Object.entries(parsed.partUpgrades)) {
      if (typeof v === 'number' && v >= 1 && v <= 5) {
        cleanUpgrades[k] = Math.round(v);
      }
    }
  }

  const base: PlayerProfile = {
    ...fallback,
    ...parsed,
    id: uid || parsed.id || fallback.id,
    email: email || parsed.email,
    coins: currency,
    scrap: currency,
    botConfig: mergedBot,
    savedLoadouts,
    customGarageBots,
    ownedParts: Array.isArray(parsed.ownedParts) ? parsed.ownedParts : [],
    unlockedArenas: [...unlockedArenasSet],
    partUpgrades: cleanUpgrades,
    campaignStars: parsed.campaignStars ?? {},
    arenaWins: parsed.arenaWins ?? {},
    bestSurvivalWave: parsed.bestSurvivalWave ?? 0,
    activeLoadoutSlot: typeof parsed.activeLoadoutSlot === 'number' ? parsed.activeLoadoutSlot : 0,
    selectedWingmanIndex: typeof parsed.selectedWingmanIndex === 'number' ? parsed.selectedWingmanIndex : 0,
    skills: { ...fallback.skills, ...(parsed.skills || {}) },
    favorites,
    masterVolume: typeof parsed.masterVolume === 'number' ? Math.max(0, Math.min(1, parsed.masterVolume)) : 0.85,
    musicVolume: typeof parsed.musicVolume === 'number' ? Math.max(0, Math.min(1, parsed.musicVolume)) : 0.65,
    sfxVolume: typeof parsed.sfxVolume === 'number' ? Math.max(0, Math.min(1, parsed.sfxVolume)) : 0.85,
    crowdVolume: typeof parsed.crowdVolume === 'number' ? Math.max(0, Math.min(1, parsed.crowdVolume)) : 0.7,
    commentaryVolume:
      typeof parsed.commentaryVolume === 'number' ? Math.max(0, Math.min(1, parsed.commentaryVolume)) : 0.9,
    commentaryMuted: parsed.commentaryDefaultOffApplied
      ? typeof parsed.commentaryMuted === 'boolean'
        ? parsed.commentaryMuted
        : true
      : true,
    commentaryDefaultOffApplied: true,
    traditionalMode: Boolean(parsed.traditionalMode),
    accessCode: typeof parsed.accessCode === 'string' ? parsed.accessCode : undefined,
    isAdmin: Boolean(parsed.isAdmin),
    adminSeat: parsed.adminSeat === 2 ? 2 : parsed.adminSeat === 1 ? 1 : undefined,
  };

  if (
    base.isAdmin ||
    isAdminIdentifier(base.callsign) ||
    isAdminIdentifier(base.email) ||
    isAdminIdentifier(base.accessCode)
  ) {
    return applyAdminFullUnlock(base);
  }

  return base;
}

export function loadPlayerProfile(uid?: string): PlayerProfile {
  try {
    const raw = localStorage.getItem(storageKeyForUid(uid));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
      return sanitizeProfile(parsed, uid, parsed.email);
    }
  } catch {
    // Ignore parse errors
  }
  const fresh = makeDefaultProfile(uid);
  savePlayerProfile(fresh, uid);
  return fresh;
}

export function savePlayerProfile(profile: PlayerProfile, uid?: string) {
  try {
    const synced: PlayerProfile = {
      ...profile,
      coins: profile.coins ?? profile.scrap,
      scrap: profile.coins ?? profile.scrap,
    };
    localStorage.setItem(storageKeyForUid(uid || profile.id), JSON.stringify(synced));
    localStorage.setItem(PROFILE_STORAGE_PREFIX, JSON.stringify(synced));
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
