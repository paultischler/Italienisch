/* Impara Italiano — Service Worker
   Bump CACHE_VERSION with every deployment to force fresh assets. */
const CACHE_VERSION = 'impara-v20260528';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  // Network-first for HTML so updates are always picked up
  if (req.headers.get('Accept')?.includes('text/html')) {
    e.respondWith(
      fetch(req).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE_VERSION).then(c => c.put(req, clone));
        return resp;
      }).catch(() => caches.match(req))
    );
    return;
  }
  // Cache-first for all other assets (JS, CSS, fonts, images)
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE_VERSION).then(c => c.put(req, clone));
        }
        return resp;
      });
    })
  );
});
