/**
 * Arena floor layouts and the custom arena format.
 * A layout decides where obstacles sit; the arena theme decides the look, hazards and weather.
 */
import type { ArenaId, DestructibleProp, HazardState } from './types.ts';

export type ArenaLayoutId =
  | 'classic'
  | 'open_floor'
  | 'pillar_grid'
  | 'cross_walls'
  | 'ring_fortress'
  | 'ramp_park'
  | 'scrap_yard'
  | 'twin_bunkers';

export const ARENA_LAYOUTS: Record<ArenaLayoutId, { id: ArenaLayoutId; label: string; note: string; hazards: boolean }> = {
  classic: { id: 'classic', label: 'Classic', note: 'Pillars, crates, barrels and 4 jump ramps', hazards: true },
  open_floor: { id: 'open_floor', label: 'Bare Floor', note: 'Empty deck. No obstacles, no traps. Pure driving.', hazards: false },
  pillar_grid: { id: 'pillar_grid', label: 'Pillar Grid', note: '8 steel columns to hide behind and bounce off', hazards: true },
  cross_walls: { id: 'cross_walls', label: 'X Walls', note: 'Diagonal blast walls split the deck into 4 lanes', hazards: true },
  ring_fortress: { id: 'ring_fortress', label: 'Ring Fortress', note: 'Walled center ring with 4 gates', hazards: true },
  ramp_park: { id: 'ramp_park', label: 'Ramp Park', note: '8 launch ramps for big air', hazards: true },
  scrap_yard: { id: 'scrap_yard', label: 'Scrap Yard', note: 'Crates and fuel barrels scattered everywhere', hazards: true },
  twin_bunkers: { id: 'twin_bunkers', label: 'Twin Bunkers', note: 'Two U-shaped bunkers facing off across the deck', hazards: true },
};

export type CustomItemKind =
  | 'pillar'
  | 'crate'
  | 'barrel'
  | 'ramp'
  | 'barrier'
  | 'saw'
  | 'flipper_pad'
  | 'crusher'
  | 'spinner_blade'
  | 'pit'
  | 'oil_slick'
  | 'laser_grid'
  | 'emp_ring'
  | 'lava_vent'
  | 'acid_pool'
  | 'bomb_drop'
  | 'lightning';

export const CUSTOM_ITEM_INFO: Record<
  CustomItemKind,
  { label: string; group: 'obstacle' | 'trap' | 'sky'; color: string; radius: number; rotates?: boolean }
> = {
  pillar: { label: 'Pillar', group: 'obstacle', color: '#94a3b8', radius: 1.05 },
  crate: { label: 'Crate', group: 'obstacle', color: '#b7793a', radius: 0.85 },
  barrel: { label: 'Fuel Barrel', group: 'obstacle', color: '#dc2626', radius: 0.72 },
  ramp: { label: 'Jump Ramp', group: 'obstacle', color: '#64748b', radius: 1.35, rotates: true },
  barrier: { label: 'Blast Wall', group: 'obstacle', color: '#cbd5e1', radius: 0.9, rotates: true },
  saw: { label: 'Floor Saw', group: 'trap', color: '#f8fafc', radius: 1.45 },
  flipper_pad: { label: 'Flipper Pad', group: 'trap', color: '#f59e0b', radius: 1.7 },
  crusher: { label: 'Crusher', group: 'trap', color: '#ef4444', radius: 1.85 },
  spinner_blade: { label: 'Sweep Blade', group: 'trap', color: '#e2e8f0', radius: 1.15 },
  pit: { label: 'Drop Pit', group: 'trap', color: '#0f172a', radius: 1.8 },
  oil_slick: { label: 'Oil Slick', group: 'trap', color: '#1e1b4b', radius: 2.3 },
  laser_grid: { label: 'Laser Grid', group: 'trap', color: '#f43f5e', radius: 1.25 },
  emp_ring: { label: 'EMP Ring', group: 'trap', color: '#a855f7', radius: 2.6 },
  lava_vent: { label: 'Lava Vent', group: 'trap', color: '#f97316', radius: 2.5 },
  acid_pool: { label: 'Acid Pool', group: 'trap', color: '#10b981', radius: 2.5 },
  bomb_drop: { label: 'Bomb Drop Zone', group: 'sky', color: '#fb923c', radius: 2.75 },
  lightning: { label: 'Lightning Rod Zone', group: 'sky', color: '#93c5fd', radius: 2.3 },
};

export interface CustomArenaItem {
  id: string;
  kind: CustomItemKind;
  x: number;
  z: number;
  yaw?: number;
}

export interface CustomArenaSpec {
  id: string;
  name: string;
  /** Visual theme: walls, floor, lighting, crowd and weather come from this arena. */
  theme: ArenaId;
  items: CustomArenaItem[];
  createdAt: number;
}

/** Hazard spawn options shared by the built-in arenas and the custom builder. */
export interface ArenaRules {
  bombs: boolean;
  lightning: boolean;
}

export const DEFAULT_ARENA_RULES: ArenaRules = { bombs: true, lightning: true };

/** Spawn ring radius used by the engine; keep custom items clear of it. */
export const SPAWN_RADIUS = 11;

const prop = (
  id: string,
  kind: DestructibleProp['kind'],
  x: number,
  z: number,
  extra: Partial<DestructibleProp> = {},
): DestructibleProp => {
  const base: Record<string, { radius: number; hp: number }> = {
    pillar: { radius: 1.05, hp: 75 },
    crate: { radius: 0.85, hp: 24 },
    barrel: { radius: 0.72, hp: 20 },
    ramp: { radius: 1.35, hp: 999 },
    barrier: { radius: 0.9, hp: 1e9 },
  };
  const b = base[kind] ?? { radius: 0.9, hp: 30 };
  return { id, kind, x, y: 0, z, radius: b.radius, hp: b.hp, maxHp: b.hp, destroyed: false, ...extra };
};

/** A straight wall made of overlapping barrier blocks (circle chain collision). */
function wall(prefix: string, x1: number, z1: number, x2: number, z2: number): DestructibleProp[] {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const n = Math.max(1, Math.round(len / 1.5));
  const yaw = Math.atan2(x2 - x1, z2 - z1);
  const out: DestructibleProp[] = [];
  for (let i = 0; i <= n; i++) {
    const f = n === 0 ? 0.5 : i / n;
    out.push(prop(`${prefix}_${i}`, 'barrier', x1 + (x2 - x1) * f, z1 + (z2 - z1) * f, { yaw }));
  }
  return out;
}

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function hashString(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Props for a preset layout. Returns null for 'classic' (the engine keeps its arena-specific set). */
export function buildLayoutProps(layout: ArenaLayoutId, arenaId: ArenaId): DestructibleProp[] | null {
  switch (layout) {
    case 'classic':
      return null;
    case 'open_floor':
      return [];
    case 'pillar_grid': {
      const out: DestructibleProp[] = [];
      for (const x of [-7, 0, 7]) {
        for (const z of [-7, 0, 7]) {
          if (x === 0 && z === 0) continue;
          out.push(prop(`pg_${x}_${z}`, 'pillar', x, z));
        }
      }
      out.push(prop('pg_crate_c', 'crate', 0, 0));
      return out;
    }
    case 'cross_walls': {
      const d = Math.SQRT1_2;
      const out: DestructibleProp[] = [];
      [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ].forEach(([sx, sz], i) => {
        out.push(...wall(`xw${i}`, sx * 3.6 * d, sz * 3.6 * d, sx * 10 * d, sz * 10 * d));
      });
      out.push(prop('xw_barrel_n', 'barrel', 0, -5.5), prop('xw_barrel_s', 'barrel', 0, 5.5));
      out.push(prop('xw_crate_w', 'crate', -5.5, 0), prop('xw_crate_e', 'crate', 5.5, 0));
      return out;
    }
    case 'ring_fortress': {
      const out: DestructibleProp[] = [];
      const r = 6.2;
      for (let q = 0; q < 4; q++) {
        // Each quarter arc leaves a gate on the diagonal
        const a0 = (q * Math.PI) / 2 + 0.42;
        const a1 = ((q + 1) * Math.PI) / 2 - 0.42;
        const steps = 4;
        for (let i = 0; i <= steps; i++) {
          const a = a0 + ((a1 - a0) * i) / steps;
          out.push(prop(`rf_${q}_${i}`, 'barrier', Math.sin(a) * r, Math.cos(a) * r, { yaw: a + Math.PI / 2 }));
        }
      }
      out.push(prop('rf_pillar_c', 'pillar', 0, 0));
      for (const [x, z] of [
        [-12, -12],
        [12, 12],
        [-12, 12],
        [12, -12],
      ]) {
        out.push(prop(`rf_crate_${x}_${z}`, 'crate', x, z));
      }
      return out;
    }
    case 'ramp_park': {
      const out: DestructibleProp[] = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const r = i % 2 === 0 ? 5.5 : 8.5;
        // Ramps face outward from the center so bots launch off them while circling
        out.push(prop(`rp_${i}`, 'ramp', Math.sin(a) * r, Math.cos(a) * r, { yaw: a + Math.PI }));
      }
      out.push(prop('rp_crate_c', 'crate', 0, 0));
      return out;
    }
    case 'scrap_yard': {
      const rnd = seeded(hashString(arenaId));
      const out: DestructibleProp[] = [];
      let tries = 0;
      while (out.length < 18 && tries < 400) {
        tries++;
        const x = (rnd() * 2 - 1) * 14;
        const z = (rnd() * 2 - 1) * 14;
        if (Math.hypot(x, z) < 2.5) continue;
        if (Math.abs(Math.hypot(x, z) - SPAWN_RADIUS) < 2.6) continue;
        if (out.some((p) => Math.hypot(p.x - x, p.z - z) < 2.4)) continue;
        const roll = rnd();
        const kind: DestructibleProp['kind'] = roll < 0.6 ? 'crate' : roll < 0.88 ? 'barrel' : 'pillar';
        out.push(prop(`sy_${out.length}`, kind, x, z, { yaw: rnd() * Math.PI }));
      }
      return out;
    }
    case 'twin_bunkers': {
      const out: DestructibleProp[] = [];
      for (const s of [-1, 1]) {
        // U shape open toward the center line
        out.push(...wall(`tb${s}_back`, -3.5, s * 7.5, 3.5, s * 7.5));
        out.push(...wall(`tb${s}_l`, -3.5, s * 7.5, -3.5, s * 4.2));
        out.push(...wall(`tb${s}_r`, 3.5, s * 7.5, 3.5, s * 4.2));
      }
      out.push(prop('tb_pillar_w', 'pillar', -8, 0), prop('tb_pillar_e', 'pillar', 8, 0));
      out.push(prop('tb_ramp_w', 'ramp', -4, 0, { yaw: Math.PI / 2 }), prop('tb_ramp_e', 'ramp', 4, 0, { yaw: -Math.PI / 2 }));
      return out;
    }
  }
}

export interface HazardTiming {
  tier2Unlock: number;
  tier3Unlock: number;
}

/** Build one hazard of a given kind with sensible cycle timing. */
export function makeHazard(kind: CustomItemKind, id: string, x: number, z: number, phase: number, t: HazardTiming): HazardState | null {
  const cyc = (cyclePeriod: number, warningDuration: number, activeDuration: number) => ({
    cyclePeriod,
    warningDuration,
    activeDuration,
  });
  const base = { id, x, z, active: false, warning: false, phase, unlockAt: 0 };
  switch (kind) {
    case 'saw':
      return { ...base, kind: 'saw', radius: 1.45, active: true };
    case 'flipper_pad':
      return { ...base, kind: 'flipper_pad', radius: 1.7, ...cyc(5, 0.9, 0.5) };
    case 'crusher':
      return { ...base, kind: 'crusher', radius: 1.85, crusherY: 1, ...cyc(11.5, 1.8, 1.0) };
    case 'spinner_blade':
      return { ...base, kind: 'spinner_blade', radius: 1.15, armLength: 2.85, sweepAngle: 0, ...cyc(10.5, 1.5, 5.4) };
    case 'pit':
      return { ...base, kind: 'pit', radius: 1.8, unlockAt: Math.min(8, t.tier2Unlock), ...cyc(10.5, 3, 4.5) };
    case 'oil_slick':
      return { ...base, kind: 'oil_slick', radius: 2.3, active: true, ignited: false };
    case 'laser_grid':
      return { ...base, kind: 'laser_grid', radius: 1.25, armLength: 3.6, sweepAngle: phase, ...cyc(10, 3, 4.5) };
    case 'emp_ring':
      return { ...base, kind: 'emp_ring', radius: 2.6, ...cyc(6, 1.1, 1.5) };
    case 'lava_vent':
      return { ...base, kind: 'lava_vent', radius: 2.5, ...cyc(5.4, 1.1, 1.8) };
    case 'acid_pool':
      return { ...base, kind: 'acid_pool', radius: 2.5, active: true, ...cyc(5, 1, 2.6) };
    case 'bomb_drop':
      return { ...base, kind: 'bomb_drop', radius: 2.75, bombY: 1, unlockAt: 3, ...cyc(8.2, 3, 0.4) };
    case 'lightning':
      return { ...base, kind: 'lightning', radius: 2.3, unlockAt: 2, ...cyc(7.2, 3, 0.4) };
    default:
      return null;
  }
}

/** Expand a saved custom arena into engine props and hazards. */
export function buildCustomArena(spec: CustomArenaSpec, t: HazardTiming): { props: DestructibleProp[]; hazards: HazardState[] } {
  const props: DestructibleProp[] = [];
  const hazards: HazardState[] = [];
  spec.items.slice(0, 80).forEach((it, i) => {
    const x = Math.max(-16, Math.min(16, it.x));
    const z = Math.max(-16, Math.min(16, it.z));
    const info = CUSTOM_ITEM_INFO[it.kind];
    if (!info) return;
    if (info.group === 'obstacle') {
      if (it.kind === 'barrier') {
        // A placed wall piece is 3 blocks long along its yaw
        const yaw = it.yaw ?? 0;
        const dx = Math.sin(yaw) * 1.5;
        const dz = Math.cos(yaw) * 1.5;
        props.push(...wall(`cw_${it.id || i}`, x - dx, z - dz, x + dx, z + dz));
      } else {
        props.push(prop(`c_${it.id || i}_${it.kind}`, it.kind as DestructibleProp['kind'], x, z, { yaw: it.yaw ?? 0 }));
      }
    } else {
      const h = makeHazard(it.kind, `ch_${it.id || i}_${it.kind}`, x, z, (i * 1.7) % 6, t);
      if (h) hazards.push(h);
    }
  });
  return { props, hazards };
}

export const CUSTOM_ARENAS_STORAGE_KEY = 'aetheris_custom_arenas_v1';

export function loadCustomArenas(): CustomArenaSpec[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(CUSTOM_ARENAS_STORAGE_KEY) : null;
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((a) => a && typeof a.id === 'string' && Array.isArray(a.items)) : [];
  } catch {
    return [];
  }
}

export function saveCustomArenas(list: CustomArenaSpec[]) {
  try {
    localStorage.setItem(CUSTOM_ARENAS_STORAGE_KEY, JSON.stringify(list.slice(0, 30)));
  } catch {
    // storage full or blocked
  }
}

/** Sanitize a custom arena received over the network or from storage. */
export function sanitizeCustomArena(raw: unknown, validThemes: string[]): CustomArenaSpec | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<CustomArenaSpec>;
  if (!Array.isArray(r.items)) return null;
  const theme = typeof r.theme === 'string' && validThemes.includes(r.theme) ? (r.theme as ArenaId) : ('foundry' as ArenaId);
  const items: CustomArenaItem[] = [];
  for (const it of r.items.slice(0, 80)) {
    if (!it || typeof it !== 'object') continue;
    const kind = (it as CustomArenaItem).kind;
    if (!(kind in CUSTOM_ITEM_INFO)) continue;
    const x = Number((it as CustomArenaItem).x);
    const z = Number((it as CustomArenaItem).z);
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    const yaw = Number((it as CustomArenaItem).yaw ?? 0);
    items.push({ id: String((it as CustomArenaItem).id ?? items.length).slice(0, 24), kind, x, z, yaw: Number.isFinite(yaw) ? yaw : 0 });
  }
  return {
    id: String(r.id ?? 'custom').slice(0, 40),
    name: String(r.name ?? 'Custom Arena').slice(0, 40),
    theme,
    items,
    createdAt: Number(r.createdAt) || Date.now(),
  };
}
