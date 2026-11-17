import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WifiOff, Volume2, VolumeX } from 'lucide-react';
import { registerSW } from 'virtual:pwa-register';
import {
  ArenaLauncherModal,
  type LocalLaunchMode,
  type RivalTier,
} from './components/ArenaLauncherModal';
import { CombatHud, type MatchResultSummary } from './components/CombatHud';
import { PWAInstallButton } from './components/PWAInstallButton';
import { SocialAndRankingsPanel, type HubModalTab } from './components/SocialAndRankingsPanel';
import { TouchControls } from './components/TouchControls';
import { WorkshopDock } from './components/WorkshopDock';
import { BattleArenaCanvas } from './game/BattleArenaCanvas';
import { soundEngine } from './game/soundEngine';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import {
  hasPendingSync,
  loadPlayerProfile,
  markPendingSync,
  savePlayerProfile,
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
  isLevelUnlocked,
  levelPassed,
} from './shared/campaign';
import {
  type ArenaId,
  type ArenaSnapshot,
  type BotConfig,
  type ClanChatMessage,
  type ClanInfo,
  DEFAULT_SKILLS,
  type GameMode,
  getBotWeapons,
  getPartPrice,
  isPartOwned,
  type LeaderboardEntry,
  type MatchModifierId,
  type PartCategory,
  partKey,
  type PlayerInputState,
  type PlayerProfile,
  type SeasonalEvent,
  type SkillTree,
  type TimedBattleDuration,
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
  const [profile, setProfile] = useState<PlayerProfile>(() => loadPlayerProfile());
  const [sceneMode, setSceneMode] = useState<'workshop' | 'combat'>('workshop');
  const [selectedArena, setSelectedArena] = useState<ArenaId>('foundry');
  const [selectedRivalTier, setSelectedRivalTier] = useState<RivalTier>('mixed');
  const [selectedDuration, setSelectedDuration] = useState<TimedBattleDuration>(180);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [hubTab, setHubTab] = useState<HubModalTab | null>(null);
  const [cameraPreset, setCameraPreset] = useState<'chase' | 'tactical' | 'cinematic'>('chase');
  const [selectedModifiers, setSelectedModifiers] = useState<MatchModifierId[]>([]);
  const [matchResult, setMatchResult] = useState<MatchResultSummary | null>(null);
  const activeCampaignIdRef = useRef<string | null>(null);

  // Server-backed social & leaderboard data (seeded with rich offline fallbacks)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(OFFLINE_FALLBACK_LEADERBOARD);
  const [clans, setClans] = useState<ClanInfo[]>(OFFLINE_FALLBACK_CLANS);
  const [seasonalEvents, setSeasonalEvents] = useState<SeasonalEvent[]>(OFFLINE_FALLBACK_EVENTS);

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
  });

  useEffect(() => {
    try {
      registerSW({ immediate: true });
    } catch {
      // Ignore in non-SW environments
    }
  }, []);

  useEffect(() => {
    soundEngine.setMuted(profile.muted);
  }, [profile.muted]);

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

  const updateProfile = useCallback((patch: Partial<PlayerProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      savePlayerProfile(next);
      return next;
    });
  }, []);

  const handleBotConfigChange = useCallback((nextConfig: BotConfig) => {
    setProfile((prev) => {
      const slot = prev.activeLoadoutSlot ?? 0;
      const nextLoadouts = Array.isArray(prev.savedLoadouts) ? [...prev.savedLoadouts] : [];
      nextLoadouts[slot] = nextConfig;
      const next: PlayerProfile = {
        ...prev,
        botConfig: nextConfig,
        savedLoadouts: nextLoadouts,
      };
      savePlayerProfile(next);
      return next;
    });
  }, []);

  const handleSelectLoadoutSlot = useCallback((slotIdx: number) => {
    setProfile((prev) => {
      const loadouts = prev.savedLoadouts || [];
      const chosen = loadouts[slotIdx] || prev.botConfig;
      const next: PlayerProfile = {
        ...prev,
        activeLoadoutSlot: slotIdx,
        botConfig: { ...chosen },
      };
      savePlayerProfile(next);
      return next;
    });
  }, []);

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
          clans: ClanInfo[];
          seasonalEvents: SeasonalEvent[];
        };
        if (data.leaderboard?.length) setLeaderboard(data.leaderboard);
        if (data.clans?.length) setClans(data.clans);
        if (data.seasonalEvents?.length) setSeasonalEvents(data.seasonalEvents);
      }
    } catch {
      // Offline fallback remains active
    }
  }, []);

  useEffect(() => {
    if (isOnline) {
      fetchBootstrap();
      if (hasPendingSync()) {
        syncProfileToServer(profile);
      }
    }
  }, [isOnline, fetchBootstrap, syncProfileToServer, profile]);

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
          };

          if (msg.type === 'room:lobby' && msg.room) {
            activeRoomIdRef.current = msg.room.id;
            setLobbyRoom(msg.room);
          } else if ((msg.type === 'match:started' || msg.type === 'match:snapshot') && msg.snapshot) {
            if (msg.type === 'match:started') {
              matchRewardAppliedRef.current = false;
              lastCountdownCeilRef.current = 3;
              setLauncherOpen(false);
              setLobbyRoom(null);
              setIsMultiplayerMatch(true);
              setSelectedArena(msg.snapshot.arenaId);
              setSceneMode('combat');
              soundEngine.playNextBattleMusic(msg.snapshot.arenaId);
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

  // Keyboard Driving & Combat Bindings
  useEffect(() => {
    const keys = new Set<string>();
    const syncKeysToInput = () => {
      const fwd = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      const str = (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) - (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0);
      const slot0 = keys.has('Digit1') || keys.has('KeyJ') || keys.has('Space');
      const slot1 = keys.has('Digit2') || keys.has('KeyK');
      const slot2 = keys.has('Digit3') || keys.has('KeyL');
      inputRef.current.throttle = fwd;
      inputRef.current.steer = str;
      inputRef.current.fireWeapons = [slot0, slot1, slot2];
      inputRef.current.fireWeapon = slot0 || slot1 || slot2;
      inputRef.current.boost = keys.has('ShiftLeft') || keys.has('ShiftRight');
      inputRef.current.overdrive = keys.has('KeyE');
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (sceneMode !== 'combat') return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
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

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [sceneMode]);

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
            playerId: profile.id,
            input: inputRef.current,
          }),
        );
      }
    }, 33);
    return () => clearInterval(timer);
  }, [sceneMode, isMultiplayerMatch, profile.id]);

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
      ratingDelta,
    });

    setProfile((prev) => {
      const nextXp = prev.xp + xpEarned;
      const leveledUp = nextXp >= prev.level * 200;
      const arenaWins = { ...(prev.arenaWins ?? {}) };
      if (won && !isPractice) {
        arenaWins[hudSnapshot.arenaId] = (arenaWins[hudSnapshot.arenaId] ?? 0) + 1;
      }
      const owned = new Set(prev.ownedParts ?? []);
      if (unlocked) owned.add(unlocked);
      const campaignStars = { ...(prev.campaignStars ?? {}) };
      if (level) campaignStars[level.id] = Math.max(campaignStars[level.id] ?? 0, stars);

      const nextProfile: PlayerProfile = {
        ...prev,
        scrap: prev.scrap + scrapEarned,
        xp: leveledUp ? nextXp - prev.level * 200 : nextXp,
        level: leveledUp ? prev.level + 1 : prev.level,
        skillPoints: (leveledUp ? prev.skillPoints + 1 : prev.skillPoints) + spEarned,
        rating: Math.max(800, prev.rating + ratingDelta),
        wins: won ? prev.wins + 1 : prev.wins,
        losses: won || isPractice || mode === 'survival' ? prev.losses : prev.losses + 1,
        kos: prev.kos + kos,
        gauntletStage: won && lastLocalMode === 'gauntlet' ? prev.gauntletStage + 1 : prev.gauntletStage,
        arenaWins,
        ownedParts: [...owned],
        campaignStars,
        bestSurvivalWave: Math.max(prev.bestSurvivalWave ?? 0, mode === 'survival' ? wavesCleared : 0),
      };
      savePlayerProfile(nextProfile);
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
    (mode: LocalLaunchMode, clanWar = false) => {
      soundEngine.unlock();
      matchRewardAppliedRef.current = false;
      lastCountdownCeilRef.current = 3;
      setIsMultiplayerMatch(false);
      setIsClanWarMatch(clanWar);
      setLastLocalMode(mode);
      activeCampaignIdRef.current = null;
      setMatchResult(null);

      const arenaToUse: ArenaId =
        mode === 'gauntlet'
          ? GAUNTLET_ARENA_ORDER[(profile.gauntletStage - 1) % GAUNTLET_ARENA_ORDER.length]
          : selectedArena;
      setSelectedArena(arenaToUse);

      const roster: BotRosterTemplate[] = [
        {
          id: profile.id,
          name: profile.callsign,
          clanTag: profile.clanTag,
          config: profile.botConfig,
          skills: profile.skills,
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

      const snap = createInitialSnapshot(mode as GameMode, arenaToUse, roster, selectedDuration, {
        modifiers: mode === 'practice' ? [] : selectedModifiers,
      });
      lastMatchTimerCeilRef.current = Math.ceil(snap.timeRemaining);
      snapshotRef.current = snap;
      setHudSnapshot({ ...snap });
      setLauncherOpen(false);
      setHubTab(null);
      setSceneMode('combat');
      soundEngine.playNextBattleMusic(arenaToUse);
    },
    [profile, selectedArena, selectedRivalTier, selectedDuration, selectedModifiers],
  );

  const startCampaignLevel = useCallback(
    (levelId: string) => {
      const level = getCampaignLevel(levelId);
      if (!level || !isLevelUnlocked(levelId, profile.campaignStars)) return;
      soundEngine.unlock();
      matchRewardAppliedRef.current = false;
      lastCountdownCeilRef.current = 3;
      activeCampaignIdRef.current = level.id;
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
      });
      lastMatchTimerCeilRef.current = Math.ceil(snap.timeRemaining);
      snapshotRef.current = snap;
      setHudSnapshot({ ...snap });
      setLauncherOpen(false);
      setHubTab(null);
      setSceneMode('combat');
      soundEngine.playNextBattleMusic(level.arenaId);
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

  const handleFindOnlineMatch = (mode: 'duel_1v1' | 'brawl_4bot') => {
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
        arenaId: selectedArena,
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
    setSceneMode('workshop');
  };

  const handleUpgradeSkill = (key: keyof SkillTree) => {
    const rank = profile.skills[key] ?? 0;
    if (rank >= 5) return;
    const scrapCost = 100 + rank * 60;
    if (profile.skillPoints >= 1) {
      updateProfile({
        skillPoints: profile.skillPoints - 1,
        skills: { ...profile.skills, [key]: rank + 1 },
      });
    } else if (profile.scrap >= scrapCost) {
      updateProfile({
        scrap: profile.scrap - scrapCost,
        skills: { ...profile.skills, [key]: rank + 1 },
      });
    }
  };

  const handleCreateClan = async (name: string, tag: string, motto: string) => {
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
    updateProfile({ clanId: localClan.id, clanTag: localClan.tag });

    try {
      const res = await fetch('/api/clans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, tag, motto }),
      });
      if (res.ok) {
        const data = (await res.json()) as { clan: ClanInfo; clans: ClanInfo[] };
        setClans(data.clans);
        updateProfile({ clanId: data.clan.id, clanTag: data.clan.tag });
      }
    } catch {
      // Local clan creation already applied
    }
  };

  const handleJoinClan = async (clanId: string) => {
    const targetLocal = clans.find((c) => c.id === clanId);
    if (targetLocal) {
      updateProfile({ clanId: targetLocal.id, clanTag: targetLocal.tag });
    }
    try {
      const res = await fetch(`/api/clans/${clanId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ previousClanId: profile.clanId }),
      });
      if (res.ok) {
        const data = (await res.json()) as { clan: ClanInfo; clans: ClanInfo[] };
        setClans(data.clans);
        updateProfile({ clanId: data.clan.id, clanTag: data.clan.tag });
      }
    } catch {
      // Local pledge already applied
    }
  };

  const handleSendClanChat = (clanId: string, text: string) => {
    const localMsg: ClanChatMessage = {
      id: `local_${Date.now()}`,
      sender: profile.callsign,
      text: text.trim().slice(0, 180),
      timestamp: new Date().toISOString(),
    };
    setClans((prev) =>
      prev.map((c) => (c.id === clanId ? { ...c, chat: [...c.chat.slice(-29), localMsg] } : c)),
    );

    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'clan:chat',
          clanId,
          name: profile.callsign,
          text,
        }),
      );
    }
  };

  const handleClaimEventReward = (ev: SeasonalEvent) => {
    if (profile.claimedEvents.includes(ev.id) || profile.wins < ev.targetWins) return;
    const owned = new Set(profile.ownedParts ?? []);
    if (ev.rewardUnlock) owned.add(ev.rewardUnlock);
    updateProfile({
      scrap: profile.scrap + ev.rewardScrap,
      skillPoints: profile.skillPoints + ev.rewardSkillPoints,
      pilotTitle: ev.badgeTitle || profile.pilotTitle,
      claimedEvents: [...profile.claimedEvents, ev.id],
      ownedParts: [...owned],
    });
    soundEngine.playPickup();
  };

  const handleBuyPart = (cat: PartCategory, id: string): boolean => {
    if (isPartOwned(profile, cat, id)) return true;
    const price = getPartPrice(cat, id);
    if (profile.scrap < price) return false;
    updateProfile({
      scrap: profile.scrap - price,
      ownedParts: [...(profile.ownedParts ?? []), partKey(cat, id)],
    });
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
    (profile.touchControlsMode === 'always' ||
      (profile.touchControlsMode === 'auto' && isTouchDevice));

  const playerCombatBot = hudSnapshot?.bots.find((b) => b.id === profile.id);

  return (
    <div className="relative h-dvh w-screen overflow-hidden bg-[#0D1014]">
      {/* Dedicated Isolated 3D WebGL Canvas */}
      <BattleArenaCanvas
        mode={sceneMode}
        arenaId={selectedArena}
        batteryMode={profile.batteryMode}
        playerBotConfig={profile.botConfig}
        playerId={profile.id}
        snapshotRef={snapshotRef}
        inputRef={inputRef}
        onStepLocalPhysics={sceneMode === 'combat' && !isMultiplayerMatch ? stepLocalPhysics : undefined}
        cameraPreset={cameraPreset}
      />

      {/* Top Navigation Bar (Workshop / Hangar Mode) */}
      {sceneMode === 'workshop' && (
        <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-slate-800/90 bg-[#0D1014]/92 px-4 sm:px-6 pt-safe">
          {/* Zone 1: Single-line Brand Wordmark */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap">
              Aetheris Bot Wars
            </span>
            <span className="hidden sm:inline rounded bg-amber-500/15 border border-amber-500/40 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
              S05 ASCENSION
            </span>
          </div>

          {/* Zone 2: Concise single-line nav links */}
          <nav className="flex items-center gap-3 sm:gap-6 overflow-x-auto text-xs sm:text-sm font-medium text-slate-300">
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
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setLauncherOpen(true)}
              className="rounded-lg bg-amber-500 px-3.5 py-2 min-h-[38px] text-xs font-bold text-slate-950 hover:bg-amber-400 transition whitespace-nowrap shrink-0"
            >
              Deploy Arena
            </button>
          </div>
        </header>
      )}

      {/* Subtle Pilot Metadata & Audio / PWA Install Strip below top bar in Workshop */}
      {sceneMode === 'workshop' && (
        <div className="pointer-events-none fixed inset-x-0 top-16 z-20 flex items-center justify-between px-4 sm:px-6">
          <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-xl border border-slate-800/90 bg-[#12161C]/90 px-3 py-1.5 text-xs text-slate-300 font-mono-tabular">
            <span className="font-semibold text-white">
              [{profile.clanTag}] {profile.callsign}
            </span>
            {profile.pilotTitle && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-sans text-[11px] font-semibold text-sky-400">
                  {profile.pilotTitle}
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span>Lv {profile.level}</span>
            <span aria-hidden="true">·</span>
            <span className="text-amber-400">{profile.scrap} Scrap</span>
            <span aria-hidden="true">·</span>
            <span>{profile.skillPoints} SP</span>
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            {!isOnline && (
              <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-[#1B1710]/95 px-2.5 py-1.5 text-xs font-medium text-amber-300">
                <WifiOff className="h-3.5 w-3.5" />
                <span>Offline Solo Ready</span>
              </div>
            )}
            <PWAInstallButton compact />
            <button
              type="button"
              onClick={() => updateProfile({ muted: !profile.muted })}
              aria-label={profile.muted ? 'Unmute audio' : 'Mute audio'}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-[#12161C]/90 text-slate-300 hover:text-white"
            >
              {profile.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}

      {/* Workshop Collapsible Bottom Customization Dock */}
      {sceneMode === 'workshop' && (
        <WorkshopDock
          config={profile.botConfig}
          skills={profile.skills}
          savedLoadouts={profile.savedLoadouts}
          activeLoadoutSlot={profile.activeLoadoutSlot ?? 0}
          onSelectLoadoutSlot={handleSelectLoadoutSlot}
          onChange={handleBotConfigChange}
          profile={profile}
          onBuyPart={handleBuyPart}
          onStartFight={() => setLauncherOpen(true)}
        />
      )}

      {/* Combat HUD */}
      {sceneMode === 'combat' && hudSnapshot && (
        <CombatHud
          snapshot={hudSnapshot}
          playerId={profile.id}
          cameraPreset={cameraPreset}
          muted={profile.muted}
          isMultiplayer={isMultiplayerMatch}
          matchResult={matchResult}
          campaignLevelId={activeCampaignIdRef.current}
          onCycleCamera={() =>
            setCameraPreset((c) => (c === 'chase' ? 'tactical' : c === 'tactical' ? 'cinematic' : 'chase'))
          }
          onToggleMute={() => updateProfile({ muted: !profile.muted })}
          onExitArena={handleExitArena}
          onRematch={() => {
            if (isMultiplayerMatch) {
              handleExitArena();
              setLauncherOpen(true);
            } else if (lastLocalMode === 'campaign') {
              if (activeCampaignIdRef.current) startCampaignLevel(activeCampaignIdRef.current);
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
          showKeyboardHint={!showTouchControls}
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
        onSelectArena={setSelectedArena}
        onSelectRivalTier={setSelectedRivalTier}
        onSelectDuration={setSelectedDuration}
        onSelectWingman={(idx) => updateProfile({ selectedWingmanIndex: idx })}
        onStartOffline={(mode) => startLocalMatch(mode, false)}
        onFindOnlineMatch={handleFindOnlineMatch}
        onStartOnlineNow={handleStartOnlineNow}
        onCancelLobby={handleCancelLobby}
        onClose={() => {
          if (lobbyRoom) handleCancelLobby();
          setLauncherOpen(false);
        }}
      />

      {/* Social, Rankings, Clans, Seasonal Events & Skill Tree Modal */}
      <SocialAndRankingsPanel
        activeTab={hubTab}
        profile={profile}
        leaderboard={leaderboard}
        clans={clans}
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
      />
    </div>
  );
}
