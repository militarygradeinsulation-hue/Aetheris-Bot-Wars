import React, { useMemo, useState } from 'react';
import {
  Check,
  Flame,
  Layers,
  PlusCircle,
  Search,
  Shield,
  Shuffle,
  Sparkles,
  Swords,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import {
  AI_RIVAL_PRESETS,
  BOSS_PRESETS,
  type RivalArchetypePreset,
} from '../shared/physicsEngine';
import { BotPortraitPreview } from './BotPortraitPreview';
import { BotFusion3DStage } from './BotFusion3DStage';
import {
  ARMOR_CATALOG,
  type BotConfig,
  CHASSIS_CATALOG,
  computeBotStats,
  DEFAULT_SKILLS,
  describePartKey,
  DRIVE_CATALOG,
  fuseTwoBotConfigs,
  generateRandomBotName,
  getBotChassisStyles,
  getBotWeapons,
  isPartOwned,
  type PartCategory,
  type PlayerProfile,
  premiumPartsInConfig,
  type SkillTree,
  WEAPON_CATALOG,
} from '../shared/types';

interface GarageRosterModalProps {
  open: boolean;
  currentBotConfig: BotConfig;
  skills: SkillTree;
  profile?: Pick<PlayerProfile, 'ownedParts' | 'unlockedArenas' | 'partUpgrades' | 'level' | 'coins' | 'scrap'>;
  customGarageBots: BotConfig[];
  onSelectBotToPlay: (config: BotConfig) => void;
  onSaveCustomBotToRoster: (config: BotConfig) => void;
  onDeleteCustomBotFromRoster: (index: number) => void;
  onClose: () => void;
}

interface UnifiedGarageEntry {
  id: string;
  origin: 'custom' | 'preset' | 'boss' | 'fusion';
  customIndex?: number;
  clanTag: string;
  aiStyleLabel: string;
  config: BotConfig;
}

const AI_STYLE_LABELS: Record<string, string> = {
  sniper_kiter: 'Sniper / Strafe Kiter',
  flanker_drifter: 'High-Speed Drift Flanker',
  wedge_lifter: 'Under-Cutter Wedge Lifter',
  spinner_brawler: '360° Full-Spin Cyclone',
  rammer_berserker: 'Boost Ram Berserker',
  hazard_pusher: 'Trap & Pit Bully',
};

function inferAiStyleLabel(config: BotConfig, preset?: RivalArchetypePreset): string {
  const style = config.aiStyle;
  if (style && AI_STYLE_LABELS[style]) return AI_STYLE_LABELS[style];
  if (preset?.roleTag) return preset.roleTag;
  const weapons = getBotWeapons(config);
  if (config.chassis === 'shell_spinner' || weapons.includes('body_spinner')) {
    return AI_STYLE_LABELS.spinner_brawler;
  }
  if (weapons.includes('railgun') || weapons.includes('mortar') || weapons.includes('laser')) {
    return AI_STYLE_LABELS.sniper_kiter;
  }
  if (weapons.includes('flipper') || config.chassis === 'wedge') {
    return AI_STYLE_LABELS.wedge_lifter;
  }
  if (config.drive === 'turbo' || config.drive === 'hover') {
    return AI_STYLE_LABELS.flanker_drifter;
  }
  return AI_STYLE_LABELS.rammer_berserker;
}

export const GarageRosterModal: React.FC<GarageRosterModalProps> = ({
  open,
  currentBotConfig,
  skills,
  profile,
  customGarageBots,
  onSelectBotToPlay,
  onSaveCustomBotToRoster,
  onDeleteCustomBotFromRoster,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'roster' | 'fusion' | 'create'>('roster');
  const [searchQuery, setSearchQuery] = useState('');
  const [weightFilter, setWeightFilter] = useState<string>('ALL');
  const [customBotName, setCustomBotName] = useState(currentBotConfig.name || 'Custom Warbot');
  const [fusionParentAId, setFusionParentAId] = useState<string>('preset_0');
  const [fusionParentBId, setFusionParentBId] = useState<string>('preset_15');
  const [fusionCustomName, setFusionCustomName] = useState('');
  const [fusionAnimSignal, setFusionAnimSignal] = useState<number>(0);
  const [pendingFuseAction, setPendingFuseAction] = useState<'equip' | 'save' | null>(null);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  const allEntries = useMemo<UnifiedGarageEntry[]>(() => {
    const list: UnifiedGarageEntry[] = [];

    customGarageBots.forEach((bot, idx) => {
      const isFusion = Array.isArray(bot.fusionParents) && bot.fusionParents.length === 2;
      list.push({
        id: `custom_${idx}`,
        origin: isFusion ? 'fusion' : 'custom',
        customIndex: idx,
        clanTag: isFusion ? 'FUSE' : 'CUST',
        aiStyleLabel: inferAiStyleLabel(bot),
        config: bot,
      });
    });

    AI_RIVAL_PRESETS.forEach((preset, idx) => {
      list.push({
        id: `preset_${idx}`,
        origin: 'preset',
        clanTag: preset.clanTag,
        aiStyleLabel: inferAiStyleLabel(preset.config, preset),
        config: {
          ...preset.config,
        },
      });
    });

    Object.entries(BOSS_PRESETS).forEach(([key, preset]) => {
      list.push({
        id: `boss_${key}`,
        origin: 'boss',
        clanTag: preset.clanTag,
        aiStyleLabel: inferAiStyleLabel(preset.config, preset),
        config: {
          ...preset.config,
        },
      });
    });

    return list;
  }, [customGarageBots]);

  const filteredEntries = useMemo(() => {
    return allEntries.filter((entry) => {
      const stats = computeBotStats(entry.config, skills, profile?.partUpgrades);
      if (weightFilter !== 'ALL' && stats.weightClass !== weightFilter) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const weaponsText = getBotWeapons(entry.config)
        .map((w) => WEAPON_CATALOG[w]?.label || w)
        .join(' ')
        .toLowerCase();
      const chassisText = getBotChassisStyles(entry.config)
        .map((c) => CHASSIS_CATALOG[c]?.label || c)
        .join(' ')
        .toLowerCase();
      return (
        entry.config.name.toLowerCase().includes(q) ||
        entry.clanTag.toLowerCase().includes(q) ||
        entry.aiStyleLabel.toLowerCase().includes(q) ||
        weaponsText.includes(q) ||
        chassisText.includes(q)
      );
    });
  }, [allEntries, searchQuery, weightFilter, skills, profile?.partUpgrades]);

  const parentAEntry =
    allEntries.find((e) => e.id === fusionParentAId) ?? allEntries[0];
  const parentBEntry =
    allEntries.find((e) => e.id === fusionParentBId) ?? allEntries[Math.min(1, allEntries.length - 1)];

  const fusedPreviewConfig = useMemo(() => {
    if (!parentAEntry || !parentBEntry) return currentBotConfig;
    return fuseTwoBotConfigs(parentAEntry.config, parentBEntry.config, fusionCustomName);
  }, [parentAEntry, parentBEntry, fusionCustomName, currentBotConfig]);

  const fusedPreviewStats = useMemo(
    () => computeBotStats(fusedPreviewConfig, skills, profile?.partUpgrades),
    [fusedPreviewConfig, skills, profile?.partUpgrades],
  );

  if (!open) return null;

  const showToast = (msg: string) => {
    setBannerNotice(msg);
    window.setTimeout(() => setBannerNotice(null), 3200);
  };

  const lockedPartsForConfig = (cfg: BotConfig): string[] => {
    if (!profile) return [];
    const reqs = premiumPartsInConfig(cfg);
    return reqs.filter((key) => {
      const [cat, id] = key.split(':') as [PartCategory, string];
      return !isPartOwned(profile, cat, id);
    });
  };

  const handleTryEquipBot = (cfg: BotConfig, closeOnSuccess = false) => {
    const missing = lockedPartsForConfig(cfg);
    if (missing.length > 0) {
      const labels = missing.slice(0, 3).map((k) => describePartKey(k)).join(', ');
      showToast(
        `Locked parts in "${cfg.name}": ${labels}${missing.length > 3 ? ` (+${missing.length - 3} more)` : ''}. Unlock them in Workshop using XP & Coins!`,
      );
      return;
    }
    onSelectBotToPlay(cfg);
    if (closeOnSuccess) {
      onClose();
    } else {
      showToast(`Equipped "${cfg.name}" for combat!`);
    }
  };

  const handleSaveCurrentWorkshopBot = () => {
    const cleanName = customBotName.trim().slice(0, 18) || currentBotConfig.name || 'Custom Bot';
    const saved: BotConfig = {
      ...JSON.parse(JSON.stringify(currentBotConfig)),
      name: cleanName,
    };
    onSaveCustomBotToRoster(saved);
    onSelectBotToPlay(saved);
    showToast(`Added "${cleanName}" to your Garage Roster & equipped for battle!`);
    setActiveTab('roster');
  };

  const executeFuseCommit = (saveToRoster: boolean) => {
    const fused = JSON.parse(JSON.stringify(fusedPreviewConfig)) as BotConfig;
    if (saveToRoster) {
      onSaveCustomBotToRoster(fused);
    }
    onSelectBotToPlay(fused);
    showToast(
      saveToRoster
        ? `Fused "${fused.name}" (${fused.fusionParents?.join(' × ')}) & saved to Garage Roster!`
        : `Equipped Fusion Bot "${fused.name}"!`,
    );
    setPendingFuseAction(null);
    if (!saveToRoster) {
      onClose();
    } else {
      setActiveTab('roster');
    }
  };

  const handleFuseAndEquip = (saveToRoster: boolean) => {
    const fused = JSON.parse(JSON.stringify(fusedPreviewConfig)) as BotConfig;
    const missing = lockedPartsForConfig(fused);
    if (missing.length > 0) {
      const labels = missing.slice(0, 3).map((k) => describePartKey(k)).join(', ');
      showToast(
        `Cannot deploy fused bot yet — locked parts: ${labels}${missing.length > 3 ? ` (+${missing.length - 3} more)` : ''}. Choose donor bots with unlocked parts or unlock them in Workshop.`,
      );
      return;
    }
    // Play the 3D merging animation first, then commit the fused bot!
    setPendingFuseAction(saveToRoster ? 'save' : 'equip');
    setFusionAnimSignal((s) => s + 1);
  };

  return (
    <div
      role="dialog"
      aria-label="Garage Bot Roster & Fusion Lab"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6 backdrop-blur-md"
    >
      <div className="flex max-h-[92dvh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-700/90 bg-[#11151C] shadow-2xl">
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-[#0D1014] px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-amber-400" />
              <h2 className="font-display text-xl sm:text-2xl font-extrabold text-white">
                Aetheris Garage Roster & 2-Bot Fusion Lab
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              Browse all {allEntries.length} official, boss, custom & fusion warbots with full stats — or fuse any 2 bots into one hybrid machine.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('roster')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold transition ${
                activeTab === 'roster'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'bg-[#181F29] text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Layers className="h-4 w-4" />
              <span>All Bots Roster ({allEntries.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('fusion')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold transition ${
                activeTab === 'fusion'
                  ? 'bg-fuchsia-500 text-slate-950 shadow'
                  : 'bg-[#181F29] text-fuchsia-300 hover:bg-slate-800'
              }`}
            >
              <Sparkles className="h-4 w-4" />
              <span>⚡ 2-Bot Fusion Lab</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCustomBotName(currentBotConfig.name || 'Custom Warbot');
                setActiveTab('create');
              }}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold transition ${
                activeTab === 'create'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'bg-[#181F29] text-emerald-300 hover:bg-slate-800'
              }`}
            >
              <PlusCircle className="h-4 w-4" />
              <span>+ Save Custom Bot</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Garage Modal"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-[#181F29] text-slate-300 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {bannerNotice && (
          <div className="border-b border-emerald-500/40 bg-emerald-500/15 px-5 py-2 text-xs font-bold text-emerald-200">
            {bannerNotice}
          </div>
        )}

        {/* TAB 1: FULL GARAGE ROSTER LIST */}
        {activeTab === 'roster' && (
          <div className="flex flex-1 min-h-0 flex-col p-4 sm:p-5">
            {/* Search & Weight Class Filter Bar */}
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search bot name, weapon (Full-Body Spinner, Laser, Mortar...), chassis, or driving style..."
                  className="w-full rounded-xl border border-slate-700 bg-[#0D1014] pl-9 pr-3 py-2 text-xs font-medium text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {['ALL', 'Lightweight', 'Middleweight', 'Heavyweight', 'Titan'].map((wClass) => (
                  <button
                    key={wClass}
                    type="button"
                    onClick={() => setWeightFilter(wClass)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                      weightFilter === wClass
                        ? 'bg-amber-500 text-slate-950'
                        : 'border border-slate-800 bg-[#161C26] text-slate-300 hover:text-white'
                    }`}
                  >
                    {wClass === 'ALL' ? 'All Classes' : wClass}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable All-Bots Table/Grid */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2.5">
              {filteredEntries.map((entry) => {
                const bStats = computeBotStats(entry.config, skills || DEFAULT_SKILLS, profile?.partUpgrades);
                const weapons = getBotWeapons(entry.config);
                const styles = getBotChassisStyles(entry.config);
                const isSelected = currentBotConfig.name === entry.config.name;
                const isFullBodySpinner =
                  entry.config.chassis === 'shell_spinner' || weapons.includes('body_spinner');
                const missingParts = lockedPartsForConfig(entry.config);

                return (
                  <div
                    key={entry.id}
                    className={`flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-2xl border-2 p-3.5 transition ${
                      isSelected
                        ? 'border-amber-400 bg-amber-500/12 shadow-lg'
                        : 'border-slate-800/90 bg-[#151A23] hover:border-slate-600'
                    }`}
                  >
                    {/* Left Column: Bot Portrait Image, Clan Badge, Name & Weapons */}
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <BotPortraitPreview config={entry.config} size="md" />
                        <div className="flex items-center gap-1.5">
                          <span
                            className="rounded px-1.5 py-0.5 font-mono-tabular text-[9px] font-extrabold text-white border"
                            style={{
                              backgroundColor: entry.config.primaryColor,
                              borderColor: entry.config.accentColor,
                            }}
                          >
                            {entry.clanTag}
                          </span>
                          <span className="font-mono-tabular text-[10px] font-extrabold text-amber-400">
                            PWR {bStats.powerScore}
                          </span>
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-display text-base font-extrabold text-white">
                            {entry.config.name}
                          </span>
                          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                            {bStats.weightClass} ({bStats.bodyScale}×)
                          </span>
                          {entry.origin === 'fusion' && (
                            <span className="rounded-md border border-fuchsia-400/60 bg-fuchsia-500/20 px-2 py-0.5 text-[10px] font-extrabold text-fuchsia-200">
                              ⚡ FUSION ({entry.config.fusionParents?.join(' × ')})
                            </span>
                          )}
                          {entry.origin === 'custom' && (
                            <span className="rounded-md border border-emerald-400/60 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-extrabold text-emerald-200">
                              ★ CUSTOM ROSTER
                            </span>
                          )}
                          {entry.origin === 'boss' && (
                            <span className="rounded-md border border-red-400/60 bg-red-500/20 px-2 py-0.5 text-[10px] font-extrabold text-red-200">
                              RAID BOSS
                            </span>
                          )}
                          {isFullBodySpinner && (
                            <span className="rounded-md border border-amber-400/70 bg-amber-500/25 px-2 py-0.5 text-[10px] font-extrabold text-amber-200">
                              360° FULL-BODY SPINNER
                            </span>
                          )}
                          {missingParts.length > 0 && (
                            <span className="rounded-md border border-amber-500/50 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                              🔒 {missingParts.length} Locked Parts
                            </span>
                          )}
                          <span className="rounded-md border border-slate-700 bg-[#0D1014] px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                            AI Style: {entry.aiStyleLabel}
                          </span>
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300">
                          <span>
                            <strong className="text-slate-400">Hull:</strong>{' '}
                            {styles.map((s) => CHASSIS_CATALOG[s]?.label || s).join(' + ')}
                          </span>
                          <span>·</span>
                          <span>
                            <strong className="text-slate-400">Armor:</strong>{' '}
                            {ARMOR_CATALOG[entry.config.armor]?.label}
                          </span>
                          <span>·</span>
                          <span>
                            <strong className="text-slate-400">Drive:</strong>{' '}
                            {DRIVE_CATALOG[entry.config.drive]?.label}
                          </span>
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {weapons.map((wId, wIdx) => (
                            <span
                              key={`${wId}_${wIdx}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-200"
                            >
                              <Swords className="h-3 w-3 text-amber-400" />
                              {WEAPON_CATALOG[wId]?.label || wId}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Middle Column: Stat Bars */}
                    <div className="grid grid-cols-5 gap-2 rounded-xl border border-slate-800 bg-[#0D1014] px-3 py-2 text-center font-mono-tabular text-xs shrink-0">
                      <div>
                        <div className="text-[10px] text-slate-400">HULL HP</div>
                        <div className="font-extrabold text-white">{bStats.maxHp}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">ARMOR/ZN</div>
                        <div className="font-extrabold text-emerald-300">{bStats.armorZoneHp}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">SHIELD</div>
                        <div className="font-extrabold text-sky-300">{bStats.maxShieldHp}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">DMG</div>
                        <div className="font-extrabold text-amber-300">{bStats.weaponDamage}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">SPEED</div>
                        <div className="font-extrabold text-fuchsia-300">{bStats.maxSpeed}m/s</div>
                      </div>
                    </div>

                    {/* Right Column: Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleTryEquipBot(entry.config, true)}
                        className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-extrabold transition ${
                          missingParts.length > 0
                            ? 'bg-slate-800 text-amber-300 border border-amber-500/40 hover:bg-slate-700'
                            : isSelected
                              ? 'bg-emerald-500 text-slate-950 shadow'
                              : 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow'
                        }`}
                      >
                        <Check className="h-4 w-4" />
                        <span>
                          {missingParts.length > 0 ? 'Locked Parts' : isSelected ? 'Equipped' : 'Select & Play'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setFusionParentAId(entry.id);
                          setActiveTab('fusion');
                        }}
                        title="Send this bot to the 2-Bot Fusion Lab"
                        className="rounded-xl border border-fuchsia-500/50 bg-fuchsia-500/15 px-3 py-2.5 text-xs font-bold text-fuchsia-300 hover:bg-fuchsia-500/25 transition"
                      >
                        ⚡ Fuse
                      </button>

                      {typeof entry.customIndex === 'number' && (
                        <button
                          type="button"
                          onClick={() => onDeleteCustomBotFromRoster(entry.customIndex!)}
                          title="Delete custom bot from roster"
                          className="rounded-xl border border-slate-700 bg-[#181F29] p-2.5 text-slate-400 hover:text-rose-400 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: 2-BOT FUSION LAB */}
        {activeTab === 'fusion' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
            {/* Live 3D Side-by-Side Donor Bots + Animated 3D Merging Stage */}
            {parentAEntry && parentBEntry && (
              <BotFusion3DStage
                botA={parentAEntry.config}
                botB={parentBEntry.config}
                fusedBot={fusedPreviewConfig}
                fusionTriggerSignal={fusionAnimSignal}
                onFusionAnimationComplete={() => {
                  if (pendingFuseAction === 'save') {
                    executeFuseCommit(true);
                  } else if (pendingFuseAction === 'equip') {
                    executeFuseCommit(false);
                  }
                }}
              />
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Parent Bot A Selector */}
              <div className="rounded-2xl border border-amber-500/50 bg-[#151A23] p-4">
                <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                  1. Choose Left Donor Bot A (Hull, Core Drive & Primary Weapons)
                </div>
                <select
                  value={fusionParentAId}
                  onChange={(e) => {
                    setFusionParentAId(e.target.value);
                    setFusionAnimSignal((s) => s + 1);
                  }}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-[#0D1014] px-3 py-2.5 text-sm font-bold text-white focus:border-amber-400 focus:outline-none"
                >
                  {allEntries.map((e) => {
                    const st = computeBotStats(e.config, skills, profile?.partUpgrades);
                    return (
                      <option key={e.id} value={e.id}>
                        [{e.clanTag}] {e.config.name} — {st.weightClass} (PWR {st.powerScore}) ·{' '}
                        {getBotWeapons(e.config)
                          .map((w) => WEAPON_CATALOG[w]?.label)
                          .join(' + ')}
                      </option>
                    );
                  })}
                </select>
                {parentAEntry && (
                  <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-800 bg-[#0D1014] p-3 text-xs text-slate-300">
                    <div className="space-y-1 min-w-0">
                      <div className="font-bold text-amber-300">3D Left Pedestal: {parentAEntry.config.name}</div>
                      <div>
                        Chassis: {CHASSIS_CATALOG[parentAEntry.config.chassis]?.label} · Armor:{' '}
                        {ARMOR_CATALOG[parentAEntry.config.armor]?.label}
                      </div>
                      <div className="text-amber-200">
                        Weapons:{' '}
                        {getBotWeapons(parentAEntry.config)
                          .map((w) => WEAPON_CATALOG[w]?.label)
                          .join(' + ')}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Parent Bot B Selector */}
              <div className="rounded-2xl border border-sky-500/50 bg-[#151A23] p-4">
                <div className="text-xs font-extrabold uppercase tracking-wider text-sky-300">
                  2. Choose Right Donor Bot B (Hybrid Hull Geometry, Armor & Extra Weapons)
                </div>
                <select
                  value={fusionParentBId}
                  onChange={(e) => {
                    setFusionParentBId(e.target.value);
                    setFusionAnimSignal((s) => s + 1);
                  }}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-[#0D1014] px-3 py-2.5 text-sm font-bold text-white focus:border-sky-400 focus:outline-none"
                >
                  {allEntries.map((e) => {
                    const st = computeBotStats(e.config, skills, profile?.partUpgrades);
                    return (
                      <option key={e.id} value={e.id}>
                        [{e.clanTag}] {e.config.name} — {st.weightClass} (PWR {st.powerScore}) ·{' '}
                        {getBotWeapons(e.config)
                          .map((w) => WEAPON_CATALOG[w]?.label)
                          .join(' + ')}
                      </option>
                    );
                  })}
                </select>
                {parentBEntry && (
                  <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-800 bg-[#0D1014] p-3 text-xs text-slate-300">
                    <div className="space-y-1 min-w-0">
                      <div className="font-bold text-sky-300">3D Right Pedestal: {parentBEntry.config.name}</div>
                      <div>
                        Chassis: {CHASSIS_CATALOG[parentBEntry.config.chassis]?.label} · Armor:{' '}
                        {ARMOR_CATALOG[parentBEntry.config.armor]?.label}
                      </div>
                      <div className="text-sky-200">
                        Weapons:{' '}
                        {getBotWeapons(parentBEntry.config)
                          .map((w) => WEAPON_CATALOG[w]?.label)
                          .join(' + ')}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Fused Result Card */}
            <div className="rounded-2xl border-2 border-fuchsia-500/70 bg-gradient-to-br from-[#1A1326] to-[#12161F] p-5 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div>
                    <span className="rounded-lg bg-fuchsia-500/25 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-fuchsia-300">
                      ⚡ Fused Hybrid Warbot Telemetry
                    </span>
                    <h3 className="mt-2 font-display text-2xl font-extrabold text-white">
                      {fusedPreviewConfig.name}
                    </h3>
                    <p className="text-xs text-fuchsia-200/90">
                      Fused Capabilities: {fusedPreviewConfig.fusionParents?.join(' × ')} ·{' '}
                      {fusedPreviewStats.weightClass} ({fusedPreviewStats.bodyScale}× Scale)
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-1 min-w-[260px]">
                  <span className="text-xs font-bold text-slate-300">Custom Fusion Name (Optional)</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      maxLength={18}
                      value={fusionCustomName}
                      onChange={(e) => setFusionCustomName(e.target.value)}
                      placeholder={fusedPreviewConfig.name}
                      className="flex-1 rounded-xl border border-fuchsia-400/50 bg-[#0D1014] px-3 py-2 text-xs font-bold text-white focus:border-amber-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setFusionCustomName(generateRandomBotName(fusionCustomName || fusedPreviewConfig.name))}
                      title="Generate a random fusion bot name"
                      className="flex items-center gap-1 rounded-xl border border-fuchsia-400/60 bg-fuchsia-500/20 px-2.5 py-2 text-xs font-extrabold text-fuchsia-200 hover:bg-fuchsia-500/30 transition shrink-0"
                    >
                      <Shuffle className="h-3.5 w-3.5" />
                      <span>Random Name</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-6 gap-2.5 rounded-xl border border-slate-800 bg-[#0D1014]/90 p-3 text-center font-mono-tabular">
                <div>
                  <div className="text-[10px] text-slate-400">FUSED HP</div>
                  <div className="text-base font-extrabold text-white">{fusedPreviewStats.maxHp}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">ARMOR/ZONE</div>
                  <div className="text-base font-extrabold text-emerald-300">
                    {fusedPreviewStats.armorZoneHp}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">SHIELD</div>
                  <div className="text-base font-extrabold text-sky-300">
                    {fusedPreviewStats.maxShieldHp}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">COMBINED DMG</div>
                  <div className="text-base font-extrabold text-amber-300">
                    {fusedPreviewStats.weaponDamage}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">TOP SPEED</div>
                  <div className="text-base font-extrabold text-fuchsia-300">
                    {fusedPreviewStats.maxSpeed} m/s
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">POWER SCORE</div>
                  <div className="text-base font-extrabold text-amber-400">
                    {fusedPreviewStats.powerScore}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-200">
                <span className="font-bold text-slate-400">Fused Hull Styles:</span>
                {getBotChassisStyles(fusedPreviewConfig).map((cId) => (
                  <span
                    key={cId}
                    className="rounded-lg border border-sky-500/40 bg-sky-500/15 px-2.5 py-1 font-bold text-sky-200"
                  >
                    {CHASSIS_CATALOG[cId]?.label}
                  </span>
                ))}
                <span className="ml-2 font-bold text-slate-400">Fused Arsenal (up to 3):</span>
                {getBotWeapons(fusedPreviewConfig).map((wId, idx) => (
                  <span
                    key={`${wId}_${idx}`}
                    className="rounded-lg border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 font-bold text-amber-200"
                  >
                    #{idx + 1} {WEAPON_CATALOG[wId]?.label}
                  </span>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => handleFuseAndEquip(false)}
                  className="rounded-xl border border-fuchsia-400 bg-fuchsia-500/20 px-4 py-2.5 text-xs font-extrabold text-fuchsia-200 hover:bg-fuchsia-500/30 transition"
                >
                  ⚡ Fuse & Equip in Workshop
                </button>
                <button
                  type="button"
                  onClick={() => handleFuseAndEquip(true)}
                  className="rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-extrabold text-slate-950 shadow-lg hover:bg-amber-400 transition"
                >
                  ★ Fuse, Save to Garage Roster & Play
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CREATE & SAVE CUSTOM BOT TO GARAGE ROSTER */}
        {activeTab === 'create' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
            <div className="rounded-2xl border border-emerald-500/50 bg-[#151A23] p-5">
              <h3 className="font-display text-lg font-extrabold text-white">
                Add Your Custom Workshop Bot to the Official Garage Roster
              </h3>
              <p className="mt-1 text-xs text-slate-300">
                Name your current custom-built bot below and add it to your permanent Garage Roster so you can select and battle with it anytime.
              </p>

              <div className="mt-4 flex flex-wrap items-end gap-3">
                <label className="flex-1 min-w-[240px] flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-slate-300">Custom Bot Name</span>
                  <input
                    type="text"
                    maxLength={18}
                    value={customBotName}
                    onChange={(e) => setCustomBotName(e.target.value)}
                    placeholder="Enter custom bot name..."
                    className="rounded-xl border border-slate-700 bg-[#0D1014] px-3.5 py-2.5 text-sm font-bold text-white focus:border-emerald-400 focus:outline-none"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setCustomBotName(generateRandomBotName(customBotName))}
                  title="Generate a random custom bot name"
                  className="flex items-center gap-1.5 rounded-xl border border-amber-500/60 bg-amber-500/15 px-4 py-2.5 text-xs font-extrabold text-amber-300 hover:bg-amber-500/25 transition"
                >
                  <Shuffle className="h-4 w-4" />
                  <span>Random Name</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveCurrentWorkshopBot}
                  className="rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-extrabold text-slate-950 shadow-lg hover:bg-emerald-400 transition"
                >
                  + Save to Garage Roster
                </button>
              </div>

              {(() => {
                const st = computeBotStats(currentBotConfig, skills, profile?.partUpgrades);
                return (
                  <div className="mt-4 rounded-xl border border-slate-800 bg-[#0D1014] p-3.5 text-xs text-slate-300 space-y-1.5">
                    <div className="font-bold text-amber-300">
                      Current Workshop Loadout: {customBotName || currentBotConfig.name} ({st.weightClass} · PWR{' '}
                      {st.powerScore})
                    </div>
                    <div>
                      Hull:{' '}
                      {getBotChassisStyles(currentBotConfig)
                        .map((c) => CHASSIS_CATALOG[c]?.label)
                        .join(' + ')}{' '}
                      · Armor: {ARMOR_CATALOG[currentBotConfig.armor]?.label} · Drive:{' '}
                      {DRIVE_CATALOG[currentBotConfig.drive]?.label}
                    </div>
                    <div>
                      Weapons:{' '}
                      {getBotWeapons(currentBotConfig)
                        .map((w) => WEAPON_CATALOG[w]?.label)
                        .join(' + ') || 'Unarmed'}
                    </div>
                    <div className="font-mono-tabular text-sky-300">
                      HP {st.maxHp} · Armor/Zone {st.armorZoneHp} · Shield {st.maxShieldHp} · Damage{' '}
                      {st.weaponDamage} · Speed {st.maxSpeed} m/s
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
