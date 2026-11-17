import React from 'react';
import { Globe, Radio, Swords, Trophy, Users, WifiOff } from 'lucide-react';
import { ARENA_CATALOG, type ArenaId, type OnlinePresence, type PvpRecord } from '../shared/types';

export interface OpenRoomSummary {
  id: string;
  mode: string;
  arenaId?: ArenaId;
  playerCount: number;
  maxPlayers: number;
  players: Array<{ id: string; name: string; clanTag: string; botName: string }>;
}

interface Props {
  isOnline: boolean;
  playerId: string;
  presence: OnlinePresence | null;
  openRooms: OpenRoomSummary[];
  pvpBoard: PvpRecord[];
  selectedArena: ArenaId;
  onFind: (mode: 'duel_1v1' | 'brawl_4bot', roomId?: string) => void;
  onOpenLadder: () => void;
}

const winPct = (r: PvpRecord) => {
  const games = r.wins + r.losses + r.draws;
  return games > 0 ? Math.round((r.wins / games) * 100) : 0;
};

export const OnlinePvpPanel: React.FC<Props> = ({
  isOnline,
  playerId,
  presence,
  openRooms,
  pvpBoard,
  selectedArena,
  onFind,
  onOpenLadder,
}) => {
  const me = pvpBoard.find((r) => r.id === playerId);
  const myRank = me ? pvpBoard.findIndex((r) => r.id === playerId) + 1 : 0;
  const joinable = openRooms.filter((r) => !r.players.some((p) => p.id === playerId));

  if (!isOnline) {
    return (
      <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200 flex items-center gap-2">
        <WifiOff className="h-4 w-4" /> You are offline. Connect to the internet to fight real pilots.
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {/* Presence + personal record */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-slate-700 bg-[#192029] p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
            <Radio className="h-3.5 w-3.5 animate-pulse" />
            {presence ? `${presence.online} pilot${presence.online === 1 ? '' : 's'} online` : 'Connecting...'}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {presence ? `${presence.searching} searching · ${presence.fighting} in a fight` : 'Live presence updates every few seconds'}
          </div>
          {presence && presence.pilots.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {presence.pilots.slice(0, 10).map((p) => (
                <span
                  key={p.id}
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    p.status === 'fighting'
                      ? 'bg-red-500/20 text-red-300'
                      : p.status === 'searching'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-slate-700/60 text-slate-300'
                  }`}
                >
                  [{p.clanTag}] {p.name}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-slate-700 bg-[#192029] p-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span className="flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-amber-400" /> Your PvP record
            </span>
            {myRank > 0 && <span className="text-amber-300">Rank #{myRank}</span>}
          </div>
          {me ? (
            <div className="mt-1.5 grid grid-cols-4 gap-1 text-center font-mono-tabular">
              <div>
                <div className="text-lg font-bold text-emerald-300">{me.wins}</div>
                <div className="text-[10px] text-slate-400">Wins</div>
              </div>
              <div>
                <div className="text-lg font-bold text-red-300">{me.losses}</div>
                <div className="text-[10px] text-slate-400">Losses</div>
              </div>
              <div>
                <div className="text-lg font-bold text-white">{winPct(me)}%</div>
                <div className="text-[10px] text-slate-400">Win rate</div>
              </div>
              <div>
                <div className="text-lg font-bold text-amber-300">{me.rating}</div>
                <div className="text-[10px] text-slate-400">Rating</div>
              </div>
            </div>
          ) : (
            <div className="mt-1.5 text-[11px] text-slate-400">
              No ranked fights yet. Beat a real pilot to get on the ladder.
            </div>
          )}
        </div>
      </div>

      {/* Matchmaking */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => onFind('duel_1v1')}
          className="flex items-center gap-3 rounded-xl border border-amber-500/60 bg-amber-500/10 p-3 text-left hover:bg-amber-500/20 transition"
        >
          <Globe className="h-5 w-5 text-amber-400 shrink-0" />
          <div>
            <div className="text-sm font-bold text-white">Find a 1v1 Duel</div>
            <div className="text-xs text-slate-400">Ranked vs a real pilot · {ARENA_CATALOG[selectedArena]?.name}</div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => onFind('brawl_4bot')}
          className="flex items-center gap-3 rounded-xl border border-slate-700 bg-[#192029] p-3 text-left hover:border-amber-500 transition"
        >
          <Users className="h-5 w-5 text-sky-400 shrink-0" />
          <div>
            <div className="text-sm font-bold text-white">Find a 4-Bot Brawl</div>
            <div className="text-xs text-slate-400">Up to 4 real pilots, free-for-all</div>
          </div>
        </button>
      </div>

      {/* Open rooms */}
      <div>
        <div className="mb-1.5 text-xs font-semibold text-slate-300">Open rooms waiting for a challenger</div>
        {joinable.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-[#0F1318] px-3 py-2 text-[11px] text-slate-400">
            No open rooms right now. Start one above and others will see it here.
          </div>
        ) : (
          <div className="space-y-1.5">
            {joinable.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-700 bg-[#192029] px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    {r.players.map((p) => `[${p.clanTag}] ${p.name}`).join(', ') || 'Empty room'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {r.mode === 'duel_1v1' ? '1v1 Duel' : '4-Bot Brawl'} · {r.playerCount}/{r.maxPlayers} pilots
                    {r.arenaId ? ` · ${ARENA_CATALOG[r.arenaId]?.name ?? r.arenaId}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onFind(r.mode === 'brawl_4bot' ? 'brawl_4bot' : 'duel_1v1', r.id)}
                  className="flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                >
                  <Swords className="h-3.5 w-3.5" /> Join
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ladder preview */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-300">
          <span>PvP Ladder (real pilots only)</span>
          <button type="button" onClick={onOpenLadder} className="text-amber-400 hover:text-amber-300">
            Full ladder
          </button>
        </div>
        {pvpBoard.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-[#0F1318] px-3 py-2 text-[11px] text-slate-400">
            The ladder is empty. First ranked win takes the top spot.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-800">
            {pvpBoard.slice(0, 5).map((r, i) => (
              <div
                key={r.id}
                className={`flex items-center justify-between px-3 py-1.5 text-xs ${
                  r.id === playerId ? 'bg-amber-500/10' : i % 2 ? 'bg-[#141920]' : 'bg-[#171D25]'
                }`}
              >
                <span className="truncate text-slate-200">
                  <span className="mr-2 font-mono-tabular text-slate-500">#{i + 1}</span>[{r.clanTag}] {r.name}
                </span>
                <span className="font-mono-tabular text-slate-300 shrink-0">
                  <span className="text-emerald-300">{r.wins}W</span> · <span className="text-red-300">{r.losses}L</span> ·{' '}
                  <span className="text-amber-300">{r.rating}</span>
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-1.5 text-[10px] text-slate-500">
          Fights count for the ladder when at least two real pilots are in the room. Starting early fills empty slots with AI and is unranked.
        </p>
      </div>
    </div>
  );
};
