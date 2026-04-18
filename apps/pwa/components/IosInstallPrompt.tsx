'use client';

import { useEffect, useState } from 'react';

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
// on their own, so we nudge them with a dismissable banner.
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

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      /* ignore quota / private mode */
    }
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Aisie'yi telefonunuza ekleyin"
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 'calc(80px + env(safe-area-inset-bottom))',
        background: '#0b0b0f',
        color: '#fff',
        borderRadius: 14,
        padding: '14px 16px',
        zIndex: 60,
        boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <div style={{ flex: 1, fontSize: 14, lineHeight: 1.45 }}>
        <strong style={{ display: 'block', marginBottom: 4 }}>
          Aisie'yi ana ekranınıza ekleyin
        </strong>
        <span style={{ color: '#d4d4d8' }}>
          Alt çubuktaki
          <ShareGlyph />
          Paylaş butonuna dokunun, ardından <em>Ana Ekran'a Ekle</em>'yi seçin.
        </span>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Kapat"
        style={{
          background: 'transparent',
          border: 'none',
          color: '#9ca3af',
          fontSize: 22,
          lineHeight: 1,
          cursor: 'pointer',
          padding: 4,
        }}
      >
        ×
      </button>
    </div>
  );
}

function ShareGlyph() {
  return (
    <svg
      aria-hidden
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ verticalAlign: '-2px', margin: '0 4px' }}
    >
      <path d="M12 3v12" />
      <path d="M7 8l5-5 5 5" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}
