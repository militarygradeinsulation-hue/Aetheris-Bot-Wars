import React, { useState } from 'react';
import { CheckCircle2, Download, PlusSquare, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{
  compact?: boolean;
  alwaysShowIOSOption?: boolean;
}> = ({ compact = false, alwaysShowIOSOption = false }) => {
  const { isInstallable, isInstalled, isIOS, isSafari, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    if (!alwaysShowIOSOption) return null;
    return (
      <div className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-300">
        <CheckCircle2 className="h-4 w-4" />
        <span>Installed on Device</span>
      </div>
    );
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="flex items-center gap-2 rounded-xl bg-amber-500 px-3.5 py-2 min-h-[44px] text-xs font-bold text-slate-950 hover:bg-amber-400 active:scale-[0.98] transition whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="w-4 h-4" />
        {compact ? 'Download App' : 'Download & Install App'}
      </button>
    );
  }

  if (isIOS || alwaysShowIOSOption) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-2 rounded-xl border border-sky-500/50 bg-sky-500/15 px-3.5 py-2 min-h-[44px] text-xs font-bold text-sky-200 hover:bg-sky-500/25 transition whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Smartphone className="w-4 h-4 text-sky-300" />
          <span>{compact ? 'iOS App' : 'Download for iOS (iPhone / iPad)'}</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl border border-sky-500/40 bg-[#141A24] p-5 sm:p-6 shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/20 border border-sky-400/40">
                    <Smartphone className="h-5 w-5 text-sky-300" />
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-sky-300">
                      iOS Standalone App
                    </div>
                    <h3 className="font-display text-lg font-extrabold text-white">
                      Download Aetheris Bot Wars on iPhone / iPad
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:text-white"
                  aria-label="Close iOS download guide"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-xs text-slate-200">
                {!isSafari && isIOS && (
                  <div className="rounded-xl border border-amber-500/40 bg-amber-500/15 p-3 text-amber-200">
                    <strong>Tip:</strong> Open this URL in Apple <strong>Safari</strong> first — iOS requires Safari to install home-screen apps.
                  </div>
                )}

                <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-[#0D1118] p-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/20 text-sky-300 font-bold shrink-0">
                    1
                  </div>
                  <div>
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <span>Open Share Menu</span>
                      <Share className="h-3.5 w-3.5 text-sky-400" />
                    </div>
                    <p className="mt-0.5 text-slate-400">
                      Tap the <strong>Share</strong> icon in your iPhone or iPad Safari toolbar.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-[#0D1118] p-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/20 text-sky-300 font-bold shrink-0">
                    2
                  </div>
                  <div>
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <span>Tap &ldquo;Add to Home Screen&rdquo;</span>
                      <PlusSquare className="h-3.5 w-3.5 text-amber-400" />
                    </div>
                    <p className="mt-0.5 text-slate-400">
                      Scroll down in the Share sheet, select <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-[#0D1118] p-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300 font-bold shrink-0">
                    3
                  </div>
                  <div>
                    <div className="font-bold text-white">Launch Fullscreen Anytime</div>
                    <p className="mt-0.5 text-slate-400">
                      Open <strong>Aetheris Bot Wars</strong> from your Home Screen with offline physics cache, touch D-Pad controls & cloud account sync.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full min-h-[46px] rounded-xl bg-amber-500 py-2.5 text-xs font-extrabold uppercase tracking-wider text-slate-950 hover:bg-amber-400 transition cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
