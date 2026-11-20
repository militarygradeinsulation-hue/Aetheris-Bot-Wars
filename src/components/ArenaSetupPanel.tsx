import React, { useMemo } from 'react';
import { Bomb, CloudLightning, Hammer, Pencil, Plus } from 'lucide-react';
import { ARENA_CATALOG, type ArenaId } from '../shared/types';
import { createInitialSnapshot } from '../shared/physicsEngine';
import {
  ARENA_LAYOUTS,
  type ArenaLayoutId,
  type ArenaRules,
  type CustomArenaSpec,
} from '../shared/arenaLayouts';
import { ArenaMiniMap, type MiniMapItem } from './ArenaMiniMap';

interface Props {
  selectedArena: ArenaId;
  layout: ArenaLayoutId;
  rules: ArenaRules;
  customArenas: CustomArenaSpec[];
  activeCustomId: string | null;
  onSelectLayout: (l: ArenaLayoutId) => void;
  onChangeRules: (r: ArenaRules) => void;
  onSelectCustom: (id: string | null) => void;
  onOpenBuilder: (editId: string | null) => void;
}

function previewItems(arenaId: ArenaId, layout: ArenaLayoutId, custom?: CustomArenaSpec | null): MiniMapItem[] {
  const snap = createInitialSnapshot('duel_1v1', arenaId, [], 180, { layout, customArena: custom ?? null });
  return [
    ...snap.props.map((p) => ({ kind: p.kind, x: p.x, z: p.z, yaw: p.yaw, radius: p.radius })),
    ...snap.hazards.map((h) => ({ kind: h.kind, x: h.x, z: h.z, radius: h.radius })),
  ];
}

/** Layout, traps and custom arenas. The theme grid stays in the launcher. */
export const ArenaSetupPanel: React.FC<Props> = ({
  selectedArena,
  layout,
  rules,
  customArenas,
  activeCustomId,
  onSelectLayout,
  onChangeRules,
  onSelectCustom,
  onOpenBuilder,
}) => {
  const accent = ARENA_CATALOG[selectedArena]?.accentHex ?? '#f59e0b';
  const previews = useMemo(() => {
    const out: Partial<Record<ArenaLayoutId, MiniMapItem[]>> = {};
    (Object.keys(ARENA_LAYOUTS) as ArenaLayoutId[]).forEach((l) => {
      out[l] = previewItems(selectedArena, l);
    });
    return out;
  }, [selectedArena]);

  return (
    <div className="space-y-4">
      {/* Layouts */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Floor layout</h3>
          <span className="text-[11px] text-slate-500">Works with any arena theme</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(ARENA_LAYOUTS) as ArenaLayoutId[]).map((l) => {
            const info = ARENA_LAYOUTS[l];
            const active = !activeCustomId && layout === l;
            return (
              <button
                key={l}
                type="button"
                onClick={() => {
                  onSelectCustom(null);
                  onSelectLayout(l);
                }}
                className={`flex flex-col items-center rounded-xl border p-2 text-center transition ${
                  active ? 'border-amber-500 bg-amber-500/10' : 'border-slate-800 bg-[#141A22] hover:border-slate-600'
                }`}
              >
                <ArenaMiniMap items={previews[l] ?? []} accent={active ? '#f59e0b' : accent} size={84} />
                <span className="mt-1.5 text-xs font-bold text-white">{info.label}</span>
                <span className="text-[10px] leading-tight text-slate-400 line-clamp-2">{info.note}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Custom arenas */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Your arenas</h3>
          <button
            type="button"
            onClick={() => onOpenBuilder(null)}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-extrabold text-slate-950 hover:bg-amber-400"
          >
            <Hammer className="h-3.5 w-3.5" /> Build your own
          </button>
        </div>
        {customArenas.length === 0 ? (
          <button
            type="button"
            onClick={() => onOpenBuilder(null)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-[#0F1318] p-4 text-sm text-slate-400 hover:border-amber-500 hover:text-white"
          >
            <Plus className="h-4 w-4" /> Place walls, pillars, ramps and traps on a grid, then fight in it
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {customArenas.map((a) => {
              const active = activeCustomId === a.id;
              return (
                <div
                  key={a.id}
                  className={`relative rounded-xl border p-2 ${active ? 'border-amber-500 bg-amber-500/10' : 'border-slate-800 bg-[#141A22]'}`}
                >
                  <button type="button" onClick={() => onSelectCustom(a.id)} className="flex w-full flex-col items-center text-center">
                    <ArenaMiniMap
                      items={a.items.map((it) => ({ kind: it.kind, x: it.x, z: it.z, yaw: it.yaw }))}
                      accent={ARENA_CATALOG[a.theme]?.accentHex}
                      size={84}
                    />
                    <span className="mt-1.5 w-full truncate text-xs font-bold text-white">{a.name}</span>
                    <span className="text-[10px] text-slate-400">
                      {ARENA_CATALOG[a.theme]?.name} · {a.items.length} pieces
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenBuilder(a.id)}
                    className="absolute right-1.5 top-1.5 rounded-md bg-slate-800/90 p-1 text-slate-300 hover:text-white"
                    aria-label={`Edit ${a.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Sky drops */}
      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-300">Sky drops during the fight</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(
            [
              { key: 'bombs', label: 'Bomb drops', note: 'Aerial bombs and Bomb Barrage events', Icon: Bomb },
              { key: 'lightning', label: 'Lightning strikes', note: 'Lightning zones and Lightning Storm events', Icon: CloudLightning },
            ] as const
          ).map(({ key, label, note, Icon }) => {
            const on = rules[key];
            return (
              <button
                key={key}
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => onChangeRules({ ...rules, [key]: !on })}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                  on ? 'border-slate-700 bg-[#141A22]' : 'border-emerald-500/50 bg-emerald-500/10'
                }`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${on ? 'text-amber-400' : 'text-slate-500'}`} />
                <span className="flex-1">
                  <span className="block text-sm font-bold text-white">{label}</span>
                  <span className="block text-[11px] text-slate-400">{note}</span>
                </span>
                <span
                  className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-amber-500' : 'bg-slate-700'}`}
                  aria-hidden
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};
