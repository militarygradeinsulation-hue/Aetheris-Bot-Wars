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
  PATTERN_CATALOG,
  type PlayerProfile,
  premiumPartsInConfig,
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
  if (merged.pattern && !PATTERN_CATALOG[merged.pattern]) merged.pattern = 'none';
  if (typeof merged.raceNumber === 'number' && !(merged.raceNumber >= 0 && merged.raceNumber <= 99)) merged.raceNumber = undefined;
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
    customGarageBots: [
      {
        name: 'Cyclone X-360',
        chassis: 'shell_spinner',
        chassisStyles: ['shell_spinner', 'ufo'],
        armor: 'titanium',
        weapon: 'body_spinner',
        weapons: ['body_spinner', 'flame'],
        wheelLayout: '4wd_tucked',
        drive: 'turbo',
        primaryColor: '#1E293B',
        accentColor: '#F59E0B',
        finishStyle: 'chrome',
        accessory: 'halo_crown',
        underglowColor: '#F59E0B',
        pattern: 'stripes',
      },
    ],
    activeLoadoutSlot: 0,
    selectedWingmanIndex: 3,
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
    ownedParts: [],
    campaignStars: {},
    arenaWins: {},
    bestSurvivalWave: 0,
    favorites: {
      weapons: ['vspinner', 'laser', 'body_spinner', 'flipper'],
      chassis: ['wedge', 'shell_spinner', 'brawler'],
      arenas: ['colosseum', 'storm'],
      builds: [],
    },
    isAdmin: false,
    adminSeat: undefined,
  };
}

/** Premium parts already sitting in a pilot's builds stay usable after the part economy arrives. */
function grantEquippedParts(profile: PlayerProfile): PlayerProfile {
  const owned = new Set(profile.ownedParts ?? []);
  for (const cfg of [profile.botConfig, ...(profile.savedLoadouts ?? []), ...(profile.customGarageBots ?? [])]) {
    if (cfg) premiumPartsInConfig(cfg).forEach((k) => owned.add(k));
  }
  return { ...profile, ownedParts: [...owned] };
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
      const customGarageBots: BotConfig[] = Array.isArray(parsed.customGarageBots)
        ? parsed.customGarageBots.map((b) => sanitizeBotConfig(b, fallback.botConfig))
        : fallback.customGarageBots ?? [];
      const rawFav = parsed.favorites;
      const favorites = {
        weapons: Array.isArray(rawFav?.weapons) ? rawFav.weapons.filter((w) => Boolean(WEAPON_CATALOG[w])) : fallback.favorites!.weapons,
        chassis: Array.isArray(rawFav?.chassis) ? rawFav.chassis.filter((c) => Boolean(CHASSIS_CATALOG[c])) : fallback.favorites!.chassis,
        arenas: Array.isArray(rawFav?.arenas) ? rawFav.arenas : fallback.favorites!.arenas,
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

      return grantEquippedParts({
        ...fallback,
        ...parsed,
        botConfig: mergedBot,
        savedLoadouts,
        customGarageBots,
        ownedParts: Array.isArray(parsed.ownedParts) ? parsed.ownedParts : [],
        campaignStars: parsed.campaignStars ?? {},
        arenaWins: parsed.arenaWins ?? {},
        bestSurvivalWave: parsed.bestSurvivalWave ?? 0,
        activeLoadoutSlot: typeof parsed.activeLoadoutSlot === 'number' ? parsed.activeLoadoutSlot : 0,
        selectedWingmanIndex: typeof parsed.selectedWingmanIndex === 'number' ? parsed.selectedWingmanIndex : 3,
        skills: { ...fallback.skills, ...(parsed.skills || {}) },
        favorites,
        masterVolume: typeof parsed.masterVolume === 'number' ? Math.max(0, Math.min(1, parsed.masterVolume)) : 0.85,
        musicVolume: typeof parsed.musicVolume === 'number' ? Math.max(0, Math.min(1, parsed.musicVolume)) : 0.65,
        sfxVolume: typeof parsed.sfxVolume === 'number' ? Math.max(0, Math.min(1, parsed.sfxVolume)) : 0.85,
        crowdVolume: typeof parsed.crowdVolume === 'number' ? Math.max(0, Math.min(1, parsed.crowdVolume)) : 0.7,
        commentaryVolume:
          typeof parsed.commentaryVolume === 'number' ? Math.max(0, Math.min(1, parsed.commentaryVolume)) : 0.9,
        commentaryMuted: parsed.commentaryDefaultOffApplied
          ? (typeof parsed.commentaryMuted === 'boolean' ? parsed.commentaryMuted : true)
          : true,
        commentaryDefaultOffApplied: true,
        traditionalMode: Boolean(parsed.traditionalMode),
        isAdmin: Boolean(parsed.isAdmin),
        adminSeat: parsed.adminSeat === 2 ? 2 : parsed.adminSeat === 1 ? 1 : undefined,
      });
    }
  } catch {
    // Ignore parse errors
  }
  const fresh = grantEquippedParts(makeDefaultProfile());
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
