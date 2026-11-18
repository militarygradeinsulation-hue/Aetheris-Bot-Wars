import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import {
  loginWithAccessCode,
  registerUsernameWithCode,
} from '../services/firebaseService';
import type { PlayerProfile } from '../shared/types';

interface AuthGateModalProps {
  authUser?: User | null;
  authLoading: boolean;
  profile: PlayerProfile;
  onProfileUpdated: (next: PlayerProfile) => void;
}

export const AuthGateModal: React.FC<AuthGateModalProps> = ({
  authLoading,
  profile,
  onProfileUpdated,
}) => {
  const [mode, setMode] = useState<'create' | 'login'>('create');
  const [usernameInput, setUsernameInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [createdSession, setCreatedSession] = useState<{
    code: string;
    isAdmin: boolean;
    profile: PlayerProfile;
  } | null>(null);

  if (authLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#090D14]/95 backdrop-blur-md p-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-700/80 bg-[#12161F] p-8 text-center shadow-2xl">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          <h2 className="mt-4 font-display text-lg font-extrabold text-white">
            Syncing Pilot Hangar & Cloud Profile...
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Loading your saved combat bots, arenas, and stats
          </p>
        </div>
      </div>
    );
  }

  // Gate passes once a pilot username is claimed and active
  if (profile.usernameClaimed && !createdSession) {
    return null;
  }

  const handleCreateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const trimmed = usernameInput.trim();
    if (!trimmed) {
      setErrorMsg('Please enter a pilot username.');
      return;
    }
    setBusy(true);
    try {
      const res = await registerUsernameWithCode(trimmed, profile);
      if (!res.ok || !res.profile || !res.code) {
        setErrorMsg(res.error || 'Could not create that username. Try another handle.');
      } else {
        setCreatedSession({
          code: res.code,
          isAdmin: Boolean(res.isAdmin),
          profile: res.profile,
        });
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to register username. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCodeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const trimmed = codeInput.trim();
    if (!trimmed) {
      setErrorMsg('Please enter your saved login code.');
      return;
    }
    setBusy(true);
    try {
      const res = await loginWithAccessCode(trimmed, profile);
      if (!res.ok || !res.profile) {
        setErrorMsg(
          res.error || 'Access code not found. Check your saved code or create a new username.',
        );
      } else {
        onProfileUpdated(res.profile);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to sign in with that code.');
    } finally {
      setBusy(false);
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(true);
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Aetheris Bot Wars Pilot Login"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#090D14]/92 backdrop-blur-lg p-3 sm:p-6 overflow-y-auto"
    >
      <div className="w-full max-w-md rounded-3xl border border-amber-500/40 bg-[#121722] p-5 sm:p-7 shadow-[0_24px_80px_rgba(0,0,0,0.85)] my-auto">
        {/* Brand Header */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <img
            src="/assets/aistudio/WhatsApp_Image_2026-11-16_at_3.53.53_PM_9a533155.jpeg"
            alt="Aetheris Business Forensics"
            className="h-12 w-12 rounded-2xl border border-amber-400/60 object-cover shrink-0"
          />
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-amber-400">
              Aetheris Bot Wars
            </div>
            <h1 className="font-display text-xl font-extrabold text-white">
              {createdSession
                ? 'Save Your Personal Login Code'
                : mode === 'create'
                  ? 'Create Your Pilot Username'
                  : 'Login With Access Code'}
            </h1>
          </div>
        </div>

        {/* Step 2 after creating username: Show generated code to copy & keep */}
        {createdSession ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-xs text-slate-200 leading-relaxed">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="flex items-center gap-1.5 font-extrabold text-emerald-300 text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  Pilot Registered: {createdSession.profile.callsign}
                </span>
                {createdSession.isAdmin && (
                  <span className="rounded-lg border border-amber-400/60 bg-amber-500/20 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-300">
                    Admin Full Unlock
                  </span>
                )}
              </div>
              <p className="text-slate-300">
                Copy and keep your personal login code below. Going forward, you can use this code
                anytime to log back into your pilot profile and restore your level, coins, and
                unlocked gear.
              </p>
            </div>

            <div className="rounded-2xl border-2 border-amber-400/70 bg-[#090D14] p-4 text-center shadow-inner">
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400">
                Your Personal Login Code
              </div>
              <div className="mt-2 font-mono text-2xl sm:text-3xl font-extrabold tracking-widest text-amber-300 select-all">
                {createdSession.code}
              </div>
              <button
                type="button"
                onClick={() => void handleCopyCode(createdSession.code)}
                className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl border border-amber-400/60 bg-amber-500/15 px-4 py-2 text-xs font-extrabold text-amber-200 hover:bg-amber-500/25 transition cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-400" />
                    <span className="text-emerald-300">Code Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Copy Login Code</span>
                  </>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                const target = createdSession.profile;
                setCreatedSession(null);
                onProfileUpdated(target);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 min-h-[48px] py-3 text-xs font-extrabold uppercase tracking-wider text-slate-950 hover:bg-amber-400 transition shadow-lg cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              <span>I Copied My Code — Enter Hangar</span>
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {/* Mode Switcher: Create Username vs Login with Code */}
            <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-slate-800 bg-[#0B0F17] p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('create');
                  setErrorMsg(null);
                }}
                className={`rounded-lg py-2.5 text-xs font-extrabold transition cursor-pointer ${
                  mode === 'create'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Create Username
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg(null);
                }}
                className={`rounded-lg py-2.5 text-xs font-extrabold transition cursor-pointer ${
                  mode === 'login'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Use Login Code
              </button>
            </div>

            {mode === 'create' ? (
              <form onSubmit={handleCreateUsername} className="space-y-4">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Choose your unique <strong>Pilot Username</strong>. We will generate a personal{' '}
                  <strong>Login Code</strong> for you to copy and keep so you can log back in
                  anytime.
                </p>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Pilot Username (3–24 characters)
                  </label>
                  <div className="relative">
                    <UserCheck className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-400" />
                    <input
                      type="text"
                      maxLength={40}
                      required
                      autoFocus
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      placeholder="e.g. Vortex_King99"
                      className="w-full rounded-xl border border-slate-700 bg-[#0B0F17] pl-10 pr-4 py-3 text-sm font-bold text-white focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                </div>

                {errorMsg && (
                  <div className="rounded-xl border border-rose-500/50 bg-rose-500/15 px-3.5 py-2.5 text-xs font-semibold text-rose-200 leading-relaxed">
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 min-h-[48px] py-3 text-xs font-extrabold uppercase tracking-wider text-slate-950 hover:bg-amber-400 disabled:opacity-60 transition cursor-pointer"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>{busy ? 'Generating Code...' : 'Create Username & Get Login Code'}</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleCodeLogin} className="space-y-4">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Enter the personal <strong>Login Code</strong> you saved when creating your
                  username to restore your pilot profile, unlocked arenas, weapons, and coins.
                </p>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Your Saved Login Code
                  </label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-400" />
                    <input
                      type="text"
                      required
                      autoFocus
                      value={codeInput}
                      onChange={(e) => setCodeInput(e.target.value)}
                      placeholder="e.g. AETH-7K9P-4X2M"
                      className="w-full rounded-xl border border-slate-700 bg-[#0B0F17] pl-10 pr-4 py-3 font-mono text-sm font-bold text-white focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                </div>

                {errorMsg && (
                  <div className="rounded-xl border border-rose-500/50 bg-rose-500/15 px-3.5 py-2.5 text-xs font-semibold text-rose-200 leading-relaxed">
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 min-h-[48px] py-3 text-xs font-extrabold uppercase tracking-wider text-slate-950 hover:bg-amber-400 disabled:opacity-60 transition cursor-pointer"
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>{busy ? 'Verifying Code...' : 'Login With Code'}</span>
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

