/* Berlin-Sommer · Service Worker
   CACHE_VERSION bei jeder Änderung hochzählen, damit alle frische Dateien bekommen. */
const CACHE_VERSION = 'berlin-v20260801c';
const PRECACHE = ['./', './index.html', './style.css', './app.js'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(PRECACHE)).catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Fremde Server (z. B. die Wetter-API) nie zwischenspeichern
  if (new URL(req.url).origin !== location.origin) return;

  // HTML: erst Netz, dann Cache – damit Updates ankommen
  if (req.headers.get('Accept')?.includes('text/html')) {
    e.respondWith(
      fetch(req).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE_VERSION).then(c => c.put(req, clone));
        return resp;
      }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Alles andere (CSS, JS, Bilder): erst Cache, dann Netz
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(resp => {
      if (resp.ok) {
        const clone = resp.clone();
        caches.open(CACHE_VERSION).then(c => c.put(req, clone));
      }
      return resp;
    }))
  );
});
