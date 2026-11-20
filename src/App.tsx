import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Gamepad2,
  KeyRound,
  Layers,
  Mic,
  MicOff,
  Monitor,
  Music,
  Radio,
  Settings,
  Sliders,
  Smartphone,
  Sparkles,
  Tablet,
  Users,
  WifiOff,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { registerSW } from 'virtual:pwa-register';
import {
  AiForgeStudioModal,
  type MediaHistoryItem,
  type StudioTab,
} from './components/AiForgeStudioModal';
import { AudioSettingsModal } from './components/AudioSettingsModal';
import { AuthGateModal } from './components/AuthGateModal';
import {
  ArenaLauncherModal,
  type LocalLaunchMode,
  type RivalTier,
} from './components/ArenaLauncherModal';
import { CombatHud, type CameraViewPreset, type MatchResultSummary } from './components/CombatHud';
import { GarageRosterModal } from './components/GarageRosterModal';
import {
  LiveVoiceCopilot,
  type StudioLightingPreset,
} from './components/LiveVoiceCopilot';
import { PWAInstallButton } from './components/PWAInstallButton';
import { SettingsHubModal } from './components/SettingsHubModal';
import { SocialAndRankingsPanel, type HubModalTab } from './components/SocialAndRankingsPanel';
import {
  ThreeSceneInspectorDock,
  type WorkshopCameraAngle,
} from './components/ThreeSceneInspectorDock';
import { TouchControls } from './components/TouchControls';
import { ArenaBuilderModal } from './components/ArenaBuilderModal';
import {
  DEFAULT_ARENA_RULES,
  loadCustomArenas,
  saveCustomArenas,
  type ArenaLayoutId,
  type ArenaRules,
  type CustomArenaSpec,
} from './shared/arenaLayouts';
import { WorkshopDock } from './components/WorkshopDock';
import { IntroSplashOverlay } from './components/IntroSplashOverlay';
import type { OpenRoomSummary } from './components/OnlinePvpPanel';
import { BattleArenaCanvas } from './game/BattleArenaCanvas';
import { soundEngine } from './game/soundEngine';
import { voiceCommentator } from './game/voiceCommentator';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import {
  claimUniqueUsername,
  createClanInFirestore,
  createCombatTeam,
  ensureAndJoinClanInFirestore,
  hydrateCodeSessionAccount,
  joinCombatTeam,
  leaveCombatTeam,
  loginWithAccessCode,
  removeConnection,
  respondToConnectionRequest,
  saveUserAccount,
  sendClanMessageInFirestore,
  sendConnectionRequest,
  setPilotPresenceStatus,
  signOutAccount,
  subscribeClanMessages,
  subscribeConnections,
  subscribeFirestoreClans,
  subscribeOnlinePilots,
  subscribeTeams,
} from './services/firebaseService';
import {
  getSavedSessionUid,
  hasPendingSync,
  loadPlayerProfile,
  makeDefaultProfile,
  markPendingSync,
  savePlayerProfile,
  setSavedSessionUid,
} from './services/storage';
import {
  AI_RIVAL_PRESETS,
  createInitialSnapshot,
  getRivalPreset,
  presetToRoster,
  stepArenaPhysics,
  type BotRosterTemplate,
} from './shared/physicsEngine';
import {
  describeObjective,
  evaluateObjective,
  getCampaignLevel,
  getNextCampaignLevel,
  isLevelUnlocked,
  levelPassed,
} from './shared/campaign';
import {
  applyAdminFullUnlock,
  ARENA_CATALOG,
  type ArenaId,
  type ArenaSnapshot,
  type BotConfig,
  type ClanChatMessage,
  type ClanInfo,
  type CombatTeamInfo,
  type ControlSchemeId,
  DEFAULT_SKILLS,
  type DeviceLayoutMode,
  type GameMode,
  getBotWeapons,
  getPartPrice,
  getPartUnlockLevel,
  getPartUpgradeCost,
  getPartUpgradeLevel,
  isAdminIdentifier,
  isPartOwned,
  isTraditionalArena,
  type LeaderboardEntry,
  type MatchModifierId,
  MAX_PART_UPGRADE_LEVEL,
  type PartCategory,
  partKey,
  type PilotConnectionRecord,
  type PilotDirectoryEntry,
  type PlayerInputState,
  type PlayerProfile,
  type SeasonalEvent,
  type SkillTree,
  type TimedBattleDuration,
  type OnlinePresence,
  type PvpMatchResult,
  type PvpRecord,
} from './shared/types';

export const OFFLINE_FALLBACK_CLANS: ClanInfo[] = [
  {
    id: 'clan_aether',
    name: 'Aetheris Prime',
    tag: 'AETH',
    motto: 'Quantum energy shields, railgun precision, and orbital supremacy.',
    perkLabel: '+8% Energy Regen & Aether Shield Synergy',
    warPoints: 2890,
    memberCount: 24,
    wins: 78,
    tournamentSeed: 1,
    chat: [
      {
        id: 'c_aeth_1',
        sender: 'Commander Orion',
        text: 'Aetheris Nexus low-gravity qualifier is live. Equip Tesla or Railgun slots!',
        timestamp: new Date().toISOString(),
      },
    ],
  },
  {
    id: 'clan_iron',
    name: 'Iron Vanguard',
    tag: 'IRON',
    motto: 'Heavy steel hulls, ERA blast plating, and relentless frontal pressure.',
    perkLabel: '+10% Armor Zone Durability & Ramming Mass',
    warPoints: 2640,
    memberCount: 19,
    wins: 69,
    tournamentSeed: 2,
    chat: [
      {
        id: 'c_iron_1',
        sender: 'Kaelen Vance',
        text: 'Reactive ERA blocks shred horizontal spinners in 2v2 Clan Wars.',
        timestamp: new Date().toISOString(),
      },
    ],
  },
  {
    id: 'clan_apex',
    name: 'Apex Torque',
    tag: 'APEX',
    motto: 'Maximum flywheel RPM and surgical rear-deck uppercuts.',
    perkLabel: '+8% Rotor Spin-Up & Kinetic Impulse',
    warPoints: 2410,
    memberCount: 17,
    wins: 61,
    tournamentSeed: 3,
    chat: [],
  },
  {
    id: 'clan_volt',
    name: 'Volt Syndicate',
    tag: 'VOLT',
    motto: 'High-speed interceptors, Tesla arcs, and pneumatic ring-outs.',
    perkLabel: '+6% Top Speed & EMP Discharge Power',
    warPoints: 2180,
    memberCount: 15,
    wins: 54,
    tournamentSeed: 4,
    chat: [],
  },
  {
    id: 'clan_cryo',
    name: 'Cryo Breach',
    tag: 'CRYO',
    motto: 'Sub-zero nitrogen jets and low-friction drift mastery.',
    perkLabel: '+15% Freeze Duration & Ice Traction',
    warPoints: 1960,
    memberCount: 14,
    wins: 48,
    tournamentSeed: 5,
    chat: [],
  },
  {
    id: 'clan_nova',
    name: 'Nova Artillery',
    tag: 'NOVA',
    motto: 'Long-range Gauss rail spikes and dorsal plasma mortar barrages.',
    perkLabel: '+10% Artillery & Railgun Impact Force',
    warPoints: 1820,
    memberCount: 12,
    wins: 43,
    tournamentSeed: 6,
    chat: [],
  },
];

export const OFFLINE_FALLBACK_LEADERBOARD: LeaderboardEntry[] = [
  {
    id: 'seed_0',
    name: 'Commander Orion',
    clanTag: 'AETH',
    rating: 1940,
    wins: 54,
    losses: 7,
    kos: 42,
    botName: 'Omega Prime',
    weapon: 'railgun',
    armor: 'aetherium',
    powerScore: 925,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'seed_1',
    name: 'Kaelen Vance',
    clanTag: 'IRON',
    rating: 1840,
    wins: 42,
    losses: 9,
    kos: 31,
    botName: 'Obsidian Maul',
    weapon: 'hammer',
    armor: 'reactive_era',
    powerScore: 862,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'seed_2',
    name: 'Nora Takahashi',
    clanTag: 'APEX',
    rating: 1765,
    wins: 36,
    losses: 11,
    kos: 28,
    botName: 'Redline Edge',
    weapon: 'vspinner',
    armor: 'titanium',
    powerScore: 815,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'seed_3',
    name: 'Viktor Volkov',
    clanTag: 'NOVA',
    rating: 1715,
    wins: 33,
    losses: 11,
    kos: 26,
    botName: 'Hellfire Howitzer',
    weapon: 'mortar',
    armor: 'tungsten',
    powerScore: 804,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'seed_4',
    name: 'Devon Mercer',
    clanTag: 'VOLT',
    rating: 1690,
    wins: 29,
    losses: 12,
    kos: 22,
    botName: 'Tesla Catapult',
    weapon: 'tesla',
    armor: 'kevlar',
    powerScore: 770,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'seed_5',
    name: 'Sora Lindqvist',
    clanTag: 'CRYO',
    rating: 1620,
    wins: 24,
    losses: 14,
    kos: 19,
    botName: 'Glacier Drum',
    weapon: 'cryo_jet',
    armor: 'nanoweave',
    powerScore: 748,
    updatedAt: new Date().toISOString(),
  },
];

export const OFFLINE_FALLBACK_EVENTS: SeasonalEvent[] = [
  {
    id: 's5_aether_ascension',
    seasonName: 'Season 05 · Aetheris Ascension',
    title: 'Quantum Nexus Trial',
    description: 'Harness low-gravity physics and +40% energy recharge in the Aetheris Quantum Nexus to score 2 wins.',
    arenaId: 'aether_nexus',
    modifierLabel: 'Low Gravity · Twin EMP Rings',
    targetWins: 2,
    rewardScrap: 450,
    rewardSkillPoints: 2,
    badgeTitle: 'Quantum Vanguard',
    endsAt: '2026-12-01T00:00:00Z',
  },
  {
    id: 's5_foundry_clash',
    seasonName: 'Season 05 · Aetheris Ascension',
    title: 'Foundry Crucible Qualifier',
    description: 'Win 4 arena matches in Molten Foundry amidst floor saws and explosive fuel drums.',
    arenaId: 'foundry',
    modifierLabel: 'Floor Saws & Explosive Drums',
    targetWins: 4,
    rewardScrap: 550,
    rewardSkillPoints: 2,
    badgeTitle: 'Forge Master',
    endsAt: '2026-12-05T00:00:00Z',
  },
  {
    id: 's5_cryo_drift',
    seasonName: 'Season 05 · Aetheris Ascension',
    title: 'Sub-Zero Drift Masters',
    description: 'Adapt to low-friction ice physics in the Cryo Pit and score 6 total wins.',
    arenaId: 'cryo',
    modifierLabel: 'Low Traction Ice + Launch Pads',
    targetWins: 6,
    rewardScrap: 700,
    rewardSkillPoints: 3,
    badgeTitle: 'Sub-Zero Drift King',
    endsAt: '2026-12-10T00:00:00Z',
  },
  {
    id: 's5_scrapyard_survivor',
    seasonName: 'Season 05 · Aetheris Ascension',
    title: 'Acid Scrapyard Reclamation',
    description: 'Outlast corrosive acid pools and twin hydraulic crushers for 8 total wins.',
    arenaId: 'toxic_scrapyard',
    modifierLabel: 'Corrosive Acid Pool + Extra Crates',
    targetWins: 8,
    rewardScrap: 850,
    rewardSkillPoints: 3,
    badgeTitle: 'Scrapyard Warlord',
    endsAt: '2026-12-14T00:00:00Z',
  },
  {
    id: 's5_caldera_inferno',
    seasonName: 'Season 05 · Aetheris Ascension',
    title: 'Magma Caldera Siege',
    description: 'Conquer erupting thermal vents and quadruple saws in the Magma Caldera for 10 wins.',
    arenaId: 'volcano_caldera',
    modifierLabel: 'Erupting Lava Vents · Quad Saws',
    targetWins: 10,
    rewardScrap: 1000,
    rewardSkillPoints: 4,
    badgeTitle: 'Caldera Warlord',
    endsAt: '2026-12-18T00:00:00Z',
  },
  {
    id: 's5_cyber_overdrive',
    seasonName: 'Season 05 · Aetheris Ascension',
    title: 'Neon Cyber Grid Grand Prix',
    description: 'Dominate the high-grip synthwave circuit and reach 12 career arena victories.',
    arenaId: 'cyber_grid',
    modifierLabel: 'High Grip · +35% Energy · Rotors',
    targetWins: 12,
    rewardScrap: 1250,
    rewardSkillPoints: 5,
    badgeTitle: 'Aetheris Grand Champion',
    endsAt: '2026-12-25T00:00:00Z',
  },
];

const GAUNTLET_ARENA_ORDER: ArenaId[] = [
  'foundry',
  'cryo',
  'aether_nexus',
  'toxic_scrapyard',
  'reactor',
  'volcano_caldera',
  'cyber_grid',
  'skyforge',
  'storm',
  'colosseum',
];

export default function App() {
  const isOnline = useOnlineStatus();
  const [authUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [profile, setProfile] = useState<PlayerProfile>(() =>
    loadPlayerProfile(getSavedSessionUid() ?? undefined),
  );
  const profileRef = useRef<PlayerProfile>(profile);
  profileRef.current = profile;
  const accountLoadedUidRef = useRef<string | null>(
    profile.usernameClaimed ? profile.id : null,
  );
  const saveDebounceRef = useRef<number | null>(null);

  const [sceneMode, setSceneMode] = useState<'workshop' | 'combat'>('workshop');
  const [selectedArena, setSelectedArena] = useState<ArenaId>('foundry');
  const [headerMoreOpen, setHeaderMoreOpen] = useState(false);
  // Arena layout, sky-drop rules and player-built arenas (persisted per device)
  const arenaSetupInit = (() => {
    try {
      const raw = localStorage.getItem('aetheris_arena_setup_v1');
      if (raw) return JSON.parse(raw) as { layout?: ArenaLayoutId; rules?: ArenaRules; customId?: string | null };
    } catch {
      /* ignore */
    }
    return {};
  })();
  const [arenaLayout, setArenaLayout] = useState<ArenaLayoutId>(arenaSetupInit.layout ?? 'classic');
  const [arenaRules, setArenaRules] = useState<ArenaRules>({ ...DEFAULT_ARENA_RULES, ...(arenaSetupInit.rules ?? {}) });
  const [customArenas, setCustomArenas] = useState<CustomArenaSpec[]>(() => loadCustomArenas());
  const [activeCustomArenaId, setActiveCustomArenaId] = useState<string | null>(arenaSetupInit.customId ?? null);
  const [arenaBuilder, setArenaBuilder] = useState<{ open: boolean; editId: string | null }>({ open: false, editId: null });
  const activeCustomArena = customArenas.find((a) => a.id === activeCustomArenaId) ?? null;
  useEffect(() => {
    try {
      localStorage.setItem(
        'aetheris_arena_setup_v1',
        JSON.stringify({ layout: arenaLayout, rules: arenaRules, customId: activeCustomArenaId }),
      );
    } catch {
      /* ignore */
    }
  }, [arenaLayout, arenaRules, activeCustomArenaId]);
  const selectArenaTheme = useCallback((id: ArenaId) => {
    setSelectedArena(id);
    setActiveCustomArenaId(null);
  }, []);
  const [selectedRivalTier, setSelectedRivalTier] = useState<RivalTier>('mixed');
  const [selectedDuration, setSelectedDuration] = useState<TimedBattleDuration>(180);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [garageOpen, setGarageOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hubTab, setHubTab] = useState<HubModalTab | null>(null);
  const [cameraPreset, setCameraPreset] = useState<CameraViewPreset>('chase');
  const [selectedModifiers, setSelectedModifiers] = useState<MatchModifierId[]>([]);
  const [matchResult, setMatchResult] = useState<MatchResultSummary | null>(null);
  const activeCampaignIdRef = useRef<string | null>(null);
  const [resumeCampaignLevelId, setResumeCampaignLevelId] = useState<string | null>(null);

  // Bot Configuration History Stack for Back / Forward buttons next to Random
  const [botHistory, setBotHistory] = useState<BotConfig[]>(() => [profile.botConfig]);
  const [botHistoryIdx, setBotHistoryIdx] = useState<number>(0);

  // Admin Login & 2-Player Multi-Screen Seat State
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminCodeInput, setAdminCodeInput] = useState('');
  const [adminUnlocked, setAdminUnlocked] = useState(() =>
    Boolean(
      profile.isAdmin ||
        isAdminIdentifier(profile.callsign) ||
        isAdminIdentifier(profile.email) ||
        isAdminIdentifier(profile.accessCode),
    ),
  );
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminSeat, setAdminSeat] = useState<1 | 2 | null>(null);

  // AI Forge Studio (Lyria 3 Music Generation + Media Lab), Real-Time Voice Copilot & 3D Scene Inspector
  const [aiStudioOpen, setAiStudioOpen] = useState(false);
  const [aiStudioTab, setAiStudioTab] = useState<StudioTab>('music');
  const [mediaHistory, setMediaHistory] = useState<MediaHistoryItem[]>([]);
  const [liveVoiceOpen, setLiveVoiceOpen] = useState(false);
  const [explodedRatio, setExplodedRatio] = useState(0);
  const [lightingPreset, setLightingPreset] = useState<StudioLightingPreset>('arena');
  const [turntableSpeed, setTurntableSpeed] = useState(1);
  const [workshopCameraAngle, setWorkshopCameraAngle] = useState<WorkshopCameraAngle>('hero');
  const [weaponTestBurstSignal, setWeaponTestBurstSignal] = useState(0);
  const [zenMode, setZenMode] = useState(false);
  const [sceneDockCollapsed, setSceneDockCollapsed] = useState(false);
  const [audioSettingsOpen, setAudioSettingsOpen] = useState(false);

  // Responsive viewport width tracking for crisp mobile vs desktop bar
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280,
  );
  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Server & Firestore-backed social, connections, teams, and leaderboard data
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(OFFLINE_FALLBACK_LEADERBOARD);
  const [clans, setClans] = useState<ClanInfo[]>(OFFLINE_FALLBACK_CLANS);
  const [onlinePilots, setOnlinePilots] = useState<PilotDirectoryEntry[]>([]);
  const [connections, setConnections] = useState<PilotConnectionRecord[]>([]);
  const [teams, setTeams] = useState<CombatTeamInfo[]>([]);
  const [seasonalEvents, setSeasonalEvents] = useState<SeasonalEvent[]>(OFFLINE_FALLBACK_EVENTS);
  const [pvpBoard, setPvpBoard] = useState<PvpRecord[]>([]);
  const [presence, setPresence] = useState<OnlinePresence | null>(null);
  const [openRooms, setOpenRooms] = useState<OpenRoomSummary[]>([]);
  const helloRef = useRef({ id: '', name: '', clanTag: '' });

  // Active Match State
  const snapshotRef = useRef<ArenaSnapshot | null>(null);
  const [hudSnapshot, setHudSnapshot] = useState<ArenaSnapshot | null>(null);
  const [isMultiplayerMatch, setIsMultiplayerMatch] = useState(false);
  const [isClanWarMatch, setIsClanWarMatch] = useState(false);
  const [lastLocalMode, setLastLocalMode] = useState<LocalLaunchMode | 'campaign'>('gauntlet');
  const matchRewardAppliedRef = useRef(false);
  const lastCountdownCeilRef = useRef(0);
  const lastMatchTimerCeilRef = useRef(0);

  // Multiplayer WebSocket & Lobby
  const wsRef = useRef<WebSocket | null>(null);
  const pvpResultRef = useRef<PvpMatchResult | null>(null);
  const activeRoomIdRef = useRef<string | null>(null);
  const [lobbyRoom, setLobbyRoom] = useState<{
    id: string;
    mode: string;
    playerCount: number;
    maxPlayers: number;
    players: Array<{ id: string; name: string; clanTag: string; botName: string }>;
  } | null>(null);

  // Player Input Ref (shared between keyboard & touch controls)
  const inputRef = useRef<PlayerInputState>({
    throttle: 0,
    steer: 0,
    fireWeapon: false,
    fireWeapons: [false, false, false],
    boost: false,
    overdrive: false,
    drift: false,
  });

  const [showIntroSplash, setShowIntroSplash] = useState(true);

  useEffect(() => {
    try {
      registerSW({ immediate: true });
    } catch {
      // Ignore in non-SW environments
    }
  }, []);

  useEffect(() => {
    soundEngine.setMuted(profile.muted);
    voiceCommentator.setMuted(profile.muted);
  }, [profile.muted]);

  useEffect(() => {
    voiceCommentator.setCommentaryMuted(Boolean(profile.commentaryMuted));
  }, [profile.commentaryMuted]);

  useEffect(() => {
    soundEngine.setVolumes({
      master: profile.masterVolume ?? 0.85,
      music: profile.musicVolume ?? 0.65,
      sfx: profile.sfxVolume ?? 0.85,
      crowd: profile.crowdVolume ?? 0.7,
    });
    soundEngine.setHapticFeedback(profile.hapticFeedback ?? true);
    voiceCommentator.setVolume(
      (profile.masterVolume ?? 0.85) * (profile.commentaryVolume ?? 0.9),
    );
  }, [
    profile.masterVolume,
    profile.musicVolume,
    profile.sfxVolume,
    profile.crowdVolume,
    profile.commentaryVolume,
    profile.hapticFeedback,
  ]);

  // Configurable Auto-Save Frequency Timer for prolonged Workshop & Fusion Lab sessions
  useEffect(() => {
    const intervalSec = Math.max(5, Math.min(120, profile.autoSaveIntervalSec ?? 15));
    const timer = window.setInterval(() => {
      const uid = accountLoadedUidRef.current;
      savePlayerProfile(profileRef.current, uid ?? undefined);
      try {
        localStorage.setItem(
          'aetheris_workshop_autosave_backup_v1',
          JSON.stringify({
            savedAt: new Date().toISOString(),
            botConfig: profileRef.current.botConfig,
            customGarageBots: profileRef.current.customGarageBots ?? [],
          }),
        );
      } catch {
        // Ignore storage quota warnings
      }
    }, intervalSec * 1000);
    return () => window.clearInterval(timer);
  }, [profile.autoSaveIntervalSec]);

  useEffect(() => {
    if (sceneMode === 'workshop') {
      soundEngine.playWorkshopMusic();
    }
  }, [sceneMode]);

  useEffect(() => {
    const handleUnlock = () => {
      soundEngine.unlock();
    };
    window.addEventListener('pointerdown', handleUnlock, { passive: true });
    window.addEventListener('keydown', handleUnlock, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', handleUnlock);
      window.removeEventListener('keydown', handleUnlock);
    };
  }, []);

  // Automatically unlock Admin mode when profile is an Admin account
  useEffect(() => {
    if (
      profile.isAdmin ||
      isAdminIdentifier(profile.callsign) ||
      isAdminIdentifier(profile.email) ||
      isAdminIdentifier(profile.accessCode)
    ) {
      setAdminUnlocked(true);
    }
  }, [profile.isAdmin, profile.callsign, profile.email, profile.accessCode]);

  // Hydrate saved code-authenticated pilot session from cloud store on startup
  useEffect(() => {
    let cancelled = false;
    const savedUid = getSavedSessionUid() || (profileRef.current.usernameClaimed ? profileRef.current.id : null);
    if (!savedUid || !profileRef.current.usernameClaimed) {
      setAuthLoading(false);
      return;
    }
    accountLoadedUidRef.current = savedUid;
    void hydrateCodeSessionAccount(savedUid, profileRef.current).then((cloudProfile) => {
      if (cancelled) return;
      accountLoadedUidRef.current = cloudProfile.id;
      setSavedSessionUid(cloudProfile.id);
      setProfile(cloudProfile);
      setBotHistory([cloudProfile.botConfig]);
      setBotHistoryIdx(0);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Subscribe to live online pilots directory, connections, teams, and clans
  const cloudReadyUid = profile.usernameClaimed ? profile.id : null;

  useEffect(() => {
    if (!cloudReadyUid) return;
    const unsubPilots = subscribeOnlinePilots(setOnlinePilots);
    const unsubConnections = subscribeConnections(cloudReadyUid, setConnections);
    const unsubTeams = subscribeTeams(setTeams);
    const unsubClans = subscribeFirestoreClans(OFFLINE_FALLBACK_CLANS, setClans);

    const status = sceneMode === 'combat' ? 'fighting' : 'garage';
    void setPilotPresenceStatus(cloudReadyUid, status);
    const heartbeat = window.setInterval(() => {
      const curStatus = sceneMode === 'combat' ? 'fighting' : 'garage';
      void setPilotPresenceStatus(cloudReadyUid, curStatus);
    }, 45_000);

    const onBeforeUnload = () => {
      void setPilotPresenceStatus(cloudReadyUid, 'offline');
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      unsubPilots();
      unsubConnections();
      unsubTeams();
      unsubClans();
      window.clearInterval(heartbeat);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [cloudReadyUid, sceneMode]);

  // Subscribe to active clan live chat in Firestore
  useEffect(() => {
    if (!cloudReadyUid || !profile.clanId) return;
    const targetClanId = profile.clanId;
    const unsub = subscribeClanMessages(targetClanId, cloudReadyUid, (msgs) => {
      setClans((prev) =>
        prev.map((c) => (c.id === targetClanId ? { ...c, chat: msgs } : c)),
      );
    });
    return () => unsub();
  }, [cloudReadyUid, profile.clanId]);

  const scheduleCloudSave = useCallback((next: PlayerProfile, immediate = false) => {
    const uid = accountLoadedUidRef.current;
    savePlayerProfile(next, uid ?? undefined);
    if (!uid) return;
    const status = sceneMode === 'combat' ? 'fighting' : 'garage';
    if (saveDebounceRef.current) {
      window.clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = null;
    }
    if (immediate) {
      void saveUserAccount(uid, next, status);
    } else {
      saveDebounceRef.current = window.setTimeout(() => {
        void saveUserAccount(uid, profileRef.current, status);
      }, 450);
    }
  }, [sceneMode]);

  const updateProfile = useCallback(
    (patch: Partial<PlayerProfile>, immediate = false) => {
      setProfile((prev) => {
        const next = { ...prev, ...patch };
        scheduleCloudSave(next, immediate);
        return next;
      });
    },
    [scheduleCloudSave],
  );

  const applyBotConfigImmediate = useCallback(
    (nextConfig: BotConfig) => {
      setProfile((prev) => {
        const slot = prev.activeLoadoutSlot ?? 0;
        const nextLoadouts = Array.isArray(prev.savedLoadouts) ? [...prev.savedLoadouts] : [];
        nextLoadouts[slot] = nextConfig;
        const next: PlayerProfile = {
          ...prev,
          botConfig: nextConfig,
          savedLoadouts: nextLoadouts,
        };
        scheduleCloudSave(next, false);
        return next;
      });
    },
    [scheduleCloudSave],
  );

  const handleBotConfigChange = useCallback(
    (nextConfig: BotConfig) => {
      applyBotConfigImmediate(nextConfig);
      setBotHistory((prev) => {
        const sliced = prev.slice(0, botHistoryIdx + 1);
        const last = sliced[sliced.length - 1];
        if (last && JSON.stringify(last) === JSON.stringify(nextConfig)) {
          return prev;
        }
        const updated = [...sliced, JSON.parse(JSON.stringify(nextConfig)) as BotConfig].slice(-25);
        setBotHistoryIdx(updated.length - 1);
        return updated;
      });
    },
    [applyBotConfigImmediate, botHistoryIdx],
  );

  const handleStepBackBotHistory = useCallback(() => {
    if (botHistoryIdx <= 0) return;
    const targetIdx = botHistoryIdx - 1;
    const chosen = botHistory[targetIdx];
    if (chosen) {
      setBotHistoryIdx(targetIdx);
      applyBotConfigImmediate(JSON.parse(JSON.stringify(chosen)) as BotConfig);
    }
  }, [botHistory, botHistoryIdx, applyBotConfigImmediate]);

  const handleStepForwardBotHistory = useCallback(() => {
    if (botHistoryIdx >= botHistory.length - 1) return;
    const targetIdx = botHistoryIdx + 1;
    const chosen = botHistory[targetIdx];
    if (chosen) {
      setBotHistoryIdx(targetIdx);
      applyBotConfigImmediate(JSON.parse(JSON.stringify(chosen)) as BotConfig);
    }
  }, [botHistory, botHistoryIdx, applyBotConfigImmediate]);

  const handleSaveCustomBotToRoster = useCallback(
    (customBot: BotConfig) => {
      setProfile((prev) => {
        const existing = Array.isArray(prev.customGarageBots) ? [...prev.customGarageBots] : [];
        const filtered = existing.filter((b) => b.name.toLowerCase() !== customBot.name.toLowerCase());
        const nextCustom = [JSON.parse(JSON.stringify(customBot)) as BotConfig, ...filtered].slice(0, 24);
        const next: PlayerProfile = {
          ...prev,
          customGarageBots: nextCustom,
        };
        scheduleCloudSave(next, true);
        return next;
      });
    },
    [scheduleCloudSave],
  );

  const handleDeleteCustomBotFromRoster = useCallback(
    (idx: number) => {
      setProfile((prev) => {
        const existing = Array.isArray(prev.customGarageBots) ? [...prev.customGarageBots] : [];
        existing.splice(idx, 1);
        const next: PlayerProfile = {
          ...prev,
          customGarageBots: existing,
        };
        scheduleCloudSave(next, true);
        return next;
      });
    },
    [scheduleCloudSave],
  );

  const handleSelectLoadoutSlot = useCallback(
    (slotIdx: number) => {
      setProfile((prev) => {
        const loadouts = prev.savedLoadouts || [];
        const chosen = loadouts[slotIdx] || prev.botConfig;
        const next: PlayerProfile = {
          ...prev,
          activeLoadoutSlot: slotIdx,
          botConfig: { ...chosen },
        };
        scheduleCloudSave(next, false);
        return next;
      });
    },
    [scheduleCloudSave],
  );

  const syncProfileToServer = useCallback(
    async (prof: PlayerProfile) => {
      if (!navigator.onLine) {
        markPendingSync(true);
        return;
      }
      try {
        const res = await fetch('/api/profile/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: prof.id,
            name: prof.callsign,
            clanTag: prof.clanTag,
            rating: prof.rating,
            wins: prof.wins,
            losses: prof.losses,
            kos: prof.kos,
            botConfig: prof.botConfig,
            skills: prof.skills,
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { leaderboard: LeaderboardEntry[] };
          if (data.leaderboard?.length) setLeaderboard(data.leaderboard);
          markPendingSync(false);
        }
      } catch {
        markPendingSync(true);
      }
    },
    [],
  );

  const fetchBootstrap = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const res = await fetch('/api/bootstrap');
      if (res.ok) {
        const data = (await res.json()) as {
          leaderboard: LeaderboardEntry[];
          pvpBoard?: PvpRecord[];
          presence?: OnlinePresence;
          activeRooms?: OpenRoomSummary[];
          clans: ClanInfo[];
          seasonalEvents: SeasonalEvent[];
        };
        if (data.leaderboard?.length) setLeaderboard(data.leaderboard);
        if (Array.isArray(data.pvpBoard)) setPvpBoard(data.pvpBoard);
        if (data.presence) setPresence(data.presence);
        if (Array.isArray(data.activeRooms)) setOpenRooms(data.activeRooms);
        if (data.clans?.length) setClans(data.clans);
        if (data.seasonalEvents?.length) setSeasonalEvents(data.seasonalEvents);
      }
    } catch {
      // Offline fallback remains active
    }
  }, []);

  const fetchMediaHistory = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const res = await fetch('/api/ai/history');
      if (res.ok) {
        const data = (await res.json()) as { history?: MediaHistoryItem[] };
        if (Array.isArray(data.history)) setMediaHistory(data.history);
      }
    } catch {
      // Ignore offline history fetch
    }
  }, []);

  useEffect(() => {
    if (isOnline) {
      fetchBootstrap();
      fetchMediaHistory();
      if (hasPendingSync()) {
        syncProfileToServer(profile);
      }
    }
  }, [isOnline, fetchBootstrap, fetchMediaHistory, syncProfileToServer, profile]);

  // Keyboard shortcut [H] in Workshop mode toggles 3D Zen / Cinema mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sceneMode !== 'workshop') return;
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select')) return;
      if (!e.repeat && e.code === 'KeyH') {
        setZenMode((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sceneMode]);

  // WebSocket lifecycle
  useEffect(() => {
    if (!isOnline) {
      wsRef.current?.close();
      wsRef.current = null;
      return;
    }

    let closedByCleanup = false;
    let reconnectTimer: number | null = null;

    const connect = () => {
      if (closedByCleanup || !navigator.onLine) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
      wsRef.current = ws;
      ws.onopen = () => {
        const h = helloRef.current;
        if (h.id) ws.send(JSON.stringify({ type: 'hello', playerId: h.id, name: h.name, clanTag: h.clanTag }));
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data) as {
            type: string;
            room?: {
              id: string;
              mode: string;
              playerCount: number;
              maxPlayers: number;
              players: Array<{ id: string; name: string; clanTag: string; botName: string }>;
            };
            roomId?: string;
            snapshot?: ArenaSnapshot;
            clanId?: string;
            message?: ClanChatMessage;
            presence?: OnlinePresence;
            rooms?: OpenRoomSummary[];
            board?: PvpRecord[];
            results?: PvpMatchResult[];
          };

          if (msg.type === 'presence') {
            if (msg.presence) setPresence(msg.presence);
            if (Array.isArray(msg.rooms)) setOpenRooms(msg.rooms);
            return;
          }
          if (msg.type === 'pvp:board' && Array.isArray(msg.board)) {
            setPvpBoard(msg.board);
            return;
          }
          if (msg.type === 'match:result' && Array.isArray(msg.results)) {
            const mine = msg.results.find((r) => r.playerId === helloRef.current.id);
            if (mine) {
              pvpResultRef.current = mine;
              setMatchResult((prev) => (prev ? { ...prev, ratingDelta: mine.ratingDelta, pvp: mine } : prev));
              setPvpBoard((prev) => {
                const next = prev.filter((r) => r.id !== mine.record.id);
                if (mine.ranked) next.push(mine.record);
                return next.sort((a, b) => b.rating - a.rating || b.wins - a.wins);
              });
            }
            return;
          }

          if (msg.type === 'room:lobby' && msg.room) {
            activeRoomIdRef.current = msg.room.id;
            setLobbyRoom(msg.room);
          } else if ((msg.type === 'match:started' || msg.type === 'match:snapshot') && msg.snapshot) {
            if (msg.type === 'match:started') {
              pvpResultRef.current = null;
              matchRewardAppliedRef.current = false;
              lastCountdownCeilRef.current = 3;
              setLauncherOpen(false);
              setAdminModalOpen(false);
              setLobbyRoom(null);
              setIsMultiplayerMatch(true);
              setSelectedArena(msg.snapshot.arenaId);
              setSceneMode('combat');
              soundEngine.playNextBattleMusic(msg.snapshot.arenaId);
              const rivalBot = msg.snapshot.bots.find((b) => b.id !== profile.id);
              voiceCommentator.announceMatchStart(
                msg.snapshot.arenaId,
                profile.botConfig.name,
                rivalBot?.config.name,
                profile.botConfig,
                rivalBot?.config,
              );
            }
            snapshotRef.current = msg.snapshot;
            setHudSnapshot({ ...msg.snapshot });
          } else if (msg.type === 'clan:chat_message' && msg.clanId && msg.message) {
            setClans((prev) =>
              prev.map((c) =>
                c.id === msg.clanId
                  ? {
                      ...c,
                      chat: c.chat.some((m) => m.id === msg.message!.id)
                        ? c.chat
                        : [...c.chat.slice(-29), msg.message!],
                    }
                  : c,
              ),
            );
          }
        } catch {
          // Ignore invalid socket frames
        }
      };

      ws.onclose = () => {
        if (!closedByCleanup && navigator.onLine) {
          reconnectTimer = window.setTimeout(connect, 2500);
        }
      };
    };

    connect();

    return () => {
      closedByCleanup = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [isOnline]);

  // Tell the server who is connected (presence list + PvP ladder identity)
  useEffect(() => {
    helloRef.current = { id: profile.id, name: profile.callsign, clanTag: profile.clanTag };
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'hello', playerId: profile.id, name: profile.callsign, clanTag: profile.clanTag }));
    }
  }, [profile.id, profile.callsign, profile.clanTag]);

  // Keyboard & Mouse Driving & Combat Bindings (WASD Drive, Arrows Drive + WASD Weapons, or Mouse Drive)
  const activeScheme: ControlSchemeId = profile.controlScheme ?? 'wasd_drive';
  const activeDeviceMode: DeviceLayoutMode = profile.deviceLayoutMode ?? 'auto';

  useEffect(() => {
    const keys = new Set<string>();
    let mouseDriveThrottle = 0;
    let mouseDriveSteer = 0;
    let mouseButtons = [false, false, false];

    const syncKeysToInput = () => {
      let fwd = 0;
      let str = 0;
      let slot0 = false;
      let slot1 = false;
      let slot2 = false;
      let repair = false;

      if (activeScheme === 'arrows_drive') {
        // Arrows Drive + W/A/S/D for Weapons & Repair
        fwd = (keys.has('ArrowUp') ? 1 : 0) - (keys.has('ArrowDown') ? 1 : 0);
        str = (keys.has('ArrowLeft') ? 1 : 0) - (keys.has('ArrowRight') ? 1 : 0);
        slot0 =
          keys.has('KeyA') ||
          keys.has('Numpad1') ||
          keys.has('Numpad4') ||
          keys.has('Digit1') ||
          keys.has('KeyJ');
        slot1 =
          keys.has('KeyW') ||
          keys.has('Numpad2') ||
          keys.has('Numpad8') ||
          keys.has('Digit2') ||
          keys.has('KeyK');
        slot2 =
          keys.has('KeyD') ||
          keys.has('Numpad3') ||
          keys.has('Numpad6') ||
          keys.has('Digit3') ||
          keys.has('KeyL');
        repair = keys.has('KeyS') || keys.has('KeyF') || keys.has('Numpad5') || keys.has('KeyE');
      } else {
        // WASD Drive (or Mouse Drive + WASD fallback) + Arrow Keys for Weapons & Repair
        const keyFwd = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
        const keyStr = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0);
        fwd =
          activeScheme === 'mouse_drive' && Math.abs(keyFwd) < 0.05
            ? mouseDriveThrottle
            : keyFwd;
        str =
          activeScheme === 'mouse_drive' && Math.abs(keyStr) < 0.05
            ? mouseDriveSteer
            : keyStr;
        slot0 =
          keys.has('ArrowLeft') ||
          keys.has('Numpad1') ||
          keys.has('Numpad4') ||
          keys.has('Digit1') ||
          keys.has('KeyJ') ||
          (activeScheme === 'mouse_drive' && mouseButtons[0]);
        slot1 =
          keys.has('ArrowUp') ||
          keys.has('Numpad2') ||
          keys.has('Numpad8') ||
          keys.has('Digit2') ||
          keys.has('KeyK') ||
          (activeScheme === 'mouse_drive' && mouseButtons[1]);
        slot2 =
          keys.has('ArrowRight') ||
          keys.has('Numpad3') ||
          keys.has('Numpad6') ||
          keys.has('Digit3') ||
          keys.has('KeyL') ||
          (activeScheme === 'mouse_drive' && mouseButtons[2]);
        repair =
          keys.has('KeyF') || keys.has('ArrowDown') || keys.has('Numpad5') || keys.has('KeyE');
      }

      inputRef.current.throttle = fwd;
      inputRef.current.steer = str;
      inputRef.current.fireWeapons = [slot0, slot1, slot2];
      inputRef.current.fireWeapon = slot0 || slot1 || slot2;
      inputRef.current.boost = keys.has('Space') || keys.has('Numpad0');
      inputRef.current.drift =
        keys.has('ShiftLeft') ||
        keys.has('ShiftRight') ||
        keys.has('KeyQ') ||
        (inputRef.current.boost && Math.abs(str) > 0.1);
      inputRef.current.overdrive = repair;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (sceneMode !== 'combat') return;
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) ||
        e.code.startsWith('Numpad')
      ) {
        e.preventDefault();
      }
      if (!e.repeat && (e.code === 'KeyV' || e.code === 'KeyC')) {
        setCameraPreset((c) =>
          c === 'chase'
            ? 'first_person'
            : c === 'first_person'
              ? 'pilot_booth'
              : c === 'pilot_booth'
                ? 'tactical'
                : c === 'tactical'
                  ? 'spectator'
                  : c === 'spectator'
                    ? 'cinematic'
                    : 'chase',
        );
        return;
      }
      soundEngine.unlock();
      keys.add(e.code);
      syncKeysToInput();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.code);
      if (sceneMode === 'combat') {
        syncKeysToInput();
      }
    };

    const isInteractiveHudElement = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      return Boolean(target.closest('button, a, input, select, textarea, [role="dialog"]'));
    };

    const onMouseMove = (e: MouseEvent) => {
      if (sceneMode !== 'combat' || activeScheme !== 'mouse_drive') return;
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      const nx = (e.clientX - w * 0.5) / (w * 0.35);
      const ny = (h * 0.52 - e.clientY) / (h * 0.32);
      const deadzone = 0.12;
      mouseDriveSteer =
        Math.abs(nx) < deadzone ? 0 : Math.max(-1, Math.min(1, -nx));
      mouseDriveThrottle =
        Math.abs(ny) < deadzone ? 0 : Math.max(-1, Math.min(1, ny));
      syncKeysToInput();
    };

    const onMouseDown = (e: MouseEvent) => {
      if (sceneMode !== 'combat' || activeScheme !== 'mouse_drive') return;
      if (isInteractiveHudElement(e.target)) return;
      soundEngine.unlock();
      if (e.button === 0) mouseButtons[0] = true;
      else if (e.button === 2) mouseButtons[1] = true;
      else if (e.button === 1) mouseButtons[2] = true;
      syncKeysToInput();
    };

    const onMouseUp = (e: MouseEvent) => {
      if (activeScheme !== 'mouse_drive') return;
      if (e.button === 0) mouseButtons[0] = false;
      else if (e.button === 2) mouseButtons[1] = false;
      else if (e.button === 1) mouseButtons[2] = false;
      if (sceneMode === 'combat') syncKeysToInput();
    };

    const onContextMenu = (e: MouseEvent) => {
      if (sceneMode === 'combat' && activeScheme === 'mouse_drive' && !isInteractiveHudElement(e.target)) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('contextmenu', onContextMenu);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('contextmenu', onContextMenu);
    };
  }, [sceneMode, activeScheme]);

  const activeCombatPlayerId = adminSeat ? `admin_p${adminSeat}` : profile.id;

  // Send live inputs to server during Multiplayer matches at 30Hz
  useEffect(() => {
    if (sceneMode !== 'combat' || !isMultiplayerMatch) return;
    const timer = window.setInterval(() => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN && activeRoomIdRef.current) {
        ws.send(
          JSON.stringify({
            type: 'match:input',
            roomId: activeRoomIdRef.current,
            playerId: activeCombatPlayerId,
            input: inputRef.current,
          }),
        );
      }
    }, 33);
    return () => clearInterval(timer);
  }, [sceneMode, isMultiplayerMatch, activeCombatPlayerId]);

  // Apply match rewards once when snapshot enters 'finished'
  useEffect(() => {
    if (!hudSnapshot || hudSnapshot.phase !== 'finished' || matchRewardAppliedRef.current) return;
    matchRewardAppliedRef.current = true;

    const playerBot = hudSnapshot.bots.find((b) => b.id === profile.id);
    const playerTeam = playerBot?.team ?? 0;
    const won =
      hudSnapshot.mode === 'survival'
        ? false
        : hudSnapshot.winningTeam !== undefined && hudSnapshot.winningTeam !== null
          ? hudSnapshot.winningTeam === playerTeam
          : hudSnapshot.winnerId === profile.id;
    const kos = playerBot?.kos ?? 0;
    const mode = hudSnapshot.mode;
    const wave = hudSnapshot.survivalWave ?? 0;
    const wavesCleared = Math.max(0, wave - 1);
    const isPractice = mode === 'practice';
    const modeBonus =
      mode === 'boss_raid' ? 85 : mode === 'team_3v3' || mode === 'king_hill' ? 45 : mode === 'team_2v2' ? 35 : 0;

    let scrapEarned = isPractice ? 0 : (won ? 150 + modeBonus : 50) + kos * 35;
    let xpEarned = isPractice ? 10 : won ? 135 + modeBonus : 45;
    let spEarned = 0;
    if (mode === 'survival') {
      scrapEarned = 40 + wavesCleared * 45 + kos * 15;
      xpEarned = 40 + wavesCleared * 25;
    }

    // Campaign star evaluation
    const level = activeCampaignIdRef.current ? getCampaignLevel(activeCampaignIdRef.current) : undefined;
    let stars = 0;
    let objectives: MatchResultSummary['objectives'];
    let unlocked: string | undefined;
    let levelWon = won;
    if (level) {
      const facts = {
        won,
        hpPct: playerBot && !playerBot.isDead ? (playerBot.hp / Math.max(1, playerBot.maxHp)) * 100 : 0,
        elapsed: hudSnapshot.elapsedTime ?? 0,
        kos,
        alliesAlive: hudSnapshot.bots.filter((b) => b.team === playerTeam && b.id !== profile.id).every((b) => !b.isDead),
        wave: wavesCleared + (playerBot && !playerBot.isDead ? 1 : 0),
      };
      const passed = levelPassed(level, facts);
      levelWon = passed;
      objectives = level.objectives.map((o) => ({ label: describeObjective(o), met: passed && evaluateObjective(o, facts) }));
      stars = passed ? objectives.filter((o) => o.met).length : 0;
      const prevStars = profile.campaignStars?.[level.id] ?? 0;
      const firstClear = prevStars === 0 && stars > 0;
      if (firstClear) {
        scrapEarned += level.rewardScrap;
        spEarned += level.rewardSkillPoints ?? 0;
        unlocked = level.rewardUnlock;
      } else if (stars > prevStars) {
        scrapEarned += Math.round(level.rewardScrap * 0.25);
      }
    }

    const ratingDelta = isPractice || level || mode === 'survival' ? 0 : won ? (isMultiplayerMatch ? 28 : 18) : isMultiplayerMatch ? -14 : -6;
    const newRecord = mode === 'survival' && wavesCleared > (profile.bestSurvivalWave ?? 0);

    setMatchResult({
      won: mode === 'survival' ? wavesCleared > 0 : levelWon,
      scrap: scrapEarned,
      xp: xpEarned,
      skillPoints: spEarned,
      stars: level ? stars : undefined,
      objectives,
      unlocked,
      wavesCleared: mode === 'survival' ? wavesCleared : undefined,
      newRecord,
      levelTitle: level?.title,
      ratingDelta: isMultiplayerMatch && pvpResultRef.current ? pvpResultRef.current.ratingDelta : ratingDelta,
      pvp: isMultiplayerMatch ? pvpResultRef.current ?? undefined : undefined,
    });

    const winnerBot = hudSnapshot.winnerId
      ? hudSnapshot.bots.find((b) => b.id === hudSnapshot.winnerId)
      : undefined;
    voiceCommentator.announceMatchEnd(
      levelWon,
      winnerBot?.config.name || profile.botConfig.name,
      hudSnapshot.finishReason,
    );

    setProfile((prev) => {
      let nextXp = prev.xp + xpEarned;
      let nextLevel = prev.level;
      let gainedLevels = 0;
      while (nextXp >= nextLevel * 200) {
        nextXp -= nextLevel * 200;
        nextLevel += 1;
        gainedLevels += 1;
      }
      const unlockedArenasSet = new Set<ArenaId>(prev.unlockedArenas ?? ['foundry', 'colosseum']);
      for (const aSpec of Object.values(ARENA_CATALOG)) {
        if ((aSpec.unlockLevel ?? 1) <= nextLevel) {
          unlockedArenasSet.add(aSpec.id);
        }
      }

      const arenaWins = { ...(prev.arenaWins ?? {}) };
      if (won && !isPractice) {
        arenaWins[hudSnapshot.arenaId] = (arenaWins[hudSnapshot.arenaId] ?? 0) + 1;
      }
      const owned = new Set(prev.ownedParts ?? []);
      if (unlocked) owned.add(unlocked);
      const campaignStars = { ...(prev.campaignStars ?? {}) };
      if (level) campaignStars[level.id] = Math.max(campaignStars[level.id] ?? 0, stars);

      const nextCoins = (prev.coins ?? prev.scrap) + scrapEarned;

      const nextProfile: PlayerProfile = {
        ...prev,
        coins: nextCoins,
        scrap: nextCoins,
        xp: nextXp,
        level: nextLevel,
        skillPoints: prev.skillPoints + gainedLevels + spEarned,
        rating: Math.max(800, prev.rating + ratingDelta),
        wins: won ? prev.wins + 1 : prev.wins,
        losses: won || isPractice || mode === 'survival' ? prev.losses : prev.losses + 1,
        kos: prev.kos + kos,
        gauntletStage: won && lastLocalMode === 'gauntlet' ? prev.gauntletStage + 1 : prev.gauntletStage,
        arenaWins,
        unlockedArenas: [...unlockedArenasSet],
        ownedParts: [...owned],
        campaignStars,
        bestSurvivalWave: Math.max(prev.bestSurvivalWave ?? 0, mode === 'survival' ? wavesCleared : 0),
      };
      savePlayerProfile(nextProfile, accountLoadedUidRef.current ?? undefined);
      if (accountLoadedUidRef.current) {
        void saveUserAccount(accountLoadedUidRef.current, nextProfile, 'fighting');
      }
      syncProfileToServer(nextProfile);

      if (isClanWarMatch && prev.clanId) {
        const warDelta = won ? 160 : 40;
        setClans((cPrev) =>
          cPrev
            .map((c) =>
              c.id === prev.clanId
                ? { ...c, warPoints: c.warPoints + warDelta, wins: won ? c.wins + 1 : c.wins }
                : c,
            )
            .sort((a, b) => b.warPoints - a.warPoints)
            .map((c, idx) => ({ ...c, tournamentSeed: idx + 1 })),
        );
        if (navigator.onLine) {
          fetch(`/api/clans/${prev.clanId}/tournament`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ won, warPointsDelta: warDelta }),
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
              if (data?.clans) setClans(data.clans);
            })
            .catch(() => {});
        }
      }

      return nextProfile;
    });
  }, [hudSnapshot, profile.id, profile.campaignStars, profile.bestSurvivalWave, isMultiplayerMatch, isClanWarMatch, lastLocalMode, syncProfileToServer]);

  // Start Offline / Local Arena Match
  const startLocalMatch = useCallback(
    (
      mode: LocalLaunchMode,
      clanWar = false,
      overrideBotConfig?: BotConfig,
      extraModifiers?: MatchModifierId[],
    ) => {
      soundEngine.unlock();
      matchRewardAppliedRef.current = false;
      lastCountdownCeilRef.current = 3;
      setAdminSeat(null);
      setIsMultiplayerMatch(false);
      setIsClanWarMatch(clanWar);
      setLastLocalMode(mode);
      activeCampaignIdRef.current = null;
      setMatchResult(null);

      const botCfgToUse = overrideBotConfig ?? profile.botConfig;
      const mergedMods = extraModifiers
        ? [...new Set([...selectedModifiers, ...extraModifiers])]
        : selectedModifiers;

      const isTrad = Boolean(profile.traditionalMode) || mergedMods.includes('traditional_rules');
      const rawArenaToUse: ArenaId =
        mode === 'gauntlet'
          ? GAUNTLET_ARENA_ORDER[(profile.gauntletStage - 1) % GAUNTLET_ARENA_ORDER.length]
          : selectedArena;
      const customForMatch = mode === 'gauntlet' ? null : activeCustomArena;
      const arenaToUse: ArenaId = customForMatch
        ? customForMatch.theme
        : isTrad && !isTraditionalArena(rawArenaToUse)
          ? 'colosseum'
          : rawArenaToUse;
      setSelectedArena(arenaToUse);

      const roster: BotRosterTemplate[] = [
        {
          id: profile.id,
          name: profile.callsign,
          clanTag: profile.clanTag,
          config: botCfgToUse,
          skills: profile.skills,
          partUpgrades: profile.partUpgrades,
          isBot: false,
          team: 0,
        },
      ];

      // Spawn AI Wingman on Team 0 for 2v2 Team Clash & Titan Boss Raid
      if (mode === 'team_2v2' || mode === 'boss_raid' || mode === 'team_3v3' || mode === 'king_hill') {
        const wingIdx = profile.selectedWingmanIndex ?? 3;
        const bay2 = profile.savedLoadouts?.[1];
        if (wingIdx === -1 && bay2) {
          roster.push({
            id: 'ally_wingman',
            name: `${profile.callsign} Wingman`,
            clanTag: profile.clanTag,
            botLevel: Math.max(2, profile.level),
            config: bay2,
            skills: profile.skills,
            isBot: true,
            team: 0,
          });
        } else {
          const wingPreset = AI_RIVAL_PRESETS[Math.abs(wingIdx) % AI_RIVAL_PRESETS.length];
          roster.push({
            id: 'ally_wingman',
            name: wingPreset.name,
            clanTag: clanWar ? profile.clanTag : wingPreset.clanTag,
            botLevel: wingPreset.botLevel,
            weightClassOverride: wingPreset.weightClass,
            scaleOverride: wingPreset.scale,
            hpMult: wingPreset.hpMult,
            speedMult: wingPreset.speedMult,
            dmgMult: wingPreset.dmgMult,
            config: wingPreset.config,
            skills: { ...DEFAULT_SKILLS, chassisReinforcement: 2, weaponTorque: 2 },
            isBot: true,
            team: 0,
          });
        }
      }

      const stageBoost = mode === 'gauntlet' ? Math.min(4, Math.floor((profile.gauntletStage - 1) / 2)) : 1;

      // Squad 3v3 gets a second AI teammate
      if (mode === 'team_3v3') {
        const mids = AI_RIVAL_PRESETS.filter((p) => p.weightClass === 'Middleweight' || p.weightClass === 'Heavyweight');
        const extra = mids[(profile.gauntletStage + 2) % mids.length];
        roster.push({ ...presetToRoster(extra, 'ally_squad', 0, 2), clanTag: profile.clanTag });
      }

      if (mode === 'boss_raid') {
        // Spawn colossal Raid Boss + 1 escort drone on Team 1
        const bossPreset = AI_RIVAL_PRESETS[AI_RIVAL_PRESETS.length - 1]; // Omega Prime
        const escortPreset = AI_RIVAL_PRESETS[0]; // Volt Wasp
        roster.push(
          {
            id: 'raid_boss_omega',
            name: bossPreset.name,
            clanTag: bossPreset.clanTag,
            botLevel: 5,
            weightClassOverride: 'Titan',
            scaleOverride: 1.38,
            hpMult: 2.1,
            speedMult: 0.78,
            dmgMult: 1.45,
            config: bossPreset.config,
            skills: {
              ...DEFAULT_SKILLS,
              chassisReinforcement: 4,
              weaponTorque: 4,
              kineticArmor: 4,
            },
            isBot: true,
            team: 1,
          },
          {
            id: 'raid_escort_1',
            name: escortPreset.name,
            clanTag: bossPreset.clanTag,
            botLevel: 2,
            weightClassOverride: 'Lightweight',
            scaleOverride: escortPreset.scale,
            hpMult: 0.9,
            speedMult: 1.15,
            dmgMult: 0.85,
            config: escortPreset.config,
            skills: DEFAULT_SKILLS,
            isBot: true,
            team: 1,
          },
        );
      } else if (mode !== 'survival') {
        const rivalCount =
          mode === 'brawl_4bot' || mode === 'team_3v3' ? 3 : mode === 'team_2v2' || mode === 'king_hill' ? 2 : 1;
        const pickPresetPool = () => {
          if (mode === 'gauntlet') {
            const st = profile.gauntletStage;
            if (st === 1) return AI_RIVAL_PRESETS.filter((p) => p.weightClass === 'Lightweight');
            if (st === 2) return AI_RIVAL_PRESETS.filter((p) => p.weightClass === 'Middleweight');
            if (st % 3 === 0) return AI_RIVAL_PRESETS.filter((p) => p.weightClass === 'Titan' || p.weightClass === 'Heavyweight');
            return AI_RIVAL_PRESETS;
          }
          if (selectedRivalTier === 'lightweight') {
            return AI_RIVAL_PRESETS.filter((p) => p.weightClass === 'Lightweight');
          }
          if (selectedRivalTier === 'middleweight') {
            return AI_RIVAL_PRESETS.filter((p) => p.weightClass === 'Middleweight');
          }
          if (selectedRivalTier === 'heavyweight') {
            return AI_RIVAL_PRESETS.filter((p) => p.weightClass === 'Heavyweight');
          }
          if (selectedRivalTier === 'titan') {
            return AI_RIVAL_PRESETS.filter((p) => p.weightClass === 'Titan');
          }
          return AI_RIVAL_PRESETS;
        };

        const pool = pickPresetPool();
        const safePool = pool.length > 0 ? pool : AI_RIVAL_PRESETS;

        for (let i = 0; i < rivalCount; i++) {
          const preset =
            selectedRivalTier === 'mixed' && rivalCount > 1
              ? safePool[(i * 3 + profile.gauntletStage) % safePool.length]
              : safePool[(i + profile.gauntletStage - 1) % safePool.length];
          roster.push({
            id: `ai_${i}`,
            name: mode === 'practice' ? 'Target Drone' : preset.config.name,
            clanTag: preset.clanTag,
            botLevel: mode === 'practice' ? 1 : preset.botLevel,
            weightClassOverride: mode === 'practice' ? 'Middleweight' : preset.weightClass,
            scaleOverride: mode === 'practice' ? 1.0 : preset.scale,
            hpMult: mode === 'practice' ? 1.0 : preset.hpMult,
            speedMult: mode === 'practice' ? 1.0 : preset.speedMult,
            dmgMult: mode === 'practice' ? 1.0 : preset.dmgMult,
            config: preset.config,
            skills: {
              ...DEFAULT_SKILLS,
              chassisReinforcement: mode === 'practice' ? 0 : stageBoost,
              weaponTorque: mode === 'practice' ? 0 : stageBoost,
              kineticArmor: mode === 'practice' ? 0 : stageBoost,
            },
            isBot: mode !== 'practice',
            team: mode === 'practice' || mode === 'team_2v2' || mode === 'team_3v3' || mode === 'king_hill' ? 1 : i + 1,
          });
        }
      }

      const effectiveModifiers: MatchModifierId[] =
        mode === 'practice'
          ? [
              ...(isTrad ? (['traditional_rules'] as MatchModifierId[]) : []),
              ...(extraModifiers ?? []),
            ]
          : isTrad && !mergedMods.includes('traditional_rules')
            ? [...mergedMods, 'traditional_rules']
            : mergedMods;
      const snap = createInitialSnapshot(mode as GameMode, arenaToUse, roster, selectedDuration, {
        modifiers: effectiveModifiers,
        layout: arenaLayout,
        customArena: customForMatch,
        rules: arenaRules,
      });
      lastMatchTimerCeilRef.current = Math.ceil(snap.timeRemaining);
      snapshotRef.current = snap;
      setHudSnapshot({ ...snap });
      setLauncherOpen(false);
      setHubTab(null);
      setSceneMode('combat');
      soundEngine.playNextBattleMusic(arenaToUse);
      const firstRival = roster.find((r) => r.team !== 0);
      voiceCommentator.announceMatchStart(
        arenaToUse,
        botCfgToUse.name,
        firstRival?.config.name,
        botCfgToUse,
        firstRival?.config,
      );
    },
    [profile, selectedArena, selectedRivalTier, selectedDuration, selectedModifiers, arenaLayout, arenaRules, activeCustomArena],
  );

  // "Save & Fight" from the arena builder: start a duel once the new arena is the active selection
  const pendingCustomPlayRef = useRef<string | null>(null);
  useEffect(() => {
    if (pendingCustomPlayRef.current && activeCustomArena?.id === pendingCustomPlayRef.current) {
      pendingCustomPlayRef.current = null;
      startLocalMatch('duel_1v1', false);
    }
  }, [activeCustomArena, startLocalMatch]);

  const startCampaignLevel = useCallback(
    (levelId: string, forceAllow = false) => {
      const level = getCampaignLevel(levelId);
      if (
        !level ||
        (!forceAllow &&
          !profile.isAdmin &&
          !isLevelUnlocked(levelId, profileRef.current.campaignStars))
      ) {
        return;
      }
      soundEngine.unlock();
      matchRewardAppliedRef.current = false;
      lastCountdownCeilRef.current = 3;
      activeCampaignIdRef.current = level.id;
      setResumeCampaignLevelId(null);
      setMatchResult(null);
      setIsMultiplayerMatch(false);
      setIsClanWarMatch(false);
      setLastLocalMode('campaign');
      setSelectedArena(level.arenaId);

      const roster: BotRosterTemplate[] = [
        {
          id: profile.id,
          name: profile.callsign,
          clanTag: profile.clanTag,
          config: profile.botConfig,
          skills: profile.skills,
          partUpgrades: profile.partUpgrades,
          isBot: false,
          team: 0,
        },
      ];
      (level.allies ?? []).forEach((key, i) => {
        const entry = presetToRoster(getRivalPreset(key), `ally_${i}`, 0, level.allySkill ?? level.enemySkill);
        roster.push({ ...entry, clanTag: profile.clanTag });
      });
      const ffa = level.mode === 'brawl_4bot' || level.mode === 'duel_1v1';
      level.enemies.forEach((key, i) => {
        roster.push(presetToRoster(getRivalPreset(key), `ai_${i}`, ffa ? i + 1 : 1, level.enemySkill));
      });

      const snap = createInitialSnapshot(level.mode, level.arenaId, roster, level.duration, {
        modifiers: level.modifiers ?? [],
        rules: arenaRules,
      });
      lastMatchTimerCeilRef.current = Math.ceil(snap.timeRemaining);
      snapshotRef.current = snap;
      setHudSnapshot({ ...snap });
      setLauncherOpen(false);
      setHubTab(null);
      setSceneMode('combat');
      soundEngine.playNextBattleMusic(level.arenaId);
      const firstRival = roster.find((r) => r.team !== 0);
      voiceCommentator.announceMatchStart(
        level.arenaId,
        profile.botConfig.name,
        firstRival?.config.name,
        profile.botConfig,
        firstRival?.config,
      );
    },
    [profile],
  );

  // Step local physics inside the Three.js frame loop when offline/solo
  const stepLocalPhysics = useCallback(
    (dt: number) => {
      if (isMultiplayerMatch || !snapshotRef.current) return;
      const prevCeil = Math.ceil(snapshotRef.current.countdown);
      const difficulty =
        lastLocalMode === 'gauntlet'
          ? Math.min(1.15, 0.72 + profile.gauntletStage * 0.05)
          : 0.85;
      stepArenaPhysics(
        snapshotRef.current,
        { [profile.id]: inputRef.current },
        dt,
        difficulty,
      );

      const nextCeil = Math.ceil(snapshotRef.current.countdown);
      if (snapshotRef.current.phase === 'countdown' && nextCeil !== prevCeil && nextCeil > 0) {
        soundEngine.playCountdown(false);
      } else if (lastCountdownCeilRef.current > 0 && snapshotRef.current.phase === 'active') {
        lastCountdownCeilRef.current = 0;
        soundEngine.playCountdown(true);
      }

      if (
        snapshotRef.current.mode !== 'practice' &&
        snapshotRef.current.mode !== 'survival' &&
        snapshotRef.current.phase === 'active'
      ) {
        const remCeil = Math.ceil(snapshotRef.current.timeRemaining);
        if (remCeil !== lastMatchTimerCeilRef.current) {
          lastMatchTimerCeilRef.current = remCeil;
          if (remCeil <= 5 && remCeil >= 1) {
            soundEngine.playCountdown(false);
          }
        }
      }

      if (snapshotRef.current.tick % 4 === 0 || snapshotRef.current.phase === 'finished') {
        setHudSnapshot({ ...snapshotRef.current });
      }
    },
    [isMultiplayerMatch, lastLocalMode, profile.gauntletStage, profile.id],
  );

  const handleFindOnlineMatch = (mode: 'duel_1v1' | 'brawl_4bot', roomId?: string) => {
    soundEngine.unlock();
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(
      JSON.stringify({
        type: 'match:find',
        playerId: profile.id,
        name: profile.callsign,
        clanTag: profile.clanTag,
        mode,
        roomId,
        arenaId: activeCustomArena ? activeCustomArena.theme : selectedArena,
        layout: arenaLayout,
        rules: arenaRules,
        customArena: activeCustomArena,
        durationSeconds: selectedDuration,
        config: profile.botConfig,
        skills: profile.skills,
      }),
    );
  };

  const handleStartOnlineNow = () => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN && activeRoomIdRef.current) {
      ws.send(JSON.stringify({ type: 'match:start_now', roomId: activeRoomIdRef.current }));
    }
  };

  const handleCancelLobby = () => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'match:leave' }));
    }
    activeRoomIdRef.current = null;
    setLobbyRoom(null);
  };

  const handleExitArena = () => {
    if (isMultiplayerMatch && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'match:leave' }));
    }
    activeRoomIdRef.current = null;
    snapshotRef.current = null;
    setHudSnapshot(null);
    setAdminSeat(null);
    setSceneMode('workshop');
  };

  const handleGoToGarageUpgrades = () => {
    const curCampaignId = activeCampaignIdRef.current;
    if (lastLocalMode === 'campaign' && curCampaignId) {
      const nextLv = matchResult?.won ? getNextCampaignLevel(curCampaignId) : undefined;
      setResumeCampaignLevelId(nextLv?.id ?? curCampaignId);
    }
    handleExitArena();
    setZenMode(false);
    setLauncherOpen(false);
    setHubTab(null);
    soundEngine.playPickup();
  };

  const handleVerifyAdminCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);
    const trimmed = adminCodeInput.trim();
    if (!trimmed) {
      setAdminError('Please enter an access code.');
      return;
    }

    const unlockAdminAndEverything = () => {
      setAdminUnlocked(true);
      setAdminCodeInput('');
      const unlockedProfile = applyAdminFullUnlock(profileRef.current);
      accountLoadedUidRef.current = unlockedProfile.id;
      setSavedSessionUid(unlockedProfile.id);
      setProfile(unlockedProfile);
      scheduleCloudSave(unlockedProfile, true);
    };

    if (isAdminIdentifier(trimmed)) {
      unlockAdminAndEverything();
      return;
    }

    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      });
      if (res.ok) {
        const data = (await res.json()) as { verified?: boolean; valid?: boolean };
        if (data.verified || data.valid) {
          unlockAdminAndEverything();
          return;
        }
      }
      setAdminError('Invalid access code.');
    } catch {
      setAdminError('Unable to reach server to verify access.');
    }
  };

  const handleApplyLoginOrAdminCode = async (
    rawCode: string,
  ): Promise<{ ok: boolean; msg?: string }> => {
    const trimmed = rawCode.trim();
    if (!trimmed) return { ok: false, msg: 'Please enter a code.' };

    if (isAdminIdentifier(trimmed)) {
      const res = await loginWithAccessCode(trimmed, profileRef.current);
      const unlocked = res.profile ?? applyAdminFullUnlock(profileRef.current);
      setAdminUnlocked(true);
      accountLoadedUidRef.current = unlocked.id;
      setSavedSessionUid(unlocked.id);
      setProfile(unlocked);
      scheduleCloudSave(unlocked, true);
      return {
        ok: true,
        msg: 'Admin Master Access unlocked! All arenas, weapons, customizations, and max upgrades enabled.',
      };
    }

    const res = await loginWithAccessCode(trimmed, profileRef.current);
    if (res.ok && res.profile) {
      accountLoadedUidRef.current = res.profile.id;
      setSavedSessionUid(res.profile.id);
      setProfile(res.profile);
      setBotHistory([res.profile.botConfig]);
      setBotHistoryIdx(0);
      if (res.isAdmin || res.profile.isAdmin) {
        setAdminUnlocked(true);
      }
      return {
        ok: true,
        msg: `Signed in as ${res.profile.callsign}!`,
      };
    }
    return {
      ok: false,
      msg: res.error || 'Access code not found.',
    };
  };

  const handleJoinAdminSeat = (seat: 1 | 2) => {
    soundEngine.unlock();
    setAdminSeat(seat);
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'admin:join_seat',
          seat,
          name: `${profile.callsign} (P${seat})`,
          clanTag: profile.clanTag,
          arenaId: selectedArena,
          durationSeconds: selectedDuration,
          config: profile.botConfig,
          skills: profile.skills,
        }),
      );
    }
  };

  const handleUpgradeSkill = (key: keyof SkillTree) => {
    const rank = profile.skills[key] ?? 0;
    if (rank >= 5) return;
    const scrapCost = 100 + rank * 60;
    const curCoins = profile.coins ?? profile.scrap;
    if (profile.skillPoints >= 1) {
      updateProfile(
        {
          skillPoints: profile.skillPoints - 1,
          skills: { ...profile.skills, [key]: rank + 1 },
        },
        true,
      );
      soundEngine.playPickup();
    } else if (curCoins >= scrapCost) {
      updateProfile(
        {
          coins: curCoins - scrapCost,
          scrap: curCoins - scrapCost,
          skills: { ...profile.skills, [key]: rank + 1 },
        },
        true,
      );
      soundEngine.playPickup();
    }
  };

  const handleCreateClan = async (name: string, tag: string, motto: string) => {
    const activeUid = profile.id || authUser?.uid;
    if (activeUid) {
      try {
        const created = await createClanInFirestore(
          activeUid,
          profile.callsign,
          name,
          tag,
          motto,
          clans.length,
        );
        updateProfile({ clanId: created.id, clanTag: created.tag }, true);
        return;
      } catch (err) {
        console.error('Clan creation failed:', err);
      }
    }

    const cleanTag = tag.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'CLAN';
    const localClan: ClanInfo = {
      id: `clan_${Date.now()}`,
      name: name.trim().slice(0, 28),
      tag: cleanTag,
      motto: (motto || 'Built for arena supremacy.').trim().slice(0, 80),
      perkLabel: '+6% All-Around Custom Syndicate Doctrine',
      warPoints: 600,
      memberCount: 1,
      wins: 0,
      tournamentSeed: clans.length + 1,
      chat: [],
    };
    setClans((prev) => [...prev, localClan]);
    updateProfile({ clanId: localClan.id, clanTag: localClan.tag }, true);
  };

  const handleJoinClan = async (clanId: string) => {
    const target = clans.find((c) => c.id === clanId);
    if (!target) return;
    const activeUid = profile.id || authUser?.uid;
    if (activeUid) {
      try {
        await ensureAndJoinClanInFirestore(activeUid, profile.callsign, target);
      } catch (err) {
        console.error('Clan join failed:', err);
      }
    }
    updateProfile({ clanId: target.id, clanTag: target.tag }, true);
  };

  const handleSendClanChat = (clanId: string, text: string) => {
    const cleanText = text.trim().slice(0, 180);
    if (!cleanText) return;
    const targetClan = clans.find((c) => c.id === clanId);
    const activeUid = profile.id || authUser?.uid;
    if (activeUid && targetClan) {
      void sendClanMessageInFirestore(activeUid, profile.callsign, targetClan, cleanText);
      return;
    }
    const localMsg: ClanChatMessage = {
      id: `local_${Date.now()}`,
      sender: profile.callsign,
      text: cleanText,
      timestamp: new Date().toISOString(),
    };
    setClans((prev) =>
      prev.map((c) => (c.id === clanId ? { ...c, chat: [...c.chat.slice(-29), localMsg] } : c)),
    );
  };

  const handleSendConnection = async (targetUid: string, targetName: string) => {
    const activeUid = profile.id || authUser?.uid;
    if (!activeUid) return;
    await sendConnectionRequest(activeUid, profile.callsign, targetUid, targetName);
  };

  const handleRespondConnection = async (connId: string, decision: 'accepted' | 'declined') => {
    await respondToConnectionRequest(connId, decision);
  };

  const handleRemoveConnection = async (connId: string) => {
    await removeConnection(connId);
  };

  const handleCreateTeam = async (name: string, tag: string, motto: string) => {
    const activeUid = profile.id || authUser?.uid;
    if (!activeUid) return;
    const team = await createCombatTeam(activeUid, profile, name, tag, motto);
    updateProfile({ teamId: team.id, teamName: team.name }, true);
  };

  const handleJoinTeam = async (teamId: string) => {
    const activeUid = profile.id || authUser?.uid;
    if (!activeUid) return;
    const joined = await joinCombatTeam(activeUid, profile.callsign, teamId);
    if (joined) {
      updateProfile({ teamId: joined.id, teamName: joined.name }, true);
    }
  };

  const handleLeaveTeam = async (teamId: string) => {
    const activeUid = profile.id || authUser?.uid;
    if (!activeUid) return;
    await leaveCombatTeam(activeUid, teamId);
    updateProfile({ teamId: null, teamName: null }, true);
  };

  const handleClaimUsernameInSettings = async (
    newUsername: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    const activeUid = profile.id || authUser?.uid;
    if (!activeUid) return { ok: false, error: 'Please create a username first.' };
    if (isAdminIdentifier(newUsername)) {
      const unlocked = applyAdminFullUnlock(profileRef.current);
      setAdminUnlocked(true);
      accountLoadedUidRef.current = unlocked.id;
      setSavedSessionUid(unlocked.id);
      setProfile(unlocked);
      scheduleCloudSave(unlocked, true);
      return { ok: true };
    }
    const res = await claimUniqueUsername(activeUid, newUsername, profile);
    if (res.ok && res.username) {
      updateProfile({ callsign: res.username, usernameClaimed: true }, true);
      return { ok: true };
    }
    return { ok: false, error: res.error || 'Could not claim username.' };
  };

  const handleSignOutUser = async () => {
    const activeUid = profile.id || authUser?.uid;
    if (activeUid) {
      await setPilotPresenceStatus(activeUid, 'offline');
    }
    await signOutAccount();
    accountLoadedUidRef.current = null;
    setAdminUnlocked(false);
    setSettingsOpen(false);
    setHubTab(null);
    setOnlinePilots([]);
    setConnections([]);
    setTeams([]);
    const guestProfile = { ...makeDefaultProfile('guest'), usernameClaimed: false };
    savePlayerProfile(guestProfile);
    setProfile(guestProfile);
  };

  const handleClaimEventReward = (ev: SeasonalEvent) => {
    if (profile.claimedEvents.includes(ev.id) || profile.wins < ev.targetWins) return;
    const owned = new Set(profile.ownedParts ?? []);
    if (ev.rewardUnlock) owned.add(ev.rewardUnlock);
    const nextCoins = (profile.coins ?? profile.scrap) + ev.rewardScrap;
    updateProfile(
      {
        coins: nextCoins,
        scrap: nextCoins,
        skillPoints: profile.skillPoints + ev.rewardSkillPoints,
        pilotTitle: ev.badgeTitle || profile.pilotTitle,
        claimedEvents: [...profile.claimedEvents, ev.id],
        ownedParts: [...owned],
      },
      true,
    );
    soundEngine.playPickup();
  };

  const handleBuyPart = (cat: PartCategory, id: string): boolean => {
    if (isPartOwned(profile, cat, id)) return true;
    const reqLevel = getPartUnlockLevel(cat, id);
    if (profile.level < reqLevel) return false;
    const price = getPartPrice(cat, id);
    const curCoins = profile.coins ?? profile.scrap;
    if (curCoins < price) return false;
    const nextCoins = curCoins - price;
    const nextOwned = [...new Set([...(profile.ownedParts ?? []), partKey(cat, id)])];
    const nextArenas =
      cat === 'arena'
        ? [...new Set([...(profile.unlockedArenas ?? ['foundry', 'colosseum']), id as ArenaId])]
        : profile.unlockedArenas;
    updateProfile(
      {
        coins: nextCoins,
        scrap: nextCoins,
        ownedParts: nextOwned,
        unlockedArenas: nextArenas,
      },
      true,
    );
    soundEngine.playPickup();
    return true;
  };

  const handleBuyArena = (arenaId: ArenaId): boolean => {
    return handleBuyPart('arena', arenaId);
  };

  const handleUpgradePart = (cat: PartCategory, id: string): boolean => {
    if (!isPartOwned(profile, cat, id)) return false;
    const curLv = getPartUpgradeLevel(profile, cat, id);
    if (curLv >= MAX_PART_UPGRADE_LEVEL) return false;
    const cost = getPartUpgradeCost(cat, id, curLv);
    const curCoins = profile.coins ?? profile.scrap;
    if (curCoins < cost) return false;
    const nextCoins = curCoins - cost;
    updateProfile(
      {
        coins: nextCoins,
        scrap: nextCoins,
        partUpgrades: {
          ...(profile.partUpgrades ?? {}),
          [partKey(cat, id)]: curLv + 1,
        },
      },
      true,
    );
    soundEngine.playPickup();
    return true;
  };

  const toggleModifier = (id: MatchModifierId) => {
    setSelectedModifiers((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  };

  const isTouchDevice = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }, []);

  const showTouchControls =
    sceneMode === 'combat' &&
    hudSnapshot?.phase !== 'finished' &&
    (activeDeviceMode === 'mobile' ||
      activeDeviceMode === 'tablet' ||
      (activeDeviceMode !== 'desktop' &&
        (profile.touchControlsMode === 'always' ||
          (profile.touchControlsMode === 'auto' && isTouchDevice))));

  const showDesktopCombatTile =
    activeDeviceMode === 'desktop' ||
    activeDeviceMode === 'tablet' ||
    (activeDeviceMode === 'auto' && !showTouchControls);

  const isCompactMobile =
    activeDeviceMode === 'mobile' || (activeDeviceMode === 'auto' && viewportWidth < 768);
  const onlineNowCount = onlinePilots.filter((p) => p.isOnline).length;
  const coinsBalance = profile.coins ?? profile.scrap ?? 0;

  const playerCombatBot = hudSnapshot?.bots.find((b) => b.id === activeCombatPlayerId);

  return (
    <div className="relative h-dvh w-screen overflow-hidden bg-[#0D1014]">
      {/* Dedicated Isolated 3D WebGL Canvas */}
      <BattleArenaCanvas
        mode={sceneMode}
        arenaId={selectedArena}
        batteryMode={profile.batteryMode}
        playerBotConfig={profile.botConfig}
        playerId={activeCombatPlayerId}
        snapshotRef={snapshotRef}
        inputRef={inputRef}
        onStepLocalPhysics={sceneMode === 'combat' && !isMultiplayerMatch ? stepLocalPhysics : undefined}
        cameraPreset={cameraPreset}
        cameraSensitivity={profile.cameraSensitivity ?? 0.65}
        colorBlindMode={profile.colorBlindMode ?? 'none'}
        ssaoEnabled={profile.ssaoEnabled ?? true}
        explodedRatio={explodedRatio}
        lightingPreset={lightingPreset}
        turntableSpeed={turntableSpeed}
        workshopCameraAngle={workshopCameraAngle}
        onWorkshopCameraManualOrbit={() => setWorkshopCameraAngle('free')}
        weaponTestBurstSignal={weaponTestBurstSignal}
      />

      {showIntroSplash && (
        <IntroSplashOverlay
          onComplete={() => {
            soundEngine.unlock();
            setShowIntroSplash(false);
          }}
        />
      )}

      {/* Pilot Username & Personal Login Code Gate */}
      {!showIntroSplash && (
        <AuthGateModal
          authUser={authUser}
          authLoading={authLoading}
          profile={profile}
          onProfileUpdated={(next) => {
            accountLoadedUidRef.current = next.id;
            setSavedSessionUid(next.id);
            setProfile(next);
            setBotHistory([next.botConfig]);
            setBotHistoryIdx(0);
            if (next.isAdmin || isAdminIdentifier(next.callsign) || isAdminIdentifier(next.email)) {
              setAdminUnlocked(true);
            }
          }}
        />
      )}

      {/* Top Navigation Bar (Workshop / Hangar Mode) */}
      {sceneMode === 'workshop' && (
        <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between gap-2 sm:gap-4 border-b border-slate-800/90 bg-[#0D1014]/92 px-3 sm:px-6 pt-safe">
          {/* Zone 1: Brand Wordmark + Developer Badge */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span className="font-display text-sm sm:text-lg font-bold tracking-tight text-white whitespace-nowrap">
              {isCompactMobile ? 'Aetheris' : 'Aetheris Bot Wars'}
            </span>
            <a
              href="https://lovable.dev/@theonlyarchitect"
              target="_blank"
              rel="noopener noreferrer"
              title="Developer: THE ARCHITECT · https://lovable.dev/@theonlyarchitect"
              className="hidden md:inline-flex items-center gap-1.5 rounded-xl border border-amber-500/45 bg-[#141922] px-2.5 py-1 text-[11px] font-bold text-amber-300 hover:border-amber-400 hover:text-amber-200 transition"
            >
              <img
                src="/assets/aistudio/nano-banana-2_take_this_image_and_create_a_logo_out_of_it_Token_HSL_Usage_--background_220_15_-0_1__11fa74ed.jpg"
                alt="THE ARCHITECT"
                className="h-5 w-5 rounded-full border border-amber-400/70 object-cover"
              />
              <span>THE ARCHITECT ↗</span>
            </a>
            <a
              href="https://businessforensics.tech"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden xl:inline-flex items-center gap-1 rounded-xl border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-[11px] font-bold text-sky-300 hover:border-sky-400 transition"
            >
              <span>Businessforensics.tech ↗</span>
            </a>
          </div>

          {/* Zone 2: Simplified Mobile Bar vs Full Desktop Nav */}
          {isCompactMobile ? (
            <nav className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setHubTab('online')}
                className="flex items-center gap-1 rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-2.5 py-2 min-h-[38px] text-[11px] font-bold text-emerald-200"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span>Online ({onlineNowCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setGarageOpen(true)}
                className="flex items-center gap-1 rounded-lg border border-fuchsia-500/50 bg-fuchsia-500/15 px-2.5 py-2 min-h-[38px] text-[11px] font-bold text-fuchsia-200"
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Garage</span>
              </button>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                aria-label="Open Settings"
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-[#161C24] px-2.5 py-2 min-h-[38px] text-[11px] font-bold text-slate-200"
              >
                <Settings className="h-3.5 w-3.5 text-sky-300" />
                <span>Settings</span>
              </button>
            </nav>
          ) : (
            <nav className="flex items-center gap-2.5 sm:gap-4 overflow-x-auto text-xs sm:text-sm font-medium text-slate-300">
              <button
                type="button"
                onClick={() => setHubTab('online')}
                className="flex items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-2.5 py-1.5 font-bold text-emerald-200 hover:bg-emerald-500/25 transition whitespace-nowrap shrink-0"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Online ({onlineNowCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setGarageOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-fuchsia-500/50 bg-fuchsia-500/15 px-2.5 py-1.5 font-bold text-fuchsia-200 hover:bg-fuchsia-500/25 transition whitespace-nowrap shrink-0"
              >
                <Layers className="h-3.5 w-3.5 text-fuchsia-300" />
                <span>Garage & Fusion</span>
              </button>
              <button
                type="button"
                onClick={() => setHubTab('rankings')}
                className="hover:text-amber-400 transition whitespace-nowrap shrink-0"
              >
                Rankings
              </button>
              <button
                type="button"
                onClick={() => setHubTab('clans')}
                className="hover:text-amber-400 transition whitespace-nowrap shrink-0"
              >
                Clans & Teams
              </button>
              <button
                type="button"
                onClick={() => setHubTab('events')}
                className="hover:text-amber-400 transition whitespace-nowrap shrink-0"
              >
                Season 05
              </button>
              <button
                type="button"
                onClick={() => setHubTab('skills')}
                className="hover:text-amber-400 transition whitespace-nowrap shrink-0"
              >
                Skills ({profile.skillPoints} SP)
              </button>
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setHeaderMoreOpen((v) => !v)}
                  aria-expanded={headerMoreOpen}
                  className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition whitespace-nowrap ${
                    headerMoreOpen ? 'border-amber-400 text-amber-200' : 'border-slate-700 bg-[#161C24] text-slate-200 hover:border-slate-500'
                  }`}
                >
                  More
                  <span aria-hidden className={`transition ${headerMoreOpen ? 'rotate-180' : ''}`}>▾</span>
                </button>
                {headerMoreOpen && (
                  <div
                    className="fixed right-28 top-14 z-50 w-56 rounded-xl border border-slate-700 bg-[#12161C] p-1.5 shadow-2xl"
                    onMouseLeave={() => setHeaderMoreOpen(false)}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setHeaderMoreOpen(false);
                        setAiStudioTab('music');
                        setAiStudioOpen(true);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
                    >
                      <Music className="h-4 w-4 text-amber-400" /> AI Music & Lab
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHeaderMoreOpen(false);
                        setLiveVoiceOpen((prev) => !prev);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
                    >
                      <Radio className="h-4 w-4 text-emerald-400" /> {liveVoiceOpen ? 'Close Live Voice AI' : 'Live Voice AI'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHeaderMoreOpen(false);
                        setAdminModalOpen(true);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
                    >
                      <KeyRound className="h-4 w-4 text-amber-400" /> {adminUnlocked ? '2P Arena' : 'Admin Login'}
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-[#161C24] px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:border-sky-400 transition whitespace-nowrap shrink-0"
              >
                <Settings className="h-3.5 w-3.5 text-sky-300" />
                <span>Settings</span>
              </button>
            </nav>
          )}

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setLauncherOpen(true)}
              className="rounded-lg bg-amber-500 px-3 sm:px-3.5 py-2 min-h-[38px] text-xs font-bold text-slate-950 hover:bg-amber-400 transition whitespace-nowrap shrink-0"
            >
              Deploy Arena
            </button>
          </div>
        </header>
      )}

      {/* Clean Pilot Status Strip below top bar in Workshop */}
      {sceneMode === 'workshop' && (
        <div className="pointer-events-none fixed inset-x-0 top-16 z-20 flex flex-wrap items-center justify-between gap-2 px-3 sm:px-6">
          <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-xl border border-slate-800/90 bg-[#12161C]/90 px-3 py-1.5 text-xs text-slate-300 font-mono-tabular">
            <span className="font-semibold text-white">
              [{profile.clanTag}] {profile.callsign}
            </span>
            {profile.teamName && !isCompactMobile && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-sans text-[11px] font-semibold text-sky-300">
                  Team: {profile.teamName}
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className="text-emerald-300 font-bold">Lv {profile.level}</span>
            <span aria-hidden="true">·</span>
            <span className="text-amber-400 font-bold">{coinsBalance} Coins</span>
            {!isCompactMobile && (
              <>
                <span aria-hidden="true">·</span>
                <span>{profile.skillPoints} SP</span>
              </>
            )}
          </div>

          {isCompactMobile ? (
            <div className="pointer-events-auto flex items-center gap-1.5">
              <PWAInstallButton compact alwaysShowIOSOption />
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-sky-500/40 bg-[#12161C]/95 px-2.5 text-xs font-bold text-sky-200"
              >
                <Sliders className="h-3.5 w-3.5 text-sky-300" />
                <span>Controls & Audio</span>
              </button>
            </div>
          ) : (
            <div className="pointer-events-auto flex flex-wrap items-center gap-1.5">
              {/* Controls, layout mode and the iOS app live in Settings; keep only quick audio here */}
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                title="Driving controls, layout mode and app install"
                className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 bg-[#12161C]/90 px-2.5 text-xs font-bold text-slate-200 hover:border-amber-400 transition"
              >
                <Gamepad2 className="h-3.5 w-3.5 text-amber-400" />
                <span>
                  {activeScheme === 'arrows_drive' ? 'Arrows drive' : activeScheme === 'mouse_drive' ? 'Mouse drive' : 'WASD drive'}
                </span>
              </button>
              {!isOnline && (
                <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-[#1B1710]/95 px-2.5 py-1.5 text-xs font-medium text-amber-300">
                  <WifiOff className="h-3.5 w-3.5" />
                  <span>Offline Solo Ready</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => setAudioSettingsOpen(true)}
                title="Open Audio & Volume Mixer (Music, SFX, Crowd, Commentary)"
                className="flex h-9 items-center gap-1.5 rounded-lg border border-amber-500/50 bg-[#12161C]/90 px-2.5 text-xs font-bold text-amber-300 hover:border-amber-400 transition cursor-pointer"
              >
                <Sliders className="h-3.5 w-3.5 text-amber-400" />
                <span className="hidden sm:inline">Audio Mixer</span>
              </button>
              <button
                type="button"
                onClick={() => updateProfile({ commentaryMuted: !profile.commentaryMuted })}
                title={
                  profile.commentaryMuted
                    ? 'Turn Commentary Voices ON'
                    : 'Turn Commentary Voices OFF'
                }
                className={`flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold transition ${
                  profile.commentaryMuted
                    ? 'border-slate-700 bg-[#12161C]/90 text-slate-400 hover:text-white'
                    : 'border-sky-500/50 bg-[#12161C]/90 text-sky-300 hover:border-sky-400'
                }`}
              >
                {profile.commentaryMuted ? (
                  <MicOff className="h-3.5 w-3.5 text-slate-400" />
                ) : (
                  <Mic className="h-3.5 w-3.5 text-sky-300" />
                )}
                <span className="hidden sm:inline">
                  {profile.commentaryMuted ? 'Commentary Off' : 'Commentary On'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => updateProfile({ muted: !profile.muted })}
                aria-label={profile.muted ? 'Unmute audio' : 'Mute audio'}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-[#12161C]/90 text-slate-300 hover:text-white"
              >
                {profile.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Campaign Pit-Stop Garage Banner when returning from a Campaign fight for repairs/upgrades */}
      {sceneMode === 'workshop' && resumeCampaignLevelId && (
        <div className="fixed top-[104px] sm:top-[108px] left-1/2 -translate-x-1/2 z-30 w-[94vw] max-w-xl rounded-2xl border border-emerald-500/60 bg-[#111820]/96 px-4 py-2.5 shadow-2xl flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-slate-200">
            <span className="font-bold text-emerald-300">Garage Pit-Stop · Hull 100% Repaired</span>
            <span className="hidden sm:inline text-slate-400"> — Upgrade weapons, armor &amp; skills below</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setGarageOpen(true)}
              className="rounded-lg border border-amber-500/50 bg-amber-500/15 px-2.5 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/25 transition"
            >
              Bot Roster
            </button>
            <button
              type="button"
              onClick={() => startCampaignLevel(resumeCampaignLevelId, true)}
              className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 transition shadow"
            >
              Fight: {getCampaignLevel(resumeCampaignLevelId)?.title ?? 'Next Stage'} →
            </button>
            <button
              type="button"
              onClick={() => setResumeCampaignLevelId(null)}
              aria-label="Dismiss campaign pit-stop banner"
              className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Workshop Left & Right Customization Docks (hidden in 3D Zen Mode [H]) */}
      {sceneMode === 'workshop' && !zenMode && (
        <WorkshopDock
          config={profile.botConfig}
          skills={profile.skills}
          savedLoadouts={profile.savedLoadouts}
          activeLoadoutSlot={profile.activeLoadoutSlot ?? 0}
          onSelectLoadoutSlot={handleSelectLoadoutSlot}
          onChange={handleBotConfigChange}
          selectedArena={selectedArena}
          onSelectArena={setSelectedArena}
          onPreviewArena3D={(arena) => {
            setSelectedArena(arena);
            setWorkshopCameraAngle('arena_3d');
          }}
          profile={profile}
          onBuyPart={handleBuyPart}
          onUpgradePart={handleUpgradePart}
          onUpdateFavorites={(favorites) => updateProfile({ favorites })}
          canStepBack={botHistoryIdx > 0}
          canStepForward={botHistoryIdx < botHistory.length - 1}
          onStepBack={handleStepBackBotHistory}
          onStepForward={handleStepForwardBotHistory}
          onOpenGarageRoster={() => setGarageOpen(true)}
          deviceLayoutMode={activeDeviceMode}
          traditionalMode={Boolean(profile.traditionalMode)}
          onToggleTraditionalMode={(next) => updateProfile({ traditionalMode: next })}
          onStartFight={() => setLauncherOpen(true)}
        />
      )}

      {/* Interactive 3D Scene Inspector Dock (Exploded View, Studio PBR Lighting, Damped Camera & Zen Mode) */}
      {sceneMode === 'workshop' && (
        <ThreeSceneInspectorDock
          explodedRatio={explodedRatio}
          onChangeExplodedRatio={setExplodedRatio}
          lightingPreset={lightingPreset}
          onChangeLightingPreset={setLightingPreset}
          turntableSpeed={turntableSpeed}
          onChangeTurntableSpeed={setTurntableSpeed}
          workshopCameraAngle={workshopCameraAngle}
          onSelectWorkshopCameraAngle={setWorkshopCameraAngle}
          onTriggerWeaponTestBurst={() => {
            soundEngine.unlock();
            setWeaponTestBurstSignal((prev) => prev + 1);
          }}
          zenMode={zenMode}
          onToggleZenMode={() => setZenMode((prev) => !prev)}
          dockCollapsed={sceneDockCollapsed}
          onToggleDockCollapsed={() => setSceneDockCollapsed((prev) => !prev)}
          onOpenAiStudio={() => {
            setAiStudioTab('music');
            setAiStudioOpen(true);
          }}
          onOpenLiveVoice={() => setLiveVoiceOpen((prev) => !prev)}
          liveVoiceOpen={liveVoiceOpen}
        />
      )}

      {/* Full Garage Bot Roster & 2-Bot Fusion Modal */}
      <GarageRosterModal
        open={garageOpen}
        currentBotConfig={profile.botConfig}
        skills={profile.skills}
        profile={profile}
        customGarageBots={profile.customGarageBots ?? []}
        onSelectBotToPlay={handleBotConfigChange}
        onSaveCustomBotToRoster={handleSaveCustomBotToRoster}
        onDeleteCustomBotFromRoster={handleDeleteCustomBotFromRoster}
        onLaunchTestRange={(hybridConfig) => {
          handleBotConfigChange(hybridConfig);
          setGarageOpen(false);
          startLocalMatch('practice', false, hybridConfig, ['frictionless_sandbox', 'no_hazards']);
        }}
        onClose={() => setGarageOpen(false)}
      />

      {/* Admin Login & 2-Player Multi-Screen Seat Selector Modal */}
      {adminModalOpen && (
        <div
          role="dialog"
          aria-label="Admin Login & 2-Player Seat Selector"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
        >
          <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-[#12161C] p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-amber-400" />
                <h2 className="font-display text-xl font-extrabold text-white">
                  {adminUnlocked ? '2-Player Multi-Screen Arena' : 'Admin Access Login'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setAdminModalOpen(false)}
                className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs font-bold text-slate-300 hover:text-white"
              >
                Close
              </button>
            </div>

            {!adminUnlocked ? (
              <form onSubmit={handleVerifyAdminCode} className="mt-4 space-y-3">
                <p className="text-xs text-slate-300">
                  Enter your administrator access code to unlock 2-Player Dual-Screen Battle mode.
                </p>
                <input
                  type="password"
                  value={adminCodeInput}
                  onChange={(e) => setAdminCodeInput(e.target.value)}
                  placeholder="Enter access code..."
                  autoFocus
                  className="w-full rounded-xl border border-slate-700 bg-[#0D1014] px-3.5 py-2.5 text-sm font-bold text-white focus:border-amber-400 focus:outline-none"
                />
                {adminError && (
                  <div className="rounded-lg border border-rose-500/50 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-300">
                    {adminError}
                  </div>
                )}
                <button
                  type="submit"
                  className="w-full rounded-xl bg-amber-500 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-amber-400 transition"
                >
                  Unlock Admin Mode
                </button>
              </form>
            ) : (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-slate-300">
                  Choose <strong className="text-amber-300">Player 1</strong> on this screen and have your opponent choose <strong className="text-sky-300">Player 2</strong> on their screen/window. Each player gets their own dedicated camera view and controls in the same live arena!
                </p>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => handleJoinAdminSeat(1)}
                    className="flex flex-col items-center gap-1.5 rounded-2xl border-2 border-amber-400 bg-amber-500/20 p-4 text-center hover:bg-amber-500/30 transition"
                  >
                    <Users className="h-6 w-6 text-amber-300" />
                    <span className="font-display text-base font-extrabold text-white">Player 1</span>
                    <span className="text-[11px] text-amber-200">This Screen = P1 View</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleJoinAdminSeat(2)}
                    className="flex flex-col items-center gap-1.5 rounded-2xl border-2 border-sky-400 bg-sky-500/20 p-4 text-center hover:bg-sky-500/30 transition"
                  >
                    <Sparkles className="h-6 w-6 text-sky-300" />
                    <span className="font-display text-base font-extrabold text-white">Player 2</span>
                    <span className="text-[11px] text-sky-200">Other Screen = P2 View</span>
                  </button>
                </div>
                {lobbyRoom && (
                  <div className="rounded-xl border border-emerald-500/50 bg-emerald-500/15 p-3 text-center text-xs font-bold text-emerald-200">
                    Waiting in 2P Arena Room ({lobbyRoom.playerCount}/2 connected)...
                    {lobbyRoom.playerCount >= 1 && (
                      <button
                        type="button"
                        onClick={handleStartOnlineNow}
                        className="mt-2 block w-full rounded-lg bg-emerald-500 py-1.5 text-slate-950 font-extrabold"
                      >
                        Start Match Now
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Combat HUD */}
      {sceneMode === 'combat' && hudSnapshot && (
        <CombatHud
          snapshot={hudSnapshot}
          playerId={activeCombatPlayerId}
          adminSeat={adminSeat}
          cameraPreset={cameraPreset}
          cameraSensitivity={profile.cameraSensitivity ?? 0.65}
          colorBlindMode={profile.colorBlindMode ?? 'none'}
          showDamageNumbers={profile.showDamageNumbers ?? true}
          momentumTrajectory={profile.momentumTrajectory ?? true}
          onToggleDamageNumbers={() =>
            updateProfile({ showDamageNumbers: !(profile.showDamageNumbers ?? true) })
          }
          muted={profile.muted}
          commentaryMuted={Boolean(profile.commentaryMuted)}
          controlScheme={activeScheme}
          deviceLayoutMode={activeDeviceMode}
          isMultiplayer={isMultiplayerMatch}
          matchResult={matchResult}
          campaignLevelId={activeCampaignIdRef.current}
          onCycleCamera={() =>
            setCameraPreset((c) =>
              c === 'chase'
                ? 'first_person'
                : c === 'first_person'
                  ? 'pilot_booth'
                  : c === 'pilot_booth'
                    ? 'tactical'
                    : c === 'tactical'
                      ? 'spectator'
                      : c === 'spectator'
                        ? 'cinematic'
                        : 'chase',
            )
          }
          onSelectCamera={setCameraPreset}
          onChangeCameraSensitivity={(sens) => updateProfile({ cameraSensitivity: sens })}
          onToggleMute={() => updateProfile({ muted: !profile.muted })}
          onToggleCommentary={() => updateProfile({ commentaryMuted: !profile.commentaryMuted })}
          onOpenAudioSettings={() => setAudioSettingsOpen(true)}
          onSelectControlScheme={(scheme) => updateProfile({ controlScheme: scheme })}
          onSelectDeviceLayoutMode={(mode) => updateProfile({ deviceLayoutMode: mode })}
          onExitArena={handleExitArena}
          onGoToGarageUpgrades={handleGoToGarageUpgrades}
          onNextCampaignLevel={(nextLevelId) => startCampaignLevel(nextLevelId, true)}
          onRematch={() => {
            if (isMultiplayerMatch) {
              handleExitArena();
              setLauncherOpen(true);
            } else if (lastLocalMode === 'campaign') {
              if (activeCampaignIdRef.current) startCampaignLevel(activeCampaignIdRef.current, true);
            } else {
              startLocalMatch(lastLocalMode, isClanWarMatch);
            }
          }}
          onWeaponTrigger={(slotIdx, pressed) => {
            soundEngine.unlock();
            const cur = Array.isArray(inputRef.current.fireWeapons)
              ? [...inputRef.current.fireWeapons]
              : [false, false, false];
            cur[slotIdx] = pressed;
            inputRef.current.fireWeapons = cur;
            inputRef.current.fireWeapon = cur.some(Boolean);
          }}
          onRepairTrigger={(pressed) => {
            soundEngine.unlock();
            inputRef.current.overdrive = pressed;
          }}
          onBoostTrigger={(pressed) => {
            soundEngine.unlock();
            inputRef.current.boost = pressed;
          }}
          onDriftTrigger={(pressed) => {
            soundEngine.unlock();
            inputRef.current.drift = pressed;
          }}
          showKeyboardHint={showDesktopCombatTile}
        />
      )}

      {/* Mobile Touch Virtual Joystick & Action Buttons */}
      {showTouchControls && playerCombatBot && (
        <TouchControls
          inputRef={inputRef}
          energy={playerCombatBot.energy}
          maxEnergy={playerCombatBot.maxEnergy}
          boostCooldown={playerCombatBot.boostCooldown}
          weapons={getBotWeapons(playerCombatBot.config)}
          weaponCooldowns={playerCombatBot.weaponCooldowns ?? [playerCombatBot.weaponCooldown]}
          overdriveTimer={playerCombatBot.overdriveTimer}
        />
      )}

      {/* Arena & Multiplayer Matchmaking Modal */}
      <ArenaLauncherModal
        open={launcherOpen}
        isOnline={isOnline}
        selectedArena={selectedArena}
        selectedRivalTier={selectedRivalTier}
        selectedDuration={selectedDuration}
        selectedWingmanIndex={profile.selectedWingmanIndex ?? 3}
        savedLoadouts={profile.savedLoadouts}
        gauntletStage={profile.gauntletStage}
        selectedModifiers={selectedModifiers}
        onToggleModifier={toggleModifier}
        campaignStars={profile.campaignStars ?? {}}
        onStartCampaign={startCampaignLevel}
        bestSurvivalWave={profile.bestSurvivalWave ?? 0}
        lobbyRoom={lobbyRoom}
        onSelectArena={selectArenaTheme}
        onSelectRivalTier={setSelectedRivalTier}
        onSelectDuration={setSelectedDuration}
        onSelectWingman={(idx) => updateProfile({ selectedWingmanIndex: idx })}
        onStartOffline={(mode) => startLocalMatch(mode, false)}
        arenaLayout={arenaLayout}
        arenaRules={arenaRules}
        customArenas={customArenas}
        activeCustomArenaId={activeCustomArenaId}
        onSelectLayout={setArenaLayout}
        onChangeRules={setArenaRules}
        onSelectCustomArena={setActiveCustomArenaId}
        onOpenArenaBuilder={(editId) => setArenaBuilder({ open: true, editId })}
        onFindOnlineMatch={handleFindOnlineMatch}
        playerId={profile.id}
        presence={presence}
        openRooms={openRooms}
        pvpBoard={pvpBoard}
        onOpenLadder={() => {
          setLauncherOpen(false);
          setHubTab('pvp');
        }}
        onStartOnlineNow={handleStartOnlineNow}
        onCancelLobby={handleCancelLobby}
        traditionalMode={Boolean(profile.traditionalMode)}
        onToggleTraditionalMode={(next) => updateProfile({ traditionalMode: next })}
        playerLevel={profile.level}
        coins={coinsBalance}
        unlockedArenas={profile.unlockedArenas}
        ownedParts={profile.ownedParts}
        onBuyArena={handleBuyArena}
        onClose={() => {
          if (lobbyRoom) handleCancelLobby();
          setLauncherOpen(false);
        }}
      />

      <ArenaBuilderModal
        open={arenaBuilder.open}
        arenas={customArenas}
        editingId={arenaBuilder.editId}
        defaultTheme={selectedArena}
        onSave={(spec) => {
          setCustomArenas((prev) => {
            const next = [spec, ...prev.filter((a) => a.id !== spec.id)];
            saveCustomArenas(next);
            return next;
          });
          setActiveCustomArenaId(spec.id);
        }}
        onDelete={(id) => {
          setCustomArenas((prev) => {
            const next = prev.filter((a) => a.id !== id);
            saveCustomArenas(next);
            return next;
          });
          if (activeCustomArenaId === id) setActiveCustomArenaId(null);
        }}
        onPlay={(spec) => {
          setActiveCustomArenaId(spec.id);
          setArenaBuilder({ open: false, editId: null });
          pendingCustomPlayRef.current = spec.id;
        }}
        onClose={() => setArenaBuilder({ open: false, editId: null })}
      />

      {/* Simple Mobile-First Settings Hub Modal */}
      <SettingsHubModal
        open={settingsOpen}
        profile={profile}
        userEmail={authUser?.email ?? profile.email ?? null}
        onUpdateProfile={(patch) => updateProfile(patch)}
        onClaimUsername={handleClaimUsernameInSettings}
        onApplyLoginOrAdminCode={handleApplyLoginOrAdminCode}
        onOpenFullAudioMixer={() => {
          setSettingsOpen(false);
          setAudioSettingsOpen(true);
        }}
        onSignOut={() => void handleSignOutUser()}
        onClose={() => setSettingsOpen(false)}
      />

      {/* Audio & Volume Mixer Modal */}
      <AudioSettingsModal
        open={audioSettingsOpen}
        settings={{
          muted: profile.muted,
          commentaryMuted: Boolean(profile.commentaryMuted),
          masterVolume: profile.masterVolume ?? 0.85,
          musicVolume: profile.musicVolume ?? 0.65,
          sfxVolume: profile.sfxVolume ?? 0.85,
          crowdVolume: profile.crowdVolume ?? 0.7,
          commentaryVolume: profile.commentaryVolume ?? 0.9,
        }}
        onChange={(patch) => updateProfile(patch)}
        onClose={() => setAudioSettingsOpen(false)}
      />

      {/* Social, Online Pilots, Connections, Teams, Clans, Seasonal Events & Skill Tree Modal */}
      <SocialAndRankingsPanel
        activeTab={hubTab}
        profile={profile}
        leaderboard={leaderboard}
        pvpBoard={pvpBoard}
        presence={presence}
        clans={clans}
        onlinePilots={onlinePilots}
        connections={connections}
        teams={teams}
        currentUid={authUser?.uid || profile.id}
        seasonalEvents={seasonalEvents}
        isOnline={isOnline}
        onChangeTab={setHubTab}
        onUpgradeSkill={handleUpgradeSkill}
        onUpdateProfile={updateProfile}
        onCreateClan={handleCreateClan}
        onJoinClan={handleJoinClan}
        onSendClanChat={handleSendClanChat}
        onStartClanWarMatch={(teamMode) => startLocalMatch(teamMode ? 'team_2v2' : 'duel_1v1', true)}
        onDeployEventArena={(arenaId) => {
          setSelectedArena(arenaId);
          setHubTab(null);
          setLauncherOpen(true);
        }}
        onClaimEventReward={handleClaimEventReward}
        onSendConnection={handleSendConnection}
        onRespondConnection={handleRespondConnection}
        onRemoveConnection={handleRemoveConnection}
        onCreateTeam={handleCreateTeam}
        onJoinTeam={handleJoinTeam}
        onLeaveTeam={handleLeaveTeam}
        onOpenSettings={() => {
          setHubTab(null);
          setSettingsOpen(true);
        }}
      />

      {/* AI Forge Studio: Lyria 3 Soundtrack Synthesizer & Multimodal Lab */}
      <AiForgeStudioModal
        open={aiStudioOpen}
        initialTab={aiStudioTab}
        idToken={null}
        botName={profile.botConfig.name}
        mediaHistory={mediaHistory}
        onRefreshHistory={fetchMediaHistory}
        onClose={() => setAiStudioOpen(false)}
      />

      {/* Real-Time Voice Copilot (Gemini 3.8 Live API WebSocket Bridge) */}
      <LiveVoiceCopilot
        open={liveVoiceOpen}
        onClose={() => setLiveVoiceOpen(false)}
        botConfig={profile.botConfig}
        selectedArena={selectedArena}
        sceneMode={sceneMode}
        onUpdateBotConfig={handleBotConfigChange}
        onSelectArena={setSelectedArena}
        onSetExplodedRatio={setExplodedRatio}
        onSetLightingPreset={setLightingPreset}
        onStartLocalBattle={(mode) => startLocalMatch(mode, false)}
      />
    </div>
  );
}
