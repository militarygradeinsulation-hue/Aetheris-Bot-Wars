import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  CircleDot,
  Gauge,
  Lock,
  Palette,
  Save,
  Shield,
  Swords,
  Warehouse,
  Wrench,
} from 'lucide-react';
import {
  ARMOR_CATALOG,
  type ArmorId,
  type BotConfig,
  CHASSIS_CATALOG,
  type ChassisId,
  computeBotStats,
  DRIVE_CATALOG,
  type DriveId,
  FINISH_CATALOG,
  type FinishId,
  getBotChassisStyles,
  getBotWeapons,
  getPartPrice,
  isPartOwned,
  PAINT_PRESETS,
  type PartCategory,
  PATTERN_CATALOG,
  type PatternId,
  type PlayerProfile,
  type SkillTree,
  WEAPON_CATALOG,
  type WeaponId,
  WHEEL_LAYOUT_CATALOG,
  type WheelLayoutId,
} from '../shared/types';

interface WorkshopDockProps {
  config: BotConfig;
  skills: SkillTree;
  profile: PlayerProfile;
  onChange: (next: BotConfig) => void;
  onBuyPart: (cat: PartCategory, id: string) => boolean;
  onSaveLoadout: (slot: number) => void;
  onLoadLoadout: (slot: number) => void;
  onStartFight: () => void;
}

type CustomTab = 'weapon' | 'armor' | 'chassis' | 'wheels' | 'drive' | 'paint' | 'garage';

const KIND_BADGE: Record<string, { label: string; cls: string }> = {
  rotor: { label: 'Spinner', cls: 'bg-orange-500/15 text-orange-300' },
  channel: { label: 'Beam', cls: 'bg-sky-500/15 text-sky-300' },
  strike: { label: 'Striker', cls: 'bg-rose-500/15 text-rose-300' },
  projectile: { label: 'Ranged', cls: 'bg-fuchsia-500/15 text-fuchsia-300' },
};

function resistTag(mult: number): { text: string; cls: string } {
  const pct = Math.round((1 - mult) * 100);
  if (pct > 0) return { text: `-${pct}%`, cls: 'text-emerald-300' };
  if (pct < 0) return { text: `+${-pct}%`, cls: 'text-red-300' };
  return { text: '0%', cls: 'text-slate-400' };
}

const cardCls = (active: boolean, locked: boolean) =>
  `relative text-left rounded-xl border p-2.5 transition ${
    active
      ? 'border-amber-500 bg-amber-500/12'
      : locked
        ? 'border-slate-800 bg-[#12161C] hover:border-slate-600'
        : 'border-slate-800 bg-[#161B22] hover:border-slate-600'
  }`;

export const WorkshopDock: React.FC<WorkshopDockProps> = ({
  config,
  skills,
  profile,
  onChange,
  onBuyPart,
  onSaveLoadout,
  onLoadLoadout,
  onStartFight,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState<CustomTab>('weapon');
  const [notice, setNotice] = useState<string | null>(null);
  const stats = computeBotStats(config, skills);
  const activeWeapons = getBotWeapons(config);
  const activeStyles = getBotChassisStyles(config);

  // Locked parts: first click buys (if enough scrap), then equips
  const ensureOwned = (cat: PartCategory, id: string, label: string): boolean => {
    if (isPartOwned(profile, cat, id)) return true;
    const price = getPartPrice(cat, id);
    if (onBuyPart(cat, id)) {
      setNotice(`Purchased ${label} for ${price} scrap`);
      window.setTimeout(() => setNotice(null), 2400);
      return true;
    }
    setNotice(`${label} costs ${price} scrap. Earn more in the arena or campaign.`);
    window.setTimeout(() => setNotice(null), 2800);
    return false;
  };

  const toggleWeapon = (wId: WeaponId) => {
    const idx = activeWeapons.indexOf(wId);
    let next: WeaponId[];
    if (idx >= 0) {
      if (activeWeapons.length <= 1) return;
      next = activeWeapons.filter((w) => w !== wId);
    } else {
      if (!ensureOwned('weapon', wId, WEAPON_CATALOG[wId].label)) return;
      if (activeWeapons.length < 3) {
        next = [...activeWeapons, wId];
      } else {
        next = [activeWeapons[0], activeWeapons[1], wId];
      }
    }
    onChange({ ...config, weapon: next[0], weapons: next });
  };

  const makePrimaryWeapon = (wId: WeaponId) => {
    const rest = activeWeapons.filter((w) => w !== wId);
    const next = [wId, ...rest];
    onChange({ ...config, weapon: next[0], weapons: next });
  };

  const toggleChassisStyle = (cId: ChassisId) => {
    const idx = activeStyles.indexOf(cId);
    let next: ChassisId[];
    if (idx >= 0) {
      if (activeStyles.length <= 1) return;
      next = activeStyles.filter((c) => c !== cId);
    } else {
      if (!ensureOwned('chassis', cId, CHASSIS_CATALOG[cId].label)) return;
      if (activeStyles.length < 3) {
        next = [...activeStyles, cId];
      } else {
        next = [activeStyles[0], activeStyles[1], cId];
      }
    }
    onChange({ ...config, chassis: next[0], chassisStyles: next });
  };

  const PriceTag = ({ cat, id }: { cat: PartCategory; id: string }) =>
    isPartOwned(profile, cat, id) ? null : (
      <span
        className={`absolute right-2 bottom-2 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
          profile.scrap >= getPartPrice(cat, id) ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'
        }`}
      >
        <Lock className="h-3 w-3" />
        {getPartPrice(cat, id)}
      </span>
    );

  const finish: FinishId = config.finish ?? 'gloss';
  const pattern: PatternId = config.pattern ?? 'none';

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-20 flex flex-col items-center px-3 pb-safe">
      <div className="pointer-events-auto mb-1.5 flex items-center gap-2">
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
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-800 pb-3">
            <div className="flex flex-wrap items-center gap-2.5 min-w-0">
              <label className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap">Hull Name</span>
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

              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono-tabular">
                <span className="font-sans font-semibold text-slate-200">{stats.weightClass}</span>
                <span aria-hidden="true">·</span>
                <span>HP {stats.maxHp}</span>
                <span aria-hidden="true">·</span>
                <span>ARM {stats.armorZoneHp}</span>
                <span aria-hidden="true">·</span>
                <span>DMG {stats.weaponDamage}</span>
                <span className="hidden sm:inline" aria-hidden="true">·</span>
                <span className="hidden sm:inline">SPD {stats.maxSpeed}</span>
                <span className="hidden md:inline" aria-hidden="true">·</span>
                <span className="hidden md:inline text-amber-400 font-semibold">PWR {stats.powerScore}</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto max-w-full">
              {(
                [
                  { id: 'weapon', label: `Weapons (${activeWeapons.length})`, Icon: Swords },
                  { id: 'chassis', label: `Styles (${activeStyles.length})`, Icon: Wrench },
                  { id: 'armor', label: 'Armor', Icon: Shield },
                  { id: 'wheels', label: 'Wheels', Icon: CircleDot },
                  { id: 'drive', label: 'Drive', Icon: Gauge },
                  { id: 'paint', label: 'Livery', Icon: Palette },
                  { id: 'garage', label: 'Garage', Icon: Warehouse },
                ] as const
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-2 min-h-[40px] text-xs font-semibold transition whitespace-nowrap shrink-0 ${
                    tab === id ? 'bg-amber-500 text-slate-950' : 'bg-[#19202A] text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={onStartFight}
                className="ml-1 rounded-lg bg-emerald-500 px-3.5 sm:px-4 py-2 min-h-[40px] text-xs font-bold text-slate-950 hover:bg-emerald-400 transition whitespace-nowrap shrink-0"
              >
                Enter Arena
              </button>
            </div>
          </div>

          {notice && (
            <div className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200">
              {notice}
            </div>
          )}

          {tab === 'weapon' && (
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
              <span>Mount up to 3 weapons. Slot 1 hits hardest; click a mounted chip to make it primary.</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {activeWeapons.map((wId, idx) => (
                  <span key={wId} className="flex items-center rounded-md border border-amber-500/50 bg-amber-500/12 text-[11px] font-semibold text-amber-300">
                    <button
                      type="button"
                      onClick={() => makePrimaryWeapon(wId)}
                      title="Make primary"
                      className="px-2 py-0.5 hover:bg-amber-500/20 rounded-l-md"
                    >
                      {idx + 1}. {WEAPON_CATALOG[wId].label}
                    </button>
                    {activeWeapons.length > 1 && (
                      <button
                        type="button"
                        onClick={() => toggleWeapon(wId)}
                        title="Unmount"
                        className="px-1.5 py-0.5 border-l border-amber-500/40 hover:bg-amber-500/20 rounded-r-md"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {tab === 'chassis' && (
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
              <span>Fuse up to 3 body styles into one hybrid hull. Click cards to layer or remove.</span>
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

          <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[34vh] sm:max-h-[240px] overflow-y-auto pr-0.5">
            {tab === 'weapon' &&
              (Object.keys(WEAPON_CATALOG) as WeaponId[]).map((wId) => {
                const item = WEAPON_CATALOG[wId];
                const slotIdx = activeWeapons.indexOf(wId);
                const active = slotIdx >= 0;
                const locked = !isPartOwned(profile, 'weapon', wId);
                const badge = KIND_BADGE[item.kind];
                return (
                  <button key={wId} type="button" onClick={() => toggleWeapon(wId)} className={cardCls(active, locked)}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-xs font-bold truncate ${locked ? 'text-slate-400' : 'text-white'}`}>{item.label}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold shrink-0 ${active ? 'bg-amber-500 text-slate-950' : badge.cls}`}>
                        {active ? `Slot ${slotIdx + 1}` : badge.label}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">{item.subtitle}</p>
                    <div className="mt-1.5 flex flex-wrap gap-x-2 text-[10px] font-mono-tabular text-slate-300 pr-12">
                      <span>DMG {item.damage}</span>
                      <span>RNG {item.range}</span>
                      <span>CD {item.cooldown}s</span>
                      {item.armorPierce ? <span className="text-rose-300">AP {Math.round(item.armorPierce * 100)}%</span> : null}
                    </div>
                    <PriceTag cat="weapon" id={wId} />
                  </button>
                );
              })}

            {tab === 'armor' &&
              (Object.keys(ARMOR_CATALOG) as ArmorId[]).map((aId) => {
                const item = ARMOR_CATALOG[aId];
                const active = config.armor === aId;
                const locked = !isPartOwned(profile, 'armor', aId);
                return (
                  <button
                    key={aId}
                    type="button"
                    onClick={() => {
                      if (ensureOwned('armor', aId, item.label)) onChange({ ...config, armor: aId });
                    }}
                    className={cardCls(active, locked)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-xs font-bold truncate ${locked ? 'text-slate-400' : 'text-white'}`}>{item.label}</span>
                      <span className="font-mono-tabular text-[11px] text-amber-400 shrink-0">+{item.hpBonus} HP</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">{item.traitLabel ?? item.subtitle}</p>
                    <div className="mt-1.5 flex flex-wrap gap-x-2 text-[10px] font-mono-tabular pr-12">
                      {(
                        [
                          ['BLD', item.resist.blade],
                          ['CRS', item.resist.crush],
                          ['IMP', item.resist.kinetic],
                          ['HEAT', item.resist.scorch],
                        ] as const
                      ).map(([k, v]) => {
                        const t = resistTag(v);
                        return (
                          <span key={k} className={t.cls}>
                            {k} {t.text}
                          </span>
                        );
                      })}
                    </div>
                    <PriceTag cat="armor" id={aId} />
                  </button>
                );
              })}

            {tab === 'chassis' &&
              (Object.keys(CHASSIS_CATALOG) as ChassisId[]).map((cId) => {
                const item = CHASSIS_CATALOG[cId];
                const slotIdx = activeStyles.indexOf(cId);
                const active = slotIdx >= 0;
                const locked = !isPartOwned(profile, 'chassis', cId);
                return (
                  <button key={cId} type="button" onClick={() => toggleChassisStyle(cId)} className={cardCls(active, locked)}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-xs font-bold truncate ${locked ? 'text-slate-400' : 'text-white'}`}>{item.label}</span>
                      <span className="font-mono-tabular text-[11px] text-amber-400 shrink-0">
                        {slotIdx === 0 ? 'Core' : active ? `Hybrid #${slotIdx + 1}` : item.sizeTag}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">{item.subtitle}</p>
                    <div className="mt-1.5 flex flex-wrap gap-x-2 text-[10px] font-mono-tabular text-slate-300 pr-12">
                      <span>HP {item.baseHp}</span>
                      <span>DEF {Math.round(item.frontDeflect * 100)}%</span>
                      <span>SPD {Math.round(item.speedMult * 100)}%</span>
                    </div>
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
                    className={cardCls(active, false)}
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
                const locked = !isPartOwned(profile, 'drive', dId);
                return (
                  <button
                    key={dId}
                    type="button"
                    onClick={() => {
                      if (ensureOwned('drive', dId, item.label)) onChange({ ...config, drive: dId });
                    }}
                    className={cardCls(active, locked)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-xs font-bold truncate ${locked ? 'text-slate-400' : 'text-white'}`}>{item.label}</span>
                      <span className="font-mono-tabular text-[11px] text-amber-400 shrink-0">{item.maxSpeed} m/s</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">{item.subtitle}</p>
                    <PriceTag cat="drive" id={dId} />
                  </button>
                );
              })}

            {tab === 'paint' && (
              <>
                <div className="col-span-2 sm:col-span-3 lg:col-span-4 grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div className="rounded-xl border border-slate-800 bg-[#161B22] p-2.5">
                    <div className="text-[11px] font-semibold text-slate-300 mb-1.5">Custom Colors</div>
                    <div className="flex flex-wrap items-center gap-3">
                      {(
                        [
                          ['Body', 'primaryColor', config.primaryColor],
                          ['Accent', 'accentColor', config.accentColor],
                          ['Glow', 'glowColor', config.glowColor ?? config.accentColor],
                        ] as const
                      ).map(([label, key, val]) => (
                        <label key={key} className="flex items-center gap-1.5 text-[11px] text-slate-400">
                          <input
                            type="color"
                            value={val}
                            onChange={(e) => onChange({ ...config, [key]: e.target.value.toUpperCase() })}
                            className="h-7 w-9 cursor-pointer rounded border border-slate-700 bg-transparent"
                            aria-label={`${label} color`}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-1.5 text-[11px] text-slate-300">
                        <input
                          type="checkbox"
                          checked={Boolean(config.underglow)}
                          onChange={(e) => onChange({ ...config, underglow: e.target.checked })}
                          className="h-4 w-4 accent-amber-500"
                        />
                        Underglow
                      </label>
                      <label className="flex items-center gap-1.5 text-[11px] text-slate-300">
                        Race #
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
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-[#161B22] p-2.5">
                    <div className="text-[11px] font-semibold text-slate-300 mb-1.5">Finish</div>
                    <div className="grid grid-cols-3 gap-1">
                      {(Object.keys(FINISH_CATALOG) as FinishId[]).map((fId) => (
                        <button
                          key={fId}
                          type="button"
                          title={FINISH_CATALOG[fId].subtitle}
                          onClick={() => onChange({ ...config, finish: fId })}
                          className={`rounded-md border px-1.5 py-1 text-[10px] font-semibold transition ${
                            finish === fId ? 'border-amber-500 bg-amber-500/15 text-amber-200' : 'border-slate-700 text-slate-300 hover:border-slate-500'
                          }`}
                        >
                          {FINISH_CATALOG[fId].label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-[#161B22] p-2.5">
                    <div className="text-[11px] font-semibold text-slate-300 mb-1.5">Pattern</div>
                    <div className="grid grid-cols-4 gap-1">
                      {(Object.keys(PATTERN_CATALOG) as PatternId[]).map((pId) => (
                        <button
                          key={pId}
                          type="button"
                          onClick={() => onChange({ ...config, pattern: pId })}
                          className={`rounded-md border px-1 py-1 text-[10px] font-semibold transition truncate ${
                            pattern === pId ? 'border-amber-500 bg-amber-500/15 text-amber-200' : 'border-slate-700 text-slate-300 hover:border-slate-500'
                          }`}
                        >
                          {PATTERN_CATALOG[pId].label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {PAINT_PRESETS.map((p) => {
                  const active = config.primaryColor === p.primary && config.accentColor === p.accent;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => onChange({ ...config, primaryColor: p.primary, accentColor: p.accent })}
                      className={`flex items-center gap-3 rounded-xl border p-2.5 transition ${
                        active ? 'border-amber-500 bg-amber-500/12' : 'border-slate-800 bg-[#161B22] hover:border-slate-600'
                      }`}
                    >
                      <span className="flex shrink-0">
                        <span className="h-6 w-4 rounded-l-md border border-white/20" style={{ backgroundColor: p.primary }} />
                        <span className="h-6 w-2.5 rounded-r-md border border-l-0 border-white/20" style={{ backgroundColor: p.accent }} />
                      </span>
                      <span className="text-xs font-semibold text-white truncate">{p.label}</span>
                    </button>
                  );
                })}
              </>
            )}

            {tab === 'garage' &&
              [0, 1, 2].map((slot) => {
                const saved = profile.savedLoadouts?.[slot];
                return (
                  <div key={slot} className="rounded-xl border border-slate-800 bg-[#161B22] p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white truncate">
                        Bay {slot + 1}: {saved ? saved.name : 'Empty'}
                      </span>
                      {saved && (
                        <span className="flex shrink-0">
                          <span className="h-4 w-3 rounded-l border border-white/20" style={{ backgroundColor: saved.primaryColor }} />
                          <span className="h-4 w-2 rounded-r border border-l-0 border-white/20" style={{ backgroundColor: saved.accentColor }} />
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">
                      {saved
                        ? `${getBotWeapons(saved).map((w) => WEAPON_CATALOG[w].label).join(' + ')} · ${ARMOR_CATALOG[saved.armor].label} · ${DRIVE_CATALOG[saved.drive].label}`
                        : 'Save your current build here to swap loadouts between fights.'}
                    </p>
                    <div className="mt-2 flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => onSaveLoadout(slot)}
                        className="flex items-center gap-1 rounded-md bg-[#19202A] px-2 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-700"
                      >
                        <Save className="h-3 w-3" /> Save
                      </button>
                      <button
                        type="button"
                        disabled={!saved}
                        onClick={() => onLoadLoadout(slot)}
                        className="rounded-md bg-amber-500 px-2 py-1 text-[11px] font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-40"
                      >
                        Load
                      </button>
                    </div>
                  </div>
                );
              })}
            {tab === 'garage' && (
              <div className="rounded-xl border border-slate-800 bg-[#161B22] p-2.5 text-[11px] text-slate-400">
                <div className="text-xs font-bold text-white">Parts Owned</div>
                <p className="mt-1">
                  {(profile.ownedParts ?? []).length} premium parts unlocked · {profile.scrap} scrap on hand. Unlock more
                  by buying locked cards, finishing campaign levels, or claiming season events.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
