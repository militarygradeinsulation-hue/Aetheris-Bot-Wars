import React, { useState } from 'react';
import {
  BatteryCharging,
  Check,
  Copy,
  Gamepad2,
  KeyRound,
  LogOut,
  Mic,
  MicOff,
  Monitor,
  Shield,
  Sliders,
  Smartphone,
  Sparkles,
  Tablet,
  UserCheck,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type {
  BatteryMode,
  ControlSchemeId,
  DeviceLayoutMode,
  PlayerProfile,
} from '../shared/types';
import { PWAInstallButton } from './PWAInstallButton';

interface SettingsHubModalProps {
  open: boolean;
  profile: PlayerProfile;
  userEmail: string | null;
  onUpdateProfile: (patch: Partial<PlayerProfile>) => void;
  onClaimUsername: (newUsername: string) => Promise<{ ok: boolean; error?: string }>;
  onApplyLoginOrAdminCode?: (code: string) => Promise<{ ok: boolean; msg?: string }>;
  onOpenFullAudioMixer: () => void;
  onSignOut: () => void;
  onClose: () => void;
}

export const SettingsHubModal: React.FC<SettingsHubModalProps> = ({
  open,
  profile,
  onUpdateProfile,
  onClaimUsername,
  onApplyLoginOrAdminCode,
  onOpenFullAudioMixer,
  onSignOut,
  onClose,
}) => {
  const [usernameDraft, setUsernameDraft] = useState(profile.callsign);
  const [usernameStatus, setUsernameStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [codeDraft, setCodeDraft] = useState('');
  const [codeStatus, setCodeStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [applyingCode, setApplyingCode] = useState(false);

  if (!open) return null;

  const activeScheme: ControlSchemeId = profile.controlScheme ?? 'wasd_drive';
  const activeDeviceMode: DeviceLayoutMode = profile.deviceLayoutMode ?? 'auto';
  const displayAccessCode = profile.accessCode || (profile.isAdmin ? '9822' : 'AETH-PILOT');

  const handleCopyLoginCode = async () => {
    try {
      await navigator.clipboard.writeText(displayAccessCode);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 2200);
    } catch {
      setCopiedCode(true);
    }
  };

  const handleSaveUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setUsernameStatus(null);
    setSavingName(true);
    try {
      const res = await onClaimUsername(usernameDraft);
      if (res.ok) {
        setUsernameStatus({ ok: true, msg: 'Username updated across online leaderboards!' });
      } else {
        setUsernameStatus({ ok: false, msg: res.error || 'Could not update username.' });
      }
    } finally {
      setSavingName(false);
    }
  };

  const handleApplyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onApplyLoginOrAdminCode || !codeDraft.trim()) return;
    setCodeStatus(null);
    setApplyingCode(true);
    try {
      const res = await onApplyLoginOrAdminCode(codeDraft.trim());
      setCodeStatus({
        ok: res.ok,
        msg: res.msg || (res.ok ? 'Access code applied!' : 'Invalid code.'),
      });
      if (res.ok) {
        setCodeDraft('');
      }
    } finally {
      setApplyingCode(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Mobile & Pilot Settings"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4"
    >
      <div className="flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-3xl sm:rounded-3xl border border-slate-700 bg-[#121720] shadow-2xl overflow-hidden">
        {/* Clean Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-[#0D1118] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Sliders className="h-5 w-5 text-amber-400" />
            <div>
              <h2 className="font-display text-lg font-extrabold text-white">
                Pilot & Device Settings
              </h2>
              <p className="text-[11px] text-slate-400">
                Simple, touch-friendly controls, login code, audio & iOS install
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 bg-[#18202C] text-slate-200 hover:text-white"
            aria-label="Close settings"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Cards */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* 1. Account, Login Code & Username */}
          <section className="rounded-2xl border border-slate-800 bg-[#161D28] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-amber-300">
                <UserCheck className="h-4 w-4" />
                <span>Pilot Profile & Login Code</span>
                {profile.isAdmin && (
                  <span className="rounded-lg border border-amber-400/60 bg-amber-500/20 px-2 py-0.5 text-[10px] font-extrabold text-amber-200">
                    ADMIN FULL ACCESS
                  </span>
                )}
              </div>
              <span className="font-mono-tabular text-xs font-bold text-amber-400">
                Lv {profile.level} · {profile.coins ?? profile.scrap} Coins
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-500/40 bg-[#0D1118] px-3.5 py-2.5">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Your Personal Login Code (Keep This Safe)
                </div>
                <div className="font-mono text-sm font-extrabold tracking-widest text-amber-300 select-all">
                  {displayAccessCode}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleCopyLoginCode()}
                className="flex items-center gap-1.5 rounded-xl border border-amber-400/50 bg-amber-500/15 px-3 py-2 text-xs font-extrabold text-amber-200 hover:bg-amber-500/25 transition cursor-pointer"
              >
                {copiedCode ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-300">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>

            <form onSubmit={handleSaveUsername} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                maxLength={24}
                value={usernameDraft}
                onChange={(e) => setUsernameDraft(e.target.value)}
                placeholder="Unique Username"
                className="flex-1 min-h-[44px] rounded-xl border border-slate-700 bg-[#0D1118] px-3.5 text-sm font-bold text-white focus:border-amber-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={savingName}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-4 min-h-[44px] text-xs font-extrabold text-slate-950 hover:bg-amber-400 disabled:opacity-50 transition"
              >
                <Check className="h-4 w-4" />
                <span>{savingName ? 'Saving...' : 'Save Username'}</span>
              </button>
            </form>

            {usernameStatus && (
              <div
                className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                  usernameStatus.ok
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
                    : 'bg-rose-500/15 text-rose-300 border border-rose-500/40'
                }`}
              >
                {usernameStatus.msg}
              </div>
            )}

            {onApplyLoginOrAdminCode && (
              <form onSubmit={handleApplyCode} className="flex flex-col sm:flex-row gap-2 pt-1">
                <div className="relative flex-1">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-400" />
                  <input
                    type="text"
                    value={codeDraft}
                    onChange={(e) => setCodeDraft(e.target.value)}
                    placeholder="Switch account or enter Admin code..."
                    className="w-full min-h-[42px] rounded-xl border border-slate-700 bg-[#0D1118] pl-9 pr-3 text-xs font-bold text-white focus:border-sky-400 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={applyingCode || !codeDraft.trim()}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-sky-500/50 bg-sky-500/15 px-3.5 min-h-[42px] text-xs font-extrabold text-sky-200 hover:bg-sky-500/25 disabled:opacity-50 transition cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{applyingCode ? 'Applying...' : 'Apply Code'}</span>
                </button>
              </form>
            )}

            {codeStatus && (
              <div
                className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                  codeStatus.ok
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
                    : 'bg-rose-500/15 text-rose-300 border border-rose-500/40'
                }`}
              >
                {codeStatus.msg}
              </div>
            )}
          </section>

          {/* 2. Sound & Commentary Quick Controls */}
          <section className="rounded-2xl border border-slate-800 bg-[#161D28] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-sky-300">
                <Volume2 className="h-4 w-4" />
                <span>Audio & Commentary</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenFullAudioMixer();
                }}
                className="text-xs font-bold text-amber-400 hover:text-amber-300"
              >
                Full Volume Mixer →
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => onUpdateProfile({ muted: !profile.muted })}
                className={`flex items-center justify-between rounded-xl border px-3.5 min-h-[46px] text-xs font-bold transition ${
                  profile.muted
                    ? 'border-rose-500/50 bg-rose-500/15 text-rose-200'
                    : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  {profile.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  All Sound
                </span>
                <span>{profile.muted ? 'OFF' : 'ON'}</span>
              </button>

              <button
                type="button"
                onClick={() => onUpdateProfile({ commentaryMuted: !profile.commentaryMuted })}
                className={`flex items-center justify-between rounded-xl border px-3.5 min-h-[46px] text-xs font-bold transition ${
                  profile.commentaryMuted
                    ? 'border-slate-700 bg-[#0D1118] text-slate-300'
                    : 'border-sky-500/40 bg-sky-500/15 text-sky-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  {profile.commentaryMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  Commentary
                </span>
                <span>{profile.commentaryMuted ? 'OFF' : 'ON'}</span>
              </button>
            </div>
          </section>

          {/* 3. Touch, Controls & Device Mode */}
          <section className="rounded-2xl border border-slate-800 bg-[#161D28] p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-emerald-300">
              <Gamepad2 className="h-4 w-4" />
              <span>Controls & Screen Layout</span>
            </div>

            <div>
              <div className="text-[11px] font-semibold text-slate-400 mb-1.5">
                Screen Layout Mode
              </div>
              <div className="grid grid-cols-4 gap-2">
                {(
                  [
                    { id: 'auto', label: 'Auto', Icon: Shield },
                    { id: 'mobile', label: 'Mobile', Icon: Smartphone },
                    { id: 'tablet', label: 'Tablet', Icon: Tablet },
                    { id: 'desktop', label: 'Desktop', Icon: Monitor },
                  ] as const
                ).map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onUpdateProfile({ deviceLayoutMode: id })}
                    className={`flex flex-col items-center justify-center gap-1 rounded-xl border py-2.5 min-h-[50px] text-xs font-bold transition ${
                      activeDeviceMode === id
                        ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                        : 'border-slate-800 bg-[#0D1118] text-slate-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-semibold text-slate-400 mb-1.5">
                On-Screen Driving Buttons (Mobile / Tablet)
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'auto', label: 'Auto Detect' },
                    { id: 'always', label: 'Always Show' },
                    { id: 'off', label: 'Off' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onUpdateProfile({ touchControlsMode: t.id })}
                    className={`rounded-xl border min-h-[44px] px-2 text-xs font-bold transition ${
                      profile.touchControlsMode === t.id
                        ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                        : 'border-slate-800 bg-[#0D1118] text-slate-300'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-semibold text-slate-400 mb-1.5">
                Keyboard / Mouse Scheme
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'wasd_drive', label: 'WASD Drive' },
                    { id: 'arrows_drive', label: 'Arrows Drive' },
                    { id: 'mouse_drive', label: 'Mouse Drive' },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onUpdateProfile({ controlScheme: s.id })}
                    className={`rounded-xl border min-h-[44px] px-2 text-xs font-bold transition ${
                      activeScheme === s.id
                        ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                        : 'border-slate-800 bg-[#0D1118] text-slate-300'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#0D1118] p-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
                <span>Follow Camera Sensitivity</span>
                <span className="font-mono-tabular font-extrabold text-amber-400">
                  {Math.round((profile.cameraSensitivity ?? 0.65) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.2}
                max={1.8}
                step={0.05}
                value={profile.cameraSensitivity ?? 0.65}
                onChange={(e) =>
                  onUpdateProfile({ cameraSensitivity: parseFloat(e.target.value) })
                }
                aria-label="Follow Camera Sensitivity"
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                {(
                  [
                    { val: 0.4, label: 'Smooth (40%)' },
                    { val: 0.65, label: 'Default (65%)' },
                    { val: 1.15, label: 'Snappy (115%)' },
                  ] as const
                ).map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => onUpdateProfile({ cameraSensitivity: preset.val })}
                    className={`rounded-lg border py-1 text-[10px] font-bold transition cursor-pointer ${
                      Math.abs((profile.cameraSensitivity ?? 0.65) - preset.val) < 0.04
                        ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                        : 'border-slate-800 bg-[#141A24] text-slate-400 hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 mb-1.5">
                <BatteryCharging className="h-3.5 w-3.5 text-emerald-400" />
                <span>Performance & Battery</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'eco', label: 'Eco 30fps' },
                    { id: 'balanced', label: 'Balanced' },
                    { id: 'ultra', label: 'Ultra 60fps' },
                  ] as Array<{ id: BatteryMode; label: string }>
                ).map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => onUpdateProfile({ batteryMode: b.id })}
                    className={`rounded-xl border min-h-[44px] px-2 text-xs font-bold transition ${
                      profile.batteryMode === b.id
                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                        : 'border-slate-800 bg-[#0D1118] text-slate-300'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* 3.5 Accessibility, Telemetry Overlays, Haptics & Auto-Save */}
          <section className="rounded-2xl border border-slate-800 bg-[#161D28] p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-amber-300">
              <Sparkles className="h-4 w-4" />
              <span>Accessibility, Visual Filters & Telemetry</span>
            </div>

            <div>
              <div className="text-[11px] font-semibold text-slate-400 mb-1.5">
                Color-Blind Hazard Warning Mode
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'none', label: 'Standard Red' },
                    { id: 'blue_orange', label: 'Blue / Orange' },
                    { id: 'cyan_yellow', label: 'Cyan / Yellow' },
                  ] as const
                ).map((cb) => (
                  <button
                    key={cb.id}
                    type="button"
                    onClick={() => onUpdateProfile({ colorBlindMode: cb.id })}
                    className={`rounded-xl border min-h-[42px] px-2 text-xs font-bold transition cursor-pointer ${
                      (profile.colorBlindMode ?? 'none') === cb.id
                        ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                        : 'border-slate-800 bg-[#0D1118] text-slate-300'
                    }`}
                  >
                    {cb.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  onUpdateProfile({ hapticFeedback: !(profile.hapticFeedback ?? true) })
                }
                className={`flex items-center justify-between rounded-xl border px-3 min-h-[42px] text-xs font-bold transition cursor-pointer ${
                  (profile.hapticFeedback ?? true)
                    ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200'
                    : 'border-slate-800 bg-[#0D1118] text-slate-400'
                }`}
              >
                <span>Haptic Vibration</span>
                <span>{(profile.hapticFeedback ?? true) ? 'ON' : 'OFF'}</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onUpdateProfile({ ssaoEnabled: !(profile.ssaoEnabled ?? true) })
                }
                className={`flex items-center justify-between rounded-xl border px-3 min-h-[42px] text-xs font-bold transition cursor-pointer ${
                  (profile.ssaoEnabled ?? true)
                    ? 'border-sky-500/50 bg-sky-500/15 text-sky-200'
                    : 'border-slate-800 bg-[#0D1118] text-slate-400'
                }`}
              >
                <span>SSAO Contrast</span>
                <span>{(profile.ssaoEnabled ?? true) ? 'ON' : 'OFF'}</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onUpdateProfile({ showDamageNumbers: !(profile.showDamageNumbers ?? true) })
                }
                className={`flex items-center justify-between rounded-xl border px-3 min-h-[42px] text-xs font-bold transition cursor-pointer ${
                  (profile.showDamageNumbers ?? true)
                    ? 'border-amber-500/50 bg-amber-500/15 text-amber-200'
                    : 'border-slate-800 bg-[#0D1118] text-slate-400'
                }`}
              >
                <span>Hit Damage Numbers</span>
                <span>{(profile.showDamageNumbers ?? true) ? 'ON' : 'OFF'}</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onUpdateProfile({ momentumTrajectory: !(profile.momentumTrajectory ?? true) })
                }
                className={`flex items-center justify-between rounded-xl border px-3 min-h-[42px] text-xs font-bold transition cursor-pointer ${
                  (profile.momentumTrajectory ?? true)
                    ? 'border-fuchsia-500/50 bg-fuchsia-500/15 text-fuchsia-200'
                    : 'border-slate-800 bg-[#0D1118] text-slate-400'
                }`}
              >
                <span>Momentum Line</span>
                <span>{(profile.momentumTrajectory ?? true) ? 'ON' : 'OFF'}</span>
              </button>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#0D1118] p-3 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
                <span>Workshop & Fusion Auto-Save Frequency</span>
                <span className="font-mono-tabular font-extrabold text-amber-400">
                  Every {profile.autoSaveIntervalSec ?? 15}s
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={120}
                step={5}
                value={profile.autoSaveIntervalSec ?? 15}
                onChange={(e) =>
                  onUpdateProfile({ autoSaveIntervalSec: parseInt(e.target.value, 10) })
                }
                aria-label="Auto-Save Frequency Seconds"
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>
          </section>

          {/* 4. iOS Download & Sign Out */}
          <section className="rounded-2xl border border-slate-800 bg-[#161D28] p-4 flex flex-wrap items-center justify-between gap-3">
            <PWAInstallButton alwaysShowIOSOption />
            <button
              type="button"
              onClick={onSignOut}
              className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 min-h-[44px] text-xs font-bold text-rose-300 hover:bg-rose-500/20 transition"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </section>
        </div>
      </div>
    </div>
  );
};
