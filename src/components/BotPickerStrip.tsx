import React, { useEffect, useRef } from 'react';
import type { BotConfig } from '../shared/types';
import { BotThumb } from './BotThumb';

export interface BotPickerEntry {
  id: string;
  clanTag: string;
  config: BotConfig;
  subtitle?: string;
}

interface Props {
  entries: BotPickerEntry[];
  selectedId: string;
  onSelect: (id: string) => void;
  accent?: 'amber' | 'sky' | 'fuchsia';
  label?: string;
}

const RING: Record<NonNullable<Props['accent']>, string> = {
  amber: 'border-amber-400 bg-amber-500/15',
  sky: 'border-sky-400 bg-sky-500/15',
  fuchsia: 'border-fuchsia-400 bg-fuchsia-500/15',
};

/** Horizontal, scrollable row of bot cards with real 3D thumbnails. */
export const BotPickerStrip: React.FC<Props> = ({ entries, selectedId, onSelect, accent = 'amber', label = 'Choose a bot' }) => {
  const rowRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = rowRef.current?.querySelector<HTMLElement>(`[data-bot="${CSS.escape(selectedId)}"]`);
    el?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [selectedId]);
  return (
    <div
      ref={rowRef}
      role="listbox"
      aria-label={label}
      className="mt-2 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:thin] snap-x"
    >
      {entries.map((e) => {
        const active = e.id === selectedId;
        return (
          <button
            key={e.id}
            data-bot={e.id}
            type="button"
            role="option"
            aria-selected={active}
            onClick={() => onSelect(e.id)}
            className={`snap-start shrink-0 w-[132px] rounded-xl border p-1.5 text-left transition ${
              active ? RING[accent] : 'border-slate-800 bg-[#0D1014] hover:border-slate-600'
            }`}
          >
            <div className="h-[86px] w-full overflow-hidden rounded-lg bg-gradient-to-b from-[#1b2230] to-[#0b0f15]">
              <BotThumb config={e.config} className="h-full w-full" fallbackSize="sm" />
            </div>
            <div className="mt-1 truncate text-[11px] font-bold text-white">{e.config.name}</div>
            <div className="truncate text-[10px] text-slate-400">
              [{e.clanTag}] {e.subtitle ?? ''}
            </div>
          </button>
        );
      })}
    </div>
  );
};
