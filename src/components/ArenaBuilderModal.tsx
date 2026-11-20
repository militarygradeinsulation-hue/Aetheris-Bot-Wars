import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Copy, Eraser, FlipHorizontal2, Map as MapIcon, Play, RotateCw, Save, Trash2, X } from 'lucide-react';
import { ArenaBuilder3D } from './ArenaBuilder3D';
import { ARENA_CATALOG, type ArenaId } from '../shared/types';
import {
  CUSTOM_ITEM_INFO,
  SPAWN_RADIUS,
  buildLayoutProps,
  type ArenaLayoutId,
  type CustomArenaItem,
  type CustomArenaSpec,
  type CustomItemKind,
} from '../shared/arenaLayouts';

interface Props {
  open: boolean;
  arenas: CustomArenaSpec[];
  editingId: string | null;
  defaultTheme: ArenaId;
  onSave: (spec: CustomArenaSpec) => void;
  onDelete: (id: string) => void;
  onPlay: (spec: CustomArenaSpec) => void;
  onClose: () => void;
}

const HALF = 18;
const LIMIT = 16;
const MAX_ITEMS = 60;
type Symmetry = 'none' | 'mirror' | 'quad';

const newId = () => `ca_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

const STARTERS: Array<{ id: ArenaLayoutId; label: string }> = [
  { id: 'open_floor', label: 'Blank' },
  { id: 'pillar_grid', label: 'Pillars' },
  { id: 'cross_walls', label: 'X Walls' },
  { id: 'ring_fortress', label: 'Ring' },
  { id: 'twin_bunkers', label: 'Bunkers' },
  { id: 'ramp_park', label: 'Ramps' },
];

/** Convert a preset layout into editable items (walls collapse to 3-block pieces). */
function starterItems(layout: ArenaLayoutId, theme: ArenaId): CustomArenaItem[] {
  const props = buildLayoutProps(layout, theme) ?? [];
  const items: CustomArenaItem[] = [];
  const used = new Set<number>();
  props.forEach((p, i) => {
    if (used.has(i)) return;
    if (p.kind === 'barrier') {
      // Take every second block as a wall-piece center; pieces are 3 blocks long
      items.push({ id: `s${i}`, kind: 'barrier', x: p.x, z: p.z, yaw: p.yaw ?? 0 });
      used.add(i + 1);
      return;
    }
    if (p.kind === 'pillar' || p.kind === 'crate' || p.kind === 'barrel' || p.kind === 'ramp') {
      items.push({ id: `s${i}`, kind: p.kind, x: p.x, z: p.z, yaw: p.yaw ?? 0 });
    }
  });
  return items;
}

export const ArenaBuilderModal: React.FC<Props> = ({ open, arenas, editingId, defaultTheme, onSave, onDelete, onPlay, onClose }) => {
  const existing = arenas.find((a) => a.id === editingId) ?? null;
  const [spec, setSpec] = useState<CustomArenaSpec>(
    () => existing ?? { id: newId(), name: 'My Arena', theme: defaultTheme, items: [], createdAt: Date.now() },
  );
  const [tool, setTool] = useState<CustomItemKind | 'select'>('pillar');
  const [selected, setSelected] = useState<string | null>(null);
  const [symmetry, setSymmetry] = useState<Symmetry>('mirror');
  const [toolYaw, setToolYaw] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [view, setView] = useState<'3d' | 'plan'>('3d');
  const dragRef = useRef<{ id: string; moved: boolean } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setSpec(existing ?? { id: newId(), name: 'My Arena', theme: defaultTheme, items: [], createdAt: Date.now() });
    setSelected(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingId]);

  const flash = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 2200);
  };

  const toWorld = useCallback((e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, z: 0 };
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * HALF * 2 - HALF;
    const z = ((e.clientY - rect.top) / rect.height) * HALF * 2 - HALF;
    const snap = (v: number) => Math.max(-LIMIT, Math.min(LIMIT, Math.round(v * 2) / 2));
    return { x: snap(x), z: snap(z) };
  }, []);

  const placeAt = (x: number, z: number) => {
    if (tool === 'select') return;
    const spots: Array<{ x: number; z: number; yaw: number }> = [{ x, z, yaw: toolYaw }];
    if (symmetry !== 'none') spots.push({ x: -x, z: -z, yaw: toolYaw + Math.PI });
    if (symmetry === 'quad') spots.push({ x: -x, z, yaw: -toolYaw }, { x, z: -z, yaw: Math.PI - toolYaw });
    setSpec((prev) => {
      const items = [...prev.items];
      for (const s of spots) {
        if (items.length >= MAX_ITEMS) break;
        // Skip exact duplicates created by symmetry on the center lines
        if (items.some((it) => Math.hypot(it.x - s.x, it.z - s.z) < 0.4 && it.kind === tool)) continue;
        items.push({ id: newId(), kind: tool, x: s.x, z: s.z, yaw: s.yaw });
      }
      if (items.length >= MAX_ITEMS) flash(`Max ${MAX_ITEMS} pieces per arena`);
      return { ...prev, items };
    });
  };

  const onSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const target = e.target as Element;
    const itemId = target.getAttribute('data-item');
    if (itemId) {
      setSelected(itemId);
      dragRef.current = { id: itemId, moved: false };
      (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
      return;
    }
    setSelected(null);
    const { x, z } = toWorld(e);
    placeAt(x, z);
  };

  const onSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const { x, z } = toWorld(e);
    d.moved = true;
    setSpec((prev) => ({ ...prev, items: prev.items.map((it) => (it.id === d.id ? { ...it, x, z } : it)) }));
  };

  const onSvgPointerUp = () => {
    dragRef.current = null;
  };

  const rotateSelected = () => {
    if (!selected) {
      setToolYaw((y) => y + Math.PI / 4);
      return;
    }
    setSpec((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.id === selected ? { ...it, yaw: (it.yaw ?? 0) + Math.PI / 4 } : it)),
    }));
  };

  const deleteSelected = () => {
    if (!selected) return;
    setSpec((prev) => ({ ...prev, items: prev.items.filter((it) => it.id !== selected) }));
    setSelected(null);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'r' || e.key === 'R') rotateSelected();
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const spawnBlocked = useMemo(
    () =>
      spec.items.filter((it) => {
        const r = CUSTOM_ITEM_INFO[it.kind]?.radius ?? 1;
        return [0, Math.PI / 2, Math.PI, Math.PI * 1.5].some(
          (a) => Math.hypot(it.x - Math.sin(a) * SPAWN_RADIUS, it.z - Math.cos(a) * SPAWN_RADIUS) < r + 1.6,
        );
      }).length,
    [spec.items],
  );

  if (!open) return null;

  const theme = ARENA_CATALOG[spec.theme] ?? ARENA_CATALOG.foundry;
  const groups: Array<{ id: 'obstacle' | 'trap' | 'sky'; label: string }> = [
    { id: 'obstacle', label: 'Obstacles' },
    { id: 'trap', label: 'Floor traps' },
    { id: 'sky', label: 'Sky drops' },
  ];
  const sel = spec.items.find((it) => it.id === selected) ?? null;

  const commitSave = () => {
    const clean = { ...spec, name: spec.name.trim() || 'My Arena' };
    onSave(clean);
    flash('Arena saved');
    return clean;
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-2 sm:p-4" role="dialog" aria-label="Arena builder">
      <div className="flex h-full max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#10141B] shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-4 py-3">
          <h2 className="font-display text-lg font-bold text-white mr-2">Arena Builder</h2>
          <input
            value={spec.name}
            onChange={(e) => setSpec((p) => ({ ...p, name: e.target.value.slice(0, 40) }))}
            className="h-9 w-48 rounded-lg border border-slate-700 bg-[#0B0F15] px-3 text-sm text-white outline-none focus:border-amber-500"
            aria-label="Arena name"
          />
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={commitSave}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 bg-[#19202A] px-3 text-xs font-bold text-white hover:border-amber-500"
            >
              <Save className="h-4 w-4" /> Save
            </button>
            <button
              type="button"
              onClick={() => onPlay(commitSave())}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-amber-500 px-3 text-xs font-extrabold text-slate-950 hover:bg-amber-400"
            >
              <Play className="h-4 w-4" /> Save & Fight
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:text-white"
              aria-label="Close arena builder"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Palette */}
          <aside className="w-full shrink-0 overflow-y-auto border-b border-slate-800 p-3 md:w-64 md:border-b-0 md:border-r">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Theme (walls, lights, crowd)</div>
            <div className="mt-1.5 grid grid-cols-2 gap-1">
              {(Object.keys(ARENA_CATALOG) as ArenaId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSpec((p) => ({ ...p, theme: id }))}
                  className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-left text-[11px] font-semibold ${
                    spec.theme === id ? 'border-amber-500 bg-amber-500/15 text-white' : 'border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: ARENA_CATALOG[id].accentHex }} />
                  <span className="truncate">{ARENA_CATALOG[id].name}</span>
                </button>
              ))}
            </div>

            {groups.map((g) => (
              <div key={g.id} className="mt-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{g.label}</div>
                <div className="mt-1.5 grid grid-cols-2 gap-1">
                  {(Object.keys(CUSTOM_ITEM_INFO) as CustomItemKind[])
                    .filter((k) => CUSTOM_ITEM_INFO[k].group === g.id)
                    .map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setTool(k)}
                        className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-[11px] font-semibold ${
                          tool === k ? 'border-amber-500 bg-amber-500/15 text-white' : 'border-slate-800 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: CUSTOM_ITEM_INFO[k].color }} />
                        {CUSTOM_ITEM_INFO[k].label}
                      </button>
                    ))}
                </div>
              </div>
            ))}

            <div className="mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Start from</div>
            <div className="mt-1.5 grid grid-cols-3 gap-1">
              {STARTERS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSpec((p) => ({ ...p, items: starterItems(s.id, p.theme) }))}
                  className="rounded-md border border-slate-800 px-1.5 py-1 text-[11px] text-slate-300 hover:border-slate-600"
                >
                  {s.label}
                </button>
              ))}
            </div>

            {arenas.length > 0 && (
              <>
                <div className="mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Your arenas</div>
                <div className="mt-1.5 space-y-1">
                  {arenas.map((a) => (
                    <div key={a.id} className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSpec(a);
                          setSelected(null);
                        }}
                        className={`flex-1 truncate rounded-md border px-2 py-1 text-left text-[11px] ${
                          a.id === spec.id ? 'border-amber-500 text-white' : 'border-slate-800 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        {a.name} · {a.items.length}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onDelete(a.id);
                          if (a.id === spec.id) setSpec({ id: newId(), name: 'My Arena', theme: spec.theme, items: [], createdAt: Date.now() });
                        }}
                        className="rounded-md border border-slate-800 p-1 text-slate-400 hover:text-red-400"
                        aria-label={`Delete ${a.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </aside>

          {/* Canvas */}
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-3">
            <div className={`mb-2 flex w-full flex-wrap items-center gap-1.5 ${view === '3d' ? '' : 'max-w-[640px]'}`}>
              <div className="flex overflow-hidden rounded-md border border-amber-500/60 text-[11px]">
                <button
                  type="button"
                  onClick={() => setView('3d')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 font-bold ${view === '3d' ? 'bg-amber-500 text-slate-950' : 'text-slate-300'}`}
                >
                  <Box className="h-3.5 w-3.5" /> 3D
                </button>
                <button
                  type="button"
                  onClick={() => setView('plan')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 font-bold ${view === 'plan' ? 'bg-amber-500 text-slate-950' : 'text-slate-300'}`}
                >
                  <MapIcon className="h-3.5 w-3.5" /> Top plan
                </button>
              </div>
              <button
                type="button"
                onClick={() => setTool('select')}
                className={`rounded-md border px-2.5 py-1.5 text-[11px] font-semibold ${
                  tool === 'select' ? 'border-amber-500 bg-amber-500/15 text-white' : 'border-slate-700 text-slate-300'
                }`}
              >
                Select / Move
              </button>
              <div className="flex overflow-hidden rounded-md border border-slate-700 text-[11px]">
                {(['none', 'mirror', 'quad'] as Symmetry[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSymmetry(m)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 font-semibold ${symmetry === m ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
                  >
                    {m === 'mirror' && <FlipHorizontal2 className="h-3.5 w-3.5" />}
                    {m === 'quad' && <Copy className="h-3.5 w-3.5" />}
                    {m === 'none' ? 'No mirror' : m === 'mirror' ? 'Mirror' : '4-way'}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={rotateSelected}
                className="flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 hover:text-white"
              >
                <RotateCw className="h-3.5 w-3.5" /> Rotate (R)
              </button>
              <button
                type="button"
                onClick={deleteSelected}
                disabled={!selected}
                className="flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 hover:text-red-300 disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
              <button
                type="button"
                onClick={() => {
                  setSpec((p) => ({ ...p, items: [] }));
                  setSelected(null);
                }}
                className="flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 hover:text-white"
              >
                <Eraser className="h-3.5 w-3.5" /> Clear
              </button>
              <span className="ml-auto font-mono-tabular text-[11px] text-slate-400">
                {spec.items.length}/{MAX_ITEMS}
              </span>
            </div>

            {view === '3d' && (
              <div className="relative min-h-[320px] w-full flex-1 overflow-hidden rounded-xl border border-slate-800">
                <ArenaBuilder3D
                  spec={spec}
                  tool={tool}
                  selectedId={selected}
                  onPlace={placeAt}
                  onSelect={setSelected}
                  onMove={(id, x, z) =>
                    setSpec((prev) => ({ ...prev, items: prev.items.map((it) => (it.id === id ? { ...it, x, z } : it)) }))
                  }
                />
                <div className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-black/55 px-2 py-1 text-[11px] text-slate-200">
                  Click floor to place · drag a piece to move · drag empty space to orbit · scroll to zoom
                </div>
              </div>
            )}
            <svg
              ref={svgRef}

              viewBox={`${-HALF} ${-HALF} ${HALF * 2} ${HALF * 2}`}
              className="aspect-square w-full max-w-[640px] touch-none select-none rounded-xl"
              style={{ cursor: tool === 'select' ? 'default' : 'crosshair', display: view === 'plan' ? undefined : 'none' }}
              onPointerDown={onSvgPointerDown}
              onPointerMove={onSvgPointerMove}
              onPointerUp={onSvgPointerUp}
              onPointerLeave={onSvgPointerUp}
            >
              <defs>
                <radialGradient id="abFloor" cx="50%" cy="50%" r="70%">
                  <stop offset="0%" stopColor="#1b2230" />
                  <stop offset="100%" stopColor="#0b0f15" />
                </radialGradient>
              </defs>
              <rect x={-HALF} y={-HALF} width={HALF * 2} height={HALF * 2} fill="url(#abFloor)" stroke={theme.accentHex} strokeWidth={0.5} />
              {Array.from({ length: 19 }, (_, i) => -HALF + i * 2).map((v) => (
                <g key={v} stroke={v === 0 ? '#334155' : '#1a2230'} strokeWidth={v === 0 ? 0.1 : 0.06}>
                  <line x1={v} y1={-HALF} x2={v} y2={HALF} />
                  <line x1={-HALF} y1={v} x2={HALF} y2={v} />
                </g>
              ))}
              <circle cx={0} cy={0} r={SPAWN_RADIUS} fill="none" stroke="#475569" strokeWidth={0.12} strokeDasharray="0.6 0.6" />
              {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((a) => (
                <g key={a}>
                  <circle cx={Math.sin(a) * SPAWN_RADIUS} cy={Math.cos(a) * SPAWN_RADIUS} r={1.3} fill="#22c55e22" stroke="#22c55e" strokeWidth={0.12} />
                  <text x={Math.sin(a) * SPAWN_RADIUS} y={Math.cos(a) * SPAWN_RADIUS + 0.35} textAnchor="middle" fontSize={0.9} fill="#86efac">
                    START
                  </text>
                </g>
              ))}
              {spec.items.map((it) => {
                const info = CUSTOM_ITEM_INFO[it.kind];
                const isSel = it.id === selected;
                const deg = ((it.yaw ?? 0) * 180) / Math.PI;
                const stroke = isSel ? '#fbbf24' : 'none';
                if (it.kind === 'barrier') {
                  return (
                    <rect
                      key={it.id}
                      data-item={it.id}
                      x={it.x - 0.45}
                      y={it.z - 2.25}
                      width={0.9}
                      height={4.5}
                      rx={0.2}
                      fill="#cbd5e1"
                      stroke={isSel ? '#fbbf24' : '#64748b'}
                      strokeWidth={isSel ? 0.25 : 0.08}
                      transform={`rotate(${-deg} ${it.x} ${it.z})`}
                      style={{ cursor: 'move' }}
                    />
                  );
                }
                if (it.kind === 'ramp') {
                  return (
                    <polygon
                      key={it.id}
                      data-item={it.id}
                      points={`${it.x - 1.2},${it.z + 1.2} ${it.x + 1.2},${it.z + 1.2} ${it.x},${it.z - 1.3}`}
                      fill="#64748b"
                      stroke={isSel ? '#fbbf24' : '#f59e0b'}
                      strokeWidth={isSel ? 0.25 : 0.12}
                      transform={`rotate(${-deg} ${it.x} ${it.z})`}
                      style={{ cursor: 'move' }}
                    />
                  );
                }
                return (
                  <g key={it.id}>
                    <circle
                      data-item={it.id}
                      cx={it.x}
                      cy={it.z}
                      r={info.radius}
                      fill={info.group === 'obstacle' ? info.color : `${info.color}44`}
                      stroke={isSel ? '#fbbf24' : info.group === 'obstacle' ? stroke : info.color}
                      strokeWidth={isSel ? 0.25 : 0.15}
                      strokeDasharray={info.group === 'sky' ? '0.5 0.4' : undefined}
                      style={{ cursor: 'move' }}
                    />
                    {info.group !== 'obstacle' && (
                      <text x={it.x} y={it.z + 0.3} textAnchor="middle" fontSize={0.75} fill="#e2e8f0" pointerEvents="none">
                        {info.label.split(' ')[0]}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
            <div className={`mt-2 flex w-full flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 ${view === '3d' ? '' : 'max-w-[640px]'}`}>
              <span>
                Click to place {tool === 'select' ? '' : CUSTOM_ITEM_INFO[tool].label}. Drag to move. R rotates, Delete removes.
              </span>
              {spawnBlocked > 0 && (
                <span className="text-amber-300">{spawnBlocked} piece(s) on a spawn point get removed at match start</span>
              )}
              {sel && (
                <span className="text-slate-300">
                  {CUSTOM_ITEM_INFO[sel.kind].label} at ({sel.x}, {sel.z})
                </span>
              )}
              {notice && <span className="font-semibold text-emerald-300">{notice}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
