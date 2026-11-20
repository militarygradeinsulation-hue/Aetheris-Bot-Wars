import React from 'react';
import {
  Box,
  Camera,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Flame,
  Layers,
  Music,
  Radio,
  RotateCw,
  Sun,
} from 'lucide-react';
import type { StudioLightingPreset } from './LiveVoiceCopilot';

export type WorkshopCameraAngle =
  | 'free'
  | 'hero'
  | 'low_wedge'
  | 'top_blueprint'
  | 'weapon_macro'
  | 'arena_3d';

export interface ThreeSceneInspectorDockProps {
  explodedRatio: number;
  onChangeExplodedRatio: (ratio: number) => void;
  lightingPreset: StudioLightingPreset;
  onChangeLightingPreset: (preset: StudioLightingPreset) => void;
  turntableSpeed: number;
  onChangeTurntableSpeed: (speed: number) => void;
  workshopCameraAngle: WorkshopCameraAngle;
  onSelectWorkshopCameraAngle: (angle: WorkshopCameraAngle) => void;
  onTriggerWeaponTestBurst: () => void;
  zenMode: boolean;
  onToggleZenMode: () => void;
  dockCollapsed: boolean;
  onToggleDockCollapsed: () => void;
  onOpenAiStudio: () => void;
  onOpenLiveVoice: () => void;
  liveVoiceOpen: boolean;
}

export const ThreeSceneInspectorDock: React.FC<ThreeSceneInspectorDockProps> = ({
  explodedRatio,
  onChangeExplodedRatio,
  lightingPreset,
  onChangeLightingPreset,
  turntableSpeed,
  onChangeTurntableSpeed,
  workshopCameraAngle,
  onSelectWorkshopCameraAngle,
  onTriggerWeaponTestBurst,
  zenMode,
  onToggleZenMode,
  dockCollapsed,
  onToggleDockCollapsed,
  onOpenAiStudio,
  onOpenLiveVoice,
  liveVoiceOpen,
}) => {
  return (
    <div
      className="pointer-events-none fixed bottom-3 left-1/2 z-30 flex w-[min(920px,95vw)] -translate-x-1/2 flex-col items-center"
      aria-label="3D Scene & Exploded View Inspector Dock"
    >
      {/* Top Collapse / Zen Mode Tab Bar */}
      <div className="pointer-events-auto mb-1 flex items-center gap-1.5 rounded-t-xl border border-slate-700/90 bg-[#0D1117]/95 px-3 py-1 text-[11px] font-bold text-slate-300 shadow-lg">
        <button
          type="button"
          onClick={onToggleDockCollapsed}
          className="flex items-center gap-1 text-slate-200 hover:text-amber-300 transition"
          title="Collapse or expand 3D Scene Inspector Dock (Shortcut: H)"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="h-3.5 w-3.5 text-amber-400" />
              <span>▴ Show 3D Scene Controls</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5 text-amber-400" />
              <span>▾ Hide 3D Dock</span>
            </>
          )}
        </button>

        <span className="text-slate-600">|</span>

        <button
          type="button"
          onClick={onToggleZenMode}
          className={`flex items-center gap-1 rounded px-2 py-0.5 transition ${
            zenMode
              ? 'bg-amber-500 text-slate-950 font-extrabold'
              : 'text-slate-300 hover:text-white'
          }`}
          title="Toggle Full-Screen 3D Cinema / Zen Mode [H]"
        >
          {zenMode ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          <span>{zenMode ? 'Exit 3D Zen Mode [H]' : '3D Zen View [H]'}</span>
        </button>
      </div>

      {/* Main Unified Bottom Control Dock */}
      {!dockCollapsed && (
        <div className="pointer-events-auto flex w-full flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-slate-700/90 bg-[#10151E]/95 px-3.5 py-2.5 text-xs text-slate-200 shadow-2xl">
          {/* 1. Exploded 3D View Slider */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-[#0B0E14] px-2.5 py-1.5">
            <Layers className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <div className="flex flex-col">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  3D Exploded View
                </span>
                <span className="font-mono-tabular text-[10px] font-bold text-amber-300">
                  {Math.round(explodedRatio * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(explodedRatio * 100)}
                onChange={(e) => onChangeExplodedRatio(Number(e.target.value) / 100)}
                aria-label="3D Exploded View Separation"
                className="h-1.5 w-24 sm:w-28 cursor-pointer accent-amber-500"
              />
            </div>
          </div>

          {/* 2. Studio PBR Lighting Presets */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-[#0B0E14] p-1">
            <Sun className="ml-1.5 h-3.5 w-3.5 text-amber-400 shrink-0" />
            {(
              [
                { id: 'arena', label: 'Arena' },
                { id: 'cyber_neon', label: 'Neon' },
                { id: 'golden_forge', label: 'Forge' },
                { id: 'cryo_lab', label: 'Cryo' },
              ] as const
            ).map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onChangeLightingPreset(preset.id)}
                className={`rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                  lightingPreset === preset.id
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* 3. Damped 3D Camera Angles */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-[#0B0E14] p-1">
            <Camera className="ml-1.5 h-3.5 w-3.5 text-sky-400 shrink-0" />
            {(
              [
                { id: 'hero', label: '3/4 Hero' },
                { id: 'low_wedge', label: 'Low Deck' },
                { id: 'weapon_macro', label: 'Weapon' },
                { id: 'top_blueprint', label: 'Top' },
                { id: 'arena_3d', label: 'Arena 3D' },
              ] as const
            ).map((cam) => (
              <button
                key={cam.id}
                type="button"
                onClick={() => onSelectWorkshopCameraAngle(cam.id)}
                className={`rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                  workshopCameraAngle === cam.id
                    ? 'bg-sky-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {cam.label}
              </button>
            ))}
          </div>

          {/* 4. Turntable Speed & 3D Weapon Spark Test */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                onChangeTurntableSpeed(turntableSpeed === 0 ? 1 : turntableSpeed === 1 ? 2.4 : 0)
              }
              className="flex items-center gap-1 rounded-xl border border-slate-700 bg-[#0B0E14] px-2.5 py-1.5 text-[11px] font-bold text-slate-200 hover:border-amber-400/60"
              title="Cycle 3D Turntable Rotation Speed"
            >
              <RotateCw className="h-3.5 w-3.5 text-amber-400" />
              <span>{turntableSpeed === 0 ? 'Orbit: Pause' : turntableSpeed > 1.5 ? 'Orbit: 2.4x' : 'Orbit: 1x'}</span>
            </button>

            <button
              type="button"
              onClick={onTriggerWeaponTestBurst}
              className="flex items-center gap-1 rounded-xl border border-orange-500/50 bg-orange-500/15 px-2.5 py-1.5 text-[11px] font-extrabold text-orange-200 hover:bg-orange-500/25 transition"
              title="Test-fire 3D weapons and spark physics on turntable"
            >
              <Flame className="h-3.5 w-3.5 text-orange-400" />
              <span>Test 3D Sparks</span>
            </button>
          </div>

          {/* 5. AI Music & Live Voice Launchers */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenAiStudio}
              className="flex items-center gap-1.5 rounded-xl border border-amber-500/50 bg-amber-500/15 px-2.5 py-1.5 text-[11px] font-extrabold text-amber-200 hover:bg-amber-500/25 transition"
              title="Open Lyria AI Music Generator & Media Lab"
            >
              <Music className="h-3.5 w-3.5 text-amber-400" />
              <span>AI Music & Lab</span>
            </button>

            <button
              type="button"
              onClick={onOpenLiveVoice}
              className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-extrabold transition ${
                liveVoiceOpen
                  ? 'border-sky-400 bg-sky-500 text-slate-950'
                  : 'border-sky-500/50 bg-sky-500/15 text-sky-200 hover:bg-sky-500/25'
              }`}
              title="Open Real-Time Voice Conversation (gemini-3.8-live)"
            >
              <Radio className="h-3.5 w-3.5" />
              <span>Live Voice AI</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
