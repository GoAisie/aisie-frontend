'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';

const DISMISSED_KEY = 'aisie-ios-install-dismissed';
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type StandaloneNavigator = Navigator & { standalone?: boolean };

function detectIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIosDevice =
    /iP(hone|od|ad)/.test(navigator.platform) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isIosDevice) return false;
  // Non-Safari browsers on iOS (Chrome, Firefox, Edge, DuckDuckGo) use
  // WebKit under the hood but don't expose the Share-to-Home-Screen flow,
  // so the banner would be misleading there.
  return /Safari/.test(ua) && !/(CriOS|FxiOS|EdgiOS|DuckDuckGo)/.test(ua);
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  return (navigator as StandaloneNavigator).standalone === true;
}

// iOS Safari does not fire `beforeinstallprompt` — the only install path is
// the native Share sheet's "Add to Home Screen". Users can't discover that
// on their own, so we nudge them with a dismissable banner. The banner
// stays dark in both light and dark themes — iOS notification convention.
export function IosInstallPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!detectIosSafari()) return;
    if (isStandalone()) return;
    try {
      const dismissedAt = Number(localStorage.getItem(DISMISSED_KEY) ?? 0);
      if (dismissedAt && Date.now() - dismissedAt < DISMISS_TTL_MS) return;
    } catch {
      /* localStorage blocked (private mode) — still show banner */
    }
    setVisible(true);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      /* ignore quota / private mode */
    }
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="dialog"
          aria-label="Aisie'yi telefonunuza ekleyin"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 30 }}
          className="fixed left-3 right-3 z-[60] flex items-start gap-3 rounded-2xl bg-zinc-900 px-4 py-3.5 text-zinc-50 shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
          style={{ bottom: 'calc(80px + env(safe-area-inset-bottom))' }}
        >
          <div className="flex-1 text-sm leading-snug">
            <strong className="mb-1 block">
              Aisie'yi ana ekranınıza ekleyin
            </strong>
            <span className="text-zinc-300">
              Alt çubuktaki <ShareGlyph /> Paylaş butonuna dokunun, ardından{' '}
              <em>Ana Ekran'a Ekle</em>'yi seçin.
            </span>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Kapat"
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-50"
          >
            <X className="size-[18px]" aria-hidden />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ShareGlyph() {
  return (
    <svg
      aria-hidden
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mx-1 -mt-0.5 inline align-middle"
    >
      <path d="M12 3v12" />
      <path d="M7 8l5-5 5 5" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}
