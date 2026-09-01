/* mehdiaskari.ir — offline cache service worker */
const CACHE = 'mehdiaskari-v12';

const PRECACHE = [
  './',
  './index.html',
  './404.html',
  './blog/',
  './blog/all/',
  './blog/all/index.html',
  './posts.json',
  './blog.css',
  './fonts/fonts.css',
  './icon.svg',
  './manifest.webmanifest',
  './og-image.png',
  './robots.txt',
  './sitemap.xml',
  './mehdi-askari.vcf',
  './qr-contact.svg',
  './fonts/vazirmatn-arabic.woff2',
  './fonts/vazirmatn-latin.woff2',
  './fonts/ibm-plex-mono-400.woff2',
  './fonts/ibm-plex-mono-500.woff2',
  './fonts/ibm-plex-mono-600.woff2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (!/^https?:$/.test(url.protocol)) return;

  // same-origin pages: network first, fall back to cache when offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // cache only successful page bodies, under their own URL
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  // same-origin assets: cache first, refresh in the background
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const refresh = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((cache) => cache.put(req, copy));
            }
            return res;
          })
          .catch(() => cached);
        return cached || refresh;
      })
    );
    return;
  }

  // cross-origin (Google Fonts, …): try network, cache opaque responses
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((cache) => cache.put(req, copy));
      return res;
    }))
  );
});
