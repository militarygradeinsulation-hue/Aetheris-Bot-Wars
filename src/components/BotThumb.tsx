import React from 'react';
import type { BotConfig } from '../shared/types';
import { useBotThumbnail } from '../game/botThumbnails';
import { BotPortraitPreview } from './BotPortraitPreview';

interface Props {
  config: BotConfig;
  className?: string;
  /** Fallback drawing size while the 3D render is pending or unavailable. */
  fallbackSize?: 'sm' | 'md' | 'lg';
}

/** Real 3D-rendered bot portrait; shows the vector sketch until the render is ready. */
export const BotThumb: React.FC<Props> = ({ config, className = '', fallbackSize = 'md' }) => {
  const url = useBotThumbnail(config);
  if (url) {
    return (
      <img
        src={url}
        alt={`${config.name} bot`}
        draggable={false}
        className={`object-contain ${className}`}
      />
    );
  }
  return (
    <div className={`flex items-center justify-center ${url === null ? 'animate-pulse' : ''} ${className}`}>
      <BotPortraitPreview config={config} size={fallbackSize} />
    </div>
  );
};
