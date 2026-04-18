'use client';

import { useEffect } from 'react';

// Registers /sw.js in production, and proactively *un*registers any stale
// worker in dev. Without that cleanup, an SW registered during a previous
// prod build keeps intercepting fetch() and breaks HMR on the next dev run.
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => void r.unregister()))
        .catch(() => undefined);
      return;
    }

    const register = () =>
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch(() => undefined);

    if (document.readyState === 'complete') {
      void register();
    } else {
      window.addEventListener('load', register, { once: true });
    }
  }, []);

  return null;
}
