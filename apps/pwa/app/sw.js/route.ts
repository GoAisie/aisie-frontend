import { NextResponse } from 'next/server';

// Service worker served via a route handler (not a static file in /public)
// so the body bytes can carry the build SHA. Why: a static sw.js never
// changes its byte content between deploys, and the browser only treats a
// service worker as "new" when its bytes differ — so a stable sw.js means
// the install/activate cycle never re-runs and old StaleWhileRevalidate
// caches (e.g. /_next/static chunks from the previous deploy) keep being
// served forever. Inlining BUILD_SHA into both the file header and the
// VERSION constant guarantees a byte-level diff on every deploy, which
// triggers self.skipWaiting() + clients.claim() + the activate handler's
// purge of stale caches.
//
// force-static lets Vercel bake the response at build time, so each prod
// build produces a different /sw.js byte stream pinned to that build's SHA.
// Cache-Control: max-age=0, must-revalidate is the canonical SW header pair
// (per Chrome/Workbox guidance) — browsers will revalidate the SW file on
// every page load instead of caching it for hours.
export const dynamic = 'force-static';

const BUILD_SHA = (process.env.VERCEL_GIT_COMMIT_SHA ?? 'local').slice(0, 7);

const SW_SOURCE = `// Aisie PWA service worker — built ${BUILD_SHA}
//
// Strategy per URL class:
//   • /api/* and /auth/*       → NetworkOnly (never cache; always hit gateway)
//   • WebSocket upgrades       → bypass (SW cannot handle WS anyway)
//   • Navigation HTML          → NetworkFirst with cached fallback (offline shell)
//   • /_next/static/*, /icons, /worklets, /manifest → StaleWhileRevalidate
//
// The cache name is pinned to BUILD_SHA so every deploy is a fresh cache
// and the activate handler purges every prior cache automatically.

const VERSION = 'aisie-${BUILD_SHA}';
const APP_SHELL = [
  '/',
  '/login',
  '/register',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-maskable.svg',
  '/worklets/vad-processor.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      // addAll is atomic: if any request fails the whole SW install fails.
      // We intentionally keep the list tiny so a single 404 during dev
      // rebuilds doesn't brick the install.
      .then((cache) => cache.addAll(APP_SHELL).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Don't touch the WebSocket upgrade handshake — it isn't a real HTTP
  // response SW can cache or replay.
  if (req.headers.get('upgrade') === 'websocket') return;

  // Cross-origin (e.g. api.goaisie.com from app.goaisie.com) — always bypass.
  if (url.origin !== self.location.origin) return;

  // API and auth calls — always network, never cache.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
    return;
  }

  // Navigation requests: NetworkFirst so a deploy is picked up immediately,
  // with cached shell as offline fallback.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(VERSION).then((c) => c.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('/'))),
    );
    return;
  }

  // Static assets: StaleWhileRevalidate — instant response from cache,
  // update in background so next load gets the new file.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(VERSION).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});

self.addEventListener('push', (event) => {
  const d = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(d.title ?? 'Aisie', {
      body: d.body ?? '',
      icon: '/icons/icon.svg',
      data: { url: d.url ?? '/notifications' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
`;

export function GET() {
  return new NextResponse(SW_SOURCE, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Service-Worker-Allowed': '/',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
}
