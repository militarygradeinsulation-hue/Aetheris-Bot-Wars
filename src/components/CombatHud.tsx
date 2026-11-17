import React from 'react';
import { Camera, Crown, LogOut, Volume2, VolumeX, Trophy, RotateCcw, Star, Swords, Zap } from 'lucide-react';
import { getCampaignLevel, describeObjective, describeUnlock } from '../shared/campaign';
import {
  ARENA_EVENT_INFO,
  getBotWeapons,
  MATCH_MODIFIERS,
  WEAPON_CATALOG,
  type ArenaSnapshot,
  type BotPhysicsState,
} from '../shared/types';

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
}

const TEAM_COLORS = ['#34D399', '#F87171', '#60A5FA', '#FBBF24', '#C084FC', '#F472B6'];

interface CombatHudProps {
  matchResult?: MatchResultSummary | null;
  campaignLevelId?: string | null;
  snapshot: ArenaSnapshot;
  playerId: string;
  cameraPreset: 'chase' | 'tactical' | 'cinematic';
  muted: boolean;
  isMultiplayer: boolean;
  onCycleCamera: () => void;
  onToggleMute: () => void;
  onExitArena: () => void;
  onRematch: () => void;
  onWeaponTrigger?: (slotIdx: number, pressed: boolean) => void;
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

export const CombatHud: React.FC<CombatHudProps> = ({
  snapshot,
  playerId,
  matchResult,
  campaignLevelId,
  cameraPreset,
  muted,
  isMultiplayer,
  onCycleCamera,
  onToggleMute,
  onExitArena,
  onRematch,
  onWeaponTrigger,
  showKeyboardHint,
}) => {
  const player = snapshot.bots.find((b) => b.id === playerId) || snapshot.bots[0];
  const rivals = snapshot.bots.filter((b) => b.id !== player?.id);
  const playerTeam = player?.team ?? 0;
  const allies = rivals.filter((b) => b.team === playerTeam);
  const enemies = rivals.filter((b) => b.team !== playerTeam);
  const isTeamMatch = allies.length > 0 || snapshot.mode === 'team_2v2' || snapshot.mode === 'team_3v3' || snapshot.mode === 'boss_raid' || snapshot.mode === 'king_hill';
  const campaignLevel = campaignLevelId ? getCampaignLevel(campaignLevelId) : undefined;
  const arenaEvent = snapshot.arenaEvent;
  const hill = snapshot.hill;
  const isSurvival = snapshot.mode === 'survival';
  const untimed = snapshot.mode === 'practice' || isSurvival;
  const stunned = (player?.stunTimer ?? 0) > 0;
  const pinned = (player?.pinnedTimer ?? 0) > 0;
  const playerWeapons = player ? getBotWeapons(player.config) : [];

  const secs = Math.ceil(snapshot.timeRemaining);
  const mins = Math.floor(secs / 60);
  const remSecs = String(secs % 60).padStart(2, '0');
  const totalDur = snapshot.durationSeconds || 180;
  const timePct = Math.max(0, Math.min(100, (snapshot.timeRemaining / totalDur) * 100));
  const isFinalWarning = !untimed && snapshot.phase === 'active' && secs <= 20 && secs > 10;
  const isFinalTen = !untimed && snapshot.phase === 'active' && secs <= 10;

  const escalationStage = snapshot.escalationStage ?? 1;
  const boltWarning = snapshot.hazards.some((h) => h.kind === 'lightning' && h.warning);
  const pitOpen = snapshot.hazards.some((h) => h.kind === 'pit' && h.active);
  const magnetActive = snapshot.hazards.some((h) => h.kind === 'magnet_crane' && h.active);
  const crusherWarning = snapshot.hazards.some((h) => h.kind === 'crusher' && h.warning);
  const crusherActive = snapshot.hazards.some((h) => h.kind === 'crusher' && h.active);
  const bladeWarning = snapshot.hazards.some((h) => h.kind === 'spinner_blade' && h.warning);
  const bladeActive = snapshot.hazards.some((h) => h.kind === 'spinner_blade' && h.active);

  const hazardAlertText = magnetActive
    ? 'Magnet Crane Engaged'
    : boltWarning
      ? 'Lightning Incoming'
      : crusherActive
    ? 'Crusher Impact'
    : crusherWarning
      ? 'Crusher Warning'
      : bladeActive
        ? 'Floor Blades Active'
        : bladeWarning
          ? 'Floor Blades Arming'
          : pitOpen
            ? 'Drop Pits Open'
            : escalationStage >= 3
            ? 'Hazard Tier 3 · All Traps'
            : escalationStage === 2
              ? 'Hazard Tier 2 · Crushers'
              : 'Hazard Tier 1';

  const hazardAlertTone =
    crusherActive || bladeActive || magnetActive
      ? 'border-red-500/70 bg-[#1B1214]/95 text-red-300'
      : crusherWarning || bladeWarning || boltWarning || pitOpen
        ? 'border-amber-500/70 bg-[#1C1710]/95 text-amber-300'
        : 'border-slate-700/80 bg-[#12161C]/90 text-slate-300';

  const winner = snapshot.winnerId ? snapshot.bots.find((b) => b.id === snapshot.winnerId) : null;
  const playerWon =
    matchResult?.won ??
    (snapshot.winnerTeam !== undefined && snapshot.winnerTeam !== null
      ? snapshot.winnerTeam === playerTeam
      : winner?.id === player?.id);
  const endedByTime = snapshot.finishReason === 'time';
  const endedByObjective = snapshot.finishReason === 'objective';
  const sortedStandings = [...snapshot.bots].sort((a, b) => {
    if (a.isDead !== b.isDead) return a.isDead ? 1 : -1;
    const scoreA = (a.hp / Math.max(1, a.maxHp)) * 100 + a.damageDealt * 0.16 + a.kos * 30;
    const scoreB = (b.hp / Math.max(1, b.maxHp)) * 100 + b.damageDealt * 0.16 + b.kos * 30;
    return scoreB - scoreA;
  });

  return (
    <>
      {/* Top Compact Combat Telemetry Bar */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3 sm:px-6 pt-safe">
        {/* Player Status */}
        {player && (
          <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-slate-700/80 bg-[#12161C]/90 px-3 py-2 min-w-[168px] sm:min-w-[248px]">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-bold text-white truncate">{player.config.name}</span>
                <span className="font-mono-tabular text-amber-400 font-semibold shrink-0">
                  {Math.max(0, Math.round(player.hp))}/{player.maxHp}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 truncate">
                <span>{player.weightClass}</span>
                {stunned && <span className="rounded bg-sky-500/25 px-1 font-bold text-sky-300">STUNNED</span>}
                {pinned && <span className="rounded bg-orange-500/25 px-1 font-bold text-orange-300">PINNED</span>}
                {player.isBounty && <span className="rounded bg-yellow-500/25 px-1 font-bold text-yellow-300">BOUNTY</span>}
                {player.burnTimer > 0 && <span className="rounded bg-red-500/25 px-1 font-bold text-red-300">BURNING</span>}
                {(player.shieldFlash ?? 0) > 0 && <span className="rounded bg-violet-500/25 px-1 font-bold text-violet-300">SHIELD</span>}
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-100"
                  style={{ width: `${Math.max(0, (player.hp / player.maxHp) * 100)}%` }}
                />
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-sky-400 transition-all duration-100"
                  style={{ width: `${Math.max(0, (player.energy / player.maxEnergy) * 100)}%` }}
                />
              </div>
            </div>
            <ArmorMiniIndicator bot={player} />
          </div>
        )}

        {/* Center Match Timer + Controls + Timed Hazard Escalation */}
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
                    : isSurvival
                      ? `${snapshot.survivalKills ?? 0} kills`
                      : snapshot.mode === 'practice'
                        ? 'Test Range'
                        : campaignLevel
                          ? campaignLevel.title
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
              title={`Camera: ${cameraPreset}`}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1A2029] text-slate-200 hover:text-amber-400 transition"
            >
              <Camera className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              title={muted ? 'Unmute audio' : 'Mute audio'}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1A2029] text-slate-200 hover:text-amber-400 transition"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onExitArena}
              title="Exit match"
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition"
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
            <div className="flex items-center gap-1.5 rounded-lg border border-fuchsia-500/70 bg-[#1A1220]/95 px-2.5 py-1 text-[11px] font-bold text-fuchsia-200 whitespace-nowrap animate-pulse">
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
                  {hill.contested ? 'CONTESTED' : hill.owner === null ? 'Hill Neutral' : hill.owner === playerTeam ? 'Your Team Holds' : 'Enemy Holds'}
                </span>
                <span className="font-mono-tabular text-yellow-300/80">moves {Math.ceil(hill.moveTimer)}s</span>
              </div>
              {[playerTeam, ...snapshot.bots.map((b) => b.team).filter((t) => t !== playerTeam)]
                .filter((t, i, arr) => arr.indexOf(t) === i)
                .slice(0, 3)
                .map((t) => (
                  <div key={t} className="mt-1 flex items-center gap-1.5">
                    <span className="w-9 text-[9px] font-bold" style={{ color: t === playerTeam ? TEAM_COLORS[0] : TEAM_COLORS[1] }}>
                      {t === playerTeam ? 'YOU' : 'ENMY'}
                    </span>
                    <div className="h-1.5 flex-1 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full transition-all duration-200"
                        style={{
                          width: `${Math.min(100, ((hill.scores[t] ?? 0) / hill.target) * 100)}%`,
                          backgroundColor: t === playerTeam ? TEAM_COLORS[0] : TEAM_COLORS[1],
                        }}
                      />
                    </div>
                    <span className="w-6 text-right font-mono-tabular text-[9px] text-slate-300">{Math.floor(hill.scores[t] ?? 0)}</span>
                  </div>
                ))}
            </div>
          )}

          {snapshot.phase !== 'finished' && (snapshot.modifiers?.length ?? 0) > 0 && (
            <div className="hidden sm:flex flex-wrap justify-center gap-1 max-w-[320px]">
              {snapshot.modifiers!.map((m) => (
                <span key={m} className="rounded border border-fuchsia-500/40 bg-[#160F1A]/85 px-1.5 py-0.5 text-[9px] font-semibold text-fuchsia-300">
                  {MATCH_MODIFIERS[m].label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Allies & Rivals Status */}
        <div className="pointer-events-auto hidden sm:flex flex-col gap-1.5 min-w-[215px] max-h-[70vh] overflow-y-auto">
          {[...allies, ...enemies].map((r) => {
            const isAlly = r.team === playerTeam;
            return (
              <div
                key={r.id}
                className={`rounded-xl border px-3 py-1.5 bg-[#12161C]/90 ${
                  r.isDead
                    ? 'border-slate-800 opacity-55'
                    : r.isBoss
                      ? 'border-red-500/70'
                      : isAlly
                        ? 'border-emerald-500/50'
                        : 'border-slate-700/80'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-100 truncate">
                    {isTeamMatch && (
                      <span className={`mr-1 text-[9px] font-bold ${isAlly ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isAlly ? 'ALLY' : r.isBoss ? 'BOSS' : 'FOE'}
                      </span>
                    )}
                    [{r.clanTag}] {r.config.name}
                  </span>
                  <span className={`font-mono-tabular font-semibold shrink-0 ${isAlly ? 'text-emerald-400' : 'text-red-400'}`}>
                    {r.isDead ? 'KO' : `${Math.round(r.hp)}/${r.maxHp}`}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono-tabular">
                  <span>Lv {r.botLevel} · {r.weightClass}</span>
                  {r.isBounty && <span className="font-sans font-bold text-yellow-300">BOUNTY</span>}
                  {(r.stunTimer ?? 0) > 0 && <span className="font-sans font-bold text-sky-300">STUN</span>}
                </div>
                <div className={`mt-1 w-full rounded-full bg-slate-800 overflow-hidden ${r.isBoss ? 'h-2.5' : 'h-1.5'}`}>
                  <div
                    className={`h-full transition-all duration-100 ${isAlly ? 'bg-emerald-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.max(0, (r.hp / r.maxHp) * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile boss bar */}
      {enemies.some((e) => e.isBoss && !e.isDead) && (
        <div className="pointer-events-none fixed inset-x-3 top-[86px] z-20 sm:hidden">
          {enemies
            .filter((e) => e.isBoss && !e.isDead)
            .map((e) => (
              <div key={e.id} className="rounded-lg border border-red-500/60 bg-[#12161C]/90 px-2 py-1">
                <div className="flex justify-between text-[10px] font-bold text-red-300">
                  <span>{e.config.name}</span>
                  <span className="font-mono-tabular">{Math.round(e.hp)}</span>
                </div>
                <div className="mt-0.5 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-red-500" style={{ width: `${(e.hp / e.maxHp) * 100}%` }} />
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Dedicated Desktop Weapon Action Bar (1 individual clickable/holdable button per weapon) */}
      {showKeyboardHint && snapshot.phase === 'active' && player && !player.isDead && (
        <div className="pointer-events-none fixed bottom-12 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
          {playerWeapons.map((wId, idx) => {
            const spec = WEAPON_CATALOG[wId];
            const active = Boolean(player.weaponActives?.[idx]);
            const cd = player.weaponCooldowns?.[idx] ?? 0;
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
                className={`pointer-events-auto flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold shadow-lg transition active:scale-95 ${
                  active
                    ? 'border-amber-300 bg-amber-500 text-slate-950'
                    : cd > 0.05
                      ? 'border-slate-700 bg-[#12161C]/90 text-slate-400'
                      : 'border-amber-500/70 bg-[#12161C]/92 text-amber-300 hover:border-amber-400'
                }`}
              >
                <span
                  className={`font-mono-tabular rounded px-1.5 py-0.5 text-[10px] ${
                    active ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-200'
                  }`}
                >
                  {idx === 0 ? '1 / Space' : `${idx + 1}`}
                </span>
                <Swords className="h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-nowrap">{spec.label}</span>
                {cd > 0.05 && (
                  <span className="font-mono-tabular text-[10px] opacity-80">{cd.toFixed(1)}s</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Desktop Keyboard Hint Strip */}
      {showKeyboardHint && snapshot.phase === 'active' && (
        <div className="pointer-events-none fixed bottom-3 left-1/2 -translate-x-1/2 z-20 hidden md:flex items-center gap-3 rounded-xl border border-slate-800 bg-[#12161C]/88 px-4 py-1.5 text-[11px] text-slate-300">
          <span>Drive: WASD / Arrows</span>
          <span aria-hidden="true">·</span>
          <span>Weapons: 1 / 2 / 3 (Space = #1)</span>
          <span aria-hidden="true">·</span>
          <span>Boost: Shift</span>
          <span aria-hidden="true">·</span>
          <span>Repair Overdrive: E</span>
        </div>
      )}

      {/* Countdown Overlay */}
      {snapshot.phase === 'countdown' && (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center">
          <div className="rounded-2xl border border-amber-500/40 bg-[#0D1014]/90 px-8 py-5 text-center shadow-2xl">
            <div className="font-display text-5xl font-bold text-amber-400">
              {Math.max(1, Math.ceil(snapshot.countdown))}
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-300">Systems Primed</div>
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
                    : endedByObjective
                      ? playerWon
                        ? 'Hill Secured'
                        : 'Hill Lost'
                      : endedByTime
                        ? playerWon
                          ? 'Judges Decision: Win'
                          : 'Judges Decision: Loss'
                        : playerWon
                          ? isTeamMatch
                            ? 'Team Victory'
                            : 'Knockout Victory'
                          : isTeamMatch
                            ? 'Team Defeated'
                            : 'Chassis Knocked Out'}
                </h2>
                <p className="text-xs text-slate-400">
                  {isSurvival
                    ? `Waves cleared: ${matchResult?.wavesCleared ?? Math.max(0, (snapshot.survivalWave ?? 1) - 1)} · Kills: ${snapshot.survivalKills ?? 0}`
                    : `${endedByObjective ? 'Objective · ' : endedByTime ? 'Time Expired · ' : 'KO Finish · '}Winner: ${
                        winner ? `${winner.config.name} (${winner.name})` : 'Draw'
                      }`}
                </p>
                {campaignLevel && <p className="text-[11px] font-semibold text-amber-300 mt-0.5">Campaign · {campaignLevel.title}</p>}
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
                      {(matchResult.objectives ?? campaignLevel?.objectives.map((o) => ({ label: describeObjective(o), met: false })) ?? []).map((o, i) => (
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
                  {matchResult.ratingDelta !== 0 && (
                    <span className={matchResult.ratingDelta > 0 ? 'text-emerald-300' : 'text-red-300'}>
                      {matchResult.ratingDelta > 0 ? '+' : ''}
                      {matchResult.ratingDelta} Rating
                    </span>
                  )}
                </div>
                {matchResult.unlocked && (
                  <div className="mt-2 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-2 py-1 text-center text-xs font-bold text-emerald-300">
                    Unlocked: {describeUnlock(matchResult.unlocked)}
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
                        <span className={b.team === playerTeam ? 'text-emerald-400' : 'text-red-400'}>
                          {b.team === playerTeam ? '● ' : '● '}
                        </span>
                      )}
                      {b.config.name}
                    </span>
                    <span className="font-mono-tabular text-[11px] shrink-0 text-slate-400">
                      {b.isDead ? 'KO' : `${hpPct}% HP`} · {Math.round(b.damageDealt)} DMG
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={onExitArena}
                className="flex-1 min-h-[44px] rounded-xl border border-slate-700 bg-[#1A2029] px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition"
              >
                Return to Hangar
              </button>
              <button
                type="button"
                onClick={onRematch}
                className="flex-1 flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400 transition"
              >
                <RotateCcw className="h-4 w-4" />
                {campaignLevel ? 'Retry Level' : 'Fight Again'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
