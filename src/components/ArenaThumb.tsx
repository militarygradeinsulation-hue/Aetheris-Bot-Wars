import React from 'react';
import type { ArenaId } from '../shared/types';
import { useArenaThumbnail } from '../game/botThumbnails';

/** Real 3D overhead picture of an arena theme. */
export const ArenaThumb: React.FC<{ arenaId: ArenaId; className?: string }> = ({ arenaId, className = '' }) => {
  const url = useArenaThumbnail(arenaId);
  return (
    <div className={`overflow-hidden rounded-lg bg-gradient-to-b from-[#1d2532] to-[#0a0e14] ${className}`} aria-hidden>
      {url ? (
        <img src={url} alt="" draggable={false} className="h-full w-full object-cover" />
      ) : (
        <div className={`h-full w-full ${url === null ? 'animate-pulse bg-slate-800/40' : ''}`} />
      )}
    </div>
  );
};
