import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  CircleDot,
  Gauge,
  Lock,
  Palette,
  Shuffle,
  Shield,
  Sparkles,
  Swords,
  Wrench,
} from 'lucide-react';
import {
  ACCESSORY_CATALOG,
  type AccessoryId,
  ARMOR_CATALOG,
  type ArmorId,
  type BotConfig,
  CHASSIS_CATALOG,
  type ChassisId,
  computeBotStats,
  DRIVE_CATALOG,
  type DriveId,
  FINISH_CATALOG,
  type FinishStyleId,
  getBotChassisStyles,
  getBotWeapons,
  PAINT_PRESETS,
  type SkillTree,
  UNDERGLOW_OPTIONS,
  WEAPON_CATALOG,
  type WeaponId,
  WHEEL_LAYOUT_CATALOG,
  type WheelLayoutId,
  getPartPrice,
  isPartOwned,
  type PartCategory,
  PATTERN_CATALOG,
  type PatternId,
  type PlayerProfile,
} from '../shared/types';

interface WorkshopDockProps {
  config: BotConfig;
  skills: SkillTree;
  savedLoadouts?: BotConfig[];
  activeLoadoutSlot?: number;
  onSelectLoadoutSlot?: (slotIdx: number) => void;
  onChange: (next: BotConfig) => void;
  onStartFight: () => void;
  profile: Pick<PlayerProfile, 'ownedParts' | 'scrap'>;
  onBuyPart: (cat: PartCategory, id: string) => boolean;
}

type CustomTab = 'weapon' | 'chassis' | 'armor' | 'wheels' | 'drive' | 'cosmetics' | 'paint';

export const WorkshopDock: React.FC<WorkshopDockProps> = ({
  config,
  skills,
  savedLoadouts,
  activeLoadoutSlot = 0,
  onSelectLoadoutSlot,
  onChange,
  onStartFight,
  profile,
  onBuyPart,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState<CustomTab>('weapon');
  const [notice, setNotice] = useState<string | null>(null);

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
        className={`absolute right-1.5 bottom-1.5 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
          profile.scrap >= getPartPrice(cat, id) ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'
        }`}
      >
        <Lock className="h-3 w-3" />
        {getPartPrice(cat, id)}
      </span>
    );
  const stats = computeBotStats(config, skills);
  const activeWeapons = getBotWeapons(config);
  const activeStyles = getBotChassisStyles(config);

  const toggleWeapon = (wId: WeaponId) => {
    const idx = activeWeapons.indexOf(wId);
    let next: WeaponId[];
    if (idx >= 0) {
      if (activeWeapons.length <= 1) return;
      next = activeWeapons.filter((w) => w !== wId);
    } else if (!ensureOwned('weapon', wId, WEAPON_CATALOG[wId].label)) {
      return;
    } else if (activeWeapons.length < 3) {
      next = [...activeWeapons, wId];
    } else {
      next = [activeWeapons[0], activeWeapons[1], wId];
    }
    onChange({ ...config, weapon: next[0], weapons: next });
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

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-20 flex flex-col items-center px-3 pb-safe">
      {/* Collapse / Expand Handle + Garage Loadout Bay Switcher */}
      <div className="pointer-events-auto mb-1.5 flex flex-wrap items-center justify-center gap-1.5">
        {savedLoadouts && onSelectLoadoutSlot && (
          <div className="flex items-center gap-1 rounded-t-xl border border-b-0 border-slate-700/90 bg-[#12161C]/95 px-2.5 py-1 min-h-[36px]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mr-1">
              Garage Bay:
            </span>
            {[0, 1, 2].map((slotIdx) => {
              const slotBot = savedLoadouts[slotIdx];
              const isCurrent = activeLoadoutSlot === slotIdx;
              return (
                <button
                  key={slotIdx}
                  type="button"
                  onClick={() => onSelectLoadoutSlot(slotIdx)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                    isCurrent
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-[#19202A] text-slate-300 hover:text-white'
                  }`}
                >
                  Bay {slotIdx + 1} · {slotBot?.name?.slice(0, 10) || `Slot ${slotIdx + 1}`}
                </button>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={handleRandomize}
          title="Generate a random hybrid bot build"
          className="flex items-center gap-1.5 rounded-t-xl border border-b-0 border-slate-700/90 bg-[#12161C]/95 px-3 py-1.5 min-h-[36px] text-xs font-semibold text-sky-300 hover:text-sky-200 transition whitespace-nowrap"
        >
          <Shuffle className="h-3.5 w-3.5" />
          Randomize
        </button>

        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center gap-1.5 rounded-t-xl border border-b-0 border-slate-700/90 bg-[#12161C]/95 px-4 py-1.5 min-h-[36px] text-xs font-semibold text-slate-200 hover:text-amber-400 transition whitespace-nowrap"
        >
          {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {collapsed ? 'Show Workshop' : 'Hide Controls'}
        </button>
      </div>

      {!collapsed && (
        <div className="pointer-events-auto w-full max-w-[1040px] rounded-2xl border border-slate-700/80 bg-[#12161C]/94 p-3 sm:p-4 shadow-2xl">
          {/* Top Row: Hull Name Input, Weight Class & Core Telemetry, Primary Fight CTA */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-800 pb-3">
            <div className="flex flex-wrap items-center gap-2.5 min-w-0">
              <label className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap">
                  Hull Name
                </span>
                <input
                  type="text"
                  maxLength={18}
                  value={config.name}
                  placeholder="Name on bot..."
                  onChange={(e) => onChange({ ...config, name: e.target.value })}
                  aria-label="Bot Name (printed on 3D hull)"
                  className="w-36 sm:w-44 rounded-lg border border-slate-700 bg-[#0D1014] px-2.5 py-1.5 text-sm font-semibold text-white focus:border-amber-500 focus:outline-none"
                />
              </label>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono-tabular">
                <span className="rounded bg-slate-800 px-1.5 py-0.5 font-sans font-semibold text-slate-200">
                  {stats.weightClass} ({stats.bodyScale}×)
                </span>
                <span>HP {stats.maxHp}</span>
                {stats.maxShieldHp > 0 && (
                  <span className="text-sky-400 font-semibold">SHD +{stats.maxShieldHp}</span>
                )}
                <span>·</span>
                <span>ARM {stats.armorZoneHp}</span>
                <span>·</span>
                <span>DMG {stats.weaponDamage}</span>
                <span className="hidden sm:inline">·</span>
                <span className="hidden sm:inline">SPD {stats.maxSpeed}</span>
                <span className="hidden md:inline">·</span>
                <span className="hidden md:inline text-amber-400 font-semibold">PWR {stats.powerScore}</span>
              </div>
            </div>

            <div className="flex items-center gap-1 overflow-x-auto max-w-full">
              {(
                [
                  { id: 'weapon', label: `Weapons (${activeWeapons.length}/3)`, Icon: Swords },
                  { id: 'chassis', label: `Chassis (${activeStyles.length}/3)`, Icon: Wrench },
                  { id: 'armor', label: 'Armor', Icon: Shield },
                  { id: 'wheels', label: 'Wheels', Icon: CircleDot },
                  { id: 'drive', label: 'Drive', Icon: Gauge },
                  { id: 'cosmetics', label: 'FX & Mods', Icon: Sparkles },
                  { id: 'paint', label: 'Paint', Icon: Palette },
                ] as const
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 min-h-[38px] text-xs font-semibold transition whitespace-nowrap shrink-0 ${
                    tab === id
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-[#19202A] text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={onStartFight}
                className="ml-1 rounded-lg bg-emerald-500 px-3.5 sm:px-4 py-2 min-h-[38px] text-xs font-bold text-slate-950 hover:bg-emerald-400 transition whitespace-nowrap shrink-0"
              >
                Enter Arena
              </button>
            </div>
          </div>

          {/* Hybrid Loadout Bar for Multi-Weapon & Multi-Style Fusion */}
          {tab === 'weapon' && (
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
              <span>
                Mount up to 3 independent weapons (Fire with Keys 1, 2, 3 or Space) — click cards to mount or unmount:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {activeWeapons.map((wId, idx) => (
                  <button
                    key={wId}
                    type="button"
                    onClick={() => toggleWeapon(wId)}
                    title={activeWeapons.length > 1 ? 'Click to unmount weapon' : 'Primary weapon'}
                    className="rounded-md border border-amber-500/50 bg-amber-500/12 px-2 py-0.5 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/20"
                  >
                    #{idx + 1} {WEAPON_CATALOG[wId].label}
                    {activeWeapons.length > 1 ? ' ×' : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === 'chassis' && (
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
              <span>
                Fuse up to 3 chassis silhouettes into one custom hybrid hull — click cards below to layer or remove:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {activeStyles.map((cId, idx) => (
                  <button
                    key={cId}
                    type="button"
                    onClick={() => toggleChassisStyle(cId)}
                    title={activeStyles.length > 1 ? 'Click to remove style' : 'Core chassis'}
                    className="rounded-md border border-amber-500/50 bg-amber-500/12 px-2 py-0.5 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/20"
                  >
                    {idx === 0 ? 'Core: ' : `+ `}
                    {CHASSIS_CATALOG[cId].label}
                    {activeStyles.length > 1 ? ' ×' : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          {notice && (
            <div className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200">
              {notice}
            </div>
          )}

          {/* Selection Strip */}
          <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[32vh] sm:max-h-[225px] overflow-y-auto pr-0.5">
            {tab === 'weapon' &&
              (Object.keys(WEAPON_CATALOG) as WeaponId[]).map((wId) => {
                const item = WEAPON_CATALOG[wId];
                const slotIdx = activeWeapons.indexOf(wId);
                const active = slotIdx >= 0;
                return (
                  <button
                    key={wId}
                    type="button"
                    onClick={() => toggleWeapon(wId)}
                    className={`relative text-left rounded-xl border p-2.5 transition ${
                      active
                        ? 'border-amber-500 bg-amber-500/12'
                        : 'border-slate-800 bg-[#161B22] hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-xs font-bold text-white truncate">{item.label}</span>
                      <span className="font-mono-tabular text-[10px] rounded bg-slate-900/90 px-1.5 py-0.5 text-amber-400 shrink-0">
                        {active ? `Slot #${slotIdx + 1}` : `${item.damage} DMG`}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-sky-400 font-mono-tabular">
                      <span>{item.category}</span>
                      <span>·</span>
                      <span>RNG {item.range}m</span>
                      <span>·</span>
                      <span>CD {item.cooldown}s</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400 line-clamp-2 pr-10">{item.subtitle}</p>
                    <PriceTag cat="weapon" id={wId} />
                  </button>
                );
              })}

            {tab === 'armor' &&
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
                    className={`relative text-left rounded-xl border p-2.5 transition ${
                      active
                        ? 'border-amber-500 bg-amber-500/12'
                        : 'border-slate-800 bg-[#161B22] hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white truncate">{item.label}</span>
                      <span className="font-mono-tabular text-[11px] text-amber-400 shrink-0">
                        +{item.hpBonus} HP · {item.zoneHp} ZN
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10px] font-semibold text-emerald-400 truncate">
                      {item.specialPerk}
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-400 line-clamp-2 pr-10">{item.subtitle}</p>
                    <PriceTag cat="armor" id={aId} />
                  </button>
                );
              })}

            {tab === 'chassis' &&
              (Object.keys(CHASSIS_CATALOG) as ChassisId[]).map((cId) => {
                const item = CHASSIS_CATALOG[cId];
                const slotIdx = activeStyles.indexOf(cId);
                const active = slotIdx >= 0;
                return (
                  <button
                    key={cId}
                    type="button"
                    onClick={() => toggleChassisStyle(cId)}
                    className={`relative text-left rounded-xl border p-2.5 transition ${
                      active
                        ? 'border-amber-500 bg-amber-500/12'
                        : 'border-slate-800 bg-[#161B22] hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white truncate">{item.label}</span>
                      <span className="font-mono-tabular text-[10px] text-amber-400 shrink-0">
                        {slotIdx === 0 ? 'Core' : active ? `Hybrid #${slotIdx + 1}` : item.sizeTag}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-300 font-mono-tabular">
                      {item.baseHp} HP · {Math.round(item.speedMult * 100)}% SPD · {Math.round(item.frontDeflect * 100)}% DEF
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-400 line-clamp-2 pr-10">{item.subtitle}</p>
                    <PriceTag cat="chassis" id={cId} />
                  </button>
                );
              })}

            {tab === 'wheels' &&
              (Object.keys(WHEEL_LAYOUT_CATALOG) as WheelLayoutId[]).map((wlId) => {
                const item = WHEEL_LAYOUT_CATALOG[wlId];
                const active = config.wheelLayout === wlId;
                return (
                  <button
                    key={wlId}
                    type="button"
                    onClick={() => onChange({ ...config, wheelLayout: wlId })}
                    className={`text-left rounded-xl border p-2.5 transition ${
                      active
                        ? 'border-amber-500 bg-amber-500/12'
                        : 'border-slate-800 bg-[#161B22] hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white truncate">{item.label}</span>
                      <span className="font-mono-tabular text-[11px] text-amber-400 shrink-0">
                        {Math.round(item.turnMult * 100)}% TRN
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">{item.subtitle}</p>
                  </button>
                );
              })}

            {tab === 'drive' &&
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
                    className={`relative text-left rounded-xl border p-2.5 transition ${
                      active
                        ? 'border-amber-500 bg-amber-500/12'
                        : 'border-slate-800 bg-[#161B22] hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white truncate">{item.label}</span>
                      <span className="font-mono-tabular text-[11px] text-amber-400 shrink-0">
                        {item.maxSpeed} m/s
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400 line-clamp-2 pr-10">{item.subtitle}</p>
                    <PriceTag cat="drive" id={dId} />
                  </button>
                );
              })}

            {tab === 'cosmetics' && (
              <>
                <div className="col-span-full text-[11px] font-semibold uppercase tracking-wider text-slate-400">
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
                      className={`text-left rounded-xl border p-2.5 transition ${
                        active
                          ? 'border-amber-500 bg-amber-500/12'
                          : 'border-slate-800 bg-[#161B22] hover:border-slate-600'
                      }`}
                    >
                      <div className="text-xs font-bold text-white">{item.label}</div>
                      <p className="mt-0.5 text-[11px] text-slate-400">{item.subtitle}</p>
                    </button>
                  );
                })}

                <div className="col-span-full mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <span>Livery Pattern</span>
                  <label className="flex items-center gap-1.5 normal-case tracking-normal text-slate-300">
                    Race number
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={config.raceNumber ?? ''}
                      placeholder="--"
                      onChange={(e) => {
                        const v = e.target.value === '' ? undefined : Math.max(0, Math.min(99, Number(e.target.value)));
                        onChange({ ...config, raceNumber: v });
                      }}
                      className="w-14 rounded border border-slate-700 bg-[#0D1014] px-1.5 py-0.5 text-xs text-white"
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
                      className={`text-left rounded-xl border p-2.5 transition ${
                        active ? 'border-amber-500 bg-amber-500/12' : 'border-slate-800 bg-[#161B22] hover:border-slate-600'
                      }`}
                    >
                      <div className="text-xs font-bold text-white">{PATTERN_CATALOG[pId].label}</div>
                    </button>
                  );
                })}

                <div className="col-span-full mt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
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
                      className={`text-left rounded-xl border p-2.5 transition ${
                        active
                          ? 'border-amber-500 bg-amber-500/12'
                          : 'border-slate-800 bg-[#161B22] hover:border-slate-600'
                      }`}
                    >
                      <div className="text-xs font-bold text-white">{item.label}</div>
                      <p className="mt-0.5 text-[11px] text-slate-400">{item.subtitle}</p>
                    </button>
                  );
                })}

                <div className="col-span-full mt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Chassis Neon Underglow Ring
                </div>
                {UNDERGLOW_OPTIONS.map((ug) => {
                  const active = (config.underglowColor || 'none') === ug.value;
                  return (
                    <button
                      key={ug.label}
                      type="button"
                      onClick={() => onChange({ ...config, underglowColor: ug.value })}
                      className={`flex items-center gap-2.5 rounded-xl border p-2.5 transition ${
                        active
                          ? 'border-amber-500 bg-amber-500/12'
                          : 'border-slate-800 bg-[#161B22] hover:border-slate-600'
                      }`}
                    >
                      <span
                        className="h-4 w-4 rounded-full border border-white/30 shrink-0"
                        style={{ backgroundColor: ug.value === 'none' ? '#1e293b' : ug.value }}
                      />
                      <span className="text-xs font-semibold text-white">{ug.label}</span>
                    </button>
                  );
                })}
              </>
            )}

            {tab === 'paint' && (
              <>
                <div className="col-span-full flex flex-wrap items-center gap-4 rounded-xl border border-slate-800 bg-[#0D1014] px-3 py-2">
                  <label className="flex items-center gap-2 text-xs text-slate-300 font-semibold">
                    <span>Custom Primary:</span>
                    <input
                      type="color"
                      value={config.primaryColor}
                      onChange={(e) => onChange({ ...config, primaryColor: e.target.value })}
                      className="h-7 w-10 cursor-pointer rounded border border-slate-700 bg-transparent"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-300 font-semibold">
                    <span>Custom Accent / Visor:</span>
                    <input
                      type="color"
                      value={config.accentColor}
                      onChange={(e) => onChange({ ...config, accentColor: e.target.value })}
                      className="h-7 w-10 cursor-pointer rounded border border-slate-700 bg-transparent"
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
                      className={`flex items-center gap-3 rounded-xl border p-2.5 transition ${
                        active
                          ? 'border-amber-500 bg-amber-500/12'
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
                      <span className="text-xs font-semibold text-white truncate">{p.label}</span>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
