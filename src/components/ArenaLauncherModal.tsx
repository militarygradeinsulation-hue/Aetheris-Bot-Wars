import React from 'react';
import {
  Clock,
  Flame,
  Globe,
  ShieldAlert,
  Skull,
  Swords,
  Target,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import { AI_RIVAL_PRESETS } from '../shared/physicsEngine';
import {
  ARENA_CATALOG,
  TIMED_BATTLE_OPTIONS,
  type ArenaId,
  type BotConfig,
  type TimedBattleDuration,
} from '../shared/types';

export type RivalTier = 'mixed' | 'lightweight' | 'middleweight' | 'heavyweight' | 'titan';
export type LocalLaunchMode =
  | 'duel_1v1'
  | 'brawl_4bot'
  | 'team_2v2'
  | 'boss_raid'
  | 'gauntlet'
  | 'practice';

interface ArenaLauncherModalProps {
  open: boolean;
  isOnline: boolean;
  selectedArena: ArenaId;
  selectedRivalTier: RivalTier;
  selectedDuration: TimedBattleDuration;
  selectedWingmanIndex: number;
  savedLoadouts?: BotConfig[];
  gauntletStage: number;
  lobbyRoom: {
    id: string;
    mode: string;
    playerCount: number;
    maxPlayers: number;
    players: Array<{ id: string; name: string; clanTag: string; botName: string }>;
  } | null;
  onSelectArena: (id: ArenaId) => void;
  onSelectRivalTier: (tier: RivalTier) => void;
  onSelectDuration: (seconds: TimedBattleDuration) => void;
  onSelectWingman: (idx: number) => void;
  onStartOffline: (mode: LocalLaunchMode) => void;
  onFindOnlineMatch: (mode: 'duel_1v1' | 'brawl_4bot') => void;
  onStartOnlineNow: () => void;
  onCancelLobby: () => void;
  onClose: () => void;
}

const RIVAL_TIERS: Array<{ id: RivalTier; label: string; note: string }> = [
  { id: 'mixed', label: 'Mixed Levels', note: 'Varied classes' },
  { id: 'lightweight', label: 'Lv 1–2 Light', note: 'Fast · Nimble' },
  { id: 'middleweight', label: 'Lv 3 Mid', note: 'Balanced' },
  { id: 'heavyweight', label: 'Lv 4 Heavy', note: 'Armored Siege' },
  { id: 'titan', label: 'Lv 5 Titan', note: 'Colossus Boss' },
];

export const ArenaLauncherModal: React.FC<ArenaLauncherModalProps> = ({
  open,
  isOnline,
  selectedArena,
  selectedRivalTier,
  selectedDuration,
  selectedWingmanIndex,
  savedLoadouts,
  gauntletStage,
  lobbyRoom,
  onSelectArena,
  onSelectRivalTier,
  onSelectDuration,
  onSelectWingman,
  onStartOffline,
  onFindOnlineMatch,
  onStartOnlineNow,
  onCancelLobby,
  onClose,
}) => {
  if (!open) return null;

  const bay2Bot = savedLoadouts?.[1];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 bg-[#141920] p-4 sm:p-6 shadow-2xl my-auto">
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3.5">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-white">
              Deploy to BattleBox Arena
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              8 destructible arenas, 2v2 Tag-Team Clash, Titan Boss Raids, and Gauntlet Career
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-[#1B212B] text-slate-300 hover:text-white transition"
            aria-label="Close arena launcher"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Waiting Multiplayer Lobby View */}
        {lobbyRoom ? (
          <div className="mt-5 rounded-xl border border-amber-500/40 bg-[#0D1014] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-bold text-amber-400">Multiplayer Arena Room Ready</div>
                <div className="text-xs text-slate-400 mt-0.5 font-mono-tabular">
                  {lobbyRoom.playerCount} / {lobbyRoom.maxPlayers} Pilots Connected · Room {lobbyRoom.id.slice(-6)}
                </div>
              </div>
              <button
                type="button"
                onClick={onCancelLobby}
                className="rounded-lg border border-slate-700 px-3 py-2 min-h-[40px] text-xs font-semibold text-slate-300 hover:text-white"
              >
                Leave Queue
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {lobbyRoom.players.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#161B22] px-3 py-2 text-xs"
                >
                  <span className="font-semibold text-white">
                    [{p.clanTag}] {p.name}
                  </span>
                  <span className="text-slate-400">{p.botName}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-400">
                Waiting for human challengers, or deploy immediately with server-authoritative sparring rivals.
              </p>
              <button
                type="button"
                onClick={onStartOnlineNow}
                className="rounded-xl bg-amber-500 px-5 py-2.5 min-h-[44px] text-xs font-bold text-slate-950 hover:bg-amber-400 transition whitespace-nowrap"
              >
                Launch Match Now
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* 8 Arena Stage Picker */}
            <div className="mt-4">
              <div className="text-xs font-semibold text-slate-300 mb-2">
                Select Combat Arena ({Object.keys(ARENA_CATALOG).length} BattleBoxes)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                {(Object.keys(ARENA_CATALOG) as ArenaId[]).map((aId) => {
                  const a = ARENA_CATALOG[aId];
                  const active = selectedArena === aId;
                  return (
                    <button
                      key={aId}
                      type="button"
                      onClick={() => onSelectArena(aId)}
                      className={`text-left rounded-xl border p-2.5 transition ${
                        active
                          ? 'border-amber-500 bg-amber-500/12'
                          : 'border-slate-800 bg-[#192029] hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-xs font-bold text-white truncate">{a.name}</span>
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: a.accentHex }}
                        />
                      </div>
                      <div
                        className="mt-0.5 text-[10px] font-semibold truncate"
                        style={{ color: a.accentHex }}
                      >
                        {a.hazardTag}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400 line-clamp-2 leading-snug">
                        {a.subtitle}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Timed Battle Clock + Wingman Selector Row */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-amber-400" />
                    Timed Battle Clock
                  </span>
                  <span className="text-[10px] font-normal text-slate-400">
                    KO or Judges Score
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {TIMED_BATTLE_OPTIONS.map((opt) => {
                    const active = selectedDuration === opt.seconds;
                    return (
                      <button
                        key={opt.seconds}
                        type="button"
                        onClick={() => onSelectDuration(opt.seconds)}
                        className={`rounded-lg border px-2 py-1.5 text-center transition ${
                          active
                            ? 'border-amber-500 bg-amber-500/15'
                            : 'border-slate-800 bg-[#0D1014] hover:border-slate-600'
                        }`}
                      >
                        <div className="font-mono-tabular text-xs font-bold text-white">{opt.label}</div>
                        <div className="text-[10px] text-slate-400">{opt.tag}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Wingman Selector for 2v2 & Boss Raid */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-emerald-400" />
                    2v2 & Raid Wingman Ally
                  </span>
                  <span className="text-[10px] font-normal text-emerald-400">
                    Fights on your team
                  </span>
                </div>
                <select
                  value={selectedWingmanIndex}
                  onChange={(e) => onSelectWingman(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-700 bg-[#0D1014] px-3 py-2 text-xs font-semibold text-white focus:border-amber-500 focus:outline-none"
                >
                  {bay2Bot && (
                    <option value={-1}>
                      ★ Garage Bay #2 Custom Bot: {bay2Bot.name} ({bay2Bot.weapon.toUpperCase()})
                    </option>
                  )}
                  {AI_RIVAL_PRESETS.map((p, idx) => (
                    <option key={p.name} value={idx}>
                      [{p.clanTag}] {p.name} · {p.roleTag} ({p.weightClass})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Offline Single-Player & Team Modes */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
                <span>Rival Weight Class & Combat Modes</span>
                <span className="text-[11px] text-slate-400">Instant 60fps local physics</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 mb-3">
                {RIVAL_TIERS.map((tier) => {
                  const active = selectedRivalTier === tier.id;
                  return (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => onSelectRivalTier(tier.id)}
                      className={`rounded-lg border px-2.5 py-1.5 text-left transition ${
                        active
                          ? 'border-amber-500 bg-amber-500/15'
                          : 'border-slate-800 bg-[#0D1014] hover:border-slate-600'
                      }`}
                    >
                      <div className="text-[11px] font-bold text-white truncate">{tier.label}</div>
                      <div className="text-[10px] text-slate-400 truncate">{tier.note}</div>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => onStartOffline('gauntlet')}
                  className="flex flex-col justify-between rounded-xl border border-slate-700 bg-[#192029] p-3 text-left hover:border-emerald-400 transition"
                >
                  <div className="flex items-center justify-between">
                    <ShieldAlert className="h-5 w-5 text-emerald-400" />
                    <span className="font-mono-tabular text-xs font-bold text-emerald-400">
                      Stage {gauntletStage}
                    </span>
                  </div>
                  <div className="mt-2">
                    <div className="text-sm font-bold text-white">Gauntlet Career</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      8-arena ladder & Titan bosses
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onStartOffline('team_2v2')}
                  className="flex flex-col justify-between rounded-xl border border-emerald-500/40 bg-[#14221E] p-3 text-left hover:border-emerald-400 transition"
                >
                  <div className="flex items-center justify-between">
                    <Users className="h-5 w-5 text-emerald-400" />
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                      NEW · TEAM
                    </span>
                  </div>
                  <div className="mt-2">
                    <div className="text-sm font-bold text-white">2v2 Team Clash</div>
                    <div className="text-[11px] text-slate-300 mt-0.5">
                      You + Wingman vs 2 Rivals
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onStartOffline('boss_raid')}
                  className="flex flex-col justify-between rounded-xl border border-purple-500/40 bg-[#1D1528] p-3 text-left hover:border-purple-400 transition"
                >
                  <div className="flex items-center justify-between">
                    <Skull className="h-5 w-5 text-purple-400" />
                    <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-bold text-purple-300">
                      BOSS RAID
                    </span>
                  </div>
                  <div className="mt-2">
                    <div className="text-sm font-bold text-white">Titan Boss Raid</div>
                    <div className="text-[11px] text-slate-300 mt-0.5">
                      2v1 Squad vs Omega Colossus
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onStartOffline('duel_1v1')}
                  className="flex flex-col justify-between rounded-xl border border-slate-700 bg-[#192029] p-3 text-left hover:border-amber-400 transition"
                >
                  <Target className="h-5 w-5 text-rose-400" />
                  <div className="mt-2">
                    <div className="text-sm font-bold text-white">1v1 Duel</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Head-to-head showdown</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onStartOffline('brawl_4bot')}
                  className="flex flex-col justify-between rounded-xl border border-slate-700 bg-[#192029] p-3 text-left hover:border-amber-400 transition"
                >
                  <Swords className="h-5 w-5 text-amber-400" />
                  <div className="mt-2">
                    <div className="text-sm font-bold text-white">4-Bot Free-For-All</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Every bot for itself</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onStartOffline('practice')}
                  className="flex flex-col justify-between rounded-xl border border-slate-700 bg-[#192029] p-3 text-left hover:border-sky-400 transition"
                >
                  <Flame className="h-5 w-5 text-sky-400" />
                  <div className="mt-2">
                    <div className="text-sm font-bold text-white">Test Range</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Free drive & weapon lab</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Online Multiplayer Section */}
            <div className="mt-4 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
                <span>Real-Time Multiplayer (WebSocket Server)</span>
                {!isOnline && (
                  <span className="flex items-center gap-1 text-amber-400">
                    <WifiOff className="h-3.5 w-3.5" /> Offline Mode
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={!isOnline}
                  onClick={() => onFindOnlineMatch('duel_1v1')}
                  className="flex items-center gap-3 rounded-xl border border-slate-700 bg-[#192029] p-3 text-left hover:border-amber-500 disabled:opacity-45 transition"
                >
                  <Globe className="h-5 w-5 text-amber-400 shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-white">Online 1v1 Duel</div>
                    <div className="text-xs text-slate-400">Ranked WebSocket arena match</div>
                  </div>
                </button>
                <button
                  type="button"
                  disabled={!isOnline}
                  onClick={() => onFindOnlineMatch('brawl_4bot')}
                  className="flex items-center gap-3 rounded-xl border border-slate-700 bg-[#192029] p-3 text-left hover:border-amber-500 disabled:opacity-45 transition"
                >
                  <Users className="h-5 w-5 text-sky-400 shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-white">Online 4-Bot Brawl</div>
                    <div className="text-xs text-slate-400">Multi-bot free-for-all arena</div>
                  </div>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
