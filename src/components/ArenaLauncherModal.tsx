import React from 'react';
import { Clock, Globe, ShieldAlert, Swords, Target, Users, WifiOff, X } from 'lucide-react';
import {
  ARENA_CATALOG,
  TIMED_BATTLE_OPTIONS,
  type ArenaId,
  type TimedBattleDuration,
} from '../shared/types';

export type RivalTier = 'mixed' | 'lightweight' | 'middleweight' | 'heavyweight' | 'titan';

interface ArenaLauncherModalProps {
  open: boolean;
  isOnline: boolean;
  selectedArena: ArenaId;
  selectedRivalTier: RivalTier;
  selectedDuration: TimedBattleDuration;
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
  onStartOffline: (mode: 'duel_1v1' | 'brawl_4bot' | 'gauntlet' | 'practice') => void;
  onFindOnlineMatch: (mode: 'duel_1v1' | 'brawl_4bot') => void;
  onStartOnlineNow: () => void;
  onCancelLobby: () => void;
  onClose: () => void;
}

const RIVAL_TIERS: Array<{ id: RivalTier; label: string; note: string }> = [
  { id: 'mixed', label: 'Mixed Levels', note: 'Varied classes' },
  { id: 'lightweight', label: 'Lv 1–2 Light', note: 'Fast · Low DMG' },
  { id: 'middleweight', label: 'Lv 3 Mid', note: 'Balanced' },
  { id: 'heavyweight', label: 'Lv 4 Heavy', note: 'Slow · Tough' },
  { id: 'titan', label: 'Lv 5 Titan', note: 'Armored Boss' },
];

export const ArenaLauncherModal: React.FC<ArenaLauncherModalProps> = ({
  open,
  isOnline,
  selectedArena,
  selectedRivalTier,
  selectedDuration,
  gauntletStage,
  lobbyRoom,
  onSelectArena,
  onSelectRivalTier,
  onSelectDuration,
  onStartOffline,
  onFindOnlineMatch,
  onStartOnlineNow,
  onCancelLobby,
  onClose,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-[#141920] p-5 sm:p-6 shadow-2xl my-auto">
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-white">Deploy to Arena</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Select a destructible BattleBox stage, rival tier, and combat mode
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 bg-[#1B212B] text-slate-300 hover:text-white transition"
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
            {/* Arena Stage Picker */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(Object.keys(ARENA_CATALOG) as ArenaId[]).map((aId) => {
                const a = ARENA_CATALOG[aId];
                const active = selectedArena === aId;
                return (
                  <button
                    key={aId}
                    type="button"
                    onClick={() => onSelectArena(aId)}
                    className={`text-left rounded-xl border p-3 transition ${
                      active
                        ? 'border-amber-500 bg-amber-500/12'
                        : 'border-slate-800 bg-[#192029] hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-white">{a.name}</span>
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: a.accentHex }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-400 leading-snug">{a.subtitle}</p>
                  </button>
                );
              })}
            </div>

            {/* Timed Battle Clock Picker */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-amber-400" />
                  Timed Battle Clock
                </span>
                <span className="text-[11px] font-normal text-slate-400">
                  KO wins immediately, or Judges score HP% + Damage at 0:00
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {TIMED_BATTLE_OPTIONS.map((opt) => {
                  const active = selectedDuration === opt.seconds;
                  return (
                    <button
                      key={opt.seconds}
                      type="button"
                      onClick={() => onSelectDuration(opt.seconds)}
                      className={`rounded-lg border px-2.5 py-2 text-center transition ${
                        active
                          ? 'border-amber-500 bg-amber-500/15'
                          : 'border-slate-800 bg-[#0D1014] hover:border-slate-600'
                      }`}
                    >
                      <div className="font-mono-tabular text-sm font-bold text-white">{opt.label}</div>
                      <div className="text-[10px] text-slate-400">{opt.tag}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Online Multiplayer Section */}
            <div className="mt-4">
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
                  className="flex items-center gap-3 rounded-xl border border-slate-700 bg-[#192029] p-3.5 text-left hover:border-amber-500 disabled:opacity-45 transition min-h-[56px]"
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
                  className="flex items-center gap-3 rounded-xl border border-slate-700 bg-[#192029] p-3.5 text-left hover:border-amber-500 disabled:opacity-45 transition min-h-[56px]"
                >
                  <Users className="h-5 w-5 text-sky-400 shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-white">Online 4-Bot Brawl</div>
                    <div className="text-xs text-slate-400">Multi-bot free-for-all arena</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Offline Single-Player Section */}
            <div className="mt-5">
              <div className="text-xs font-semibold text-slate-300 mb-2">
                Offline Single-Player Rival Class & Modes
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 mb-3">
                {RIVAL_TIERS.map((tier) => {
                  const active = selectedRivalTier === tier.id;
                  return (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => onSelectRivalTier(tier.id)}
                      className={`rounded-lg border px-2.5 py-2 text-left transition ${
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

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
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
                    <div className="text-sm font-bold text-white">Gauntlet</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Scaling career</div>
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
                    <div className="text-[11px] text-slate-400 mt-0.5">Selected class</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onStartOffline('brawl_4bot')}
                  className="flex flex-col justify-between rounded-xl border border-slate-700 bg-[#192029] p-3 text-left hover:border-amber-400 transition"
                >
                  <Swords className="h-5 w-5 text-amber-400" />
                  <div className="mt-2">
                    <div className="text-sm font-bold text-white">4-Bot Brawl</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">3 tactical rivals</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onStartOffline('practice')}
                  className="flex flex-col justify-between rounded-xl border border-slate-700 bg-[#192029] p-3 text-left hover:border-sky-400 transition"
                >
                  <Users className="h-5 w-5 text-sky-400" />
                  <div className="mt-2">
                    <div className="text-sm font-bold text-white">Test Range</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Free drive & props</div>
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
