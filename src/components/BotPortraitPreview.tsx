import React, { useId } from 'react';
import {
  type BotConfig,
  getBotChassisStyles,
  getBotWeapons,
  type WeaponId,
} from '../shared/types';

interface BotPortraitPreviewProps {
  config: BotConfig;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const BotPortraitPreview: React.FC<BotPortraitPreviewProps> = ({
  config,
  size = 'md',
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');
  const styles = getBotChassisStyles(config);
  const weapons = getBotWeapons(config);
  const primaryChassis = styles[0] || config.chassis;
  const secondaryChassis = styles[1];
  const primary = config.primaryColor || '#f59e0b';
  const accent = config.accentColor || '#38bdf8';
  const underglow =
    config.underglowColor && config.underglowColor !== 'none'
      ? config.underglowColor
      : accent;
  const isFullBodySpinner =
    primaryChassis === 'shell_spinner' ||
    styles.includes('shell_spinner') ||
    weapons.includes('body_spinner');
  const isHover =
    config.drive === 'hover' ||
    config.drive === 'maglev' ||
    primaryChassis === 'hover_disc' ||
    primaryChassis === 'ufo';
  const isTreads =
    config.drive === 'tracks' ||
    config.drive === 'crawler_nuclear' ||
    config.wheelLayout === '8wd_crawler';
  const isSpider = primaryChassis === 'spider' || styles.includes('spider');

  const dims =
    size === 'lg'
      ? 'h-24 w-32'
      : size === 'sm'
        ? 'h-12 w-16'
        : 'h-16 w-24';

  const renderWeaponGraphic = (wId: WeaponId, idx: number) => {
    const offsetY = idx === 0 ? 0 : idx === 1 ? -4 : 4;
    switch (wId) {
      case 'vspinner':
      case 'drum':
        return (
          <g key={`${wId}_${idx}`} transform={`translate(0, ${offsetY})`}>
            <circle cx="88" cy="40" r="12" fill="#0f172a" stroke={accent} strokeWidth="2.5" strokeDasharray="5 3" />
            <circle cx="88" cy="40" r="5" fill={primary} />
            <path d="M88 26 L95 31 L88 34 Z M88 54 L95 49 L88 46 Z" fill="#f8fafc" />
          </g>
        );
      case 'hbar':
      case 'sawblade':
        return (
          <g key={`${wId}_${idx}`} transform={`translate(0, ${offsetY})`}>
            <ellipse cx="86" cy="40" rx="16" ry="6" fill="none" stroke={accent} strokeWidth="2.5" strokeDasharray="6 3" />
            <rect x="70" y="37" width="32" height="6" rx="2" fill="#e2e8f0" stroke="#0f172a" strokeWidth="1" />
          </g>
        );
      case 'body_spinner':
        return (
          <g key={`${wId}_${idx}`}>
            <ellipse
              cx="56"
              cy="42"
              rx="42"
              ry="20"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="3"
              strokeDasharray="8 4"
            />
            <polygon points="98,42 90,36 90,48" fill="#fde047" />
            <polygon points="14,42 22,36 22,48" fill="#fde047" />
          </g>
        );
      case 'flipper':
        return (
          <g key={`${wId}_${idx}`} transform={`translate(0, ${offsetY})`}>
            <polygon
              points="76,48 105,52 94,34 74,38"
              fill={accent}
              stroke="#f8fafc"
              strokeWidth="1.5"
            />
          </g>
        );
      case 'hammer':
        return (
          <g key={`${wId}_${idx}`}>
            <path d="M52 26 Q66 8 84 18" fill="none" stroke="#cbd5e1" strokeWidth="3.5" />
            <polygon points="80,12 94,16 86,28 76,22" fill={accent} stroke="#fff" strokeWidth="1.2" />
          </g>
        );
      case 'railgun':
      case 'laser':
        return (
          <g key={`${wId}_${idx}`} transform={`translate(0, ${offsetY})`}>
            <rect x="56" y="20" width="38" height="7" rx="2" fill="#1e293b" stroke={wId === 'laser' ? '#f43f5e' : '#38bdf8'} strokeWidth="1.8" />
            <line
              x1="94"
              y1="23.5"
              x2="116"
              y2="23.5"
              stroke={wId === 'laser' ? '#fb7185' : '#7dd3fc'}
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>
        );
      case 'flame':
      case 'cryo_jet':
        return (
          <g key={`${wId}_${idx}`} transform={`translate(0, ${offsetY})`}>
            <rect x="78" y="34" width="14" height="8" rx="2" fill="#334155" stroke={accent} strokeWidth="1.5" />
            <path
              d="M92 38 Q106 30 115 38 Q106 46 92 38 Z"
              fill={wId === 'flame' ? '#f97316' : '#38bdf8'}
              opacity="0.88"
            />
          </g>
        );
      case 'mortar':
      case 'missiles':
        return (
          <g key={`${wId}_${idx}`}>
            <rect
              x="42"
              y="14"
              width="22"
              height="12"
              rx="3"
              transform="rotate(-18 53 20)"
              fill="#1e293b"
              stroke="#fb923c"
              strokeWidth="1.8"
            />
            <circle cx="63" cy="15" r="3.5" fill="#fbbf24" />
          </g>
        );
      case 'tesla':
      case 'lightning_strike':
        return (
          <g key={`${wId}_${idx}`}>
            <line x1="56" y1="26" x2="56" y2="8" stroke="#38bdf8" strokeWidth="3" />
            <ellipse cx="56" cy="14" rx="10" ry="3.5" fill="none" stroke="#7dd3fc" strokeWidth="1.8" />
            <circle cx="56" cy="7" r="4.5" fill="#e0f2fe" stroke="#38bdf8" strokeWidth="2" />
            <polyline points="56,7 66,2 62,11 72,6" fill="none" stroke="#bae6fd" strokeWidth="1.6" />
          </g>
        );
      case 'bomb_drop':
        return (
          <g key={`${wId}_${idx}`}>
            <rect x="38" y="18" width="24" height="8" rx="3" fill="#dc2626" stroke="#fca5a5" strokeWidth="1.4" />
            <circle cx="45" cy="22" r="2.5" fill="#fde047" />
            <circle cx="55" cy="22" r="2.5" fill="#fde047" />
          </g>
        );
      default:
        return (
          <g key={`${wId}_${idx}`} transform={`translate(0, ${offsetY})`}>
            <polygon points="78,34 102,40 78,46" fill={accent} stroke="#f8fafc" strokeWidth="1.4" />
          </g>
        );
    }
  };

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-slate-700/90 bg-gradient-to-br from-[#0B0F17] via-[#131A26] to-[#0A0D12] shadow-inner shrink-0 ${dims} ${className}`}
    >
      <svg
        viewBox="0 0 120 72"
        className="h-full w-full"
        aria-label={`${config.name} 3D Blueprint Portrait`}
      >
        <defs>
          <linearGradient id={`hull_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={primary} />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
          <radialGradient id={`glow_${uid}`} cx="50%" cy="55%" r="50%">
            <stop offset="0%" stopColor={underglow} stopOpacity="0.48" />
            <stop offset="100%" stopColor={underglow} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Subtle Hangar Grid Floor */}
        <line x1="6" y1="58" x2="114" y2="58" stroke="#1e293b" strokeWidth="1.5" />
        <ellipse cx="58" cy="57" rx="38" ry="7" fill={`url(#glow_${uid})`} />

        {/* Chassis Body Shape */}
        {isFullBodySpinner ? (
          <g>
            <path
              d="M22 50 C24 24, 88 24, 92 50 Z"
              fill={`url(#hull_${uid})`}
              stroke={accent}
              strokeWidth="2.2"
            />
            <ellipse
              cx="57"
              cy="46"
              rx="39"
              ry="9"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="2.5"
              strokeDasharray="7 3"
            />
          </g>
        ) : primaryChassis === 'wedge' ? (
          <polygon
            points="20,50 26,28 66,28 98,50"
            fill={`url(#hull_${uid})`}
            stroke={accent}
            strokeWidth="2.2"
          />
        ) : primaryChassis === 'juggernaut' ||
          primaryChassis === 'behemoth' ||
          primaryChassis === 'monolith' ? (
          <g>
            <rect
              x="20"
              y="26"
              width="68"
              height="24"
              rx="5"
              fill={`url(#hull_${uid})`}
              stroke={accent}
              strokeWidth="2.2"
            />
            <rect x="30" y="20" width="38" height="9" rx="3" fill={accent} opacity="0.85" />
          </g>
        ) : (
          <polygon
            points="22,49 28,27 78,27 92,42 88,50"
            fill={`url(#hull_${uid})`}
            stroke={accent}
            strokeWidth="2.2"
          />
        )}

        {/* Secondary Hybrid Hull Fin */}
        {secondaryChassis && (
          <polygon
            points="24,28 42,17 56,28"
            fill={accent}
            opacity="0.85"
            stroke="#f8fafc"
            strokeWidth="1"
          />
        )}

        {/* Cockpit Visor Strip */}
        <polygon points="56,31 76,33 72,39 54,37" fill={accent} />

        {/* Mounted Weapons */}
        {weapons.slice(0, 3).map((wId, idx) => renderWeaponGraphic(wId, idx))}

        {/* Wheels / Treads / Spider Legs / Hover Thrusters */}
        {isSpider ? (
          <g stroke={accent} strokeWidth="2.6" strokeLinecap="round" fill="none">
            <polyline points="34,46 20,52 16,61" />
            <polyline points="54,47 50,55 48,63" />
            <polyline points="74,46 86,53 90,61" />
          </g>
        ) : isHover ? (
          <g>
            <ellipse cx="38" cy="54" rx="11" ry="4" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
            <ellipse cx="74" cy="54" rx="11" ry="4" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
          </g>
        ) : isTreads ? (
          <g>
            <rect
              x="22"
              y="46"
              width="66"
              height="12"
              rx="6"
              fill="#0f172a"
              stroke="#64748b"
              strokeWidth="2"
            />
            <circle cx="31" cy="52" r="4" fill={accent} />
            <circle cx="55" cy="52" r="4" fill={accent} />
            <circle cx="79" cy="52" r="4" fill={accent} />
          </g>
        ) : (
          <g>
            <circle cx="34" cy="51" r="8.5" fill="#0f172a" stroke="#94a3b8" strokeWidth="2.2" />
            <circle cx="34" cy="51" r="3.5" fill={accent} />
            <circle cx="76" cy="51" r="8.5" fill="#0f172a" stroke="#94a3b8" strokeWidth="2.2" />
            <circle cx="76" cy="51" r="3.5" fill={accent} />
          </g>
        )}
      </svg>

      {/* Corner Hull Weight / Fusion Tag */}
      {Array.isArray(config.fusionParents) && config.fusionParents.length === 2 && (
        <span className="absolute right-1 top-1 rounded bg-fuchsia-500/90 px-1 py-0.2 text-[8px] font-extrabold text-slate-950">
          FUSE
        </span>
      )}
    </div>
  );
};
