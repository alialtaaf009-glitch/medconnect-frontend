// sw.js — MedConnect service worker (app-shell cache)
const CACHE = 'medconnect-v15';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
];

// Install: pre-cache the app shell.
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

// Activate: drop old caches.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
//  - API calls (network-only): never cache dynamic data.
//  - Everything else: cache-first, fall back to network, then to cached index.html.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;

  // Don't intercept API traffic — let it hit the network directly.
  if (url.pathname.includes('/api/')) {
    event.respondWith(fetch(event.request).catch(() => new Response(
      JSON.stringify({ error: 'offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } }
    )));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
