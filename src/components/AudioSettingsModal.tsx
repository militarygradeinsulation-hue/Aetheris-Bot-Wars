import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  Music,
  RotateCcw,
  SkipForward,
  Sliders,
  Sparkles,
  Users,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { soundEngine } from '../game/soundEngine';

export interface AudioMixerSettings {
  muted: boolean;
  commentaryMuted: boolean;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  crowdVolume: number;
  commentaryVolume: number;
}

interface AudioSettingsModalProps {
  open: boolean;
  settings: AudioMixerSettings;
  onChange: (patch: Partial<AudioMixerSettings>) => void;
  onClose: () => void;
}

export const AudioSettingsModal: React.FC<AudioSettingsModalProps> = ({
  open,
  settings,
  onChange,
  onClose,
}) => {
  const [trackName, setTrackName] = useState(() => soundEngine.getCurrentTrackTitle());

  if (!open) return null;

  const pct = (v: number) => `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;

  const applyPreset = (
    preset: 'balanced' | 'sfx_focus' | 'music_focus' | 'broadcast',
  ) => {
    soundEngine.unlock();
    if (preset === 'balanced') {
      onChange({
        muted: false,
        masterVolume: 0.85,
        musicVolume: 0.65,
        sfxVolume: 0.85,
        crowdVolume: 0.7,
        commentaryVolume: 0.9,
      });
    } else if (preset === 'sfx_focus') {
      onChange({
        muted: false,
        masterVolume: 0.95,
        musicVolume: 0.25,
        sfxVolume: 1.0,
        crowdVolume: 0.45,
        commentaryVolume: 0.75,
      });
    } else if (preset === 'music_focus') {
      onChange({
        muted: false,
        masterVolume: 0.9,
        musicVolume: 0.95,
        sfxVolume: 0.6,
        crowdVolume: 0.4,
        commentaryVolume: 0.6,
      });
    } else if (preset === 'broadcast') {
      onChange({
        muted: false,
        commentaryMuted: false,
        masterVolume: 0.9,
        musicVolume: 0.45,
        sfxVolume: 0.8,
        crowdVolume: 0.9,
        commentaryVolume: 1.0,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 pointer-events-auto">
      <div className="w-full max-w-lg rounded-2xl border border-amber-400/35 bg-[#0A0E17]/95 shadow-[0_24px_80px_rgba(0,0,0,0.85)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-gradient-to-r from-amber-500/15 via-sky-500/10 to-transparent">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-mono uppercase tracking-[0.22em] text-amber-300">
                Aetheris Sound Studio
              </div>
              <h2 className="font-display text-lg font-extrabold uppercase tracking-wider text-white">
                Audio & Volume Mixer
              </h2>
            </div>
          </div>
          <button
            onClick={() => {
              soundEngine.unlock();
              onClose();
            }}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition cursor-pointer"
            title="Close Audio Mixer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Top Master & Commentary Toggles */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => {
                onChange({ muted: !settings.muted });
              }}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                settings.muted
                  ? 'bg-rose-500/20 border-rose-400/50 text-rose-200'
                  : 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/25'
              }`}
            >
              <span className="flex items-center gap-2">
                {settings.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                Master Audio
              </span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/40">
                {settings.muted ? 'MUTED' : 'LIVE'}
              </span>
            </button>

            <button
              onClick={() => {
                onChange({ commentaryMuted: !settings.commentaryMuted });
              }}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                settings.commentaryMuted
                  ? 'bg-slate-800/80 border-white/15 text-slate-400'
                  : 'bg-sky-500/15 border-sky-400/40 text-sky-200 hover:bg-sky-500/25'
              }`}
            >
              <span className="flex items-center gap-2">
                {settings.commentaryMuted ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
                Commentators
              </span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/40">
                {settings.commentaryMuted ? 'OFF' : 'ON'}
              </span>
            </button>
          </div>

          {/* Sliders */}
          <div className="space-y-3.5 bg-white/[0.03] border border-white/10 rounded-xl p-4">
            {/* Master Volume */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
                  <Volume2 className="w-4 h-4 text-amber-400" />
                  Master Output Gain
                </label>
                <span className="font-mono text-xs font-bold text-amber-300">
                  {pct(settings.masterVolume)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={settings.masterVolume}
                onChange={(e) =>
                  onChange({ masterVolume: parseFloat(e.target.value), muted: false })
                }
                className="w-full accent-amber-400 cursor-pointer h-2 rounded-lg bg-slate-800"
              />
            </div>

            {/* Music Volume + Skip Track */}
            <div className="pt-2 border-t border-white/10">
              <div className="flex items-center justify-between mb-1.5">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
                  <Music className="w-4 h-4 text-sky-400" />
                  Arena & Menu Music
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      soundEngine.skipMusicTrack();
                      setTrackName(soundEngine.getCurrentTrackTitle());
                    }}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-[10px] font-mono uppercase tracking-wider text-sky-200 transition cursor-pointer"
                    title="Skip to next metal soundtrack"
                  >
                    <SkipForward className="w-3 h-3" />
                    Next Track
                  </button>
                  <span className="font-mono text-xs font-bold text-sky-300">
                    {pct(settings.musicVolume)}
                  </span>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={settings.musicVolume}
                onChange={(e) =>
                  onChange({ musicVolume: parseFloat(e.target.value), muted: false })
                }
                className="w-full accent-sky-400 cursor-pointer h-2 rounded-lg bg-slate-800"
              />
              <div className="mt-1 text-[10px] font-mono text-slate-400 flex items-center justify-between">
                <span>Now Playing: {trackName}</span>
                <span>Rotates each fight</span>
              </div>
            </div>

            {/* Sound Effects (Weapons, Explosions, Motors) */}
            <div className="pt-2 border-t border-white/10">
              <div className="flex items-center justify-between mb-1.5">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
                  <Zap className="w-4 h-4 text-rose-400" />
                  Weapons, Crashes & Explosions (SFX)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      soundEngine.unlock();
                      soundEngine.playHammerStrike(1.2);
                    }}
                    className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-[10px] font-mono uppercase tracking-wider text-rose-200 transition cursor-pointer"
                  >
                    Test SFX
                  </button>
                  <span className="font-mono text-xs font-bold text-rose-300">
                    {pct(settings.sfxVolume)}
                  </span>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={settings.sfxVolume}
                onChange={(e) =>
                  onChange({ sfxVolume: parseFloat(e.target.value), muted: false })
                }
                className="w-full accent-rose-400 cursor-pointer h-2 rounded-lg bg-slate-800"
              />
            </div>

            {/* Crowd & Applause Volume */}
            <div className="pt-2 border-t border-white/10">
              <div className="flex items-center justify-between mb-1.5">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
                  <Users className="w-4 h-4 text-emerald-400" />
                  Arena Crowd & Applause
                </label>
                <span className="font-mono text-xs font-bold text-emerald-300">
                  {pct(settings.crowdVolume)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={settings.crowdVolume}
                onChange={(e) =>
                  onChange({ crowdVolume: parseFloat(e.target.value), muted: false })
                }
                className="w-full accent-emerald-400 cursor-pointer h-2 rounded-lg bg-slate-800"
              />
            </div>

            {/* Live Commentators Volume */}
            <div className="pt-2 border-t border-white/10">
              <div className="flex items-center justify-between mb-1.5">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  Live Duo Commentary (Rex & Kira)
                </label>
                <span className="font-mono text-xs font-bold text-purple-300">
                  {pct(settings.commentaryVolume)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={settings.commentaryVolume}
                onChange={(e) =>
                  onChange({
                    commentaryVolume: parseFloat(e.target.value),
                    commentaryMuted: false,
                    muted: false,
                  })
                }
                className="w-full accent-purple-400 cursor-pointer h-2 rounded-lg bg-slate-800"
              />
            </div>
          </div>

          {/* Quick Mix Presets */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-400 mb-2">
              Quick Sound Mix Presets
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={() => applyPreset('balanced')}
                className="px-2.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold uppercase tracking-wider text-slate-200 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                Balanced
              </button>
              <button
                onClick={() => applyPreset('sfx_focus')}
                className="px-2.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold uppercase tracking-wider text-slate-200 transition cursor-pointer"
              >
                Heavy Combat
              </button>
              <button
                onClick={() => applyPreset('music_focus')}
                className="px-2.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold uppercase tracking-wider text-slate-200 transition cursor-pointer"
              >
                Metal Anthem
              </button>
              <button
                onClick={() => applyPreset('broadcast')}
                className="px-2.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold uppercase tracking-wider text-slate-200 transition cursor-pointer"
              >
                TV Broadcast
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10 bg-black/40 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Settings save automatically to your pilot profile
          </span>
          <button
            onClick={() => {
              soundEngine.unlock();
              onClose();
            }}
            className="px-4 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs uppercase tracking-wider transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
