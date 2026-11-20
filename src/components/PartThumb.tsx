import React, { useMemo } from 'react';
import type { ArmorId, BotConfig, ChassisId, DriveId, WeaponId, WheelLayoutId } from '../shared/types';
import { useBotThumbnail, type ThumbFocus } from '../game/botThumbnails';

export type PartThumbKind = 'weapon' | 'chassis' | 'armor' | 'wheels' | 'drive' | 'full';

interface Props {
  kind: PartThumbKind;
  id?: string;
  /** Player's bot: only its colors and finish are used, so part pictures don't re-render on every change. */
  base: BotConfig;
  className?: string;
}

/** Real 3D picture of a single part (weapon, frame, wheels) or of the bot wearing it (armor, drive). */
export const PartThumb: React.FC<Props> = ({ kind, id, base, className = '' }) => {
  const cfg = useMemo<BotConfig>(() => {
    const neutral: BotConfig = {
      name: '',
      chassis: 'wedge',
      armor: 'titanium',
      weapon: 'vspinner',
      weapons: ['vspinner'],
      wheelLayout: '4wd_wide',
      drive: 'omni',
      primaryColor: base.primaryColor,
      accentColor: base.accentColor,
      finishStyle: base.finishStyle,
    };
    if (kind === 'full') return base;
    if (kind === 'weapon' && id) return { ...neutral, weapon: id as WeaponId, weapons: [id as WeaponId] };
    if (kind === 'chassis' && id) return { ...neutral, chassis: id as ChassisId, chassisStyles: [id as ChassisId] };
    if (kind === 'armor' && id) return { ...neutral, armor: id as ArmorId };
    if (kind === 'wheels' && id) return { ...neutral, wheelLayout: id as WheelLayoutId };
    if (kind === 'drive' && id) return { ...neutral, drive: id as DriveId };
    return neutral;
  }, [kind, id, base]);
  const focus: ThumbFocus =
    kind === 'weapon' ? 'weapon' : kind === 'chassis' ? 'chassis' : kind === 'wheels' ? 'wheels' : kind === 'drive' ? 'chassis' : 'full';
  const url = useBotThumbnail(cfg, focus);
  return (
    <div
      className={`overflow-hidden rounded-xl border border-slate-700/70 bg-gradient-to-b from-[#1d2532] to-[#0a0e14] ${className}`}
      aria-hidden
    >
      {url ? (
        <img src={url} alt="" draggable={false} className="h-full w-full object-contain" />
      ) : (
        <div className={`h-full w-full ${url === null ? 'animate-pulse bg-slate-800/40' : ''}`} />
      )}
    </div>
  );
};
