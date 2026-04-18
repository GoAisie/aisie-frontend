// Aisie PWA service worker.
//
// Strategy per URL class:
//   • /api/* and /auth/*       → NetworkOnly (never cache; always hit gateway)
//   • WebSocket upgrades       → bypass (SW cannot handle WS anyway)
//   • Navigation HTML          → NetworkFirst with cached fallback (offline shell)
//   • /_next/static/*, /icons, /worklets, /manifest → StaleWhileRevalidate
//
// The cache name is versioned; changing VERSION on deploy causes the activate
// handler to purge the old cache so clients aren't stuck on stale bundles.

const VERSION = 'aisie-v1';
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
