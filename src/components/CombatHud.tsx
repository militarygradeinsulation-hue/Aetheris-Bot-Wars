import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Camera,
  ChevronDown,
  ChevronUp,
  Crown,
  Eye,
  Flame,
  LogOut,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  RotateCcw,
  Shield,
  ShieldPlus,
  Sliders,
  Star,
  Swords,
  Trophy,
  Volume2,
  VolumeX,
  Wrench,
  Zap,
} from 'lucide-react';
import { BotSystemsDiagram } from './BotSystemsDiagram';
import { describeObjective, describeUnlock, getCampaignLevel, getNextCampaignLevel } from '../shared/campaign';
import {
  ARENA_CATALOG,
  ARENA_EVENT_INFO,
  getBotWeapons,
  MATCH_MODIFIERS,
  WEAPON_CATALOG,
  type ArenaSnapshot,
  type BotPhysicsState,
  type ControlSchemeId,
  type DeviceLayoutMode,
  type PvpMatchResult,
} from '../shared/types';
import { voiceCommentator, type CommentaryLine } from '../game/voiceCommentator';

export interface MatchResultSummary {
  won: boolean;
  scrap: number;
  xp: number;
  skillPoints: number;
  stars?: number;
  objectives?: Array<{ label: string; met: boolean }>;
  unlocked?: string;
  wavesCleared?: number;
  newRecord?: boolean;
  levelTitle?: string;
  ratingDelta: number;
  pvp?: PvpMatchResult;
}

export type CameraViewPreset = 'chase' | 'first_person' | 'pilot_booth' | 'tactical' | 'cinematic';

interface CombatHudProps {
  matchResult?: MatchResultSummary | null;
  campaignLevelId?: string | null;
  snapshot: ArenaSnapshot;
  playerId: string;
  adminSeat?: 1 | 2 | null;
  cameraPreset: CameraViewPreset;
  cameraSensitivity?: number;
  muted: boolean;
  commentaryMuted?: boolean;
  controlScheme?: ControlSchemeId;
  deviceLayoutMode?: DeviceLayoutMode;
  isMultiplayer: boolean;
  onCycleCamera: () => void;
  onSelectCamera?: (preset: CameraViewPreset) => void;
  onChangeCameraSensitivity?: (sens: number) => void;
  onToggleMute: () => void;
  onToggleCommentary?: () => void;
  onOpenAudioSettings?: () => void;
  onSelectControlScheme?: (scheme: ControlSchemeId) => void;
  onSelectDeviceLayoutMode?: (mode: DeviceLayoutMode) => void;
  onExitArena: () => void;
  onRematch: () => void;
  onNextCampaignLevel?: (nextLevelId: string) => void;
  onGoToGarageUpgrades?: () => void;
  onWeaponTrigger?: (slotIdx: number, pressed: boolean) => void;
  onRepairTrigger?: (pressed: boolean) => void;
  onBoostTrigger?: (pressed: boolean) => void;
  onDriftTrigger?: (pressed: boolean) => void;
  showKeyboardHint: boolean;
}

function ArmorMiniIndicator({ bot }: { bot: BotPhysicsState }) {
  const pct = (val: number) =>
    bot.maxArmorZone > 0 ? Math.max(0, Math.round((val / bot.maxArmorZone) * 100)) : 0;
  const barColor = (p: number) =>
    p <= 0 ? 'bg-slate-800' : p < 35 ? 'bg-red-500' : p < 70 ? 'bg-amber-400' : 'bg-emerald-400';

  return (
    <div className="flex items-center gap-2 text-[10px] text-slate-300 font-mono-tabular">
      <div className="grid grid-cols-3 gap-0.5 w-11 h-7 items-center justify-items-center bg-[#0D1014] rounded p-0.5 border border-slate-800">
        <div className="col-start-2 w-4 h-1 rounded-sm overflow-hidden bg-slate-800">
          <div className={`h-full ${barColor(pct(bot.armorZones.front))}`} style={{ width: `${pct(bot.armorZones.front)}%` }} />
        </div>
        <div className="col-start-1 row-start-2 w-1.5 h-3.5 rounded-sm overflow-hidden bg-slate-800">
          <div className={`w-full h-full ${barColor(pct(bot.armorZones.left))}`} />
        </div>
        <div className="col-start-2 row-start-2 w-2.5 h-3.5 rounded-sm bg-slate-700" />
        <div className="col-start-3 row-start-2 w-1.5 h-3.5 rounded-sm overflow-hidden bg-slate-800">
          <div className={`w-full h-full ${barColor(pct(bot.armorZones.right))}`} />
        </div>
        <div className="col-start-2 row-start-3 w-4 h-1 rounded-sm overflow-hidden bg-slate-800">
          <div className={`h-full ${barColor(pct(bot.armorZones.rear))}`} style={{ width: `${pct(bot.armorZones.rear)}%` }} />
        </div>
      </div>
      <div className="hidden sm:block leading-tight text-slate-400">
        <div>F {pct(bot.armorZones.front)}% · R {pct(bot.armorZones.rear)}%</div>
        <div>L {pct(bot.armorZones.left)}% · R {pct(bot.armorZones.right)}%</div>
      </div>
    </div>
  );
}

function ArenaMiniRadar({
  snapshot,
  playerId,
  minimized,
  onToggleMinimize,
}: {
  snapshot: ArenaSnapshot;
  playerId: string;
  minimized?: boolean;
  onToggleMinimize?: () => void;
}) {
  const half = ARENA_CATALOG[snapshot.arenaId]?.halfSize || 18;
  const player = snapshot.bots.find((b) => b.id === playerId) || snapshot.bots[0];
  const toPct = (coord: number) => Math.max(4, Math.min(96, ((coord + half) / (half * 2)) * 100));

  if (minimized) {
    return (
      <button
        type="button"
        onClick={onToggleMinimize}
        className="pointer-events-auto hidden md:flex fixed bottom-4 left-4 z-20 items-center gap-1.5 rounded-xl border border-slate-700/80 bg-[#0D1014]/90 px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-300 hover:text-amber-300 shadow-lg cursor-pointer"
        title="Expand Arena Radar"
      >
        <Maximize2 className="h-3 w-3 text-amber-400" />
        <span>Radar</span>
      </button>
    );
  }

  return (
    <div className="pointer-events-auto hidden md:block fixed bottom-4 left-4 z-20 h-28 w-28 rounded-xl border border-slate-700/80 bg-[#0D1014]/88 p-1.5 shadow-xl group">
      {onToggleMinimize && (
        <button
          type="button"
          onClick={onToggleMinimize}
          className="absolute top-1.5 right-1.5 z-30 rounded bg-slate-900/90 p-0.5 text-slate-400 hover:text-amber-300 border border-slate-700/70 cursor-pointer"
          title="Minimize Radar"
        >
          <Minimize2 className="h-2.5 w-2.5" />
        </button>
      )}
      <div className="relative h-full w-full rounded-lg border border-slate-800 bg-[#121720] overflow-hidden">
        <div className="absolute inset-x-0 top-1/2 h-px bg-slate-800/80" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-slate-800/80" />

        {/* Hazards */}
        {snapshot.hazards.map((h) => (
          <span
            key={h.id}
            style={{ left: `${toPct(h.x)}%`, top: `${toPct(h.z)}%` }}
            className={`-translate-x-1/2 -translate-y-1/2 absolute h-2 w-2 rounded-full ${
              h.active
                ? 'bg-red-500/80'
                : h.warning
                  ? 'bg-amber-400/75'
                  : 'bg-slate-600/40'
            }`}
          />
        ))}

        {/* Active Pickups */}
        {snapshot.props
          .filter(
            (p) =>
              !p.destroyed &&
              (p.kind === 'pickup_repair' ||
                p.kind === 'pickup_energy' ||
                p.kind === 'pickup_overcharge' ||
                p.kind === 'pickup_shield'),
          )
          .map((p) => (
            <span
              key={p.id}
              style={{ left: `${toPct(p.x)}%`, top: `${toPct(p.z)}%` }}
              className="-translate-x-1/2 -translate-y-1/2 absolute h-2 w-2 rounded-sm bg-emerald-400 animate-pulse"
            />
          ))}

        {/* Bots */}
        {snapshot.bots.map((b) => {
          if (b.isDead) return null;
          const isSelf = b.id === player?.id;
          const isAlly = !isSelf && player && b.team === player.team;
          return (
            <span
              key={b.id}
              style={{ left: `${toPct(b.x)}%`, top: `${toPct(b.z)}%` }}
              className={`-translate-x-1/2 -translate-y-1/2 absolute rounded-full border border-slate-950 ${
                isSelf
                  ? 'h-3 w-3 bg-amber-400 z-10'
                  : isAlly
                    ? 'h-2.5 w-2.5 bg-emerald-400'
                    : 'h-2.5 w-2.5 bg-red-500'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}

export const CombatHud: React.FC<CombatHudProps> = ({
  snapshot,
  playerId,
  adminSeat,
  matchResult,
  campaignLevelId,
  cameraPreset,
  cameraSensitivity = 0.65,
  muted,
  commentaryMuted,
  controlScheme = 'wasd_drive',
  deviceLayoutMode = 'auto',
  isMultiplayer,
  onCycleCamera,
  onChangeCameraSensitivity,
  onToggleMute,
  onToggleCommentary,
  onOpenAudioSettings,
  onSelectControlScheme,
  onSelectDeviceLayoutMode,
  onExitArena,
  onRematch,
  onNextCampaignLevel,
  onGoToGarageUpgrades,
  onWeaponTrigger,
  onRepairTrigger,
  onBoostTrigger,
  onDriftTrigger,
  showKeyboardHint,
}) => {
  const [calloutText, setCalloutText] = useState<string | null>(null);
  const [liveCommentary, setLiveCommentary] = useState<CommentaryLine | null>(null);
  const [cleanViewAll, setCleanViewAll] = useState(false);
  const [minPlayerTile, setMinPlayerTile] = useState(false);
  const [minRivalsTile, setMinRivalsTile] = useState(false);
  const [minControlsTile, setMinControlsTile] = useState(false);
  const [minRadarTile, setMinRadarTile] = useState(false);
  const [autoNextEnabled, setAutoNextEnabled] = useState(true);
  const [autoNextCountdown, setAutoNextCountdown] = useState<number | null>(null);

  const toggleCleanViewAll = () => {
    setCleanViewAll((prev) => {
      const next = !prev;
      setMinPlayerTile(next);
      setMinRivalsTile(next);
      setMinControlsTile(next);
      setMinRadarTile(next);
      return next;
    });
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'KeyH') {
        e.preventDefault();
        toggleCleanViewAll();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    return voiceCommentator.subscribe((line) => {
      setLiveCommentary(line);
    });
  }, []);

  useEffect(() => {
    if (!snapshot.events || snapshot.events.length === 0) return;
    const withCallout = [...snapshot.events].reverse().find((e) => e.callout);
    if (withCallout?.callout) {
      setCalloutText(withCallout.callout);
      const t = window.setTimeout(() => setCalloutText(null), 2200);
      return () => clearTimeout(t);
    }
  }, [snapshot.events]);

  const player = snapshot.bots.find((b) => b.id === playerId) || snapshot.bots[0];
  const allies = snapshot.bots.filter((b) => b.id !== player?.id && b.team === player?.team);
  const rivals = snapshot.bots.filter((b) => b.id !== player?.id && b.team !== player?.team);
  const playerWeapons = player ? getBotWeapons(player.config) : [];
  const focusRival = player
    ? rivals
        .filter((r) => !r.isDead)
        .sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z))[0]
    : undefined;
  const playerTeam = player?.team ?? 0;
  const campaignLevel = campaignLevelId ? getCampaignLevel(campaignLevelId) : undefined;
  const nextCampaignLevel = campaignLevelId ? getNextCampaignLevel(campaignLevelId) : undefined;
  const arenaEvent = snapshot.arenaEvent;
  const hill = snapshot.hill;
  const isSurvival = snapshot.mode === 'survival';
  const untimed = snapshot.mode === 'practice' || isSurvival;

  const secs = Math.ceil(snapshot.timeRemaining);
  const mins = Math.floor(secs / 60);
  const remSecs = String(secs % 60).padStart(2, '0');
  const totalDur = snapshot.durationSeconds || 180;
  const timePct = Math.max(0, Math.min(100, (snapshot.timeRemaining / totalDur) * 100));
  const isFinalWarning = !untimed && snapshot.phase === 'active' && secs <= 20 && secs > 10;
  const isFinalTen = !untimed && snapshot.phase === 'active' && secs <= 10;

  const escalationStage = snapshot.escalationStage ?? 1;
  const crusherWarning = snapshot.hazards.some((h) => h.kind === 'crusher' && h.warning);
  const crusherActive = snapshot.hazards.some((h) => h.kind === 'crusher' && h.active);
  const bladeWarning = snapshot.hazards.some((h) => h.kind === 'spinner_blade' && h.warning);
  const bladeActive = snapshot.hazards.some((h) => h.kind === 'spinner_blade' && h.active);

  const arenaSpec = ARENA_CATALOG[snapshot.arenaId];
  const boltWarning = snapshot.hazards.some((h) => h.kind === 'lightning' && h.warning);
  const bombWarning = snapshot.hazards.some((h) => h.kind === 'bomb_drop' && h.warning);
  const laserActive = snapshot.hazards.some((h) => h.kind === 'laser_grid' && h.active);
  const oilIgnited = snapshot.hazards.some((h) => h.kind === 'oil_slick' && h.ignited);
  const pitOpen = snapshot.hazards.some((h) => h.kind === 'pit' && h.active);

  const hazardAlertText = bombWarning
    ? 'Aerial Bomb Drop Incoming!'
    : boltWarning
      ? 'Lightning Strike Incoming!'
      : laserActive
        ? 'Sweeping Laser Grid Active'
        : oilIgnited
          ? 'Burning Oil Slicks Ignited!'
          : pitOpen && !crusherActive
            ? 'Drop Pits Open'
            : crusherActive
              ? 'Crusher Impact'
              : crusherWarning
                ? 'Crusher Warning'
                : bladeActive
                  ? 'Floor Blades Active'
                  : bladeWarning
                    ? 'Floor Blades Arming'
                    : escalationStage >= 3
                      ? `${arenaSpec?.name || 'Arena'} · Tier 3 All Traps`
                      : escalationStage === 2
                        ? `${arenaSpec?.name || 'Arena'} · Tier 2 Crushers`
                        : `${arenaSpec?.name || 'Arena'} · Tier 1`;

  const hazardAlertTone =
    crusherActive || bladeActive || laserActive || oilIgnited
      ? 'border-red-500/70 bg-[#1B1214]/95 text-red-300'
      : crusherWarning || bladeWarning || boltWarning || bombWarning || pitOpen
        ? 'border-amber-500/70 bg-[#1C1710]/95 text-amber-300'
        : 'border-slate-700/80 bg-[#12161C]/90 text-slate-300';

  const winner = snapshot.winnerId ? snapshot.bots.find((b) => b.id === snapshot.winnerId) : null;
  const playerWon =
    matchResult?.won ??
    (winner?.id === player?.id ||
      (snapshot.winningTeam !== null &&
        snapshot.winningTeam !== undefined &&
        Boolean(player) &&
        snapshot.winningTeam === player?.team));
  const endedByTime = snapshot.finishReason === 'time';
  const endedByObjective = snapshot.finishReason === 'objective';
  const endedByRingOut = snapshot.finishReason === 'ring_out';
  const isTeamMatch = allies.length > 0 || (rivals.length > 1 && snapshot.mode !== 'brawl_4bot');
  const sortedStandings = [...snapshot.bots].sort((a, b) => {
    if (a.isDead !== b.isDead) return a.isDead ? 1 : -1;
    const scoreA = (a.hp / Math.max(1, a.maxHp)) * 100 + a.damageDealt * 0.16 + a.kos * 30;
    const scoreB = (b.hp / Math.max(1, b.maxHp)) * 100 + b.damageDealt * 0.16 + b.kos * 30;
    return scoreB - scoreA;
  });

  useEffect(() => {
    if (snapshot.phase !== 'finished') {
      setAutoNextCountdown(null);
      setAutoNextEnabled(true);
      return;
    }
    if (!campaignLevel || !playerWon || !nextCampaignLevel || !onNextCampaignLevel || !autoNextEnabled) {
      setAutoNextCountdown(null);
      return;
    }
    setAutoNextCountdown(8);
    const interval = window.setInterval(() => {
      setAutoNextCountdown((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          window.clearInterval(interval);
          window.setTimeout(() => {
            onNextCampaignLevel(nextCampaignLevel.id);
          }, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [snapshot.phase, campaignLevel?.id, playerWon, nextCampaignLevel?.id, onNextCampaignLevel, autoNextEnabled]);

  return (
    <>
      {/* Top Compact Combat Telemetry Bar */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3 sm:px-6 pt-safe">
        {/* Player + Wingman Ally Status Column */}
        <div className="pointer-events-auto flex flex-col gap-1.5 min-w-[140px] sm:min-w-[240px]">
          {player && minPlayerTile ? (
            <button
              type="button"
              onClick={() => setMinPlayerTile(false)}
              className="flex items-center justify-between gap-2 rounded-xl border border-slate-700/80 bg-[#12161C]/90 px-3 py-1.5 text-xs font-bold text-white hover:border-amber-400/60 transition cursor-pointer shadow-lg"
              title="Expand Player Telemetry Tile"
            >
              <span className="truncate">{player.config.name}</span>
              <span className="font-mono-tabular text-amber-400">
                {Math.max(0, Math.round(player.hp))} HP
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            </button>
          ) : (
            player && (
              <div className="flex items-center gap-3 rounded-xl border border-slate-700/80 bg-[#12161C]/92 px-3 py-2 relative">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-white truncate">{player.config.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-mono-tabular text-amber-400 font-semibold">
                        {Math.max(0, Math.round(player.hp))}/{player.maxHp}
                      </span>
                      <button
                        type="button"
                        onClick={() => setMinPlayerTile(true)}
                        className="rounded bg-slate-800/90 p-0.5 text-slate-400 hover:text-amber-300 transition cursor-pointer"
                        title="Minimize Player Telemetry Tile"
                      >
                        <ChevronUp className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                  <span>{player.weightClass}</span>
                  {(player.shieldHp ?? 0) > 0 && (
                    <span className="flex items-center gap-0.5 text-sky-400 font-semibold">
                      <Shield className="h-2.5 w-2.5" /> {Math.round(player.shieldHp!)}
                    </span>
                  )}
                  {(player.eraBlocksRemaining ?? 0) > 0 && (
                    <span className="rounded bg-amber-500/20 px-1 text-[9px] font-bold text-amber-300">
                      ERA×{player.eraBlocksRemaining}
                    </span>
                  )}
                  {player.overdriveTimer > 0 && (
                    <span className="rounded bg-sky-500/25 px-1 text-[9px] font-bold text-sky-300">
                      OVERDRIVE
                    </span>
                  )}
                  {(player.damageBoostTimer ?? 0) > 0 && (
                    <span className="rounded bg-orange-500/25 px-1 text-[9px] font-bold text-orange-300">
                      +35% DMG
                    </span>
                  )}
                  {(player.freezeTimer ?? 0) > 0 && (
                    <span className="rounded bg-cyan-500/25 px-1 text-[9px] font-bold text-cyan-300">
                      FROZEN
                    </span>
                  )}
                  {(player.pinnedTimer ?? 0) > 0 && (
                    <span className="rounded bg-orange-500/25 px-1 text-[9px] font-bold text-orange-300">PINNED</span>
                  )}
                  {player.isBounty && (
                    <span className="rounded bg-yellow-500/25 px-1 text-[9px] font-bold text-yellow-300">BOUNTY</span>
                  )}
                  {(player.shockTimer ?? 0) > 0 && (
                    <span className="rounded bg-purple-500/25 px-1 text-[9px] font-bold text-purple-300">
                      EMP SHOCK
                    </span>
                  )}
                  {(player.slipTimer ?? 0) > 0 && (
                    <span className="rounded bg-amber-500/25 px-1 text-[9px] font-bold text-amber-300">
                      OIL SLIP!
                    </span>
                  )}
                  {player.isDrifting && (
                    <span className="rounded bg-fuchsia-500/30 px-1 text-[9px] font-bold text-fuchsia-200">
                      DRIFTING
                    </span>
                  )}
                  {(player.driftBoostTimer ?? 0) > 0 && (
                    <span className="rounded bg-cyan-500/30 px-1 text-[9px] font-bold text-cyan-200">
                      DRIFT TURBO!
                    </span>
                  )}
                  {adminSeat && (
                    <span className="rounded bg-emerald-500/25 px-1.5 text-[9px] font-extrabold text-emerald-300">
                      PLAYER {adminSeat} VIEW
                    </span>
                  )}
                </div>

                {/* Shield Bar (if equipped) */}
                {(player.maxShieldHp ?? 0) > 0 && (
                  <div className="mt-1 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-cyan-400 transition-all duration-100"
                      style={{
                        width: `${Math.max(0, ((player.shieldHp ?? 0) / Math.max(1, player.maxShieldHp!)) * 100)}%`,
                      }}
                    />
                  </div>
                )}

                {/* Hull HP Bar */}
                <div className="mt-1 h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-amber-500 transition-all duration-75"
                    style={{ width: `${Math.max(0, (player.hp / player.maxHp) * 100)}%` }}
                  />
                </div>
                {/* Weapon Power Bar */}
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="font-mono-tabular text-[9px] font-bold text-amber-300 w-7 shrink-0">PWR</span>
                  <div className="h-1.5 flex-1 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-75 ${
                        player.weaponActive ? 'bg-amber-400' : 'bg-emerald-400'
                      }`}
                      style={{ width: `${Math.max(0, (player.energy / Math.max(1, player.maxEnergy)) * 100)}%` }}
                    />
                  </div>
                </div>
                {/* Boost Meter Bar */}
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="font-mono-tabular text-[9px] font-bold text-sky-300 w-7 shrink-0">BST</span>
                  <div className="h-1.5 flex-1 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-75 ${
                        player.isBoosting ? 'bg-orange-400' : 'bg-sky-400'
                      }`}
                      style={{
                        width: `${Math.max(0, ((player.boostFuel ?? 100) / Math.max(1, player.maxBoostFuel ?? 100)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
                {/* Mortar Short-Click (Close) vs Long-Press (Far) Charge Meter */}
                {playerWeapons.includes('mortar') && (
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className="font-mono-tabular text-[9px] font-bold text-fuchsia-300 w-7 shrink-0">MTR</span>
                    <div className="h-1.5 flex-1 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-fuchsia-400 transition-all duration-75"
                        style={{
                          width: `${Math.min(100, ((player.mortarCharge ?? 0) / 1.15) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="font-mono-tabular text-[8px] text-fuchsia-200">
                      {(player.mortarCharge ?? 0) > 0.35 ? 'FAR' : 'TAP=CLOSE / HOLD=FAR'}
                    </span>
                  </div>
                )}
              </div>
              <ArmorMiniIndicator bot={player} />
            </div>
            )
          )}

          {/* Wingman / Teammate Card in 2v2 or Raid */}
          {!minPlayerTile &&
            allies.map((ally) => (
              <div
                key={ally.id}
                className={`rounded-xl border px-3 py-1.5 bg-[#12161C]/90 ${
                  ally.isDead ? 'border-slate-800 opacity-55' : 'border-emerald-500/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-emerald-300 truncate">
                    ALLY · [{ally.clanTag}] {ally.config.name}
                  </span>
                  <span className="font-mono-tabular text-emerald-400 font-semibold shrink-0">
                    {ally.outOfRing ? 'RING-OUT' : ally.isDead ? 'KO' : `${Math.round(ally.hp)}/${ally.maxHp}`}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-100"
                    style={{ width: `${Math.max(0, (ally.hp / ally.maxHp) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          {player && !minPlayerTile && (
            <div className="hidden sm:block">
              <BotSystemsDiagram bot={player} title="Your systems" />
            </div>
          )}
        </div>

        {/* Center Match Timer + Controls + Timed Hazard Escalation + Callout Banner */}
        <div className="pointer-events-none flex flex-col items-center gap-1.5">
          <div
            className={`pointer-events-auto flex items-center gap-1.5 rounded-xl border bg-[#12161C]/90 px-2.5 py-1.5 ${
              isFinalTen ? 'border-red-500/80' : isFinalWarning ? 'border-amber-500/80' : 'border-slate-700/80'
            }`}
          >
            <div className="px-2 text-center min-w-[66px]">
              <div
                className={`font-mono-tabular text-base sm:text-lg font-bold leading-none ${
                  isFinalTen ? 'text-red-400' : isFinalWarning ? 'text-amber-300' : 'text-white'
                }`}
              >
                {isSurvival
                  ? `W${Math.max(1, snapshot.survivalWave ?? 1)}`
                  : snapshot.mode === 'practice'
                    ? 'FREE'
                    : `${mins}:${remSecs}`}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 whitespace-nowrap">
                {isFinalTen
                  ? 'FINAL SEC'
                  : isMultiplayer
                    ? 'Timed PvP'
                    : campaignLevel
                      ? campaignLevel.title
                    : isSurvival
                      ? `${snapshot.survivalKills ?? 0} kills`
                    : snapshot.mode === 'team_3v3'
                      ? 'Squad 3v3'
                    : snapshot.mode === 'king_hill'
                      ? 'King of the Hill'
                    : snapshot.mode === 'team_2v2'
                      ? '2v2 Clash'
                      : snapshot.mode === 'boss_raid'
                        ? 'Boss Raid'
                        : snapshot.mode === 'practice'
                          ? 'Test Range'
                          : 'Timed Battle'}
              </div>
              {!untimed && (
                <div className="mt-1 h-1 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-200 ${
                      isFinalTen ? 'bg-red-500' : isFinalWarning ? 'bg-amber-400' : 'bg-emerald-400'
                    }`}
                    style={{ width: `${timePct}%` }}
                  />
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onCycleCamera}
              title={`Cycle Camera View [V]: ${cameraPreset}`}
              className={`flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition ${
                cameraPreset === 'first_person' || cameraPreset === 'pilot_booth'
                  ? 'border border-amber-400/70 bg-amber-500/20 text-amber-300'
                  : 'bg-[#1A2029] text-slate-200 hover:text-amber-400'
              }`}
            >
              {cameraPreset === 'first_person' || cameraPreset === 'pilot_booth' ? (
                <Eye className="h-4 w-4 shrink-0" />
              ) : (
                <Camera className="h-4 w-4 shrink-0" />
              )}
              <span className="hidden sm:inline whitespace-nowrap">
                View:{' '}
                {cameraPreset === 'first_person'
                  ? '1st Person'
                  : cameraPreset === 'pilot_booth'
                    ? 'Behind Glass'
                    : cameraPreset === 'chase'
                      ? 'Follow Cam'
                      : cameraPreset === 'tactical'
                        ? 'Tactical'
                        : 'Orbit'}
              </span>
              <span className="font-mono-tabular rounded bg-slate-900/80 px-1 py-0.5 text-[9px] text-slate-300">
                V
              </span>
            </button>
            {onToggleCommentary && (
              <button
                type="button"
                onClick={onToggleCommentary}
                title={commentaryMuted ? 'Turn Commentary Voice ON' : 'Turn Commentary Voice OFF'}
                className={`flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold transition ${
                  commentaryMuted
                    ? 'border border-slate-700 bg-[#1A2029] text-slate-400 hover:text-white'
                    : 'border border-sky-400/60 bg-sky-500/20 text-sky-200 hover:bg-sky-500/30'
                }`}
              >
                {commentaryMuted ? (
                  <MicOff className="h-4 w-4 shrink-0 text-slate-400" />
                ) : (
                  <Mic className="h-4 w-4 shrink-0 text-sky-300" />
                )}
                <span className="hidden md:inline whitespace-nowrap">
                  {commentaryMuted ? 'Voice Off' : 'Voice On'}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={toggleCleanViewAll}
              title="Minimize or Expand all battle HUD tiles for a Clean Arena View [H]"
              className={`flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold transition cursor-pointer ${
                cleanViewAll
                  ? 'border border-emerald-400/70 bg-emerald-500/20 text-emerald-200'
                  : 'bg-[#1A2029] text-slate-200 hover:text-amber-400'
              }`}
            >
              {cleanViewAll ? (
                <Maximize2 className="h-4 w-4 shrink-0" />
              ) : (
                <Minimize2 className="h-4 w-4 shrink-0" />
              )}
              <span className="hidden lg:inline whitespace-nowrap">
                {cleanViewAll ? 'Show HUD' : 'Clean View'}
              </span>
              <span className="font-mono-tabular rounded bg-slate-900/80 px-1 py-0.5 text-[9px] text-slate-300">
                H
              </span>
            </button>
            {onOpenAudioSettings && (
              <button
                type="button"
                onClick={onOpenAudioSettings}
                title="Open Audio & Volume Mixer (Music, SFX, Crowd, Commentary)"
                className="flex h-10 items-center gap-1.5 rounded-lg bg-[#1A2029] px-2.5 text-xs font-semibold text-slate-200 hover:text-amber-400 transition cursor-pointer"
              >
                <Sliders className="h-4 w-4 shrink-0 text-amber-400" />
                <span className="hidden xl:inline whitespace-nowrap">Audio</span>
              </button>
            )}
            <button
              type="button"
              onClick={onToggleMute}
              title={muted ? 'Unmute audio' : 'Mute audio'}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1A2029] text-slate-200 hover:text-amber-400 transition cursor-pointer"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onExitArena}
              title="Exit match"
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>

          {snapshot.phase === 'active' && snapshot.hazards.length > 0 && (
            <div
              className={`rounded-lg border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide whitespace-nowrap ${hazardAlertTone}`}
            >
              {hazardAlertText}
            </div>
          )}

          {snapshot.phase === 'active' && arenaEvent && (
            <div className="flex items-center gap-1.5 rounded-lg border border-fuchsia-500/70 bg-[#1A1220]/95 px-2.5 py-1 text-[11px] font-bold text-fuchsia-200 whitespace-nowrap">
              <Zap className="h-3.5 w-3.5" />
              {arenaEvent.label}
              <span className="font-normal text-fuchsia-300/80 hidden sm:inline">· {ARENA_EVENT_INFO[arenaEvent.kind].note}</span>
              <span className="font-mono-tabular text-fuchsia-300/80">{Math.ceil(arenaEvent.timeLeft)}s</span>
            </div>
          )}

          {hill && (
            <div className="pointer-events-auto w-[220px] rounded-lg border border-yellow-500/50 bg-[#17150E]/92 px-2.5 py-1.5">
              <div className="flex items-center justify-between text-[10px] font-semibold text-yellow-200">
                <span className="flex items-center gap-1">
                  <Crown className="h-3 w-3" />
                  {hill.contested
                    ? 'CONTESTED'
                    : hill.owner === null
                      ? 'Hill Neutral'
                      : hill.owner === playerTeam
                        ? 'Your Team Holds'
                        : 'Enemy Holds'}
                </span>
                <span className="font-mono-tabular text-yellow-300/80">moves {Math.ceil(hill.moveTimer)}s</span>
              </div>
              {[playerTeam, ...snapshot.bots.map((b) => b.team).filter((t) => t !== playerTeam)]
                .filter((t, i, arr) => arr.indexOf(t) === i)
                .slice(0, 3)
                .map((t) => (
                  <div key={t} className="mt-1 flex items-center gap-1.5">
                    <span className={`w-9 text-[9px] font-bold ${t === playerTeam ? 'text-emerald-400' : 'text-red-400'}`}>
                      {t === playerTeam ? 'YOU' : 'ENMY'}
                    </span>
                    <div className="h-1.5 flex-1 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-200 ${t === playerTeam ? 'bg-emerald-400' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(100, ((hill.scores[t] ?? 0) / hill.target) * 100)}%` }}
                      />
                    </div>
                    <span className="w-6 text-right font-mono-tabular text-[9px] text-slate-300">
                      {Math.floor(hill.scores[t] ?? 0)}
                    </span>
                  </div>
                ))}
            </div>
          )}

          {snapshot.phase !== 'finished' && (snapshot.modifiers?.length ?? 0) > 0 && (
            <div className="hidden sm:flex flex-wrap justify-center gap-1 max-w-[320px]">
              {snapshot.modifiers!.map((m) => (
                <span
                  key={m}
                  className="rounded border border-fuchsia-500/40 bg-[#160F1A]/85 px-1.5 py-0.5 text-[9px] font-semibold text-fuchsia-300"
                >
                  {MATCH_MODIFIERS[m].label}
                </span>
              ))}
            </div>
          )}

          {calloutText && snapshot.phase === 'active' && (
            <div className="rounded-xl border border-amber-400/80 bg-amber-500/20 px-3.5 py-1 text-xs font-extrabold tracking-wider text-amber-300 shadow-lg">
              {calloutText}
            </div>
          )}

          {liveCommentary && !commentaryMuted && snapshot.phase === 'active' && (
            <div className="max-w-lg rounded-2xl border border-sky-400/60 bg-[#0D131D]/94 px-3.5 py-2 text-left shadow-2xl space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono-tabular rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-amber-300 shrink-0">
                  🎙️ {liveCommentary.speaker}
                </span>
                <span className="text-[11px] font-bold text-slate-100 leading-snug">
                  {liveCommentary.text}
                </span>
              </div>
              {liveCommentary.coText && (
                <div className="flex items-center gap-2 border-t border-slate-800/80 pt-1">
                  <span className="font-mono-tabular rounded bg-sky-500/20 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-sky-300 shrink-0">
                    🎧 {liveCommentary.coSpeaker || 'KIRA VOLT (ANALYST)'}
                  </span>
                  <span className="text-[11px] font-semibold text-sky-100 leading-snug">
                    {liveCommentary.coText}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rivals Status */}
        <div className="pointer-events-auto hidden sm:flex flex-col gap-1.5 min-w-[160px] sm:min-w-[215px]">
          {minRivalsTile ? (
            <button
              type="button"
              onClick={() => setMinRivalsTile(false)}
              className="flex items-center justify-between gap-2 self-end rounded-xl border border-slate-700/80 bg-[#12161C]/90 px-3 py-1.5 text-xs font-bold text-slate-200 hover:border-red-400/60 transition cursor-pointer shadow-lg"
              title="Expand Rivals Telemetry Tile"
            >
              <span>
                Rivals ({rivals.filter((r) => !r.isDead).length}/{rivals.length})
              </span>
              {focusRival && (
                <span className="font-mono-tabular text-red-400">
                  {Math.max(0, Math.round(focusRival.hp))} HP
                </span>
              )}
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            </button>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#0D1014]/85 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                <span>Rival Telemetry</span>
                <button
                  type="button"
                  onClick={() => setMinRivalsTile(true)}
                  className="rounded bg-slate-800/90 p-0.5 text-slate-400 hover:text-amber-300 transition cursor-pointer"
                  title="Minimize Rivals Telemetry Tile"
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
              </div>
              {rivals.map((r) => (
                <div
                  key={r.id}
                  className={`rounded-xl border px-3 py-1.5 bg-[#12161C]/90 ${
                    r.isDead ? 'border-slate-800 opacity-55' : 'border-slate-700/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-100 truncate">
                      {r.isBoss && <span className="mr-1 text-[9px] font-bold text-red-400">BOSS</span>}
                      {r.isBounty && <span className="mr-1 text-[9px] font-bold text-yellow-300">$</span>}
                      [{r.clanTag}] {r.config.name}
                    </span>
                    <span className="font-mono-tabular text-red-400 font-semibold shrink-0">
                      {r.outOfRing ? 'RING-OUT' : r.isDead ? 'KO' : `${Math.round(r.hp)}/${r.maxHp}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono-tabular">
                    <span>Lv {r.botLevel} · {r.weightClass}</span>
                    {(r.shieldHp ?? 0) > 0 && (
                      <span className="text-sky-400">· SHD {Math.round(r.shieldHp!)}</span>
                    )}
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-red-500 transition-all duration-100"
                      style={{ width: `${Math.max(0, (r.hp / r.maxHp) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
              {focusRival && (
                <div className="self-end">
                  <BotSystemsDiagram bot={focusRival} compact title={`Target: ${focusRival.config.name}`} />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {player?.flipped && !player.isDead && snapshot.phase === 'active' && (
        <div className="pointer-events-none fixed left-1/2 top-1/3 z-30 -translate-x-1/2 rounded-xl border border-fuchsia-400/80 bg-fuchsia-600/25 px-4 py-2 text-center text-sm font-extrabold tracking-wider text-fuchsia-100 shadow-xl">
          FLIPPED OVER · press Space (Boost) to self-right
        </div>
      )}
      {player && (player.frozenTimer ?? 0) > 0 && !player.isDead && (
        <div className="pointer-events-none fixed left-1/2 top-1/3 z-30 -translate-x-1/2 rounded-xl border border-cyan-300/80 bg-cyan-500/25 px-4 py-2 text-sm font-extrabold tracking-wider text-cyan-100 shadow-xl">
          FROZEN SOLID · thawing {(player.frozenTimer ?? 0).toFixed(1)}s
        </div>
      )}

      {/* Tactical Arena Mini-Radar */}
      {snapshot.phase === 'active' && (
        <ArenaMiniRadar
          snapshot={snapshot}
          playerId={playerId}
          minimized={minRadarTile}
          onToggleMinimize={() => setMinRadarTile((v) => !v)}
        />
      )}

      {/* First-Person Cockpit Visor Overlay */}
      {cameraPreset === 'first_person' && snapshot.phase === 'active' && player && !player.isDead && (
        <div className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center">
          {/* Subtle Cockpit Visor Corner Brackets */}
          <div className="absolute inset-x-8 top-16 bottom-12 border-x border-amber-500/15 rounded-3xl" />
          {/* Center Targeting Reticle */}
          <div className="relative flex items-center justify-center">
            <div className="h-12 w-12 rounded-full border border-amber-400/45" />
            <div className="absolute h-1.5 w-1.5 rounded-full bg-amber-400/80" />
            <div className="absolute -left-5 h-0.5 w-3 bg-amber-400/60" />
            <div className="absolute -right-5 h-0.5 w-3 bg-amber-400/60" />
            <div className="absolute -top-5 h-3 w-0.5 bg-amber-400/60" />
            <div className="absolute -bottom-5 h-3 w-0.5 bg-amber-400/60" />
          </div>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-lg border border-amber-500/35 bg-[#0D1014]/80 px-3 py-1 font-mono-tabular text-[10px] font-semibold text-amber-300">
            COCKPIT VISOR · SPD {Math.hypot(player.vx, player.vz).toFixed(1)} m/s · PRESS [V] FOR RC GLASS VIEW
          </div>
        </div>
      )}

      {/* Outside-the-Arena Elevated "Behind the Lexan Glass" RC Pilot Booth View Overlay */}
      {cameraPreset === 'pilot_booth' && snapshot.phase === 'active' && player && (
        <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between">
          {/* Unobstructed Panoramic Upper Lexan Polycarbonate Safety Glass Frame */}
          <div className="absolute inset-0 border-[10px] border-[#0E131B]/85 shadow-[inset_0_0_65px_rgba(14,165,233,0.12)]" />
          <div className="absolute inset-x-0 top-14 h-6 bg-gradient-to-b from-sky-400/10 to-transparent" />

          <div />

          {/* Interactive Ringside RC Transmitter Remote Controller in Pilot's Hands */}
          <div className="relative mx-auto mb-3 flex w-[340px] sm:w-[410px] flex-col items-center rounded-t-3xl border-2 border-slate-600/90 bg-gradient-to-b from-[#1A212D]/95 to-[#0D1118]/98 px-5 py-3 shadow-2xl">
            {/* Dual RC Antennae */}
            <div className="absolute -top-7 left-14 h-7 w-1.5 -rotate-12 rounded-t-full bg-slate-500" />
            <div className="absolute -top-7 right-14 h-7 w-1.5 rotate-12 rounded-t-full bg-slate-500" />

            <div className="flex w-full items-center justify-between text-[10px] font-mono-tabular text-sky-300">
              <span className="font-bold tracking-wider text-amber-400">AETHERIS RC-9000 PRO TX</span>
              <span>2.4GHz TELEMETRY LINK · ACTIVE</span>
            </div>

            <div className="mt-2 flex w-full items-center justify-between gap-4">
              {/* Left RC Gimbal Stick (Throttle / Drive) */}
              <div className="flex flex-col items-center">
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-slate-700 bg-[#0B0E14] shadow-inner">
                  <div className="h-9 w-9 rounded-full border border-slate-800" />
                  <div
                    className="h-6 w-6 rounded-full border-2 border-amber-300 bg-amber-500 shadow-lg transition-transform duration-75"
                    style={{
                      transform: `translate(${Math.max(-14, Math.min(14, -Math.sin(player.yaw) * 8))}px, ${Math.max(-14, Math.min(14, -Math.hypot(player.vx, player.vz) * 0.9))}px)`,
                    }}
                  />
                </div>
                <span className="mt-1 text-[9px] font-mono-tabular text-slate-400">DRIVE STICK</span>
              </div>

              {/* Center RC LCD Telemetry Screen */}
              <div className="flex flex-1 flex-col rounded-xl border border-sky-500/40 bg-[#07131D] px-3 py-2 font-mono-tabular text-[10px] text-sky-300">
                <div className="flex justify-between font-bold text-white">
                  <span className="truncate">{player.config.name}</span>
                  <span className="text-amber-400">{Math.round(player.hp)} HP</span>
                </div>
                <div className="mt-1 flex justify-between text-[9px]">
                  <span>SPD {Math.hypot(player.vx, player.vz).toFixed(1)} m/s</span>
                  <span className={player.isDrifting ? 'text-fuchsia-300 font-bold' : 'text-emerald-300'}>
                    {player.isDrifting ? 'DRIFTING' : 'GRIP OK'}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-1 pt-1 border-t border-sky-900/60 text-[9px]">
                  {[0, 1, 2].map((idx) => (
                    <span
                      key={idx}
                      className={`rounded px-1.5 py-0.5 font-bold ${
                        player.weaponActives?.[idx]
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-900 text-slate-400'
                      }`}
                    >
                      W{idx + 1}
                    </span>
                  ))}
                  <span
                    className={`rounded px-1.5 py-0.5 font-bold ${
                      player.isBoosting ? 'bg-sky-400 text-slate-950' : 'bg-slate-900 text-slate-400'
                    }`}
                  >
                    BST
                  </span>
                </div>
              </div>

              {/* Right RC Gimbal Stick (Steer / Drift / Weapons) */}
              <div className="flex flex-col items-center">
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-slate-700 bg-[#0B0E14] shadow-inner">
                  <div className="h-9 w-9 rounded-full border border-slate-800" />
                  <div
                    className={`h-6 w-6 rounded-full border-2 shadow-lg transition-transform duration-75 ${
                      player.weaponActive
                        ? 'border-red-300 bg-red-500'
                        : player.isDrifting
                          ? 'border-fuchsia-300 bg-fuchsia-500'
                          : 'border-sky-300 bg-sky-500'
                    }`}
                    style={{
                      transform: `translate(${player.isDrifting ? (player.vx > 0 ? 10 : -10) : 0}px, ${player.weaponActive ? -10 : 0}px)`,
                    }}
                  />
                </div>
                <span className="mt-1 text-[9px] font-mono-tabular text-slate-400">STEER / WPN</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Left-Side Vertical Desktop Combat Controls & Configurable Pad Tile */}
      {showKeyboardHint && snapshot.phase === 'active' && (
        <div className="pointer-events-none fixed left-3 sm:left-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2 w-56 sm:w-60">
          {minControlsTile ? (
            <button
              type="button"
              onClick={() => setMinControlsTile(false)}
              className="pointer-events-auto self-start flex items-center gap-2 rounded-xl border border-slate-700/80 bg-[#12161C]/92 px-3 py-2 text-xs font-bold text-amber-300 hover:border-amber-400 transition shadow-xl cursor-pointer"
              title="Expand Weapons & Controls Tile"
            >
              <Swords className="h-3.5 w-3.5" />
              <span>Controls & Weapons</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>
          ) : (
            <>
              {player && !player.isDead && (
                <div className="pointer-events-auto flex flex-col gap-1.5 rounded-2xl border border-slate-800/90 bg-[#12161C]/95 p-2.5 shadow-xl">
                  <div className="flex items-center justify-between px-1 pb-0.5 border-b border-slate-800/80">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-amber-300 font-bold">
                      Combat Controls Tile
                    </span>
                    <button
                      type="button"
                      onClick={() => setMinControlsTile(true)}
                      className="rounded bg-slate-800/90 px-1.5 py-0.5 text-[9px] font-mono text-slate-300 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                      title="Minimize Controls Tile"
                    >
                      <Minimize2 className="h-2.5 w-2.5" />
                      <span>Min</span>
                    </button>
                  </div>
                  {/* Control Scheme Quick Switcher (WASD Drive vs Arrows Drive vs Mouse Drive) */}
                  {onSelectControlScheme && (
                    <div className="mb-1 flex flex-col gap-1 rounded-xl border border-slate-800 bg-[#0D1014] p-1.5">
                  <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-slate-400 px-1">
                    <span>Controls</span>
                    <span className="text-amber-300">
                      {controlScheme === 'arrows_drive'
                        ? 'Arrows Drive · WASD Wpns'
                        : controlScheme === 'mouse_drive'
                          ? 'Mouse Drive + Clicks'
                          : 'WASD Drive · Arrows Wpns'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {(
                      [
                        { id: 'wasd_drive', label: 'WASD Drive' },
                        { id: 'arrows_drive', label: 'Arrows Drive' },
                        { id: 'mouse_drive', label: 'Mouse Drive' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onSelectControlScheme(opt.id)}
                        className={`rounded-lg py-1 text-[9px] font-extrabold transition ${
                          controlScheme === opt.id
                            ? 'bg-amber-500 text-slate-950 shadow'
                            : 'bg-[#161B22] text-slate-300 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Device Mode Quick Switcher (Desktop / Tablet / Mobile) */}
              {onSelectDeviceLayoutMode && (
                <div className="mb-1 grid grid-cols-3 gap-1 rounded-xl border border-slate-800 bg-[#0D1014] p-1">
                  {(
                    [
                      { id: 'desktop', label: 'Desktop' },
                      { id: 'tablet', label: 'Tablet' },
                      { id: 'mobile', label: 'Mobile' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onSelectDeviceLayoutMode(m.id)}
                      className={`rounded-lg py-1 text-[9px] font-bold transition ${
                        deviceLayoutMode === m.id
                          ? 'bg-sky-500 text-slate-950 font-extrabold'
                          : 'bg-[#161B22] text-slate-400 hover:text-white'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Camera Follow Speed / Sensitivity Slider */}
              {onChangeCameraSensitivity && (
                <div className="mb-1 rounded-xl border border-slate-800 bg-[#0D1014] px-2 py-1.5">
                  <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    <span>Cam Sensitivity</span>
                    <span className="font-mono-tabular text-amber-300">
                      {Math.round(cameraSensitivity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={1.8}
                    step={0.05}
                    value={cameraSensitivity}
                    onChange={(e) => onChangeCameraSensitivity(parseFloat(e.target.value))}
                    aria-label="Follow Camera Sensitivity"
                    className="mt-1 h-1.5 w-full accent-amber-500 cursor-pointer"
                  />
                </div>
              )}

              <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 px-0.5">
                <span>Weapons & Repair</span>
                <span className="font-mono-tabular text-amber-300">
                  PWR {Math.round((player.energy / Math.max(1, player.maxEnergy)) * 100)}%
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full transition-all duration-75 ${
                    player.weaponActive ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.max(0, (player.energy / Math.max(1, player.maxEnergy)) * 100)}%` }}
                />
              </div>

              {/* Equipped Weapon Buttons with Dynamic Control Scheme Badges */}
              {playerWeapons.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-[#0D1014]/80 px-2.5 py-2 text-[11px] text-slate-400">
                  No weapons mounted (0/3)
                </div>
              ) : (
                playerWeapons.map((wId, idx) => {
                  const spec = WEAPON_CATALOG[wId];
                  const active = Boolean(player.weaponActives?.[idx]);
                  const cd = player.weaponCooldowns?.[idx] ?? 0;
                  const ArrowIcon = idx === 0 ? ArrowLeft : idx === 1 ? ArrowUp : ArrowRight;
                  const keyLabel =
                    controlScheme === 'arrows_drive'
                      ? idx === 0
                        ? 'Key A'
                        : idx === 1
                          ? 'Key W'
                          : 'Key D'
                      : controlScheme === 'mouse_drive'
                        ? idx === 0
                          ? 'L-Click'
                          : idx === 1
                            ? 'R-Click'
                            : 'M-Click'
                        : idx === 0
                          ? 'Left'
                          : idx === 1
                            ? 'Up'
                            : 'Right';
                  return (
                    <button
                      key={`${wId}_${idx}`}
                      type="button"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        onWeaponTrigger?.(idx, true);
                      }}
                      onPointerUp={() => onWeaponTrigger?.(idx, false)}
                      onPointerLeave={() => onWeaponTrigger?.(idx, false)}
                      onPointerCancel={() => onWeaponTrigger?.(idx, false)}
                      className={`flex items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-xs font-bold shadow transition active:scale-95 ${
                        active
                          ? 'border-amber-300 bg-amber-500 text-slate-950'
                          : cd > 0.05
                            ? 'border-slate-700 bg-[#0D1014]/90 text-slate-400'
                            : 'border-amber-500/70 bg-[#0D1014]/92 text-amber-300 hover:border-amber-400'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Swords className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{spec.label}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {cd > 0.05 && (
                          <span className="font-mono-tabular text-[10px] opacity-80">{cd.toFixed(1)}s</span>
                        )}
                        <span
                          className={`flex items-center gap-0.5 font-mono-tabular rounded px-1.5 py-0.5 text-[10px] font-extrabold ${
                            active ? 'bg-slate-950/25 text-slate-950' : 'bg-slate-800 text-amber-300'
                          }`}
                        >
                          {controlScheme === 'wasd_drive' && <ArrowIcon className="h-3 w-3" />}
                          <span>{keyLabel}</span>
                        </span>
                      </div>
                    </button>
                  );
                })
              )}

              {/* Field Repair Button */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  onRepairTrigger?.(true);
                }}
                onPointerUp={() => onRepairTrigger?.(false)}
                onPointerLeave={() => onRepairTrigger?.(false)}
                onPointerCancel={() => onRepairTrigger?.(false)}
                className={`flex items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-xs font-bold shadow transition active:scale-95 ${
                  player.overdriveTimer > 0
                    ? 'border-sky-300 bg-sky-500 text-slate-950'
                    : player.energy >= 28
                      ? 'border-emerald-500/80 bg-[#0D1014]/92 text-emerald-300 hover:border-emerald-400'
                      : 'border-slate-800 bg-[#0D1014]/80 text-slate-500'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <ShieldPlus className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {player.overdriveTimer > 0 ? 'Repairing...' : 'Field Repair'}
                  </span>
                </div>
                <span
                  className={`flex items-center gap-0.5 font-mono-tabular rounded px-1.5 py-0.5 text-[10px] font-extrabold shrink-0 ${
                    player.overdriveTimer > 0
                      ? 'bg-slate-950/25 text-slate-950'
                      : 'bg-slate-800 text-emerald-300'
                  }`}
                >
                  {controlScheme === 'wasd_drive' && <ArrowDown className="h-3 w-3" />}
                  <span>{controlScheme === 'arrows_drive' ? 'Key S / F' : 'F / Down'}</span>
                </span>
              </button>

              {/* Interactive Visual Weapon & Repair Pad */}
              <div className="mt-1 rounded-xl border border-slate-800/90 bg-[#0D1014]/90 p-2">
                <div className="mb-1.5 flex items-center justify-between text-[10px] text-slate-400">
                  <span>
                    {controlScheme === 'arrows_drive'
                      ? 'WASD Weapon Pad'
                      : controlScheme === 'mouse_drive'
                        ? 'Mouse & Key Pad'
                        : 'Arrow Key Pad'}
                  </span>
                  <span className="font-mono-tabular text-[9px] text-slate-500">Click or Press</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <div />
                  {/* TOP BUTTON: Weapon #2 */}
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      if (playerWeapons[1]) onWeaponTrigger?.(1, true);
                    }}
                    onPointerUp={() => onWeaponTrigger?.(1, false)}
                    onPointerLeave={() => onWeaponTrigger?.(1, false)}
                    disabled={!playerWeapons[1]}
                    className={`flex flex-col items-center justify-center rounded-lg border py-1.5 text-[10px] font-bold transition ${
                      player.weaponActives?.[1]
                        ? 'border-amber-300 bg-amber-500 text-slate-950'
                        : playerWeapons[1]
                          ? 'border-amber-500/50 bg-[#161B22] text-amber-300 hover:border-amber-400'
                          : 'border-slate-800 bg-slate-900/50 text-slate-600'
                    }`}
                  >
                    {controlScheme === 'arrows_drive' ? (
                      <span className="font-mono-tabular text-xs font-extrabold">W</span>
                    ) : (
                      <ArrowUp className="h-3.5 w-3.5" />
                    )}
                    <span className="font-mono-tabular text-[9px] leading-tight mt-0.5">
                      {playerWeapons[1] ? 'WPN 2' : 'OFF'}
                    </span>
                  </button>
                  <div />

                  {/* LEFT BUTTON: Weapon #1 */}
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      if (playerWeapons[0]) onWeaponTrigger?.(0, true);
                    }}
                    onPointerUp={() => onWeaponTrigger?.(0, false)}
                    onPointerLeave={() => onWeaponTrigger?.(0, false)}
                    disabled={!playerWeapons[0]}
                    className={`flex flex-col items-center justify-center rounded-lg border py-1.5 text-[10px] font-bold transition ${
                      player.weaponActives?.[0]
                        ? 'border-amber-300 bg-amber-500 text-slate-950'
                        : playerWeapons[0]
                          ? 'border-amber-500/50 bg-[#161B22] text-amber-300 hover:border-amber-400'
                          : 'border-slate-800 bg-slate-900/50 text-slate-600'
                    }`}
                  >
                    {controlScheme === 'arrows_drive' ? (
                      <span className="font-mono-tabular text-xs font-extrabold">A</span>
                    ) : (
                      <ArrowLeft className="h-3.5 w-3.5" />
                    )}
                    <span className="font-mono-tabular text-[9px] leading-tight mt-0.5">
                      {playerWeapons[0] ? 'WPN 1' : 'OFF'}
                    </span>
                  </button>

                  {/* DOWN BUTTON: Field Repair */}
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      onRepairTrigger?.(true);
                    }}
                    onPointerUp={() => onRepairTrigger?.(false)}
                    onPointerLeave={() => onRepairTrigger?.(false)}
                    className={`flex flex-col items-center justify-center rounded-lg border py-1.5 text-[10px] font-bold transition ${
                      player.overdriveTimer > 0
                        ? 'border-sky-300 bg-sky-500 text-slate-950'
                        : player.energy >= 35
                          ? 'border-emerald-500/60 bg-[#14201C] text-emerald-300 hover:border-emerald-400'
                          : 'border-slate-800 bg-slate-900/60 text-slate-500'
                    }`}
                  >
                    {controlScheme === 'arrows_drive' ? (
                      <span className="font-mono-tabular text-xs font-extrabold">S</span>
                    ) : (
                      <ArrowDown className="h-3.5 w-3.5" />
                    )}
                    <span className="font-mono-tabular text-[9px] leading-tight mt-0.5">REPAIR</span>
                  </button>

                  {/* RIGHT BUTTON: Weapon #3 */}
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      if (playerWeapons[2]) onWeaponTrigger?.(2, true);
                    }}
                    onPointerUp={() => onWeaponTrigger?.(2, false)}
                    onPointerLeave={() => onWeaponTrigger?.(2, false)}
                    disabled={!playerWeapons[2]}
                    className={`flex flex-col items-center justify-center rounded-lg border py-1.5 text-[10px] font-bold transition ${
                      player.weaponActives?.[2]
                        ? 'border-amber-300 bg-amber-500 text-slate-950'
                        : playerWeapons[2]
                          ? 'border-amber-500/50 bg-[#161B22] text-amber-300 hover:border-amber-400'
                          : 'border-slate-800 bg-slate-900/50 text-slate-600'
                    }`}
                  >
                    {controlScheme === 'arrows_drive' ? (
                      <span className="font-mono-tabular text-xs font-extrabold">D</span>
                    ) : (
                      <ArrowRight className="h-3.5 w-3.5" />
                    )}
                    <span className="font-mono-tabular text-[9px] leading-tight mt-0.5">
                      {playerWeapons[2] ? 'WPN 3' : 'OFF'}
                    </span>
                  </button>
                </div>

                {/* Hold-to-Boost Space Bar with Live Refilling Boost Meter */}
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    onBoostTrigger?.(true);
                  }}
                  onPointerUp={() => onBoostTrigger?.(false)}
                  onPointerLeave={() => onBoostTrigger?.(false)}
                  className={`relative overflow-hidden mt-1.5 flex w-full flex-col gap-1 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold transition ${
                    player.isBoosting
                      ? 'border-amber-400 bg-amber-500/25 text-amber-200'
                      : (player.boostFuel ?? 100) > 5
                        ? 'border-sky-500/60 bg-[#121E2A] text-sky-300 hover:border-sky-400'
                        : 'border-slate-800 bg-slate-900/60 text-slate-500'
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Flame className="h-3 w-3" />
                      <span>{player.isBoosting ? 'BOOSTING!' : 'Hold Boost'}</span>
                    </span>
                    <span className="font-mono-tabular rounded bg-slate-900 px-1.5 py-0.5 text-[9px] text-sky-200">
                      SPACE · {Math.round(player.boostFuel ?? 100)}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-900 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-75 ${
                        player.isBoosting ? 'bg-amber-400' : 'bg-sky-400'
                      }`}
                      style={{
                        width: `${Math.max(0, ((player.boostFuel ?? 100) / Math.max(1, player.maxBoostFuel ?? 100)) * 100)}%`,
                      }}
                    />
                  </div>
                </button>

                {/* Hold-to-Drift Shift Button + Mini-Turbo Charge */}
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    onDriftTrigger?.(true);
                  }}
                  onPointerUp={() => onDriftTrigger?.(false)}
                  onPointerLeave={() => onDriftTrigger?.(false)}
                  className={`relative overflow-hidden mt-1.5 flex w-full flex-col gap-1 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold transition ${
                    player.isDrifting
                      ? 'border-fuchsia-400 bg-fuchsia-500/25 text-fuchsia-200'
                      : (player.driftBoostTimer ?? 0) > 0
                        ? 'border-cyan-400 bg-cyan-500/25 text-cyan-200'
                        : 'border-fuchsia-500/50 bg-[#1B1222] text-fuchsia-300 hover:border-fuchsia-400'
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span>
                      {player.isDrifting
                        ? 'DRIFTING! (Release for Turbo)'
                        : (player.driftBoostTimer ?? 0) > 0
                          ? 'MINI-TURBO ACTIVE!'
                          : 'Boost + Turn = Auto Drift'}
                    </span>
                    <span className="font-mono-tabular rounded bg-slate-900 px-1.5 py-0.5 text-[9px] text-fuchsia-200">
                      SHIFT / SPACE+TURN
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-900 overflow-hidden">
                    <div
                      className="h-full bg-fuchsia-400 transition-all duration-75"
                      style={{
                        width: `${Math.min(100, ((player.driftCharge ?? 0) / 1.1) * 100)}%`,
                      }}
                    />
                  </div>
                </button>
              </div>
            </div>
          )}

          <div className="hidden md:flex flex-col gap-1 rounded-2xl border border-slate-800/90 bg-[#12161C]/90 p-2.5 text-[11px] text-slate-300 shadow-lg backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Drive</span>
              <span className="font-mono-tabular font-semibold text-white">
                {controlScheme === 'arrows_drive'
                  ? 'Arrow Keys'
                  : controlScheme === 'mouse_drive'
                    ? 'Mouse Cursor + WASD'
                    : 'WASD'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Auto Drift</span>
              <span className="font-mono-tabular font-semibold text-fuchsia-300">
                Boost + Turn / Shift
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Weapons 1–3</span>
              <span className="font-mono-tabular font-semibold text-amber-300">
                {controlScheme === 'arrows_drive'
                  ? 'A · W · D / 1–3'
                  : controlScheme === 'mouse_drive'
                    ? 'L/R/M Click / ← ↑ →'
                    : '← ↑ → / Num 1–3'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Field Repair</span>
              <span className="font-mono-tabular font-semibold text-emerald-300">
                {controlScheme === 'arrows_drive' ? 'Key S / Key F' : '↓ Down / Key F'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Boost</span>
              <span className="font-mono-tabular font-semibold text-sky-300">Space</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Clean View</span>
              <span className="font-mono-tabular font-semibold text-emerald-300">Key H</span>
            </div>
          </div>
            </>
          )}
        </div>
      )}

      {/* Countdown Overlay */}
      {snapshot.phase === 'countdown' && (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center">
          <div className="rounded-2xl border border-amber-500/40 bg-[#0D1014]/90 px-8 py-5 text-center shadow-2xl">
            <div className="font-display text-5xl font-bold text-amber-400">
              {Math.max(1, Math.ceil(snapshot.countdown))}
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-300">
              {arenaSpec?.name || 'BattleBox'} · Systems Primed
            </div>
          </div>
        </div>
      )}

      {/* Post-Match Result Modal */}
      {snapshot.phase === 'finished' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#161B22] p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                  playerWon ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
                }`}
              >
                <Trophy className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-display text-2xl font-bold text-white">
                  {isSurvival
                    ? matchResult?.newRecord
                      ? 'New Survival Record'
                      : 'Survival Run Over'
                    : endedByRingOut
                      ? playerWon
                        ? 'Ring-Out Victory!'
                        : 'Knocked Out of the Ring!'
                      : endedByObjective
                        ? playerWon
                          ? 'Hill Secured'
                          : 'Hill Lost'
                        : endedByTime
                          ? playerWon
                            ? 'Judges Decision: Win'
                            : 'Judges Decision: Loss'
                          : playerWon
                            ? 'Knockout Victory'
                            : 'Chassis Knocked Out'}
                </h2>
                <p className="text-xs text-slate-400">
                  {isSurvival
                    ? `Waves cleared: ${matchResult?.wavesCleared ?? Math.max(0, (snapshot.survivalWave ?? 1) - 1)} · Kills: ${snapshot.survivalKills ?? 0}`
                    : `${
                        endedByRingOut
                          ? 'Out of the Ring (OOTA) · '
                          : endedByObjective
                            ? 'Objective · '
                            : endedByTime
                              ? 'Time Expired · '
                              : 'KO Finish · '
                      }Winner: ${winner ? `[${winner.clanTag}] ${winner.config.name}` : 'Draw'}`}
                </p>
                {campaignLevel && (
                  <p className="text-[11px] font-semibold text-amber-300 mt-0.5">Campaign · {campaignLevel.title}</p>
                )}
              </div>
            </div>

            {player && (
              <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-slate-800 bg-[#0D1014] p-3 text-center">
                <div>
                  <div className="text-[11px] text-slate-400">Damage Dealt</div>
                  <div className="font-mono-tabular text-lg font-bold text-white mt-0.5">
                    {Math.round(player.damageDealt)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Hits Landed</div>
                  <div className="font-mono-tabular text-lg font-bold text-amber-400 mt-0.5">
                    {player.hitsDealt}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">KOs</div>
                  <div className="font-mono-tabular text-lg font-bold text-emerald-400 mt-0.5">
                    {player.kos}
                  </div>
                </div>
              </div>
            )}

            {/* Campaign stars & rewards */}
            {matchResult && (
              <div className="mt-3 rounded-xl border border-slate-800 bg-[#0D1014] p-3">
                {matchResult.stars !== undefined && (
                  <>
                    <div className="flex justify-center gap-1.5">
                      {[0, 1, 2].map((i) => (
                        <Star
                          key={i}
                          className={`h-7 w-7 ${i < (matchResult.stars ?? 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-700'}`}
                        />
                      ))}
                    </div>
                    <ul className="mt-2 space-y-0.5 text-[11px]">
                      {(
                        matchResult.objectives ??
                        campaignLevel?.objectives.map((o) => ({ label: describeObjective(o), met: false })) ??
                        []
                      ).map((o, i) => (
                        <li key={i} className={o.met ? 'text-emerald-300' : 'text-slate-500'}>
                          {o.met ? '✓' : '✗'} {o.label}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs font-mono-tabular">
                  <span className="text-amber-300">+{matchResult.scrap} Scrap</span>
                  <span className="text-sky-300">+{matchResult.xp} XP</span>
                  {matchResult.skillPoints > 0 && <span className="text-emerald-300">+{matchResult.skillPoints} SP</span>}
                  {matchResult.pvp && (
                    <span className="text-sky-300">
                      {matchResult.pvp.ranked
                        ? `PvP ${matchResult.pvp.record.wins}W-${matchResult.pvp.record.losses}L · ${matchResult.pvp.record.rating}`
                        : 'Unranked (needs 2 real pilots)'}
                    </span>
                  )}
                  {matchResult.ratingDelta !== 0 && (
                    <span className={matchResult.ratingDelta > 0 ? 'text-emerald-300' : 'text-red-300'}>
                      {matchResult.ratingDelta > 0 ? '+' : ''}
                      {matchResult.ratingDelta} Rating
                    </span>
                  )}
                </div>
                {matchResult.unlocked && (
                  <div className="mt-2 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-2 py-1 text-center text-xs font-bold text-emerald-300">
                    Unlocked {describeUnlock(matchResult.unlocked)}
                  </div>
                )}
              </div>
            )}

            {/* Judges / Arena Scorecard */}
            <div className="mt-3 rounded-xl border border-slate-800 bg-[#0D1014] p-2.5 space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-1">
                {endedByTime ? "Judges' Scorecard" : 'Match Standings'}
              </div>
              {sortedStandings.map((b, idx) => {
                const hpPct = b.isDead ? 0 : Math.max(1, Math.round((b.hp / Math.max(1, b.maxHp)) * 100));
                return (
                  <div
                    key={b.id}
                    className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-xs ${
                      b.id === winner?.id ? 'bg-amber-500/12 text-amber-300' : 'text-slate-300'
                    }`}
                  >
                    <span className="truncate font-semibold">
                      #{idx + 1}{' '}
                      {isTeamMatch && (
                        <span className={b.team === playerTeam ? 'text-emerald-400' : 'text-red-400'}>● </span>
                      )}
                      [{b.clanTag}] {b.config.name}
                    </span>
                    <span className="font-mono-tabular text-[11px] shrink-0 text-slate-400">
                      {b.isDead ? 'KO' : `${hpPct}% HP`} · {Math.round(b.damageDealt)} DMG
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Campaign Auto-Advance & Post-Match Actions */}
            {campaignLevel && (matchResult?.won ?? playerWon) && nextCampaignLevel && onNextCampaignLevel && (
              <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 flex items-center justify-between gap-2">
                <div className="text-xs text-emerald-200">
                  {autoNextEnabled && autoNextCountdown !== null ? (
                    <>
                      Auto-starting <span className="font-bold text-white">{nextCampaignLevel.title}</span> in{' '}
                      <span className="font-mono-tabular font-bold text-amber-300">{autoNextCountdown}s</span>
                    </>
                  ) : (
                    <>
                      Next Stage Ready: <span className="font-bold text-white">{nextCampaignLevel.title}</span>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setAutoNextEnabled((prev) => !prev)}
                  className="shrink-0 rounded-lg border border-emerald-400/40 bg-slate-900/80 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-slate-800 transition"
                >
                  {autoNextEnabled ? 'Pause Auto' : 'Auto-Next'}
                </button>
              </div>
            )}

            <div className="mt-4 space-y-2.5">
              {campaignLevel && (matchResult?.won ?? playerWon) && nextCampaignLevel && onNextCampaignLevel && (
                <button
                  type="button"
                  onClick={() => {
                    setAutoNextEnabled(false);
                    onNextCampaignLevel(nextCampaignLevel.id);
                  }}
                  className="w-full flex items-center justify-center gap-2 min-h-[46px] rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 transition"
                >
                  <Swords className="h-4 w-4" />
                  Next Fight: {nextCampaignLevel.title}
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setAutoNextEnabled(false);
                  if (onGoToGarageUpgrades) {
                    onGoToGarageUpgrades();
                  } else {
                    onExitArena();
                  }
                }}
                className="w-full flex items-center justify-center gap-2 min-h-[44px] rounded-xl border border-amber-500/50 bg-amber-500/15 px-4 py-2.5 text-sm font-bold text-amber-300 hover:bg-amber-500/25 transition"
              >
                <Wrench className="h-4 w-4" />
                Garage: Repairs &amp; Upgrades
              </button>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setAutoNextEnabled(false);
                    onExitArena();
                  }}
                  className="flex-1 min-h-[42px] rounded-xl border border-slate-700 bg-[#1A2029] px-3 py-2 text-xs sm:text-sm font-semibold text-slate-200 hover:bg-slate-800 transition"
                >
                  {campaignLevel ? 'Campaign Map' : 'Return to Hangar'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAutoNextEnabled(false);
                    onRematch();
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 min-h-[42px] rounded-xl bg-amber-500 px-3 py-2 text-xs sm:text-sm font-bold text-slate-950 hover:bg-amber-400 transition"
                >
                  <RotateCcw className="h-4 w-4" />
                  {campaignLevel ? 'Retry Level' : 'Fight Again'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
