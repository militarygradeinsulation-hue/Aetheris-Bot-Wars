import React, { useState } from 'react';
import {
  Clock,
  Crown,
  Flag,
  Globe,
  Lock,
  Map as MapIcon,
  ShieldAlert,
  Skull,
  Sparkles,
  Star,
  Swords,
  Target,
  Users,
  UsersRound,
  Waves,
  WifiOff,
  X,
} from 'lucide-react';
import {
  CAMPAIGN_CHAPTERS,
  CAMPAIGN_LEVELS,
  describeObjective,
  describeUnlock,
  isLevelUnlocked,
} from '../shared/campaign';
import {
  ARENA_CATALOG,
  MATCH_MODIFIERS,
  TIMED_BATTLE_OPTIONS,
  type ArenaId,
  type MatchModifierId,
  type TimedBattleDuration,
} from '../shared/types';

export type RivalTier = 'mixed' | 'lightweight' | 'middleweight' | 'heavyweight' | 'titan';
export type LocalMode =
  | 'duel_1v1'
  | 'brawl_4bot'
  | 'gauntlet'
  | 'practice'
  | 'team_2v2'
  | 'team_3v3'
  | 'survival'
  | 'king_hill'
  | 'boss_raid';

interface ArenaLauncherModalProps {
  open: boolean;
  isOnline: boolean;
  selectedArena: ArenaId;
  selectedRivalTier: RivalTier;
  selectedDuration: TimedBattleDuration;
  selectedModifiers: MatchModifierId[];
  campaignStars: Record<string, number>;
  bestSurvivalWave: number;
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
  onToggleModifier: (id: MatchModifierId) => void;
  onStartOffline: (mode: LocalMode) => void;
  onStartCampaign: (levelId: string) => void;
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

const MODE_CARDS: Array<{
  id: LocalMode;
  label: string;
  note: string;
  Icon: React.ComponentType<{ className?: string }>;
  tone: string;
}> = [
  { id: 'duel_1v1', label: '1v1 Duel', note: 'Selected class', Icon: Target, tone: 'text-rose-400' },
  { id: 'brawl_4bot', label: '4-Bot Brawl', note: 'Free-for-all', Icon: Swords, tone: 'text-amber-400' },
  { id: 'team_2v2', label: 'Team 2v2', note: 'AI wingman', Icon: Users, tone: 'text-emerald-400' },
  { id: 'team_3v3', label: 'Squad 3v3', note: 'Full team war', Icon: UsersRound, tone: 'text-teal-400' },
  { id: 'king_hill', label: 'King of the Hill', note: 'Hold the ring', Icon: Crown, tone: 'text-yellow-300' },
  { id: 'boss_raid', label: 'Boss Raid', note: '3 vs Titan boss', Icon: Skull, tone: 'text-red-400' },
  { id: 'survival', label: 'Survival', note: 'Endless waves', Icon: Waves, tone: 'text-sky-400' },
  { id: 'gauntlet', label: 'Gauntlet', note: 'Scaling career', Icon: ShieldAlert, tone: 'text-emerald-300' },
  { id: 'practice', label: 'Test Range', note: 'Free drive', Icon: Flag, tone: 'text-slate-300' },
];

type LauncherTab = 'quick' | 'campaign' | 'online';

export const ArenaLauncherModal: React.FC<ArenaLauncherModalProps> = ({
  open,
  isOnline,
  selectedArena,
  selectedRivalTier,
  selectedDuration,
  selectedModifiers,
  campaignStars,
  bestSurvivalWave,
  gauntletStage,
  lobbyRoom,
  onSelectArena,
  onSelectRivalTier,
  onSelectDuration,
  onToggleModifier,
  onStartOffline,
  onStartCampaign,
  onFindOnlineMatch,
  onStartOnlineNow,
  onCancelLobby,
  onClose,
}) => {
  const [tab, setTab] = useState<LauncherTab>('quick');
  const [expandedLevel, setExpandedLevel] = useState<string | null>(null);
  if (!open) return null;

  const totalStars = Object.values(campaignStars).reduce((a, b) => a + b, 0);
  const maxStars = CAMPAIGN_LEVELS.length * 3;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-700 bg-[#141920] p-4 sm:p-6 shadow-2xl my-auto">
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-white">Deploy to Arena</h2>
            <p className="text-xs text-slate-400 mt-0.5">Quick battles, the career campaign, or live online rooms</p>
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

        {!lobbyRoom && (
          <div className="mt-3 flex gap-1.5">
            {(
              [
                { id: 'quick', label: 'Quick Battle', Icon: Swords },
                { id: 'campaign', label: `Campaign ${totalStars}/${maxStars}★`, Icon: MapIcon },
                { id: 'online', label: 'Online', Icon: Globe },
              ] as const
            ).map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 min-h-[40px] text-xs font-semibold transition whitespace-nowrap ${
                  tab === id ? 'bg-amber-500 text-slate-950' : 'bg-[#19202A] text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        )}

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
        ) : tab === 'campaign' ? (
          <div className="mt-4 space-y-4 max-h-[68vh] overflow-y-auto pr-1">
            {CAMPAIGN_CHAPTERS.map((ch) => {
              const levels = CAMPAIGN_LEVELS.filter((l) => l.chapter === ch.chapter);
              return (
                <div key={ch.chapter}>
                  <div className="flex items-baseline justify-between gap-2 mb-1.5">
                    <h3 className="font-display text-sm font-bold text-white">
                      Chapter {ch.chapter} · {ch.name}
                    </h3>
                    <span className="text-[11px] text-slate-400 truncate">{ch.tagline}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {levels.map((lvl) => {
                      const unlocked = isLevelUnlocked(lvl.id, campaignStars);
                      const stars = campaignStars[lvl.id] ?? 0;
                      const expanded = expandedLevel === lvl.id;
                      const arena = ARENA_CATALOG[lvl.arenaId];
                      return (
                        <div
                          key={lvl.id}
                          className={`rounded-xl border p-3 transition ${
                            !unlocked
                              ? 'border-slate-800 bg-[#11151B] opacity-60'
                              : expanded
                                ? 'border-amber-500 bg-amber-500/10'
                                : 'border-slate-800 bg-[#192029] hover:border-slate-600'
                          }`}
                        >
                          <button
                            type="button"
                            disabled={!unlocked}
                            onClick={() => setExpandedLevel(expanded ? null : lvl.id)}
                            className="w-full text-left"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-bold text-white truncate">
                                {!unlocked && <Lock className="inline h-3.5 w-3.5 mr-1 -mt-0.5 text-slate-500" />}
                                {lvl.title}
                              </span>
                              <span className="flex shrink-0">
                                {[0, 1, 2].map((i) => (
                                  <Star
                                    key={i}
                                    className={`h-3.5 w-3.5 ${i < stars ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}`}
                                  />
                                ))}
                              </span>
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: arena.accentHex }} />
                              <span>{arena.name}</span>
                              <span aria-hidden="true">·</span>
                              <span className="capitalize">{lvl.mode.replace(/_/g, ' ')}</span>
                            </div>
                          </button>
                          {expanded && unlocked && (
                            <div className="mt-2 border-t border-slate-800 pt-2">
                              <p className="text-xs text-slate-300 leading-snug">{lvl.brief}</p>
                              <ul className="mt-2 space-y-0.5 text-[11px] text-slate-400">
                                {lvl.objectives.map((o, i) => (
                                  <li key={i} className="flex items-center gap-1.5">
                                    <Star className={`h-3 w-3 ${i < stars ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}`} />
                                    {describeObjective(o)}
                                  </li>
                                ))}
                              </ul>
                              {lvl.modifiers && lvl.modifiers.length > 0 && (
                                <div className="mt-1.5 text-[11px] text-fuchsia-300">
                                  Rules: {lvl.modifiers.map((m) => MATCH_MODIFIERS[m].label).join(', ')}
                                </div>
                              )}
                              <div className="mt-2 flex items-center justify-between gap-2">
                                <span className="text-[11px] font-mono-tabular text-amber-300">
                                  +{lvl.rewardScrap} Scrap
                                  {lvl.rewardSkillPoints ? ` · +${lvl.rewardSkillPoints} SP` : ''}
                                  {lvl.rewardUnlock ? ` · ${describeUnlock(lvl.rewardUnlock)}` : ''}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => onStartCampaign(lvl.id)}
                                  className="rounded-lg bg-emerald-500 px-3.5 py-2 min-h-[38px] text-xs font-bold text-slate-950 hover:bg-emerald-400 transition shrink-0"
                                >
                                  {stars > 0 ? 'Replay' : 'Fight'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : tab === 'online' ? (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
              <span>Real-Time Multiplayer (WebSocket Server) · Arena: {ARENA_CATALOG[selectedArena].name}</span>
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
            <p className="mt-3 text-[11px] text-slate-500">Arena and clock are taken from your Quick Battle selections.</p>
          </div>
        ) : (
          <>
            {/* Arena Stage Picker */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(ARENA_CATALOG) as ArenaId[]).map((aId) => {
                const a = ARENA_CATALOG[aId];
                const active = selectedArena === aId;
                return (
                  <button
                    key={aId}
                    type="button"
                    onClick={() => onSelectArena(aId)}
                    className={`text-left rounded-xl border p-2.5 transition ${
                      active ? 'border-amber-500 bg-amber-500/12' : 'border-slate-800 bg-[#192029] hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white truncate">{a.name}</span>
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: a.accentHex }} />
                    </div>
                    <p className="mt-1 text-[10px] text-slate-400 leading-snug line-clamp-2">{a.subtitle}</p>
                  </button>
                );
              })}
            </div>

            {/* Game Modes */}
            <div className="mt-4">
              <div className="text-xs font-semibold text-slate-300 mb-1.5">Game Mode</div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {MODE_CARDS.map(({ id, label, note, Icon, tone }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onStartOffline(id)}
                    className="flex flex-col justify-between rounded-xl border border-slate-700 bg-[#192029] p-2.5 text-left hover:border-amber-400 transition min-h-[78px]"
                  >
                    <div className="flex items-center justify-between">
                      <Icon className={`h-4.5 w-4.5 ${tone}`} />
                      {id === 'gauntlet' && (
                        <span className="font-mono-tabular text-[10px] font-bold text-emerald-400">St {gauntletStage}</span>
                      )}
                      {id === 'survival' && bestSurvivalWave > 0 && (
                        <span className="font-mono-tabular text-[10px] font-bold text-sky-400">Best {bestSurvivalWave}</span>
                      )}
                    </div>
                    <div className="mt-1.5">
                      <div className="text-xs font-bold text-white leading-tight">{label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{note}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Rival Class */}
            <div className="mt-4">
              <div className="text-xs font-semibold text-slate-300 mb-1.5">Rival Class</div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                {RIVAL_TIERS.map((tier) => {
                  const active = selectedRivalTier === tier.id;
                  return (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => onSelectRivalTier(tier.id)}
                      className={`rounded-lg border px-2.5 py-2 text-left transition ${
                        active ? 'border-amber-500 bg-amber-500/15' : 'border-slate-800 bg-[#0D1014] hover:border-slate-600'
                      }`}
                    >
                      <div className="text-[11px] font-bold text-white truncate">{tier.label}</div>
                      <div className="text-[10px] text-slate-400 truncate">{tier.note}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Timed Battle Clock Picker */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-amber-400" />
                  Timed Battle Clock
                </span>
                <span className="text-[11px] font-normal text-slate-400 hidden sm:inline">
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
                        active ? 'border-amber-500 bg-amber-500/15' : 'border-slate-800 bg-[#0D1014] hover:border-slate-600'
                      }`}
                    >
                      <div className="font-mono-tabular text-sm font-bold text-white">{opt.label}</div>
                      <div className="text-[10px] text-slate-400">{opt.tag}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Match Modifiers */}
            <div className="mt-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-1.5">
                <Sparkles className="h-3.5 w-3.5 text-fuchsia-400" />
                Match Modifiers
                <span className="font-normal text-slate-500">({selectedModifiers.length} active)</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {(Object.keys(MATCH_MODIFIERS) as MatchModifierId[]).map((mId) => {
                  const m = MATCH_MODIFIERS[mId];
                  const active = selectedModifiers.includes(mId);
                  return (
                    <button
                      key={mId}
                      type="button"
                      onClick={() => onToggleModifier(mId)}
                      aria-pressed={active}
                      className={`rounded-lg border px-2.5 py-2 text-left transition ${
                        active ? 'border-fuchsia-400 bg-fuchsia-500/15' : 'border-slate-800 bg-[#0D1014] hover:border-slate-600'
                      }`}
                    >
                      <div className="text-[11px] font-bold text-white truncate">{m.label}</div>
                      <div className="text-[10px] text-slate-400 truncate">{m.note}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
