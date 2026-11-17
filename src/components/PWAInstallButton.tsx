import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-2 rounded-lg bg-amber-500 px-3.5 py-2 min-h-[44px] text-xs font-semibold text-slate-950 hover:bg-amber-400 active:scale-[0.98] transition whitespace-nowrap shrink-0"
      >
        <Download className="w-4 h-4" />
        {compact ? 'Install' : 'Install App'}
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 min-h-[44px] text-xs font-medium text-slate-200 hover:bg-slate-700 transition whitespace-nowrap shrink-0"
        >
          <Download className="w-4 h-4 text-amber-400" />
          Install iOS
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
            <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-[#161B22] p-6 shadow-2xl">
              <h3 className="font-display text-lg font-bold text-white">Install ForgeClash</h3>
              <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                1. Tap the <strong>Share</strong> button in your Safari toolbar.
                <br />
                2. Scroll down and select <strong>Add to Home Screen</strong> for fullscreen offline arena play.
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full min-h-[44px] rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-400 transition"
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
