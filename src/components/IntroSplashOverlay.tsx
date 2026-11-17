import React, { useEffect, useState } from 'react';
import { Shield, Swords, Zap } from 'lucide-react';

interface IntroSplashOverlayProps {
  onComplete: () => void;
}

const EMBERS = [
  { left: '14%', delay: '0.05s', duration: '2.1s', size: 'h-2 w-2', color: 'bg-amber-400' },
  { left: '24%', delay: '0.25s', duration: '2.4s', size: 'h-1.5 w-1.5', color: 'bg-sky-400' },
  { left: '36%', delay: '0.12s', duration: '1.9s', size: 'h-2.5 w-2.5', color: 'bg-amber-300' },
  { left: '48%', delay: '0.32s', duration: '2.2s', size: 'h-2 w-2', color: 'bg-orange-400' },
  { left: '62%', delay: '0.18s', duration: '2.0s', size: 'h-2 w-2', color: 'bg-sky-300' },
  { left: '74%', delay: '0.08s', duration: '2.3s', size: 'h-2.5 w-2.5', color: 'bg-amber-400' },
  { left: '85%', delay: '0.28s', duration: '2.1s', size: 'h-1.5 w-1.5', color: 'bg-amber-200' },
];

export const IntroSplashOverlay: React.FC<IntroSplashOverlayProps> = ({ onComplete }) => {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const exitTimer = window.setTimeout(() => {
      setExiting(true);
    }, 3600);
    const doneTimer = window.setTimeout(() => {
      onComplete();
    }, 4150);

    const handleKey = () => {
      setExiting(true);
      window.setTimeout(onComplete, 260);
    };
    window.addEventListener('keydown', handleKey, { once: true });

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(doneTimer);
      window.removeEventListener('keydown', handleKey);
    };
  }, [onComplete]);

  const handleDismiss = () => {
    if (exiting) return;
    setExiting(true);
    window.setTimeout(onComplete, 260);
  };

  return (
    <div
      role="dialog"
      aria-label="Aetheris Bot Wars Intro"
      onClick={handleDismiss}
      className={`fixed inset-0 z-50 flex cursor-pointer select-none flex-col items-center justify-center overflow-hidden bg-[#090C10]/95 transition-opacity duration-500 ${
        exiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Radial Forge & Quantum Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_44%,rgba(245,158,11,0.24),rgba(56,189,248,0.12)_42%,rgba(9,12,16,0.98)_78%)]"
      />

      {/* Expanding Impact Shockwave Rings */}
      <div
        aria-hidden="true"
        className="animate-aether-shockwave pointer-events-none absolute h-72 w-72 rounded-full border-2 border-amber-400/70 shadow-[0_0_80px_rgba(245,158,11,0.55)]"
      />
      <div
        aria-hidden="true"
        style={{ animationDelay: '0.36s' }}
        className="animate-aether-shockwave pointer-events-none absolute h-96 w-96 rounded-full border border-sky-400/50"
      />

      {/* Rising Forge Sparks */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {EMBERS.map((ember, idx) => (
          <span
            key={idx}
            style={{
              left: ember.left,
              bottom: '18%',
              animation: `aetherEmberRise ${ember.duration} ease-out ${ember.delay} infinite`,
            }}
            className={`absolute rounded-full ${ember.size} ${ember.color} shadow-[0_0_12px_rgba(251,191,36,0.9)]`}
          />
        ))}
      </div>

      {/* Center Emblem, Title Lockup & Official Brand Banner */}
      <div className="relative z-10 flex w-full max-w-3xl flex-col items-center px-6 text-center">
        {/* Crest Icon Row */}
        <div className="animate-aether-title mb-3 flex items-center gap-3 rounded-xl border border-amber-500/40 bg-[#12161C]/95 px-4 py-1.5 shadow-[0_0_40px_rgba(245,158,11,0.28)]">
          <Shield className="h-4 w-4 text-sky-400" />
          <Swords className="h-5 w-5 text-amber-400" />
          <Zap className="h-4 w-4 text-amber-300" />
          <span className="font-mono-tabular text-xs font-bold tracking-widest text-amber-300">
            SEASON 05 · ASCENSION
          </span>
        </div>

        {/* Main Hero Title: AETHERIS */}
        <div className="relative overflow-hidden px-4 py-0.5">
          <h1 className="animate-aether-title font-display text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white drop-shadow-[0_6px_32px_rgba(245,158,11,0.45)]">
            AETHERIS
          </h1>
          <div
            aria-hidden="true"
            className="animate-aether-beam pointer-events-none absolute inset-y-0 w-32 bg-gradient-to-r from-transparent via-amber-300/40 to-transparent"
          />
        </div>

        {/* Secondary Slam Title: BOT WARS */}
        <div className="animate-aether-sub mt-0.5 flex items-center gap-3 sm:gap-4">
          <span aria-hidden="true" className="h-0.5 w-8 sm:w-16 bg-gradient-to-r from-transparent to-amber-400" />
          <span className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-wider bg-gradient-to-r from-amber-300 via-amber-400 to-sky-400 bg-clip-text text-transparent">
            BOT WARS
          </span>
          <span aria-hidden="true" className="h-0.5 w-8 sm:w-16 bg-gradient-to-l from-transparent to-sky-400" />
        </div>

        {/* Official Aetheris Technology / Lovable Expert Partner '26 Banner */}
        <a
          href="https://businessforensics.tech"
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="animate-aether-sub group relative mt-4 block w-full max-w-2xl overflow-hidden rounded-2xl border border-amber-400/50 bg-[#05070A] p-1.5 shadow-[0_0_50px_rgba(245,158,11,0.32),0_0_24px_rgba(56,189,248,0.22)] transition hover:border-amber-300 hover:shadow-[0_0_65px_rgba(245,158,11,0.55)]"
        >
          <img
            src="/assets/aistudio/WhatsApp_Image_2026-11-16_at_3.53.53_PM_9a533155.jpeg"
            alt="Lovable Expert Partner '26 · Hire Aetheris Technology · We can fix or build your systems"
            referrerPolicy="no-referrer"
            className="h-auto w-full rounded-xl object-contain"
          />
          <div
            aria-hidden="true"
            className="animate-aether-beam pointer-events-none absolute inset-y-0 w-28 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          />
        </a>

        {/* Official Website & Developer Links: Businessforensics.tech + THE ARCHITECT (lovable.dev/@theonlyarchitect) */}
        <div className="animate-aether-sub mt-3 flex flex-wrap items-center justify-center gap-3">
          <a
            href="https://businessforensics.tech"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-2 rounded-xl border border-sky-400/60 bg-sky-500/15 px-3.5 py-1.5 font-mono-tabular text-xs font-extrabold tracking-wide text-sky-300 shadow-[0_0_24px_rgba(56,189,248,0.35)] transition hover:border-amber-300 hover:bg-amber-500/20 hover:text-amber-200"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
            <span>Businessforensics.tech</span>
            <span className="text-[10px] uppercase tracking-widest text-amber-300/90">↗</span>
          </a>

          <a
            href="https://lovable.dev/@theonlyarchitect"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-2.5 rounded-xl border border-amber-400/70 bg-[#12161C]/95 px-3 py-1 font-mono-tabular text-xs font-extrabold tracking-wide text-amber-200 shadow-[0_0_28px_rgba(245,158,11,0.4)] transition hover:border-amber-300 hover:bg-amber-500/20"
          >
            <img
              src="/assets/aistudio/nano-banana-2_take_this_image_and_create_a_logo_out_of_it_Token_HSL_Usage_--background_220_15_-0_1__11fa74ed.jpg"
              alt="THE ARCHITECT Developer Logo"
              className="h-8 w-8 rounded-full border border-amber-400/80 object-cover"
            />
            <div className="text-left leading-tight">
              <div className="text-[11px] font-extrabold text-amber-300">THE ARCHITECT</div>
              <div className="text-[10px] text-sky-300">lovable.dev/@theonlyarchitect ↗</div>
            </div>
          </a>
        </div>

        {/* Subtitle & Action CTA */}
        <p className="animate-aether-sub mt-2.5 max-w-md text-xs sm:text-sm font-medium text-slate-300">
          3D Custom Hybrid Combat Robotics · Destructible Armor · Live Arena Warfare
        </p>

        <button
          type="button"
          onClick={handleDismiss}
          className="animate-aether-sub mt-3 rounded-xl border border-amber-400/80 bg-amber-500 px-6 py-2.5 text-xs sm:text-sm font-extrabold text-slate-950 shadow-[0_0_30px_rgba(245,158,11,0.5)] hover:bg-amber-400 transition"
        >
          Enter Hangar
        </button>
      </div>
    </div>
  );
};

