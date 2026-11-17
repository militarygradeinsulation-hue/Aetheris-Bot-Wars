import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  CircleDot,
  Gauge,
  Palette,
  Shield,
  Swords,
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
  getBotChassisStyles,
  getBotWeapons,
  PAINT_PRESETS,
  type SkillTree,
  WEAPON_CATALOG,
  type WeaponId,
  WHEEL_LAYOUT_CATALOG,
  type WheelLayoutId,
} from '../shared/types';

interface WorkshopDockProps {
  config: BotConfig;
  skills: SkillTree;
  onChange: (next: BotConfig) => void;
  onStartFight: () => void;
}

type CustomTab = 'weapon' | 'armor' | 'chassis' | 'wheels' | 'drive' | 'paint';

export const WorkshopDock: React.FC<WorkshopDockProps> = ({
  config,
  skills,
  onChange,
  onStartFight,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState<CustomTab>('weapon');
  const stats = computeBotStats(config, skills);
  const activeWeapons = getBotWeapons(config);
  const activeStyles = getBotChassisStyles(config);

  const toggleWeapon = (wId: WeaponId) => {
    const idx = activeWeapons.indexOf(wId);
    let next: WeaponId[];
    if (idx >= 0) {
      if (activeWeapons.length <= 1) return;
      next = activeWeapons.filter((w) => w !== wId);
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
    } else if (activeStyles.length < 3) {
      next = [...activeStyles, cId];
    } else {
      next = [activeStyles[0], activeStyles[1], cId];
    }
    onChange({ ...config, chassis: next[0], chassisStyles: next });
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-20 flex flex-col items-center px-3 pb-safe">
      {/* Collapse / Expand Handle */}
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
        <div className="pointer-events-auto w-full max-w-[980px] rounded-2xl border border-slate-700/80 bg-[#12161C]/94 p-3 sm:p-4 shadow-2xl">
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

              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono-tabular">
                <span className="font-sans font-semibold text-slate-200">{stats.weightClass}</span>
                <span aria-hidden="true">·</span>
                <span>{stats.bodyScale}×</span>
                <span aria-hidden="true">·</span>
                <span>HP {stats.maxHp}</span>
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
                  { id: 'paint', label: 'Finish', Icon: Palette },
                ] as const
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-2 min-h-[40px] text-xs font-semibold transition whitespace-nowrap shrink-0 ${
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
                className="ml-1 rounded-lg bg-emerald-500 px-3.5 sm:px-4 py-2 min-h-[40px] text-xs font-bold text-slate-950 hover:bg-emerald-400 transition whitespace-nowrap shrink-0"
              >
                Enter Arena
              </button>
            </div>
          </div>

          {/* Hybrid Loadout Bar for Multi-Weapon & Multi-Style Fusion */}
          {tab === 'weapon' && (
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
              <span>
                Combine up to 3 weapons on one chassis — click cards below to mount or remove
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
                    {idx + 1}. {WEAPON_CATALOG[wId].label}
                    {activeWeapons.length > 1 ? ' ×' : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === 'chassis' && (
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
              <span>
                Fuse up to 3 body styles into one hybrid hull — click cards below to layer or remove
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

          {/* Selection Strip */}
          <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[30vh] sm:max-h-[215px] overflow-y-auto pr-0.5">
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
                    className={`text-left rounded-xl border p-2.5 transition ${
                      active
                        ? 'border-amber-500 bg-amber-500/12'
                        : 'border-slate-800 bg-[#161B22] hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white truncate">{item.label}</span>
                      <span className="font-mono-tabular text-[11px] text-amber-400 shrink-0">
                        {active ? `Slot ${slotIdx + 1}` : `+ ${item.damage} DMG`}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">{item.subtitle}</p>
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
                    onClick={() => onChange({ ...config, armor: aId })}
                    className={`text-left rounded-xl border p-2.5 transition ${
                      active
                        ? 'border-amber-500 bg-amber-500/12'
                        : 'border-slate-800 bg-[#161B22] hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white truncate">{item.label}</span>
                      <span className="font-mono-tabular text-[11px] text-amber-400 shrink-0">
                        +{item.hpBonus} HP
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">{item.subtitle}</p>
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
                    className={`text-left rounded-xl border p-2.5 transition ${
                      active
                        ? 'border-amber-500 bg-amber-500/12'
                        : 'border-slate-800 bg-[#161B22] hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white truncate">{item.label}</span>
                      <span className="font-mono-tabular text-[11px] text-amber-400 shrink-0">
                        {slotIdx === 0 ? 'Core' : active ? `Hybrid #${slotIdx + 1}` : item.sizeTag}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">{item.subtitle}</p>
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
                    onClick={() => onChange({ ...config, drive: dId })}
                    className={`text-left rounded-xl border p-2.5 transition ${
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
                    <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">{item.subtitle}</p>
                  </button>
                );
              })}

            {tab === 'paint' &&
              PAINT_PRESETS.map((p) => {
                const active = config.primaryColor === p.primary;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() =>
                      onChange({ ...config, primaryColor: p.primary, accentColor: p.accent })
                    }
                    className={`flex items-center gap-3 rounded-xl border p-2.5 transition ${
                      active
                        ? 'border-amber-500 bg-amber-500/12'
                        : 'border-slate-800 bg-[#161B22] hover:border-slate-600'
                    }`}
                  >
                    <span
                      className="h-6 w-6 rounded-lg border border-white/20 shrink-0"
                      style={{ backgroundColor: p.primary }}
                    />
                    <span className="text-xs font-semibold text-white truncate">{p.label}</span>
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
};
