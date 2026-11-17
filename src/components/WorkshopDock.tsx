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
  isPartOwned,
  isTraditionalArena,
  isTraditionalWeapon,
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
  profile: Pick<PlayerProfile, 'ownedParts' | 'scrap' | 'favorites'>;
  onBuyPart: (cat: PartCategory, id: string) => boolean;
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

type RightCustomTab = 'chassis' | 'armor' | 'wheels' | 'drive' | 'paint' | 'cosmetics' | 'arenas';
type LeftWeaponView = 'all_weapons' | 'placement' | 'favorites';

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
  const [leftView, setLeftView] = useState<LeftWeaponView>('all_weapons');
  const [rightTab, setRightTab] = useState<RightCustomTab>('chassis');
  const [mobilePanelSide, setMobilePanelSide] = useState<'weapons' | 'hull'>('weapons');
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

  // Premium parts: first click buys (if enough scrap), then equips
  const ensureOwned = (cat: PartCategory, id: string, label: string): boolean => {
    if (isPartOwned(profile, cat, id)) return true;
    const price = getPartPrice(cat, id);
    if (onBuyPart(cat, id)) {
      setNotice(`Purchased ${label} for ${price} scrap`);
    } else {
      setNotice(`${label} costs ${price} scrap. Earn more in the arena, campaign or season events.`);
    }
    window.setTimeout(() => setNotice(null), 2600);
    return isPartOwned(profile, cat, id) || profile.scrap >= price;
  };
  const owned = (cat: PartCategory, id: string) => isPartOwned(profile, cat, id);
  const PriceTag = ({ cat, id }: { cat: PartCategory; id: string }) =>
    owned(cat, id) ? null : (
      <span
        className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
          profile.scrap >= getPartPrice(cat, id) ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'
        }`}
      >
        <Lock className="h-3 w-3" />
        {getPartPrice(cat, id)}
      </span>
    );

  const stats = computeBotStats(config, skills);
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
    const allFinishes = Object.keys(FINISH_CATALOG) as FinishStyleId[];
    const allAccessories = Object.keys(ACCESSORY_CATALOG) as AccessoryId[];

    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const c1 = pick(allChassis);
    const c2 = pick(allChassis.filter((c) => c !== c1));
    const w1 = pick(allWeapons);
    const w2 = pick(allWeapons.filter((w) => w !== w1));
    const paint = pick(PAINT_PRESETS);

    onChange({
      ...config,
      name: generateRandomBotName(config.name),
      chassis: c1,
      chassisStyles: Math.random() < 0.7 ? [c1, c2] : [c1],
      armor: pick(allArmors),
      weapon: w1,
      weapons: Math.random() < 0.75 ? [w1, w2] : [w1],
      wheelLayout: pick(allWheels),
      drive: pick(allDrives),
      primaryColor: paint.primary,
      accentColor: paint.accent,
      finishStyle: pick(allFinishes),
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
          <span>Show Left & Right Workshop Docks</span>
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

  const leftAsideClass = isForcedMobile
    ? `pointer-events-none fixed inset-x-2 bottom-2 top-36 z-20 ${mobilePanelSide === 'weapons' ? 'flex' : 'hidden'} flex-col pb-safe`
    : isForcedTablet
      ? 'pointer-events-none fixed left-2 top-28 bottom-2 z-20 flex w-[340px] flex-col pb-safe'
      : isForcedDesktop
        ? 'pointer-events-none fixed left-3 sm:left-4 top-28 bottom-3 z-20 flex w-[420px] xl:w-[465px] flex-col pb-safe'
        : `pointer-events-none fixed left-3 sm:left-4 top-28 bottom-3 z-20 ${mobilePanelSide === 'weapons' ? 'flex' : 'hidden lg:flex'} w-[calc(100vw-1.5rem)] sm:w-[410px] lg:w-[440px] xl:w-[465px] flex-col pb-safe`;

  const rightAsideClass = isForcedMobile
    ? `pointer-events-none fixed inset-x-2 bottom-2 top-36 z-20 ${mobilePanelSide === 'hull' ? 'flex' : 'hidden'} flex-col pb-safe`
    : isForcedTablet
      ? 'pointer-events-none fixed right-2 top-28 bottom-2 z-20 flex w-[340px] flex-col pb-safe'
      : isForcedDesktop
        ? 'pointer-events-none fixed right-3 sm:right-4 top-28 bottom-3 z-20 flex w-[420px] xl:w-[465px] flex-col pb-safe'
        : `pointer-events-none fixed right-3 sm:right-4 top-28 bottom-3 z-20 ${mobilePanelSide === 'hull' ? 'flex' : 'hidden lg:flex'} w-[calc(100vw-1.5rem)] sm:w-[410px] lg:w-[440px] xl:w-[465px] flex-col pb-safe`;

  return (
    <>
      {(isForcedMobile || deviceLayoutMode === 'auto') && (
        <div
          className={`pointer-events-auto fixed left-1/2 top-28 z-30 -translate-x-1/2 flex items-center gap-1 rounded-xl border border-slate-700 bg-[#0D1014]/95 p-1 shadow-xl ${
            isForcedMobile ? 'flex' : 'flex lg:hidden'
          }`}
        >
          <button
            type="button"
            onClick={() => setMobilePanelSide('weapons')}
            className={`rounded-lg px-3 py-1 text-xs font-extrabold transition ${
              mobilePanelSide === 'weapons'
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Weapons & Mounts
          </button>
          <button
            type="button"
            onClick={() => setMobilePanelSide('hull')}
            className={`rounded-lg px-3 py-1 text-xs font-extrabold transition ${
              mobilePanelSide === 'hull'
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Hull, Armor & Arenas
          </button>
        </div>
      )}

      {/* =====================================================================
          LEFT SIDE DOCK: WEAPONS ARSENAL, 3D PLACEMENT & FAVORITES CHECKLIST
          ===================================================================== */}
      <aside
        id="workshop-dock"
        aria-label="Left Weapon & Favorites Workshop Controls"
        className={leftAsideClass}
      >
        <div className="pointer-events-auto flex h-full min-h-0 flex-col rounded-2xl border border-slate-700/85 bg-[#12161C]/95 p-3.5 sm:p-4 shadow-2xl backdrop-blur-md">
          {/* Header Bar: Garage Bays + Save Build + Hide */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
            {savedLoadouts && onSelectLoadoutSlot ? (
              <div className="flex items-center gap-1.5 min-w-0">
                {[0, 1, 2].map((slotIdx) => {
                  const slotBot = savedLoadouts[slotIdx];
                  const isCurrent = activeLoadoutSlot === slotIdx;
                  return (
                    <button
                      key={slotIdx}
                      type="button"
                      onClick={() => onSelectLoadoutSlot(slotIdx)}
                      title={slotBot?.name || `Bay ${slotIdx + 1}`}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition whitespace-nowrap ${
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
              <span className="font-display text-sm font-bold text-white">Weapons & Favorites</span>
            )}

            <div className="flex items-center gap-1.5 shrink-0">
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
                  className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-extrabold transition whitespace-nowrap cursor-pointer ${
                    traditionalMode
                      ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200 shadow'
                      : 'border-slate-700 bg-[#19202A] text-slate-300 hover:text-white'
                  }`}
                >
                  <Shield className="h-3.5 w-3.5" />
                  <span>{traditionalMode ? 'Traditional: ON' : 'Traditional Mode'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={saveCurrentBuildToFavorites}
                title="Save current bot configuration to your Favorites list"
                className="flex items-center gap-1 rounded-lg border border-amber-500/50 bg-amber-500/15 px-2.5 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/25 transition whitespace-nowrap"
              >
                <BookmarkPlus className="h-3.5 w-3.5" />
                <span>★ Save Build</span>
              </button>
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                title="Minimize workshop panels"
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-[#19202A] px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-amber-300 transition whitespace-nowrap"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Hide</span>
              </button>
            </div>
          </div>

          {/* Left Mode Switcher: Weapons Arsenal | 3D Placement | ★ Favorites List */}
          <div className="mt-2.5 grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => setLeftView('all_weapons')}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-2.5 text-xs font-bold transition ${
                leftView === 'all_weapons'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'bg-[#19202A] text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Swords className="h-4 w-4 shrink-0" />
              <span>Weapons ({activeWeapons.length}/3)</span>
            </button>
            <button
              type="button"
              onClick={() => setLeftView('placement')}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-2.5 text-xs font-bold transition ${
                leftView === 'placement'
                  ? 'bg-sky-400 text-slate-950 shadow'
                  : 'bg-[#19202A] text-sky-300 hover:bg-slate-800'
              }`}
            >
              <Wrench className="h-4 w-4 shrink-0" />
              <span>3D Mounts</span>
            </button>
            <button
              type="button"
              onClick={() => setLeftView('favorites')}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-2.5 text-xs font-bold transition ${
                leftView === 'favorites'
                  ? 'bg-yellow-400 text-slate-950 shadow'
                  : 'bg-[#19202A] text-yellow-300 hover:bg-slate-800'
              }`}
            >
              <Star className="h-4 w-4 shrink-0 fill-current" />
              <span>Favorites ({favorites.weapons.length + (favorites.builds?.length ?? 0)})</span>
            </button>
          </div>

          {/* Active Mounted Weapons Strip + 1-Click All Off */}
          <div className="mt-2.5 rounded-xl border border-slate-800 bg-[#0D1014]/95 p-3 text-xs text-slate-300">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-200">
                Active Weapons ({activeWeapons.length}/3 Mounted):
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setOnlyFavWeapons((v) => !v)}
                  className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold transition ${
                    onlyFavWeapons
                      ? 'border-yellow-400/70 bg-yellow-500/20 text-yellow-200'
                      : 'border-slate-700 bg-slate-900 text-slate-300 hover:text-yellow-300'
                  }`}
                >
                  <Star className={`h-3 w-3 ${onlyFavWeapons ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                  <span>{onlyFavWeapons ? 'Showing Favorites' : 'Filter ★'}</span>
                </button>
                {activeWeapons.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAllWeapons}
                    className="flex items-center gap-1 rounded-lg border border-rose-500/50 bg-rose-500/15 px-2.5 py-1 text-[11px] font-bold text-rose-300 hover:bg-rose-500/25 transition whitespace-nowrap"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    <span>All Off</span>
                  </button>
                )}
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {activeWeapons.length === 0 ? (
                <span className="text-xs font-medium text-amber-300">
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
                      className="flex items-center gap-1.5 rounded-lg border border-amber-500/60 bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-200 hover:bg-amber-500/25 transition whitespace-nowrap"
                    >
                      <span className="font-mono-tabular rounded bg-amber-500/30 px-1.5 py-0.5 text-[11px] font-extrabold text-amber-100">
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

          {notice && (
            <div className="mt-2 rounded-xl border border-amber-500/50 bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-200">
              {notice}
            </div>
          )}

          {/* LEFT SCROLLABLE BODY */}
          <div className="mt-2.5 flex-1 min-h-0 overflow-y-auto pr-1 space-y-2.5">
            {leftView === 'all_weapons' &&
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

            {leftView === 'placement' && (
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

            {leftView === 'favorites' && (
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
                          onClick={() => onSelectArena?.(aId)}
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
                            {isSel ? 'ACTIVE ARENA' : 'Select Arena'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* =====================================================================
          RIGHT SIDE DOCK: CHASSIS, ARMOR, WHEELS, DRIVE, PAINT & ARENAS
          ===================================================================== */}
      <aside
        id="workshop-dock-right"
        aria-label="Right Hull, Armor, Drivetrain & Arena Controls"
        className={rightAsideClass}
      >
        <div className="pointer-events-auto flex h-full min-h-0 flex-col rounded-2xl border border-slate-700/85 bg-[#12161C]/95 p-3.5 sm:p-4 shadow-2xl backdrop-blur-md">
          {/* Hull Callsign + Random Name Generator + Back / Random / Forward + Enter Arena */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800 pb-2.5">
            <label className="flex flex-1 items-center gap-1.5 min-w-[130px]">
              <span className="text-xs font-bold text-slate-300 whitespace-nowrap">Bot</span>
              <input
                type="text"
                maxLength={18}
                value={config.name}
                placeholder="Name on bot..."
                onChange={(e) => onChange({ ...config, name: e.target.value })}
                aria-label="Bot Name (printed on 3D hull)"
                className="w-full min-w-0 rounded-xl border border-slate-700 bg-[#0D1014] px-2.5 py-1.5 text-xs font-bold text-white focus:border-amber-500 focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => onChange({ ...config, name: generateRandomBotName(config.name) })}
              title="Random Bot Name Generator — Generate a new epic warbot callsign"
              className="flex items-center gap-1 rounded-xl border border-amber-500/50 bg-amber-500/15 px-2.5 py-1.5 text-xs font-extrabold text-amber-300 hover:bg-amber-500/25 hover:text-amber-200 transition whitespace-nowrap shrink-0"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Name</span>
            </button>

            {/* Back / Random / Forward History Controls */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={onStepBack}
                disabled={!canStepBack}
                title="Previous Bot Build (Back in history if you passed one you liked)"
                className={`flex h-8 w-8 items-center justify-center rounded-xl border text-xs font-bold transition ${
                  canStepBack
                    ? 'border-sky-500/60 bg-[#19202A] text-sky-300 hover:border-sky-400 hover:text-white'
                    : 'border-slate-800 bg-[#12161C] text-slate-600 cursor-not-allowed'
                }`}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleRandomize}
                title="Generate a random hybrid bot build & name"
                className="flex items-center gap-1 rounded-xl border border-slate-700 bg-[#19202A] px-2.5 py-1.5 text-xs font-semibold text-sky-300 hover:text-sky-200 transition whitespace-nowrap"
              >
                <Shuffle className="h-3.5 w-3.5" />
                <span>Random</span>
              </button>
              <button
                type="button"
                onClick={onStepForward}
                disabled={!canStepForward}
                title="Next Bot Build (Forward in history)"
                className={`flex h-8 w-8 items-center justify-center rounded-xl border text-xs font-bold transition ${
                  canStepForward
                    ? 'border-sky-500/60 bg-[#19202A] text-sky-300 hover:border-sky-400 hover:text-white'
                    : 'border-slate-800 bg-[#12161C] text-slate-600 cursor-not-allowed'
                }`}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={onStartFight}
              className="rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 transition whitespace-nowrap shrink-0 shadow-lg"
            >
              Enter Arena
            </button>
          </div>

          {/* Live Bot Performance Telemetry */}
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-[#0D1014] px-3 py-2 text-xs text-slate-200 font-mono-tabular">
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

          {/* Right Panel Category Tabs */}
          <div className="mt-2.5 grid grid-cols-4 gap-1.5">
            {(
              [
                { id: 'chassis', label: `Chassis (${activeStyles.length}/3)`, Icon: Wrench, span: 'col-span-2' },
                { id: 'arenas', label: `Arenas (10)`, Icon: MapPin, span: 'col-span-2' },
                { id: 'armor', label: 'Armor', Icon: Shield, span: 'col-span-1' },
                { id: 'wheels', label: 'Wheels', Icon: CircleDot, span: 'col-span-1' },
                { id: 'drive', label: 'Drive', Icon: Gauge, span: 'col-span-1' },
                { id: 'paint', label: 'Paint', Icon: Palette, span: 'col-span-1' },
                { id: 'cosmetics', label: 'FX, Livery & Toppers', Icon: Sparkles, span: 'col-span-4' },
              ] as const
            ).map(({ id, label, Icon, span }) => (
              <button
                key={id}
                type="button"
                onClick={() => setRightTab(id)}
                className={`${span} flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-bold transition whitespace-nowrap ${
                  rightTab === id
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'bg-[#19202A] text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>

          {/* Right Scrollable Options List (Larger Cards) */}
          <div className="mt-2.5 flex-1 min-h-0 overflow-y-auto pr-1 space-y-2.5">
            {rightTab === 'chassis' &&
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

            {rightTab === 'arenas' &&
              (Object.keys(ARENA_CATALOG) as ArenaId[])
                .filter((aId) => (traditionalMode ? isTraditionalArena(aId) : true))
                .map((aId) => {
                  const ar = ARENA_CATALOG[aId];
                const active = selectedArena === aId;
                const isFav = favorites.arenas.includes(aId);
                return (
                  <div
                    key={aId}
                    onClick={() => onSelectArena?.(aId)}
                    role="button"
                    tabIndex={0}
                    className={`cursor-pointer relative w-full text-left rounded-2xl border-2 p-3.5 transition ${
                      active
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
                      <span
                        className={`font-mono-tabular text-xs rounded-lg px-2.5 py-1 font-bold ${
                          active ? 'bg-sky-400 text-slate-950' : 'bg-slate-900 text-sky-300'
                        }`}
                      >
                        {active ? 'SELECTED' : 'Preview 3D'}
                      </span>
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

            {rightTab === 'armor' &&
              (Object.keys(ARMOR_CATALOG) as ArmorId[]).map((aId) => {
                const item = ARMOR_CATALOG[aId];
                const active = config.armor === aId;
                return (
                  <button
                    key={aId}
                    type="button"
                    onClick={() => {
                      if (ensureOwned('armor', aId, item.label)) onChange({ ...config, armor: aId });
                    }}
                    className={`relative w-full text-left rounded-2xl border-2 p-3.5 transition ${
                      active
                        ? 'border-amber-400 bg-amber-500/16'
                        : 'border-slate-800 bg-[#161B22] hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-extrabold text-white truncate">{item.label}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <PriceTag cat="armor" id={aId} />
                        <span className="font-mono-tabular text-xs font-bold text-amber-400">
                          +{item.hpBonus} HP · {item.zoneHp} ZN
                        </span>
                      </div>
                    </div>
                    <div className="mt-1 text-xs font-bold text-emerald-400">{item.specialPerk}</div>
                    <p className="mt-1 text-xs text-slate-300">{item.subtitle}</p>
                  </button>
                );
              })}

            {rightTab === 'wheels' &&
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

            {rightTab === 'drive' &&
              (Object.keys(DRIVE_CATALOG) as DriveId[]).map((dId) => {
                const item = DRIVE_CATALOG[dId];
                const active = config.drive === dId;
                return (
                  <button
                    key={dId}
                    type="button"
                    onClick={() => {
                      if (ensureOwned('drive', dId, item.label)) onChange({ ...config, drive: dId });
                    }}
                    className={`relative w-full text-left rounded-2xl border-2 p-3.5 transition ${
                      active
                        ? 'border-amber-400 bg-amber-500/16'
                        : 'border-slate-800 bg-[#161B22] hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-extrabold text-white truncate">{item.label}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <PriceTag cat="drive" id={dId} />
                        <span className="font-mono-tabular text-xs font-bold text-amber-400">
                          {item.maxSpeed} m/s
                        </span>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-slate-300">{item.subtitle}</p>
                  </button>
                );
              })}

            {rightTab === 'paint' && (
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

            {rightTab === 'cosmetics' && (
              <div className="grid grid-cols-2 gap-2.5">
                <div className="col-span-full text-xs font-bold text-slate-300">
                  Armor Surface Shader Finish
                </div>
                {(Object.keys(FINISH_CATALOG) as FinishStyleId[]).map((fId) => {
                  const item = FINISH_CATALOG[fId];
                  const active = (config.finishStyle || 'standard') === fId;
                  return (
                    <button
                      key={fId}
                      type="button"
                      onClick={() => onChange({ ...config, finishStyle: fId })}
                      className={`text-left rounded-2xl border-2 p-3 transition ${
                        active
                          ? 'border-amber-400 bg-amber-500/16'
                          : 'border-slate-800 bg-[#161B22] hover:border-slate-600'
                      }`}
                    >
                      <div className="text-xs font-bold text-white">{item.label}</div>
                      <p className="mt-0.5 text-[11px] text-slate-400">{item.subtitle}</p>
                    </button>
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
                  const active = (config.pattern || 'none') === pId;
                  return (
                    <button
                      key={pId}
                      type="button"
                      onClick={() => onChange({ ...config, pattern: pId })}
                      className={`text-left rounded-2xl border-2 p-3 transition ${
                        active
                          ? 'border-amber-400 bg-amber-500/16'
                          : 'border-slate-800 bg-[#161B22] hover:border-slate-600'
                      }`}
                    >
                      <div className="text-xs font-bold text-white">{PATTERN_CATALOG[pId].label}</div>
                    </button>
                  );
                })}

                <div className="col-span-full mt-2 text-xs font-bold text-slate-300">
                  Dorsal Hull Topper / Accessory
                </div>
                {(Object.keys(ACCESSORY_CATALOG) as AccessoryId[]).map((accId) => {
                  const item = ACCESSORY_CATALOG[accId];
                  const active = (config.accessory || 'none') === accId;
                  return (
                    <button
                      key={accId}
                      type="button"
                      onClick={() => onChange({ ...config, accessory: accId })}
                      className={`text-left rounded-2xl border-2 p-3 transition ${
                        active
                          ? 'border-amber-400 bg-amber-500/16'
                          : 'border-slate-800 bg-[#161B22] hover:border-slate-600'
                      }`}
                    >
                      <div className="text-xs font-bold text-white">{item.label}</div>
                      <p className="mt-0.5 text-[11px] text-slate-400">{item.subtitle}</p>
                    </button>
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
    </>
  );
};
