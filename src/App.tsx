import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WifiOff, Volume2, VolumeX } from 'lucide-react';
import { registerSW } from 'virtual:pwa-register';
import { ArenaLauncherModal, type RivalTier } from './components/ArenaLauncherModal';
import { CombatHud } from './components/CombatHud';
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
  stepArenaPhysics,
  type BotRosterTemplate,
} from './shared/physicsEngine';
import {
  type ArenaId,
  type ArenaSnapshot,
  type BotConfig,
  type ClanChatMessage,
  type ClanInfo,
  DEFAULT_SKILLS,
  type GameMode,
  getBotWeapons,
  type LeaderboardEntry,
  type PlayerInputState,
  type PlayerProfile,
  type SeasonalEvent,
  type SkillTree,
  type TimedBattleDuration,
} from './shared/types';

// Offline fallback seed so leaderboard, clans & seasonal tabs stay populated without connectivity
const OFFLINE_FALLBACK_EVENTS: SeasonalEvent[] = [
  {
    id: 's4_foundry_clash',
    seasonName: 'Season 04 · Molten Foundry',
    title: 'Foundry Crucible Qualifier',
    description: 'Win 3 arena matches in Molten Foundry to earn prototype alloy scrap and a Skill Core.',
    arenaId: 'foundry',
    modifierLabel: 'Active Floor Saws & Explosive Drums',
    targetWins: 3,
    rewardScrap: 450,
    rewardSkillPoints: 2,
    endsAt: '2026-12-01T00:00:00Z',
  },
  {
    id: 's4_cryo_drift',
    seasonName: 'Season 04 · Molten Foundry',
    title: 'Sub-Zero Drift Masters',
    description: 'Adapt to low-friction ice physics in the Cryo Pit and score 5 total wins.',
    arenaId: 'cryo',
    modifierLabel: 'Low Traction Ice + Launch Pads',
    targetWins: 5,
    rewardScrap: 650,
    rewardSkillPoints: 3,
    endsAt: '2026-12-08T00:00:00Z',
  },
  {
    id: 's4_reactor_surge',
    seasonName: 'Season 04 · Molten Foundry',
    title: 'Overcharge Reactor Raid',
    description: 'Harness +55% energy recharge inside the EMP Reactor chamber for 8 total wins.',
    arenaId: 'reactor',
    modifierLabel: '+55% Energy Regen · Periodic EMP',
    targetWins: 8,
    rewardScrap: 900,
    rewardSkillPoints: 4,
    endsAt: '2026-12-15T00:00:00Z',
  },
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

  // Server-backed social & leaderboard data
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [clans, setClans] = useState<ClanInfo[]>([]);
  const [seasonalEvents, setSeasonalEvents] = useState<SeasonalEvent[]>(OFFLINE_FALLBACK_EVENTS);

  // Active Match State
  const snapshotRef = useRef<ArenaSnapshot | null>(null);
  const [hudSnapshot, setHudSnapshot] = useState<ArenaSnapshot | null>(null);
  const [isMultiplayerMatch, setIsMultiplayerMatch] = useState(false);
  const [isClanWarMatch, setIsClanWarMatch] = useState(false);
  const [lastLocalMode, setLastLocalMode] = useState<'duel_1v1' | 'brawl_4bot' | 'gauntlet' | 'practice'>('gauntlet');
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

  // Register PWA service worker once
  useEffect(() => {
    try {
      registerSW({ immediate: true });
    } catch {
      // Ignore in non-SW environments
    }
  }, []);

  // Sync sound mute state & play Workshop music during customization
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

  // Persist profile locally on every change
  const updateProfile = useCallback((patch: Partial<PlayerProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
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
          setLeaderboard(data.leaderboard);
          markPendingSync(false);
        }
      } catch {
        markPendingSync(true);
      }
    },
    [],
  );

  // Fetch bootstrap data when online
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
        setLeaderboard(data.leaderboard);
        setClans(data.clans);
        setSeasonalEvents(data.seasonalEvents);
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
    const won = hudSnapshot.winnerId === profile.id;
    const kos = playerBot?.kos ?? 0;

    const scrapEarned = won ? 140 + kos * 35 : 45 + kos * 20;
    const xpEarned = won ? 120 : 45;
    const ratingDelta = won ? (isMultiplayerMatch ? 28 : 16) : isMultiplayerMatch ? -14 : -6;

    setProfile((prev) => {
      const nextXp = prev.xp + xpEarned;
      const leveledUp = nextXp >= prev.level * 200;
      const nextProfile: PlayerProfile = {
        ...prev,
        scrap: prev.scrap + scrapEarned,
        xp: leveledUp ? nextXp - prev.level * 200 : nextXp,
        level: leveledUp ? prev.level + 1 : prev.level,
        skillPoints: leveledUp ? prev.skillPoints + 1 : prev.skillPoints,
        rating: Math.max(800, prev.rating + ratingDelta),
        wins: won ? prev.wins + 1 : prev.wins,
        losses: won ? prev.losses : prev.losses + 1,
        kos: prev.kos + kos,
        gauntletStage: won && lastLocalMode === 'gauntlet' ? prev.gauntletStage + 1 : prev.gauntletStage,
      };
      savePlayerProfile(nextProfile);
      syncProfileToServer(nextProfile);

      if (isClanWarMatch && prev.clanId && navigator.onLine) {
        fetch(`/api/clans/${prev.clanId}/tournament`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ won, warPointsDelta: won ? 150 : 35 }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (data?.clans) setClans(data.clans);
          })
          .catch(() => {});
      }

      return nextProfile;
    });
  }, [hudSnapshot, profile.id, isMultiplayerMatch, isClanWarMatch, lastLocalMode, syncProfileToServer]);

  // Start Offline / Local Arena Match
  const startLocalMatch = useCallback(
    (mode: 'duel_1v1' | 'brawl_4bot' | 'gauntlet' | 'practice', clanWar = false) => {
      soundEngine.unlock();
      matchRewardAppliedRef.current = false;
      lastCountdownCeilRef.current = 3;
      setIsMultiplayerMatch(false);
      setIsClanWarMatch(clanWar);
      setLastLocalMode(mode);

      const arenaToUse: ArenaId =
        mode === 'gauntlet'
          ? (['foundry', 'cryo', 'reactor', 'colosseum'][(profile.gauntletStage - 1) % 4] as ArenaId)
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

      const rivalCount = mode === 'brawl_4bot' ? 3 : 1;
      const stageBoost = mode === 'gauntlet' ? Math.min(4, Math.floor((profile.gauntletStage - 1) / 2)) : 1;

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
          selectedRivalTier === 'mixed' && mode === 'brawl_4bot'
            ? [safePool[0], safePool[2], safePool[4]][i % 3] || safePool[i % safePool.length]
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
          team: mode === 'practice' ? 1 : i + 1,
        });
      }

      const snap = createInitialSnapshot(mode as GameMode, arenaToUse, roster, selectedDuration);
      lastMatchTimerCeilRef.current = Math.ceil(snap.timeRemaining);
      snapshotRef.current = snap;
      setHudSnapshot({ ...snap });
      setLauncherOpen(false);
      setHubTab(null);
      setSceneMode('combat');
      soundEngine.playNextBattleMusic(arenaToUse);
    },
    [profile, selectedArena, selectedRivalTier, selectedDuration],
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

      if (snapshotRef.current.mode !== 'practice' && snapshotRef.current.phase === 'active') {
        const remCeil = Math.ceil(snapshotRef.current.timeRemaining);
        if (remCeil !== lastMatchTimerCeilRef.current) {
          lastMatchTimerCeilRef.current = remCeil;
          if (remCeil <= 5 && remCeil >= 1) {
            soundEngine.playCountdown(false);
          }
        }
      }

      // Update React HUD at ~15Hz to keep DOM super light on mobile batteries
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
    const rank = profile.skills[key];
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
      // Ignore network error
    }
  };

  const handleJoinClan = async (clanId: string) => {
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
      // Ignore
    }
  };

  const handleSendClanChat = (clanId: string, text: string) => {
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
    updateProfile({
      scrap: profile.scrap + ev.rewardScrap,
      skillPoints: profile.skillPoints + ev.rewardSkillPoints,
      claimedEvents: [...profile.claimedEvents, ev.id],
    });
    soundEngine.playPickup();
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
          <span className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0">
            ForgeClash
          </span>

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
              Clans
            </button>
            <button
              type="button"
              onClick={() => setHubTab('events')}
              className="hover:text-amber-400 transition whitespace-nowrap shrink-0"
            >
              Season 04
            </button>
            <button
              type="button"
              onClick={() => setHubTab('skills')}
              className="hover:text-amber-400 transition whitespace-nowrap shrink-0"
            >
              Skills
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
            <span className="font-semibold text-white">[{profile.clanTag}] {profile.callsign}</span>
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
          onChange={(nextConfig: BotConfig) => updateProfile({ botConfig: nextConfig })}
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
          onCycleCamera={() =>
            setCameraPreset((c) => (c === 'chase' ? 'tactical' : c === 'tactical' ? 'cinematic' : 'chase'))
          }
          onToggleMute={() => updateProfile({ muted: !profile.muted })}
          onExitArena={handleExitArena}
          onRematch={() => {
            if (isMultiplayerMatch) {
              handleExitArena();
              setLauncherOpen(true);
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
        gauntletStage={profile.gauntletStage}
        lobbyRoom={lobbyRoom}
        onSelectArena={setSelectedArena}
        onSelectRivalTier={setSelectedRivalTier}
        onSelectDuration={setSelectedDuration}
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
        onStartClanWarMatch={() => startLocalMatch('duel_1v1', true)}
        onClaimEventReward={handleClaimEventReward}
      />
    </div>
  );
}
