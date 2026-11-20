import React from 'react';
import { CUSTOM_ITEM_INFO, SPAWN_RADIUS, type CustomItemKind } from '../shared/arenaLayouts';

export interface MiniMapItem {
  kind: CustomItemKind | string;
  x: number;
  z: number;
  yaw?: number;
  radius?: number;
}

interface Props {
  items: MiniMapItem[];
  accent?: string;
  size?: number;
  showSpawns?: boolean;
  className?: string;
}

const HALF = 18;

/** Top-down schematic of an arena floor: walls, spawn ring, obstacles and traps. */
export const ArenaMiniMap: React.FC<Props> = ({ items, accent = '#f59e0b', size = 96, showSpawns = true, className = '' }) => {
  return (
    <svg
      viewBox={`${-HALF} ${-HALF} ${HALF * 2} ${HALF * 2}`}
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Arena layout preview"
    >
      <rect x={-HALF} y={-HALF} width={HALF * 2} height={HALF * 2} rx={1.5} fill="#0b0f15" stroke={accent} strokeWidth={0.6} />
      {[-12, -6, 0, 6, 12].map((v) => (
        <g key={v} stroke="#1e293b" strokeWidth={0.12}>
          <line x1={v} y1={-HALF} x2={v} y2={HALF} />
          <line x1={-HALF} y1={v} x2={HALF} y2={v} />
        </g>
      ))}
      {showSpawns && (
        <circle cx={0} cy={0} r={SPAWN_RADIUS} fill="none" stroke="#334155" strokeWidth={0.18} strokeDasharray="0.8 0.8" />
      )}
      {items.map((it, i) => {
        const info = CUSTOM_ITEM_INFO[it.kind as CustomItemKind];
        const color = info?.color ?? '#94a3b8';
        const r = it.radius ?? info?.radius ?? 0.9;
        const deg = ((it.yaw ?? 0) * 180) / Math.PI;
        if (it.kind === 'barrier') {
          return (
            <rect
              key={i}
              x={it.x - 0.45}
              y={it.z - 0.85}
              width={0.9}
              height={1.7}
              rx={0.15}
              fill="#cbd5e1"
              transform={`rotate(${-deg} ${it.x} ${it.z})`}
            />
          );
        }
        if (it.kind === 'ramp') {
          return (
            <polygon
              key={i}
              points={`${it.x - 1.1},${it.z + 1.1} ${it.x + 1.1},${it.z + 1.1} ${it.x},${it.z - 1.2}`}
              fill="#64748b"
              stroke="#f59e0b"
              strokeWidth={0.15}
              transform={`rotate(${-deg} ${it.x} ${it.z})`}
            />
          );
        }
        if (it.kind === 'crate') {
          return <rect key={i} x={it.x - 0.75} y={it.z - 0.75} width={1.5} height={1.5} rx={0.2} fill={color} />;
        }
        const group = info?.group;
        return (
          <circle
            key={i}
            cx={it.x}
            cy={it.z}
            r={r}
            fill={group === 'obstacle' ? color : `${color}55`}
            stroke={group === 'obstacle' ? 'none' : color}
            strokeWidth={0.25}
            strokeDasharray={group === 'sky' ? '0.6 0.5' : undefined}
          />
        );
      })}
    </svg>
  );
};
