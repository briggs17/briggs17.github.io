/* Lift Log service worker — hand written.
 * Precaches the built app shell (list injected at build time by the precache plugin in
 * vite.config.ts) and serves same-origin GETs cache-first, so the app works fully offline. */
const VERSION = 'ee44f3482172';
const PRECACHE = ["assets/index-BdIbronY.js","assets/index-CvloMXqM.css","icons/apple-touch-icon.png","icons/favicon-32.png","icons/favicon.svg","icons/icon-192.png","icons/icon-512-maskable.png","icons/icon-512.png","manifest.webmanifest"];
const CACHE = `lift-log-${VERSION}`;
const SCOPE = new URL(self.registration.scope).pathname; // e.g. /lift-log/

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([SCOPE, ...PRECACHE.map((p) => SCOPE + p)]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('lift-log-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function fromNetworkAndCache(request, cacheKey) {
  const res = await fetch(request);
  if (res && res.ok && res.type === 'basic') {
    const cache = await caches.open(CACHE);
    cache.put(cacheKey || request, res.clone());
  }
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE)) return;

  // App navigations: serve the cached shell instantly, refresh it in the background.
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match(SCOPE).then((cached) => {
        const net = fromNetworkAndCache(new Request(SCOPE), SCOPE).catch(() => cached);
        if (cached) {
          event.waitUntil(net.catch(() => {}));
          return cached;
        }
        return net;
      }),
    );
    return;
  }

  // Everything else (hashed assets, icons, manifest): cache first, then network.
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => cached || fromNetworkAndCache(req).catch(() => cached || Response.error())),
  );
});
