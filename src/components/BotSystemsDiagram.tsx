import React from 'react';
import { getBotWeapons, WEAPON_CATALOG, type ArmorZones, type BotPhysicsState } from '../shared/types';

const healthColor = (h: number) => (h <= 0 ? '#1e293b' : h < 35 ? '#ef4444' : h < 70 ? '#f59e0b' : '#10b981');

interface Props {
  bot: BotPhysicsState;
  compact?: boolean;
  title?: string;
}

/** Top-down systems readout: armor zones, drive units, weapon mounts, battery, motor, heat and cryo load. */
export const BotSystemsDiagram: React.FC<Props> = ({ bot, compact = false, title }) => {
  const c = bot.components ?? { wheels: [100, 100, 100, 100], weapons: [100, 100, 100], battery: 100, motor: 100 };
  const weapons = getBotWeapons(bot.config);
  const armorPct = (z: keyof ArmorZones) =>
    bot.maxArmorZone > 0 ? Math.max(0, Math.round((bot.armorZones[z] / bot.maxArmorZone) * 100)) : 0;
  const melt = (z: keyof ArmorZones) => bot.meltZones?.[z] ?? 0;
  const heat = Math.round(bot.heat ?? 0);
  const chill = Math.round(bot.chill ?? 0);
  const frozen = (bot.frozenTimer ?? 0) > 0;
  const w = compact ? 112 : 150;

  const wheelRects: Array<[number, number]> = [
    [20, 42],
    [116, 42],
    [20, 98],
    [116, 98],
  ];
  const weaponPos: Array<[number, number]> = [
    [75, 12],
    [58, 70],
    [92, 70],
  ];

  const armorBar = (z: keyof ArmorZones, x: number, y: number, bw: number, bh: number) => {
    const p = armorPct(z);
    const m = melt(z);
    return (
      <g key={z}>
        <rect x={x} y={y} width={bw} height={bh} rx={2} fill="#0f172a" stroke="#334155" strokeWidth={0.6} />
        {p > 0 && (
          <rect
            x={x}
            y={y}
            width={bw > bh ? (bw * p) / 100 : bw}
            height={bw > bh ? bh : (bh * p) / 100}
            rx={2}
            fill={healthColor(p)}
          />
        )}
        {m > 0.05 && <rect x={x} y={y} width={bw} height={bh} rx={2} fill="#f97316" opacity={Math.min(0.75, m * 0.8)} />}
      </g>
    );
  };

  return (
    <div
      className={`rounded-xl border bg-[#12161C]/90 px-2 py-1.5 ${
        frozen ? 'border-cyan-400/80' : heat > 55 ? 'border-orange-500/80' : bot.flipped ? 'border-fuchsia-500/70' : 'border-slate-700/80'
      }`}
      style={{ width: w + 16 }}
    >
      <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-slate-400">
        <span className="truncate">{title ?? 'Systems'}</span>
        <span className="flex gap-1">
          {bot.flipped && <span className="text-fuchsia-300">Inverted</span>}
          {frozen && <span className="text-cyan-300">Frozen</span>}
          {!frozen && heat > 55 && <span className="text-orange-300">Melting</span>}
        </span>
      </div>
      <svg viewBox="0 0 150 168" width={w} height={(w * 168) / 150} role="img" aria-label="Bot systems damage diagram">
        <g transform={bot.flipped ? 'rotate(180 75 84)' : undefined}>
          {/* Hull */}
          <rect x={38} y={30} width={74} height={104} rx={8} fill="#1e293b" stroke="#475569" strokeWidth={0.8} />
          <text x={75} y={146} textAnchor="middle" fontSize={7} fill="#64748b">
            REAR
          </text>
          {/* Armor zones */}
          {armorBar('front', 40, 24, 70, 5)}
          {armorBar('rear', 40, 135, 70, 5)}
          {armorBar('left', 32, 34, 5, 96)}
          {armorBar('right', 113, 34, 5, 96)}
          {/* Drive units */}
          {wheelRects.map(([x, y], i) => {
            const h = Math.round(c.wheels[i] ?? 100);
            const gone = h <= 0;
            return (
              <g key={`w${i}`}>
                <rect
                  x={x}
                  y={y}
                  width={14}
                  height={26}
                  rx={3}
                  fill={gone ? 'none' : healthColor(h)}
                  stroke={gone ? '#ef4444' : '#0f172a'}
                  strokeDasharray={gone ? '3 2' : undefined}
                  strokeWidth={gone ? 1.2 : 0.8}
                />
                {gone && (
                  <path d={`M${x + 3} ${y + 6} L${x + 11} ${y + 20} M${x + 11} ${y + 6} L${x + 3} ${y + 20}`} stroke="#ef4444" strokeWidth={1.4} />
                )}
              </g>
            );
          })}
          {/* Battery + motor */}
          <rect x={62} y={94} width={26} height={22} rx={2} fill="#0f172a" stroke="#475569" strokeWidth={0.6} />
          <rect
            x={62}
            y={94 + 22 * (1 - Math.max(0, c.battery) / 100)}
            width={26}
            height={22 * (Math.max(0, c.battery) / 100)}
            rx={2}
            fill={c.battery <= 0 ? '#1e293b' : c.battery < 35 ? '#ef4444' : '#facc15'}
          />
          <text x={75} y={108} textAnchor="middle" fontSize={7} fontWeight={700} fill="#0f172a">
            {c.battery <= 0 ? 'X' : 'BAT'}
          </text>
          <rect x={62} y={119} width={26} height={9} rx={2} fill={healthColor(c.motor)} />
          <text x={75} y={126} textAnchor="middle" fontSize={6} fontWeight={700} fill="#0f172a">
            MOTOR
          </text>
          {/* Weapon mounts */}
          {weapons.slice(0, 3).map((wid, slot) => {
            const [x, y] = weaponPos[slot];
            const h = Math.round(c.weapons[slot] ?? 100);
            const gone = h <= 0;
            return (
              <g key={`wp${slot}`}>
                <circle
                  cx={x}
                  cy={y}
                  r={9}
                  fill={gone ? 'none' : healthColor(h)}
                  stroke={gone ? '#ef4444' : '#0f172a'}
                  strokeDasharray={gone ? '3 2' : undefined}
                  strokeWidth={1}
                />
                <text x={x} y={y + 3} textAnchor="middle" fontSize={8} fontWeight={800} fill={gone ? '#ef4444' : '#0f172a'}>
                  {gone ? 'X' : slot + 1}
                </text>
              </g>
            );
          })}
        </g>
        {/* Heat & cryo load */}
        <rect x={6} y={154} width={66} height={6} rx={3} fill="#0f172a" />
        <rect x={6} y={154} width={(66 * heat) / 100} height={6} rx={3} fill={heat > 55 ? '#f97316' : '#fb923c'} opacity={0.9} />
        <text x={6} y={152} fontSize={6} fill="#fdba74">
          HEAT {heat}
        </text>
        <rect x={78} y={154} width={66} height={6} rx={3} fill="#0f172a" />
        <rect x={78} y={154} width={(66 * chill) / 100} height={6} rx={3} fill="#38bdf8" />
        <text x={78} y={152} fontSize={6} fill="#7dd3fc">
          CRYO {frozen ? 'LOCKED' : chill}
        </text>
      </svg>
      {!compact && (
        <div className="mt-0.5 grid grid-cols-1 gap-0.5 text-[9px] font-mono-tabular text-slate-400">
          {weapons.slice(0, 3).map((wid, slot) => {
            const h = Math.round(c.weapons[slot] ?? 100);
            return (
              <div key={wid + slot} className="flex justify-between">
                <span className="truncate">
                  {slot + 1}. {WEAPON_CATALOG[wid].label}
                </span>
                <span className={h <= 0 ? 'text-red-400 font-bold' : h < 35 ? 'text-red-300' : 'text-slate-300'}>
                  {h <= 0 ? 'LOST' : `${h}%`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
