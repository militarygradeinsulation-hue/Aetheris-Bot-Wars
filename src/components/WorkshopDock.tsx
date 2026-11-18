import React, { useState } from 'react';
import {
  BookmarkPlus,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Gauge,
  Lock,
  MapPin,
  Palette,
  RotateCcw,
  Shield,
  Shuffle,
  Sparkles,
  Square,
  Star,
  Swords,
  Trash2,
  Wrench,
  XCircle,
} from 'lucide-react';
import {
  ACCESSORY_CATALOG,
  type AccessoryId,
  ARENA_CATALOG,
  type ArenaId,
  ARMOR_CATALOG,
  type ArmorId,
  type BotConfig,
  CHASSIS_CATALOG,
  type ChassisId,
  computeBotStats,
  DRIVE_CATALOG,
  type DriveId,
  type DeviceLayoutMode,
  type FavoritesList,
  FINISH_CATALOG,
  type FinishStyleId,
  generateRandomBotName,
  getBotChassisStyles,
  getBotWeaponPlacements,
  getBotWeapons,
  getDefaultWeaponPlacement,
  getPartPrice,
  getPartUnlockLevel,
  getPartUpgradeCost,
  getPartUpgradeLevel,
  isPartOwned,
  isTraditionalArena,
  isTraditionalWeapon,
  MAX_PART_UPGRADE_LEVEL,
  PAINT_PRESETS,
  type PartCategory,
  PATTERN_CATALOG,
  type PatternId,
  type PlayerProfile,
  sanitizeConfigForTraditionalMode,
  type SkillTree,
  UNDERGLOW_OPTIONS,
  WEAPON_CATALOG,
  type WeaponId,
  WEAPON_MOUNT_ZONES,
  type WeaponMountZone,
  type WeaponPlacementConfig,
  WHEEL_LAYOUT_CATALOG,
  type WheelLayoutId,
} from '../shared/types';

interface WorkshopDockProps {
  config: BotConfig;
  skills: SkillTree;
  savedLoadouts?: BotConfig[];
  activeLoadoutSlot?: number;
  onSelectLoadoutSlot?: (slotIdx: number) => void;
  onChange: (next: BotConfig) => void;
  onStartFight: () => void;
  selectedArena?: ArenaId;
  onSelectArena?: (arenaId: ArenaId) => void;
  profile: Pick<
    PlayerProfile,
    'ownedParts' | 'unlockedArenas' | 'partUpgrades' | 'level' | 'coins' | 'scrap' | 'favorites'
  >;
  onBuyPart: (cat: PartCategory, id: string) => boolean;
  onUpgradePart?: (cat: PartCategory, id: string) => boolean;
  onUpdateFavorites?: (next: FavoritesList) => void;
  canStepBack?: boolean;
  canStepForward?: boolean;
  onStepBack?: () => void;
  onStepForward?: () => void;
  onOpenGarageRoster?: () => void;
  deviceLayoutMode?: DeviceLayoutMode;
  traditionalMode?: boolean;
  onToggleTraditionalMode?: (next: boolean) => void;
}

type UnifiedWorkshopTab =
  | 'weapons'
  | 'placement'
  | 'chassis'
  | 'armor'
  | 'wheels'
  | 'drive'
  | 'paint'
  | 'cosmetics'
  | 'arenas'
  | 'favorites';

export const WorkshopDock: React.FC<WorkshopDockProps> = ({
  config,
  skills,
  savedLoadouts,
  activeLoadoutSlot = 0,
  onSelectLoadoutSlot,
  onChange,
  onStartFight,
  selectedArena = 'foundry',
  onSelectArena,
  profile,
  onBuyPart,
  onUpgradePart,
  onUpdateFavorites,
  canStepBack = false,
  canStepForward = false,
  onStepBack,
  onStepForward,
  deviceLayoutMode = 'auto',
  traditionalMode = false,
  onToggleTraditionalMode,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<UnifiedWorkshopTab>('weapons');
  const [onlyFavWeapons, setOnlyFavWeapons] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [placementSlot, setPlacementSlot] = useState(0);

  const favorites: FavoritesList = profile.favorites ?? {
    weapons: ['laser', 'vspinner', 'railgun'],
    chassis: ['wedge', 'brawler'],
    arenas: ['foundry', 'aether_nexus'],
    builds: [],
  };

  const updateFavs = (patch: Partial<FavoritesList>) => {
    onUpdateFavorites?.({
      ...favorites,
      ...patch,
    });
  };

  const toggleFavWeapon = (wId: WeaponId, e: React.MouseEvent) => {
    e.stopPropagation();
    const exists = favorites.weapons.includes(wId);
    updateFavs({
      weapons: exists ? favorites.weapons.filter((w) => w !== wId) : [...favorites.weapons, wId],
    });
  };

  const toggleFavChassis = (cId: ChassisId, e: React.MouseEvent) => {
    e.stopPropagation();
    const exists = favorites.chassis.includes(cId);
    updateFavs({
      chassis: exists ? favorites.chassis.filter((c) => c !== cId) : [...favorites.chassis, cId],
    });
  };

  const toggleFavArena = (aId: ArenaId, e: React.MouseEvent) => {
    e.stopPropagation();
    const exists = favorites.arenas.includes(aId);
    updateFavs({
      arenas: exists ? favorites.arenas.filter((a) => a !== aId) : [...favorites.arenas, aId],
    });
  };

  const saveCurrentBuildToFavorites = () => {
    const newBuild = {
      id: `fav_build_${Date.now()}`,
      label: `${config.name || 'Custom Bot'} (${getBotWeapons(config)
        .map((w) => WEAPON_CATALOG[w].label.split(' ')[0])
        .join('+') || 'Unarmed'})`,
      config: JSON.parse(JSON.stringify(config)) as BotConfig,
      savedAt: new Date().toISOString(),
    };
    updateFavs({
      builds: [newBuild, ...(favorites.builds || []).slice(0, 14)],
    });
    setNotice(`Saved "${config.name}" to your Favorites List!`);
    window.setTimeout(() => setNotice(null), 2400);
  };

  const removeFavBuild = (id: string) => {
    updateFavs({
      builds: (favorites.builds || []).filter((b) => b.id !== id),
    });
  };

  const coinBalance = profile.coins ?? profile.scrap ?? 0;
  const pilotLevel = profile.level ?? 1;

  // Locked items require Pilot Level and/or Coins to unlock
  const ensureOwned = (cat: PartCategory, id: string, label: string): boolean => {
    if (isPartOwned(profile, cat, id)) return true;
    const price = getPartPrice(cat, id);
    const reqLv = getPartUnlockLevel(cat, id);
    if (cat !== 'arena' && pilotLevel < reqLv) {
      setNotice(`${label} unlocks at Pilot Lv ${reqLv} (${price} Coins). Battle to gain XP Points!`);
      window.setTimeout(() => setNotice(null), 3000);
      return false;
    }
    if (onBuyPart(cat, id)) {
      setNotice(`Unlocked ${label} for ${price} Coins!`);
      window.setTimeout(() => setNotice(null), 2600);
      return true;
    }
    setNotice(
      cat === 'arena'
        ? `${label} unlocks at Pilot Lv ${reqLv} or ${price} Coins.`
        : `${label} costs ${price} Coins. Earn Coins in battles!`,
    );
    window.setTimeout(() => setNotice(null), 2800);
    return false;
  };
  const owned = (cat: PartCategory, id: string) => isPartOwned(profile, cat, id);

  const handleUpgradeClick = (cat: PartCategory, id: string, label: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const curLv = getPartUpgradeLevel(profile, cat, id);
    if (curLv >= MAX_PART_UPGRADE_LEVEL) return;
    const cost = getPartUpgradeCost(cat, id, curLv);
    if (onUpgradePart?.(cat, id)) {
      setNotice(`Upgraded ${label} to Lv ${curLv + 1} (-${cost} Coins)!`);
    } else {
      setNotice(`Need ${cost} Coins to upgrade ${label} to Lv ${curLv + 1}.`);
    }
    window.setTimeout(() => setNotice(null), 2500);
  };

  const PriceTag = ({ cat, id }: { cat: PartCategory; id: string }) => {
    if (owned(cat, id)) return null;
    const price = getPartPrice(cat, id);
    const reqLv = getPartUnlockLevel(cat, id);
    const lvOk = cat === 'arena' || pilotLevel >= reqLv;
    return (
      <span
        className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
          lvOk && coinBalance >= price
            ? 'bg-amber-500/20 text-amber-300'
            : 'bg-slate-800 text-slate-400'
        }`}
      >
        <Lock className="h-3 w-3" />
        {reqLv > 1 ? `Lv${reqLv} · ${price}` : `${price} Coins`}
      </span>
    );
  };

  const UpgradePill = ({ cat, id, label }: { cat: PartCategory; id: string; label: string }) => {
    if (!owned(cat, id) || !onUpgradePart) return null;
    const curLv = getPartUpgradeLevel(profile, cat, id);
    const isMax = curLv >= MAX_PART_UPGRADE_LEVEL;
    const cost = getPartUpgradeCost(cat, id, curLv);
    const canAfford = coinBalance >= cost;
    return (
      <button
        type="button"
        onClick={(e) => handleUpgradeClick(cat, id, label, e)}
        disabled={isMax}
        title={isMax ? 'Max Upgrade Level' : `Level up ${label} with Coins`}
        className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold font-mono-tabular transition ${
          isMax
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
            : canAfford
              ? 'bg-sky-500/20 text-sky-200 border border-sky-400/50 hover:bg-sky-500/35'
              : 'bg-slate-800/80 text-slate-400 border border-slate-700'
        }`}
      >
        {isMax ? `Lv${curLv} MAX` : `Lv${curLv} ↑ ${cost}c`}
      </button>
    );
  };

  const stats = computeBotStats(config, skills, profile.partUpgrades);
  const activeWeapons = getBotWeapons(config);
  const activePlacements = getBotWeaponPlacements(config);
  const activeStyles = getBotChassisStyles(config);
  const clampedPlacementSlot = Math.min(placementSlot, Math.max(0, activeWeapons.length - 1));

  // Allow clicking any mounted weapon off (even down to 0 weapons) so you never have to scroll back
  const toggleWeapon = (wId: WeaponId) => {
    const idx = activeWeapons.indexOf(wId);
    let next: WeaponId[];
    let nextPlacements: WeaponPlacementConfig[];
    if (idx >= 0) {
      next = activeWeapons.filter((w) => w !== wId);
      nextPlacements = activePlacements.filter((_, i) => i !== idx);
    } else if (!ensureOwned('weapon', wId, WEAPON_CATALOG[wId].label)) {
      return;
    } else if (activeWeapons.length < 3) {
      next = [...activeWeapons, wId];
      nextPlacements = [
        ...activePlacements,
        getDefaultWeaponPlacement(wId, activeWeapons.length),
      ];
      setPlacementSlot(next.length - 1);
    } else {
      next = [activeWeapons[0], activeWeapons[1], wId];
      nextPlacements = [
        activePlacements[0] ?? getDefaultWeaponPlacement(activeWeapons[0], 0),
        activePlacements[1] ?? getDefaultWeaponPlacement(activeWeapons[1], 1),
        getDefaultWeaponPlacement(wId, 2),
      ];
      setPlacementSlot(2);
    }
    onChange({
      ...config,
      weapon: next[0] ?? config.weapon,
      weapons: next,
      weaponPlacements: nextPlacements,
    });
  };

  const clearAllWeapons = () => {
    onChange({
      ...config,
      weapons: [],
      weaponPlacements: [],
    });
  };

  const updateWeaponPlacement = (slotIdx: number, patch: Partial<WeaponPlacementConfig>) => {
    const nextPlacements = activeWeapons.map((wId, idx) => {
      const current = activePlacements[idx] ?? getDefaultWeaponPlacement(wId, idx);
      if (idx !== slotIdx) return current;
      const updated = { ...current, ...patch };
      if (patch.zone && patch.yawDeg === undefined) {
        const zoneSpec = WEAPON_MOUNT_ZONES.find((z) => z.id === patch.zone);
        if (zoneSpec) {
          updated.yawDeg = zoneSpec.defaultYawDeg;
        }
      }
      return updated;
    });
    onChange({
      ...config,
      weaponPlacements: nextPlacements,
    });
  };

  const resetWeaponPlacement = (slotIdx: number) => {
    const wId = activeWeapons[slotIdx];
    if (!wId) return;
    const def = getDefaultWeaponPlacement(wId, slotIdx);
    const nextPlacements = activeWeapons.map((w, idx) =>
      idx === slotIdx ? def : activePlacements[idx] ?? getDefaultWeaponPlacement(w, idx),
    );
    onChange({
      ...config,
      weaponPlacements: nextPlacements,
    });
  };

  const toggleChassisStyle = (cId: ChassisId) => {
    const idx = activeStyles.indexOf(cId);
    let next: ChassisId[];
    if (idx >= 0) {
      if (activeStyles.length <= 1) return;
      next = activeStyles.filter((c) => c !== cId);
    } else if (!ensureOwned('chassis', cId, CHASSIS_CATALOG[cId].label)) {
      return;
    } else if (activeStyles.length < 3) {
      next = [...activeStyles, cId];
    } else {
      next = [activeStyles[0], activeStyles[1], cId];
    }
    onChange({ ...config, chassis: next[0], chassisStyles: next });
  };

  const handleRandomize = () => {
    const allChassis = (Object.keys(CHASSIS_CATALOG) as ChassisId[]).filter((c) => owned('chassis', c));
    const allWeapons = (Object.keys(WEAPON_CATALOG) as WeaponId[]).filter((w) => owned('weapon', w));
    const allArmors = (Object.keys(ARMOR_CATALOG) as ArmorId[]).filter((a) => owned('armor', a));
    const allWheels = Object.keys(WHEEL_LAYOUT_CATALOG) as WheelLayoutId[];
    const allDrives = (Object.keys(DRIVE_CATALOG) as DriveId[]).filter((d) => owned('drive', d));
    const allFinishes = (Object.keys(FINISH_CATALOG) as FinishStyleId[]).filter((f) => owned('finish', f));
    const allPatterns = (Object.keys(PATTERN_CATALOG) as PatternId[]).filter((p) => owned('pattern', p));
    const allAccessories = (Object.keys(ACCESSORY_CATALOG) as AccessoryId[]).filter((a) => owned('accessory', a));

    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const c1 = pick(allChassis);
    const otherChassis = allChassis.filter((c) => c !== c1);
    const c2 = otherChassis.length > 0 ? pick(otherChassis) : c1;
    const w1 = pick(allWeapons);
    const otherWeapons = allWeapons.filter((w) => w !== w1);
    const w2 = otherWeapons.length > 0 ? pick(otherWeapons) : w1;
    const paint = pick(PAINT_PRESETS);

    onChange({
      ...config,
      name: generateRandomBotName(config.name),
      chassis: c1,
      chassisStyles: c2 !== c1 && Math.random() < 0.7 ? [c1, c2] : [c1],
      armor: pick(allArmors),
      weapon: w1,
      weapons: w2 !== w1 && Math.random() < 0.75 ? [w1, w2] : [w1],
      wheelLayout: pick(allWheels),
      drive: pick(allDrives),
      primaryColor: paint.primary,
      accentColor: paint.accent,
      finishStyle: pick(allFinishes),
      pattern: pick(allPatterns),
      accessory: pick(allAccessories),
      underglowColor: paint.underglow,
    });
  };

  if (collapsed) {
    return (
      <div
        id="workshop-dock"
        className="pointer-events-none fixed left-3 sm:left-4 top-28 z-20 flex flex-col items-start gap-2"
      >
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="pointer-events-auto flex items-center gap-2 rounded-xl border border-slate-700/90 bg-[#12161C]/95 px-4 py-3 text-xs font-bold text-slate-100 shadow-2xl hover:border-amber-500/60 hover:text-amber-300 transition whitespace-nowrap"
        >
          <ChevronRight className="h-4 w-4 text-amber-400" />
          <span>Show Customization Menu</span>
        </button>
        <button
          type="button"
          onClick={onStartFight}
          className="pointer-events-auto rounded-xl bg-emerald-500 px-4 py-3 text-xs font-bold text-slate-950 shadow-xl hover:bg-emerald-400 transition whitespace-nowrap"
        >
          Enter Arena
        </button>
      </div>
    );
  }

  const displayedWeaponIds = (Object.keys(WEAPON_CATALOG) as WeaponId[]).filter(
    (wId) =>
      (onlyFavWeapons ? favorites.weapons.includes(wId) : true) &&
      (traditionalMode ? isTraditionalWeapon(wId) : true),
  );

  const isForcedMobile = deviceLayoutMode === 'mobile';
  const isForcedTablet = deviceLayoutMode === 'tablet';
  const isForcedDesktop = deviceLayoutMode === 'desktop';

  const unifiedAsideClass = isForcedMobile
    ? 'pointer-events-none fixed inset-x-2 bottom-2 top-28 z-20 flex flex-col pb-safe'
    : isForcedTablet
      ? 'pointer-events-none fixed left-2 top-28 bottom-2 z-20 flex w-[380px] flex-col pb-safe'
      : isForcedDesktop
        ? 'pointer-events-none fixed left-3 sm:left-4 top-28 bottom-3 z-20 flex w-[435px] xl:w-[475px] flex-col pb-safe'
        : 'pointer-events-none fixed left-3 sm:left-4 top-28 bottom-3 z-20 flex w-[calc(100vw-1.5rem)] sm:w-[415px] lg:w-[445px] xl:w-[475px] flex-col pb-safe';

  return (
    <aside
      id="workshop-dock"
      aria-label="Unified Bot Customizer & Arena Controls"
      className={unifiedAsideClass}
    >
      <div className="pointer-events-auto flex h-full min-h-0 flex-col rounded-2xl border border-slate-700/85 bg-[#12161C]/95 p-3 sm:p-4 shadow-2xl backdrop-blur-md">
        {/* Row 1: Garage Bays + Traditional Mode + Save Build + Hide + Enter Arena */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-800 pb-2">
          {savedLoadouts && onSelectLoadoutSlot ? (
            <div className="flex items-center gap-1 min-w-0">
              {[0, 1, 2].map((slotIdx) => {
                const slotBot = savedLoadouts[slotIdx];
                const isCurrent = activeLoadoutSlot === slotIdx;
                return (
                  <button
                    key={slotIdx}
                    type="button"
                    onClick={() => onSelectLoadoutSlot(slotIdx)}
                    title={slotBot?.name || `Bay ${slotIdx + 1}`}
                    className={`rounded-lg px-2 py-1 text-xs font-bold transition whitespace-nowrap ${
                      isCurrent
                        ? 'bg-amber-500 text-slate-950 shadow'
                        : 'bg-[#19202A] text-slate-300 hover:text-white'
                    }`}
                  >
                    Bay {slotIdx + 1}
                  </button>
                );
              })}
            </div>
          ) : (
            <span className="font-display text-sm font-bold text-white">Bot Customizer</span>
          )}

          <div className="flex items-center gap-1 shrink-0">
            {onToggleTraditionalMode && (
              <button
                type="button"
                onClick={() => {
                  const next = !traditionalMode;
                  onToggleTraditionalMode(next);
                  if (next) {
                    onChange(sanitizeConfigForTraditionalMode(config));
                    if (!isTraditionalArena(selectedArena)) {
                      onSelectArena?.('colosseum');
                    }
                    setNotice('Traditional Mode Active: Classic BattleBox arenas & mechanical weapons only!');
                    window.setTimeout(() => setNotice(null), 2600);
                  }
                }}
                title="Toggle Traditional Mode (Normal BattleBox arenas & mechanical weapons only)"
                className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-extrabold transition whitespace-nowrap cursor-pointer ${
                  traditionalMode
                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200 shadow'
                    : 'border-slate-700 bg-[#19202A] text-slate-300 hover:text-white'
                }`}
              >
                <Shield className="h-3 w-3" />
                <span>{traditionalMode ? 'Trad: ON' : 'Traditional'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={saveCurrentBuildToFavorites}
              title="Save current bot configuration to your Favorites list"
              className="flex items-center gap-1 rounded-lg border border-amber-500/50 bg-amber-500/15 px-2 py-1 text-[11px] font-bold text-amber-300 hover:bg-amber-500/25 transition whitespace-nowrap"
            >
              <BookmarkPlus className="h-3 w-3" />
              <span>★ Save</span>
            </button>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              title="Minimize customizer menu"
              className="flex items-center gap-1 rounded-lg border border-slate-700 bg-[#19202A] px-2 py-1 text-[11px] font-semibold text-slate-300 hover:text-amber-300 transition whitespace-nowrap"
            >
              <ChevronLeft className="h-3 w-3" />
              <span>Hide</span>
            </button>
            <button
              type="button"
              onClick={onStartFight}
              className="rounded-lg bg-emerald-500 px-2.5 py-1 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 transition whitespace-nowrap shadow"
            >
              Enter Arena
            </button>
          </div>
        </div>

        {/* Row 2: Bot Callsign + Random Name + History Back / Random Build / Forward */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <label className="flex flex-1 items-center gap-1.5 min-w-[125px]">
            <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap">Bot</span>
            <input
              type="text"
              maxLength={18}
              value={config.name}
              placeholder="Name on bot..."
              onChange={(e) => onChange({ ...config, name: e.target.value })}
              aria-label="Bot Name (printed on 3D hull)"
              className="w-full min-w-0 rounded-xl border border-slate-700 bg-[#0D1014] px-2.5 py-1 text-xs font-bold text-white focus:border-amber-500 focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => onChange({ ...config, name: generateRandomBotName(config.name) })}
            title="Random Bot Name Generator"
            className="flex items-center gap-1 rounded-xl border border-amber-500/50 bg-amber-500/15 px-2 py-1 text-xs font-extrabold text-amber-300 hover:bg-amber-500/25 transition whitespace-nowrap shrink-0"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Name</span>
          </button>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onStepBack}
              disabled={!canStepBack}
              title="Previous Bot Build"
              className={`flex h-7 w-7 items-center justify-center rounded-xl border text-xs font-bold transition ${
                canStepBack
                  ? 'border-sky-500/60 bg-[#19202A] text-sky-300 hover:border-sky-400 hover:text-white'
                  : 'border-slate-800 bg-[#12161C] text-slate-600 cursor-not-allowed'
              }`}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleRandomize}
              title="Generate a random hybrid bot build & name"
              className="flex items-center gap-1 rounded-xl border border-slate-700 bg-[#19202A] px-2 py-1 text-xs font-semibold text-sky-300 hover:text-sky-200 transition whitespace-nowrap"
            >
              <Shuffle className="h-3.5 w-3.5" />
              <span>Random</span>
            </button>
            <button
              type="button"
              onClick={onStepForward}
              disabled={!canStepForward}
              title="Next Bot Build"
              className={`flex h-7 w-7 items-center justify-center rounded-xl border text-xs font-bold transition ${
                canStepForward
                  ? 'border-sky-500/60 bg-[#19202A] text-sky-300 hover:border-sky-400 hover:text-white'
                  : 'border-slate-800 bg-[#12161C] text-slate-600 cursor-not-allowed'
              }`}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Row 3: Live Bot Performance Telemetry */}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5 rounded-xl border border-slate-800 bg-[#0D1014] px-2.5 py-1.5 text-[11px] text-slate-200 font-mono-tabular">
          <span className="font-sans font-bold text-amber-300">
            {stats.weightClass} ({stats.bodyScale}×)
          </span>
          <span>HP {stats.maxHp}</span>
          {stats.maxShieldHp > 0 && <span className="text-sky-400 font-bold">SHD +{stats.maxShieldHp}</span>}
          <span>ARM {stats.armorZoneHp}</span>
          <span>DMG {stats.weaponDamage}</span>
          <span>SPD {stats.maxSpeed}</span>
          <span className="text-amber-400 font-extrabold">PWR {stats.powerScore}</span>
        </div>

        {/* Row 4: Unified Customization Category Tabs */}
        <div className="mt-2 grid grid-cols-5 gap-1">
          {(
            [
              { id: 'weapons', label: `Wpns (${activeWeapons.length}/3)`, Icon: Swords },
              { id: 'placement', label: '3D Mounts', Icon: Wrench },
              { id: 'chassis', label: `Hull (${activeStyles.length}/3)`, Icon: Wrench },
              { id: 'armor', label: 'Armor', Icon: Shield },
              { id: 'wheels', label: 'Wheels', Icon: CircleDot },
              { id: 'drive', label: 'Drive', Icon: Gauge },
              { id: 'paint', label: 'Paint', Icon: Palette },
              { id: 'cosmetics', label: 'FX & Top', Icon: Sparkles },
              { id: 'arenas', label: 'Arenas', Icon: MapPin },
              {
                id: 'favorites',
                label: `★ Favs (${favorites.weapons.length + (favorites.builds?.length ?? 0)})`,
                Icon: Star,
              },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex items-center justify-center gap-1 rounded-xl px-1.5 py-1.5 text-[11px] font-bold transition whitespace-nowrap cursor-pointer ${
                activeTab === id
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'bg-[#19202A] text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="h-3 w-3 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>

        {/* Active Mounted Weapons Strip (shown when Weapons or 3D Mounts tab is active) */}
        {(activeTab === 'weapons' || activeTab === 'placement') && (
          <div className="mt-2 rounded-xl border border-slate-800 bg-[#0D1014]/95 p-2.5 text-xs text-slate-300">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-200">
                Active Weapons ({activeWeapons.length}/3 Mounted):
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setOnlyFavWeapons((v) => !v)}
                  className={`flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-bold transition ${
                    onlyFavWeapons
                      ? 'border-yellow-400/70 bg-yellow-500/20 text-yellow-200'
                      : 'border-slate-700 bg-slate-900 text-slate-300 hover:text-yellow-300'
                  }`}
                >
                  <Star className={`h-3 w-3 ${onlyFavWeapons ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                  <span>{onlyFavWeapons ? 'Showing ★' : 'Filter ★'}</span>
                </button>
                {activeWeapons.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAllWeapons}
                    className="flex items-center gap-1 rounded-lg border border-rose-500/50 bg-rose-500/15 px-2 py-0.5 text-[11px] font-bold text-rose-300 hover:bg-rose-500/25 transition whitespace-nowrap"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    <span>All Off</span>
                  </button>
                )}
              </div>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {activeWeapons.length === 0 ? (
                <span className="text-[11px] font-medium text-amber-300">
                  All weapons turned OFF — click any weapon card below to equip Slot #1 [←]
                </span>
              ) : (
                activeWeapons.map((wId, idx) => {
                  const arrowSym = idx === 0 ? '←' : idx === 1 ? '↑' : '→';
                  return (
                    <button
                      key={wId}
                      type="button"
                      onClick={() => toggleWeapon(wId)}
                      title="Click to turn off this weapon"
                      className="flex items-center gap-1.5 rounded-lg border border-amber-500/60 bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-200 hover:bg-amber-500/25 transition whitespace-nowrap"
                    >
                      <span className="font-mono-tabular rounded bg-amber-500/30 px-1 py-0.5 text-[10px] font-extrabold text-amber-100">
                        {arrowSym}
                      </span>
                      <span>
                        #{idx + 1} {WEAPON_CATALOG[wId].label} ×
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {notice && (
          <div className="mt-2 rounded-xl border border-amber-500/50 bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-200">
            {notice}
          </div>
        )}

        {/* UNIFIED SCROLLABLE BODY */}
        <div className="mt-2 flex-1 min-h-0 overflow-y-auto pr-1 space-y-2.5">
          {activeTab === 'weapons' &&
            displayedWeaponIds.map((wId) => {
                const item = WEAPON_CATALOG[wId];
                const slotIdx = activeWeapons.indexOf(wId);
                const active = slotIdx >= 0;
                const isFav = favorites.weapons.includes(wId);
                const slotArrow = slotIdx === 0 ? '←' : slotIdx === 1 ? '↑' : '→';
                return (
                  <div
                    key={wId}
                    onClick={() => toggleWeapon(wId)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleWeapon(wId);
                      }
                    }}
                    className={`cursor-pointer relative w-full text-left rounded-2xl border-2 p-3.5 transition ${
                      active
                        ? 'border-amber-400 bg-amber-500/16 shadow-lg'
                        : 'border-slate-800 bg-[#161B22] hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          type="button"
                          onClick={(e) => toggleFavWeapon(wId, e)}
                          title={isFav ? 'Checked in Favorites (click to uncheck)' : 'Check to add to Favorites'}
                          className="rounded p-0.5 text-yellow-400 hover:scale-110 transition shrink-0"
                        >
                          {isFav ? (
                            <CheckSquare className="h-4 w-4 fill-yellow-400/20 text-yellow-400" />
                          ) : (
                            <Square className="h-4 w-4 text-slate-500 hover:text-yellow-300" />
                          )}
                        </button>
                        <span className="text-sm font-extrabold text-white truncate">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <PriceTag cat="weapon" id={wId} />
                        <UpgradePill cat="weapon" id={wId} label={item.label} />
                        <span
                          className={`font-mono-tabular text-xs rounded-lg px-2.5 py-1 font-bold ${
                            active
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-slate-900 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {active ? `${slotArrow} ON · #${slotIdx + 1} (Off)` : `${item.damage} DMG`}
                        </span>
                      </div>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-sky-300 font-mono-tabular">
                      <span className="rounded bg-sky-500/15 px-1.5 py-0.5 font-bold">{item.category}</span>
                      <span>Range {item.range}m</span>
                      <span>·</span>
                      <span>Cooldown {item.cooldown}s</span>
                      <span>·</span>
                      <span>Knockback {item.impulse}</span>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">{item.subtitle}</p>
                  </div>
                );
              })}

            {activeTab === 'placement' && (
              <div className="rounded-2xl border border-slate-800 bg-[#141921] p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-sky-300">
                    3D Weapon Placement Customizer
                  </span>
                  {activeWeapons.length > 0 && (
                    <button
                      type="button"
                      onClick={() => resetWeaponPlacement(clampedPlacementSlot)}
                      className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:border-slate-500"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Reset Default</span>
                    </button>
                  )}
                </div>

                {activeWeapons.length === 0 ? (
                  <div className="rounded-xl border border-slate-800 bg-[#0D1014] p-4 text-center text-xs text-slate-400">
                    Mount at least 1 weapon from the Weapons tab to customize its 3D position, height, aim angle, and scale.
                  </div>
                ) : (
                  (() => {
                    const selWId = activeWeapons[clampedPlacementSlot] ?? activeWeapons[0];
                    const selPlacement =
                      activePlacements[clampedPlacementSlot] ??
                      getDefaultWeaponPlacement(selWId, clampedPlacementSlot);
                    return (
                      <>
                        <div className="flex items-center gap-1.5">
                          {activeWeapons.map((wId, idx) => {
                            const arrowSym = idx === 0 ? '←' : idx === 1 ? '↑' : '→';
                            const isSel = idx === clampedPlacementSlot;
                            return (
                              <button
                                key={`${wId}_${idx}`}
                                type="button"
                                onClick={() => setPlacementSlot(idx)}
                                className={`flex-1 rounded-xl border py-2 px-2 text-xs font-bold truncate transition ${
                                  isSel
                                    ? 'border-sky-400 bg-sky-500/25 text-sky-100'
                                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                #{idx + 1} [{arrowSym}] {WEAPON_CATALOG[wId].label.split(' ')[0]}
                              </button>
                            );
                          })}
                        </div>

                        <div className="text-xs font-semibold text-slate-300">Mount Zone Preset:</div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {WEAPON_MOUNT_ZONES.map((z) => {
                            const activeZone = selPlacement.zone === z.id;
                            return (
                              <button
                                key={z.id}
                                type="button"
                                onClick={() =>
                                  updateWeaponPlacement(clampedPlacementSlot, {
                                    zone: z.id as WeaponMountZone,
                                    offsetX: 0,
                                    offsetY: 0,
                                    offsetZ: 0,
                                  })
                                }
                                className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
                                  activeZone
                                    ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                                    : 'border-slate-800 bg-[#0D1014] text-slate-300 hover:border-slate-600'
                                }`}
                              >
                                {z.label}
                              </button>
                            );
                          })}
                        </div>

                        <div className="space-y-2.5 pt-2 text-xs">
                          <label className="flex flex-col gap-1">
                            <div className="flex justify-between text-slate-300 font-mono-tabular">
                              <span>Left / Right Offset (X)</span>
                              <span className="text-amber-300 font-bold">{selPlacement.offsetX.toFixed(2)}m</span>
                            </div>
                            <input
                              type="range"
                              min={-0.85}
                              max={0.85}
                              step={0.05}
                              value={selPlacement.offsetX}
                              onChange={(e) =>
                                updateWeaponPlacement(clampedPlacementSlot, {
                                  offsetX: parseFloat(e.target.value),
                                })
                              }
                              className="h-2 accent-amber-500 cursor-pointer"
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <div className="flex justify-between text-slate-300 font-mono-tabular">
                              <span>Vertical Elevation (Y)</span>
                              <span className="text-amber-300 font-bold">{selPlacement.offsetY.toFixed(2)}m</span>
                            </div>
                            <input
                              type="range"
                              min={-0.35}
                              max={0.65}
                              step={0.05}
                              value={selPlacement.offsetY}
                              onChange={(e) =>
                                updateWeaponPlacement(clampedPlacementSlot, {
                                  offsetY: parseFloat(e.target.value),
                                })
                              }
                              className="h-2 accent-amber-500 cursor-pointer"
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <div className="flex justify-between text-slate-300 font-mono-tabular">
                              <span>Forward / Rear Offset (Z)</span>
                              <span className="text-amber-300 font-bold">{selPlacement.offsetZ.toFixed(2)}m</span>
                            </div>
                            <input
                              type="range"
                              min={-0.85}
                              max={0.85}
                              step={0.05}
                              value={selPlacement.offsetZ}
                              onChange={(e) =>
                                updateWeaponPlacement(clampedPlacementSlot, {
                                  offsetZ: parseFloat(e.target.value),
                                })
                              }
                              className="h-2 accent-amber-500 cursor-pointer"
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <div className="flex justify-between text-slate-300 font-mono-tabular">
                              <span>Aim Orientation Angle</span>
                              <span className="text-sky-300 font-bold">{Math.round(selPlacement.yawDeg)}°</span>
                            </div>
                            <input
                              type="range"
                              min={-180}
                              max={180}
                              step={15}
                              value={selPlacement.yawDeg}
                              onChange={(e) =>
                                updateWeaponPlacement(clampedPlacementSlot, {
                                  yawDeg: parseFloat(e.target.value),
                                })
                              }
                              className="h-2 accent-sky-400 cursor-pointer"
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <div className="flex justify-between text-slate-300 font-mono-tabular">
                              <span>Weapon Scale</span>
                              <span className="text-amber-300 font-bold">
                                {Math.round((selPlacement.scale || 1) * 100)}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0.75}
                              max={1.35}
                              step={0.05}
                              value={selPlacement.scale || 1}
                              onChange={(e) =>
                                updateWeaponPlacement(clampedPlacementSlot, {
                                  scale: parseFloat(e.target.value),
                                })
                              }
                              className="h-2 accent-amber-500 cursor-pointer"
                            />
                          </label>
                        </div>
                      </>
                    );
                  })()
                )}
              </div>
            )}

            {activeTab === 'favorites' && (
              <div className="space-y-3">
                {/* Saved Favorite Builds */}
                <div className="rounded-2xl border border-yellow-500/40 bg-[#151821] p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-yellow-300">
                      ★ Saved Favorite Bot Builds ({(favorites.builds || []).length})
                    </span>
                    <button
                      type="button"
                      onClick={saveCurrentBuildToFavorites}
                      className="rounded-lg bg-yellow-400 px-2.5 py-1 text-[11px] font-extrabold text-slate-950 hover:bg-yellow-300 transition"
                    >
                      + Save Current Bot
                    </button>
                  </div>
                  {(favorites.builds || []).length === 0 ? (
                    <p className="mt-2 text-xs text-slate-400">
                      Click "+ Save Current Bot" anytime to bookmark your favorite custom bot loadouts and return to them with one click.
                    </p>
                  ) : (
                    <div className="mt-2.5 space-y-2">
                      {(favorites.builds || []).map((b) => (
                        <div
                          key={b.id}
                          className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-[#0D1014] px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">{b.label}</div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {CHASSIS_CATALOG[b.config.chassis]?.label} · {ARMOR_CATALOG[b.config.armor]?.label}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                onChange({ ...b.config });
                                setNotice(`Loaded favorite build: ${b.label}`);
                                window.setTimeout(() => setNotice(null), 2000);
                              }}
                              className="rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-bold text-slate-950 hover:bg-amber-400"
                            >
                              Load
                            </button>
                            <button
                              type="button"
                              onClick={() => removeFavBuild(b.id)}
                              className="rounded-lg border border-slate-700 p-1 text-slate-400 hover:text-rose-400"
                              title="Remove build from favorites"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Checked Favorite Weapons */}
                <div className="rounded-2xl border border-slate-800 bg-[#151821] p-3.5">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                    ★ Checked Favorite Weapons ({favorites.weapons.length})
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-1.5">
                    {favorites.weapons.map((wId) => {
                      const item = WEAPON_CATALOG[wId];
                      if (!item) return null;
                      const mounted = activeWeapons.includes(wId);
                      return (
                        <div
                          key={wId}
                          onClick={() => toggleWeapon(wId)}
                          role="button"
                          tabIndex={0}
                          className={`cursor-pointer flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-bold ${
                            mounted
                              ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                              : 'border-slate-800 bg-[#0D1014] text-slate-200 hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => toggleFavWeapon(wId, e)}
                              className="text-yellow-400"
                            >
                              <CheckSquare className="h-4 w-4" />
                            </button>
                            <span>{item.label}</span>
                          </div>
                          <span className="font-mono-tabular text-[11px]">
                            {mounted ? 'MOUNTED (Click Off)' : 'Click to Equip'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Checked Favorite Arenas */}
                <div className="rounded-2xl border border-slate-800 bg-[#151821] p-3.5">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-sky-300">
                    ★ Checked Favorite Arenas ({favorites.arenas.length})
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-1.5">
                    {favorites.arenas.map((aId) => {
                      const ar = ARENA_CATALOG[aId];
                      if (!ar) return null;
                      const isSel = selectedArena === aId;
                      return (
                        <div
                          key={aId}
                          onClick={() => {
                            if (ensureOwned('arena', aId, ar.name)) onSelectArena?.(aId);
                          }}
                          role="button"
                          tabIndex={0}
                          className={`cursor-pointer flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-bold ${
                            isSel
                              ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                              : 'border-slate-800 bg-[#0D1014] text-slate-200 hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => toggleFavArena(aId, e)}
                              className="text-yellow-400"
                            >
                              <CheckSquare className="h-4 w-4" />
                            </button>
                            <span>{ar.name}</span>
                          </div>
                          <span className="font-mono-tabular text-[11px]">
                            {!owned('arena', aId) ? `🔒 Lv${getPartUnlockLevel('arena', aId)}` : isSel ? 'ACTIVE ARENA' : 'Select Arena'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'chassis' &&
              (Object.keys(CHASSIS_CATALOG) as ChassisId[]).map((cId) => {
                const item = CHASSIS_CATALOG[cId];
                const slotIdx = activeStyles.indexOf(cId);
                const active = slotIdx >= 0;
                const isFav = favorites.chassis.includes(cId);
                return (
                  <div
                    key={cId}
                    onClick={() => toggleChassisStyle(cId)}
                    role="button"
                    tabIndex={0}
                    className={`cursor-pointer relative w-full text-left rounded-2xl border-2 p-3.5 transition ${
                      active
                        ? 'border-amber-400 bg-amber-500/16 shadow-lg'
                        : 'border-slate-800 bg-[#161B22] hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          type="button"
                          onClick={(e) => toggleFavChassis(cId, e)}
                          title="Check to favorite this chassis"
                          className="rounded p-0.5 text-yellow-400 hover:scale-110 transition shrink-0"
                        >
                          {isFav ? (
                            <CheckSquare className="h-4 w-4 fill-yellow-400/20 text-yellow-400" />
                          ) : (
                            <Square className="h-4 w-4 text-slate-500 hover:text-yellow-300" />
                          )}
                        </button>
                        <span className="text-sm font-extrabold text-white truncate">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <PriceTag cat="chassis" id={cId} />
                        <UpgradePill cat="chassis" id={cId} label={item.label} />
                        <span className="font-mono-tabular text-xs rounded-lg bg-slate-900 px-2.5 py-1 font-bold text-amber-400">
                          {slotIdx === 0 ? 'Core Hull' : active ? `Hybrid #${slotIdx + 1}` : item.sizeTag}
                        </span>
                      </div>
                    </div>
                    <div className="mt-1.5 text-xs text-sky-300 font-mono-tabular">
                      {item.baseHp} Base HP · {Math.round(item.speedMult * 100)}% Speed ·{' '}
                      {Math.round(item.frontDeflect * 100)}% Front Deflect
                    </div>
                    <p className="mt-1 text-xs text-slate-300">{item.subtitle}</p>
                  </div>
                );
              })}

            {activeTab === 'arenas' &&
              (Object.keys(ARENA_CATALOG) as ArenaId[])
                .filter((aId) => (traditionalMode ? isTraditionalArena(aId) : true))
                .map((aId) => {
                  const ar = ARENA_CATALOG[aId];
                  const active = selectedArena === aId;
                  const isFav = favorites.arenas.includes(aId);
                  const arenaUnlocked = owned('arena', aId);
                  return (
                    <div
                      key={aId}
                      onClick={() => {
                        if (ensureOwned('arena', aId, ar.name)) onSelectArena?.(aId);
                      }}
                      role="button"
                      tabIndex={0}
                      className={`cursor-pointer relative w-full text-left rounded-2xl border-2 p-3.5 transition ${
                        !arenaUnlocked
                          ? 'border-slate-800/80 bg-[#12161D] opacity-85 hover:border-amber-500/40'
                          : active
                            ? 'border-sky-400 bg-sky-500/16 shadow-lg'
                            : 'border-slate-800 bg-[#161B22] hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            type="button"
                            onClick={(e) => toggleFavArena(aId, e)}
                            title="Check to favorite this arena"
                            className="rounded p-0.5 text-yellow-400 hover:scale-110 transition shrink-0"
                          >
                            {isFav ? (
                              <CheckSquare className="h-4 w-4 fill-yellow-400/20 text-yellow-400" />
                            ) : (
                              <Square className="h-4 w-4 text-slate-500 hover:text-yellow-300" />
                            )}
                          </button>
                          <span className="text-sm font-extrabold text-white truncate">{ar.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <PriceTag cat="arena" id={aId} />
                          <span
                            className={`font-mono-tabular text-xs rounded-lg px-2.5 py-1 font-bold ${
                              !arenaUnlocked
                                ? 'bg-slate-900 text-slate-400'
                                : active
                                  ? 'bg-sky-400 text-slate-950'
                                  : 'bg-slate-900 text-sky-300'
                            }`}
                          >
                            {!arenaUnlocked ? 'LOCKED' : active ? 'SELECTED' : 'Preview 3D'}
                          </span>
                        </div>
                      </div>
                      <div className="mt-1 text-xs font-bold text-amber-300">{ar.subtitle}</div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {ar.hazardTag.split('·').map((hz) => (
                          <span
                            key={hz.trim()}
                            className="rounded-md border border-slate-700 bg-slate-900/90 px-2 py-0.5 text-[10px] font-semibold text-slate-200"
                          >
                            {hz.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}

            {activeTab === 'armor' &&
              (Object.keys(ARMOR_CATALOG) as ArmorId[]).map((aId) => {
                const item = ARMOR_CATALOG[aId];
                const active = config.armor === aId;
                return (
                  <div
                    key={aId}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (ensureOwned('armor', aId, item.label)) onChange({ ...config, armor: aId });
                    }}
                    className={`cursor-pointer relative w-full text-left rounded-2xl border-2 p-3.5 transition ${
                      active
                        ? 'border-amber-400 bg-amber-500/16'
                        : 'border-slate-800 bg-[#161B22] hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-extrabold text-white truncate">{item.label}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <PriceTag cat="armor" id={aId} />
                        <UpgradePill cat="armor" id={aId} label={item.label} />
                        <span className="font-mono-tabular text-xs font-bold text-amber-400">
                          +{item.hpBonus} HP · {item.zoneHp} ZN
                        </span>
                      </div>
                    </div>
                    <div className="mt-1 text-xs font-bold text-emerald-400">{item.specialPerk}</div>
                    <p className="mt-1 text-xs text-slate-300">{item.subtitle}</p>
                  </div>
                );
              })}

            {activeTab === 'wheels' &&
              (Object.keys(WHEEL_LAYOUT_CATALOG) as WheelLayoutId[]).map((wlId) => {
                const item = WHEEL_LAYOUT_CATALOG[wlId];
                const active = config.wheelLayout === wlId;
                return (
                  <button
                    key={wlId}
                    type="button"
                    onClick={() => onChange({ ...config, wheelLayout: wlId })}
                    className={`w-full text-left rounded-2xl border-2 p-3.5 transition ${
                      active
                        ? 'border-amber-400 bg-amber-500/16'
                        : 'border-slate-800 bg-[#161B22] hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-extrabold text-white truncate">{item.label}</span>
                      <span className="font-mono-tabular text-xs font-bold text-amber-400 shrink-0">
                        {Math.round(item.turnMult * 100)}% Turn Rate
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-300">{item.subtitle}</p>
                  </button>
                );
              })}

            {activeTab === 'drive' &&
              (Object.keys(DRIVE_CATALOG) as DriveId[]).map((dId) => {
                const item = DRIVE_CATALOG[dId];
                const active = config.drive === dId;
                return (
                  <div
                    key={dId}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (ensureOwned('drive', dId, item.label)) onChange({ ...config, drive: dId });
                    }}
                    className={`cursor-pointer relative w-full text-left rounded-2xl border-2 p-3.5 transition ${
                      active
                        ? 'border-amber-400 bg-amber-500/16'
                        : 'border-slate-800 bg-[#161B22] hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-extrabold text-white truncate">{item.label}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <PriceTag cat="drive" id={dId} />
                        <UpgradePill cat="drive" id={dId} label={item.label} />
                        <span className="font-mono-tabular text-xs font-bold text-amber-400">
                          {item.maxSpeed} m/s
                        </span>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-slate-300">{item.subtitle}</p>
                  </div>
                );
              })}

            {activeTab === 'paint' && (
              <div className="grid grid-cols-2 gap-2.5">
                <div className="col-span-full flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-[#0D1014] px-3.5 py-3">
                  <label className="flex items-center gap-2 text-xs text-slate-200 font-bold">
                    <span>Primary Hull</span>
                    <input
                      type="color"
                      value={config.primaryColor}
                      onChange={(e) => onChange({ ...config, primaryColor: e.target.value })}
                      className="h-8 w-12 cursor-pointer rounded border border-slate-700 bg-transparent"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-200 font-bold">
                    <span>Accent / Visor</span>
                    <input
                      type="color"
                      value={config.accentColor}
                      onChange={(e) => onChange({ ...config, accentColor: e.target.value })}
                      className="h-8 w-12 cursor-pointer rounded border border-slate-700 bg-transparent"
                    />
                  </label>
                </div>

                {PAINT_PRESETS.map((p) => {
                  const active = config.primaryColor === p.primary && config.accentColor === p.accent;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() =>
                        onChange({
                          ...config,
                          primaryColor: p.primary,
                          accentColor: p.accent,
                          underglowColor: p.underglow,
                        })
                      }
                      className={`flex items-center gap-2.5 rounded-2xl border-2 p-3 transition ${
                        active
                          ? 'border-amber-400 bg-amber-500/16'
                          : 'border-slate-800 bg-[#161B22] hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center -space-x-1.5 shrink-0">
                        <span
                          className="h-6 w-6 rounded-lg border border-white/20"
                          style={{ backgroundColor: p.primary }}
                        />
                        <span
                          className="h-5 w-5 rounded-full border border-white/30"
                          style={{ backgroundColor: p.accent }}
                        />
                      </div>
                      <span className="text-xs font-bold text-white truncate">{p.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {activeTab === 'cosmetics' && (
              <div className="grid grid-cols-2 gap-2.5">
                <div className="col-span-full text-xs font-bold text-slate-300">
                  Armor Surface Shader Finish
                </div>
                {(Object.keys(FINISH_CATALOG) as FinishStyleId[]).map((fId) => {
                  const item = FINISH_CATALOG[fId];
                  const active = (config.finishStyle || 'standard') === fId;
                  return (
                    <div
                      key={fId}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (ensureOwned('finish', fId, item.label)) onChange({ ...config, finishStyle: fId });
                      }}
                      className={`cursor-pointer text-left rounded-2xl border-2 p-3 transition ${
                        active
                          ? 'border-amber-400 bg-amber-500/16'
                          : 'border-slate-800 bg-[#161B22] hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-xs font-bold text-white truncate">{item.label}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <PriceTag cat="finish" id={fId} />
                          <UpgradePill cat="finish" id={fId} label={item.label} />
                        </div>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-400">{item.subtitle}</p>
                    </div>
                  );
                })}

                <div className="col-span-full mt-2 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-300">
                  <span>Livery Pattern</span>
                  <label className="flex items-center gap-1.5 text-slate-200">
                    <span>Race #</span>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={config.raceNumber ?? ''}
                      placeholder="--"
                      onChange={(e) => {
                        const v =
                          e.target.value === '' ? undefined : Math.max(0, Math.min(99, Number(e.target.value)));
                        onChange({ ...config, raceNumber: v });
                      }}
                      className="w-16 rounded-lg border border-slate-700 bg-[#0D1014] px-2 py-1 text-xs text-white"
                    />
                  </label>
                </div>
                {(Object.keys(PATTERN_CATALOG) as PatternId[]).map((pId) => {
                  const item = PATTERN_CATALOG[pId];
                  const active = (config.pattern || 'none') === pId;
                  return (
                    <div
                      key={pId}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (ensureOwned('pattern', pId, item.label)) onChange({ ...config, pattern: pId });
                      }}
                      className={`cursor-pointer flex items-center justify-between gap-1.5 text-left rounded-2xl border-2 p-3 transition ${
                        active
                          ? 'border-amber-400 bg-amber-500/16'
                          : 'border-slate-800 bg-[#161B22] hover:border-slate-600'
                      }`}
                    >
                      <span className="text-xs font-bold text-white truncate">{item.label}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <PriceTag cat="pattern" id={pId} />
                        {pId !== 'none' && <UpgradePill cat="pattern" id={pId} label={item.label} />}
                      </div>
                    </div>
                  );
                })}

                <div className="col-span-full mt-2 text-xs font-bold text-slate-300">
                  Dorsal Hull Topper / Accessory
                </div>
                {(Object.keys(ACCESSORY_CATALOG) as AccessoryId[]).map((accId) => {
                  const item = ACCESSORY_CATALOG[accId];
                  const active = (config.accessory || 'none') === accId;
                  return (
                    <div
                      key={accId}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (ensureOwned('accessory', accId, item.label)) onChange({ ...config, accessory: accId });
                      }}
                      className={`cursor-pointer text-left rounded-2xl border-2 p-3 transition ${
                        active
                          ? 'border-amber-400 bg-amber-500/16'
                          : 'border-slate-800 bg-[#161B22] hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-xs font-bold text-white truncate">{item.label}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <PriceTag cat="accessory" id={accId} />
                          {accId !== 'none' && <UpgradePill cat="accessory" id={accId} label={item.label} />}
                        </div>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-400">{item.subtitle}</p>
                    </div>
                  );
                })}

                <div className="col-span-full mt-2 text-xs font-bold text-slate-300">
                  Chassis Neon Underglow Ring
                </div>
                {UNDERGLOW_OPTIONS.map((ug) => {
                  const active = (config.underglowColor || 'none') === ug.value;
                  return (
                    <button
                      key={ug.label}
                      type="button"
                      onClick={() => onChange({ ...config, underglowColor: ug.value })}
                      className={`flex items-center gap-2.5 rounded-2xl border-2 p-3 transition ${
                        active
                          ? 'border-amber-400 bg-amber-500/16'
                          : 'border-slate-800 bg-[#161B22] hover:border-slate-600'
                      }`}
                    >
                      <span
                        className="h-4 w-4 rounded-full border border-white/30 shrink-0"
                        style={{ backgroundColor: ug.value === 'none' ? '#1e293b' : ug.value }}
                      />
                      <span className="text-xs font-bold text-white">{ug.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
        </div>
      </div>
    </aside>
  );
};
