import { BotPickerStrip } from './BotPickerStrip';
import { ArenaSetupPanel } from './ArenaSetupPanel';
import { ARENA_LAYOUTS, type ArenaLayoutId, type ArenaRules, type CustomArenaSpec } from '../shared/arenaLayouts';
import { OnlinePvpPanel, type OpenRoomSummary } from './OnlinePvpPanel';
import React, { useState } from 'react';
import {
  Clock,
  Crown,
  Flame,
  Lock,
  Map as MapIcon,
  Sparkles,
  Star,
  UsersRound,
  Waves,
  Globe,
  LayoutGrid,
  ChevronRight,
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
  CAMPAIGN_CHAPTERS,
  CAMPAIGN_LEVELS,
  describeObjective,
  describeUnlock,
  isLevelUnlocked,
} from '../shared/campaign';
import {
  ARENA_CATALOG,
  getPartPrice,
  getPartUnlockLevel,
  isPartOwned,
  isTraditionalArena,
  MATCH_MODIFIERS,
  TIMED_BATTLE_OPTIONS,
  type ArenaId,
  type BotConfig,
  type MatchModifierId,
  type TimedBattleDuration,
  type OnlinePresence,
  type PvpRecord,
} from '../shared/types';

export type RivalTier = 'mixed' | 'lightweight' | 'middleweight' | 'heavyweight' | 'titan';
export type LocalLaunchMode =
  | 'duel_1v1'
  | 'brawl_4bot'
  | 'team_2v2'
  | 'boss_raid'
  | 'gauntlet'
  | 'practice'
  | 'team_3v3'
  | 'king_hill'
  | 'survival';

interface ArenaLauncherModalProps {
  open: boolean;
  isOnline: boolean;
  selectedArena: ArenaId;
  selectedRivalTier: RivalTier;
  selectedDuration: TimedBattleDuration;
  selectedWingmanIndex: number;
  savedLoadouts?: BotConfig[];
  gauntletStage: number;
  selectedModifiers: MatchModifierId[];
  campaignStars: Record<string, number>;
  bestSurvivalWave: number;
  onToggleModifier: (id: MatchModifierId) => void;
  onStartCampaign: (levelId: string) => void;
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
  onFindOnlineMatch: (mode: 'duel_1v1' | 'brawl_4bot', roomId?: string) => void;
  playerId: string;
  presence: OnlinePresence | null;
  openRooms: OpenRoomSummary[];
  pvpBoard: PvpRecord[];
  onOpenLadder: () => void;
  onStartOnlineNow: () => void;
  onCancelLobby: () => void;
  onClose: () => void;
  traditionalMode?: boolean;
  onToggleTraditionalMode?: (next: boolean) => void;
  playerLevel?: number;
  coins?: number;
  unlockedArenas?: ArenaId[];
  ownedParts?: string[];
  onBuyArena?: (arenaId: ArenaId) => boolean;
  arenaLayout: ArenaLayoutId;
  arenaRules: ArenaRules;
  customArenas: CustomArenaSpec[];
  activeCustomArenaId: string | null;
  onSelectLayout: (l: ArenaLayoutId) => void;
  onChangeRules: (r: ArenaRules) => void;
  onSelectCustomArena: (id: string | null) => void;
  onOpenArenaBuilder: (editId: string | null) => void;
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
  selectedModifiers,
  campaignStars,
  bestSurvivalWave,
  onToggleModifier,
  onStartCampaign,
  lobbyRoom,
  onSelectArena,
  onSelectRivalTier,
  onSelectDuration,
  onSelectWingman,
  onStartOffline,
  onFindOnlineMatch,
  playerId,
  presence,
  openRooms,
  pvpBoard,
  onOpenLadder,
  onStartOnlineNow,
  onCancelLobby,
  onClose,
  traditionalMode = false,
  onToggleTraditionalMode,
  playerLevel = 1,
  coins = 0,
  unlockedArenas = ['foundry', 'colosseum'],
  ownedParts = [],
  onBuyArena,
  arenaLayout,
  arenaRules,
  customArenas,
  activeCustomArenaId,
  onSelectLayout,
  onChangeRules,
  onSelectCustomArena,
  onOpenArenaBuilder,
}) => {
  const [tab, setTab] = useState<'quick' | 'arena' | 'campaign' | 'online'>('quick');
  const [expandedLevel, setExpandedLevel] = useState<string | null>(null);
  const [arenaNotice, setArenaNotice] = useState<string | null>(null);
  if (!open) return null;

  const bay2Bot = savedLoadouts?.[1];
  const totalStars = Object.values(campaignStars).reduce((a, b) => a + b, 0);
  const maxStars = CAMPAIGN_LEVELS.length * 3;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 bg-[#141920] p-4 sm:p-6 shadow-2xl my-auto">
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3.5">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-white">
              Deploy to BattleBox Arena
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {Object.keys(ARENA_CATALOG).length} arenas, team modes, boss raids, survival and a {CAMPAIGN_LEVELS.length}-level campaign
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

        {!lobbyRoom && (
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
            {(
              [
                { id: 'quick', label: 'Quick Battle', Icon: Swords },
                { id: 'arena', label: 'Arena & Layout', Icon: LayoutGrid },
                { id: 'campaign', label: `Campaign ${totalStars}/${maxStars}★`, Icon: MapIcon },
                {
                  id: 'online',
                  label: presence ? `Online PvP · ${presence.online} on` : 'Online PvP',
                  Icon: Globe,
                },
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
        ) : tab === 'online' ? (
          <OnlinePvpPanel
            isOnline={isOnline}
            playerId={playerId}
            presence={presence}
            openRooms={openRooms}
            pvpBoard={pvpBoard}
            selectedArena={selectedArena}
            onFind={onFindOnlineMatch}
            onOpenLadder={onOpenLadder}
          />
        ) : tab === 'arena' ? (
          <div className="mt-4 space-y-4">
            {/* Arena Stage Picker */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-xs font-semibold text-slate-300">
                  Select Combat Arena (
                  {traditionalMode || selectedModifiers.includes('traditional_rules')
                    ? '3 Traditional BattleBoxes'
                    : `${Object.keys(ARENA_CATALOG).length} BattleBoxes`}
                  )
                </div>
                <span className="font-mono-tabular text-[11px] font-bold text-amber-300">
                  Lv {playerLevel} · {coins} Coins
                </span>
              </div>
              {arenaNotice && (
                <div className="mb-2 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-200">
                  {arenaNotice}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                {(Object.keys(ARENA_CATALOG) as ArenaId[])
                  .filter((aId) =>
                    traditionalMode || selectedModifiers.includes('traditional_rules')
                      ? isTraditionalArena(aId)
                      : true,
                  )
                  .map((aId) => {
                    const a = ARENA_CATALOG[aId];
                    const active = selectedArena === aId;
                    const unlocked = isPartOwned(
                      { level: playerLevel, unlockedArenas, ownedParts },
                      'arena',
                      aId,
                    );
                    const reqLv = getPartUnlockLevel('arena', aId);
                    const price = getPartPrice('arena', aId);
                    return (
                      <button
                        key={aId}
                        type="button"
                        onClick={() => {
                          if (unlocked) {
                            onSelectArena(aId);
                            return;
                          }
                          if (onBuyArena?.(aId)) {
                            onSelectArena(aId);
                            setArenaNotice(`Unlocked ${a.name} for ${price} Coins!`);
                          } else {
                            setArenaNotice(
                              `${a.name} unlocks automatically at Pilot Lv ${reqLv} or purchase now for ${price} Coins.`,
                            );
                          }
                          window.setTimeout(() => setArenaNotice(null), 2600);
                        }}
                        className={`text-left rounded-xl border p-2.5 transition ${
                          !unlocked
                            ? 'border-slate-800/80 bg-[#12161D] opacity-80 hover:border-amber-500/50'
                            : active
                              ? 'border-amber-500 bg-amber-500/12'
                              : 'border-slate-800 bg-[#192029] hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-xs font-bold text-white truncate">
                            {!unlocked && <Lock className="inline h-3 w-3 mr-1 text-amber-400" />}
                            {a.name}
                          </span>
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: a.accentHex }}
                          />
                        </div>
                        <div
                          className="mt-0.5 text-[10px] font-semibold truncate"
                          style={{ color: unlocked ? a.accentHex : '#fbbf24' }}
                        >
                          {unlocked ? a.hazardTag : `🔒 Unlock Lv ${reqLv} or ${price} Coins`}
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400 line-clamp-2 leading-snug">
                          {a.subtitle}
                        </p>
                      </button>
                    );
                  })}
              </div>
            </div>

            <ArenaSetupPanel
              selectedArena={selectedArena}
              layout={arenaLayout}
              rules={arenaRules}
              customArenas={customArenas}
              activeCustomId={activeCustomArenaId}
              onSelectLayout={onSelectLayout}
              onChangeRules={onChangeRules}
              onSelectCustom={onSelectCustomArena}
              onOpenBuilder={onOpenArenaBuilder}
            />
            {/* Pre-Match Arena Hazard Layout Toggle (Static / Standard Dynamic / High-Chaos) */}
            <div className="rounded-xl border border-amber-500/40 bg-[#181512] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                    Arena Hazard Layout Variant (Ranked, Solo & Practice)
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Choose between static layouts (pure bot-vs-bot duel), standard 3s telegraphed hazards, or dynamic high-chaos sudden-death overdrive.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      {
                        id: 'static',
                        label: 'Static (No Hazards)',
                        active: selectedModifiers.includes('no_hazards'),
                        onClick: () => {
                          if (!selectedModifiers.includes('no_hazards')) onToggleModifier('no_hazards');
                          if (selectedModifiers.includes('high_chaos')) onToggleModifier('high_chaos');
                        },
                      },
                      {
                        id: 'standard',
                        label: 'Dynamic Standard',
                        active:
                          !selectedModifiers.includes('no_hazards') &&
                          !selectedModifiers.includes('high_chaos'),
                        onClick: () => {
                          if (selectedModifiers.includes('no_hazards')) onToggleModifier('no_hazards');
                          if (selectedModifiers.includes('high_chaos')) onToggleModifier('high_chaos');
                        },
                      },
                      {
                        id: 'high_chaos',
                        label: 'High-Chaos Overdrive',
                        active: selectedModifiers.includes('high_chaos'),
                        onClick: () => {
                          if (selectedModifiers.includes('no_hazards')) onToggleModifier('no_hazards');
                          if (!selectedModifiers.includes('high_chaos')) onToggleModifier('high_chaos');
                        },
                      },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={opt.onClick}
                      className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-extrabold transition cursor-pointer ${
                        opt.active
                          ? opt.id === 'high_chaos'
                            ? 'border-rose-400 bg-rose-500 text-slate-950 shadow'
                            : 'border-amber-400 bg-amber-500 text-slate-950 shadow'
                          : 'border-slate-700 bg-[#0D1014] text-slate-300 hover:border-slate-500 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Traditional Mode vs All-Out Sci-Fi Mode Toggle Banner */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/40 bg-[#0F1B18] p-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-emerald-300">
                  <Swords className="h-4 w-4 text-emerald-400" />
                  <span>Traditional BattleBox Mode</span>
                  { (traditionalMode || selectedModifiers.includes('traditional_rules')) && (
                    <span className="rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] font-extrabold text-slate-950">
                      ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Normal BattleBox arenas (Colosseum, Foundry, Scrapyard) & classic mechanical weapons only — no lightning, orbital bombs, or sci-fi anomalies.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const isActive = traditionalMode || selectedModifiers.includes('traditional_rules');
                  const next = !isActive;
                  onToggleTraditionalMode?.(next);
                  if (next && !selectedModifiers.includes('traditional_rules')) {
                    onToggleModifier('traditional_rules');
                  } else if (!next && selectedModifiers.includes('traditional_rules')) {
                    onToggleModifier('traditional_rules');
                  }
                  if (next && !isTraditionalArena(selectedArena)) {
                    onSelectArena('colosseum');
                  }
                }}
                className={`rounded-xl px-4 py-2 text-xs font-extrabold uppercase tracking-wider transition cursor-pointer shrink-0 ${
                  traditionalMode || selectedModifiers.includes('traditional_rules')
                    ? 'bg-emerald-400 text-slate-950 shadow-lg hover:bg-emerald-300'
                    : 'border border-emerald-500/50 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25'
                }`}
              >
                {traditionalMode || selectedModifiers.includes('traditional_rules')
                  ? 'Traditional Mode: ON'
                  : 'Enable Traditional Mode'}
              </button>
            </div>

            {/* Match Modifiers */}
            <div>
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
            <button
              type="button"
              onClick={() => setTab('quick')}
              className="w-full rounded-xl bg-amber-500 py-3 text-sm font-extrabold text-slate-950 hover:bg-amber-400"
            >
              Done · Pick a mode
            </button>
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
        ) : (
          <>
            {/* Arena summary: details live on the Arena & Layout tab */}
            <button
              type="button"
              onClick={() => setTab('arena')}
              className="mt-4 flex w-full items-center gap-3 rounded-xl border border-slate-700 bg-[#192029] p-3 text-left hover:border-amber-500 transition"
            >
              <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: ARENA_CATALOG[(customArenas.find((a) => a.id === activeCustomArenaId)?.theme ?? selectedArena)]?.accentHex }} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-white truncate">
                  {customArenas.find((a) => a.id === activeCustomArenaId)?.name ?? ARENA_CATALOG[selectedArena]?.name}
                </span>
                <span className="block text-[11px] text-slate-400 truncate">
                  {customArenas.find((a) => a.id === activeCustomArenaId)
                    ? `Custom arena · ${ARENA_CATALOG[customArenas.find((a) => a.id === activeCustomArenaId)!.theme]?.name} theme`
                    : `${ARENA_LAYOUTS[arenaLayout].label} layout`}
                  {' · '}Bombs {arenaRules.bombs ? 'on' : 'off'} · Lightning {arenaRules.lightning ? 'on' : 'off'}
                  {selectedModifiers.length > 0 ? ` · ${selectedModifiers.length} modifier${selectedModifiers.length === 1 ? '' : 's'}` : ''}
                </span>
              </span>
              <span className="flex items-center gap-1 text-xs font-semibold text-amber-300">
                Change <ChevronRight className="h-4 w-4" />
              </span>
            </button>

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
              <div className="min-w-0">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-emerald-400" />
                    2v2 & Raid Wingman Ally
                  </span>
                  <span className="text-[10px] font-normal text-emerald-400">
                    Fights on your team
                  </span>
                </div>
                <BotPickerStrip
                  label="Wingman ally"
                  accent="amber"
                  selectedId={String(selectedWingmanIndex)}
                  onSelect={(id) => onSelectWingman(Number(id))}
                  entries={[
                    ...(bay2Bot ? [{ id: '-1', clanTag: 'BAY2', config: bay2Bot, subtitle: 'Your Bay 2 bot' }] : []),
                    ...AI_RIVAL_PRESETS.map((p, idx) => ({
                      id: String(idx),
                      clanTag: p.clanTag,
                      config: p.config,
                      subtitle: `${p.roleTag} · ${p.weightClass}`,
                    })),
                  ]}
                />
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
                  onClick={() => onStartOffline('team_3v3')}
                  className="flex flex-col justify-between rounded-xl border border-teal-500/40 bg-[#122220] p-3 text-left hover:border-teal-400 transition"
                >
                  <div className="flex items-center justify-between">
                    <UsersRound className="h-5 w-5 text-teal-400" />
                    <span className="rounded bg-teal-500/20 px-1.5 py-0.5 text-[10px] font-bold text-teal-300">SQUAD</span>
                  </div>
                  <div className="mt-2">
                    <div className="text-sm font-bold text-white">Squad 3v3</div>
                    <div className="text-[11px] text-slate-300 mt-0.5">You + 2 allies vs 3 rivals</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onStartOffline('king_hill')}
                  className="flex flex-col justify-between rounded-xl border border-yellow-500/40 bg-[#211E10] p-3 text-left hover:border-yellow-400 transition"
                >
                  <div className="flex items-center justify-between">
                    <Crown className="h-5 w-5 text-yellow-300" />
                    <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-bold text-yellow-200">OBJECTIVE</span>
                  </div>
                  <div className="mt-2">
                    <div className="text-sm font-bold text-white">King of the Hill</div>
                    <div className="text-[11px] text-slate-300 mt-0.5">Hold the moving ring to 100</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onStartOffline('survival')}
                  className="flex flex-col justify-between rounded-xl border border-sky-500/40 bg-[#101C26] p-3 text-left hover:border-sky-400 transition"
                >
                  <div className="flex items-center justify-between">
                    <Waves className="h-5 w-5 text-sky-400" />
                    <span className="font-mono-tabular text-xs font-bold text-sky-300">
                      {bestSurvivalWave > 0 ? `Best W${bestSurvivalWave}` : 'ENDLESS'}
                    </span>
                  </div>
                  <div className="mt-2">
                    <div className="text-sm font-bold text-white">Survival Waves</div>
                    <div className="text-[11px] text-slate-300 mt-0.5">Boss every 5th wave</div>
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

            {/* Online Multiplayer shortcut */}
            <div className="mt-4 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setTab('online')}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 text-left hover:bg-amber-500/20 transition"
              >
                <span className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-amber-400 shrink-0" />
                  <span>
                    <span className="block text-sm font-bold text-white">Fight real pilots online</span>
                    <span className="block text-xs text-slate-400">Ranked 1v1 and brawls with a live win/loss ladder</span>
                  </span>
                </span>
                <span className="text-xs font-semibold text-amber-300">
                  {!isOnline ? 'Offline' : presence ? `${presence.online} online` : 'Open'}
                </span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
