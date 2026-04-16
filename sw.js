const CACHE_NAME = 'timer-v4';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png'
];

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.allSettled(
    APP_SHELL.map(async (asset) => {
      const response = await fetch(asset, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`Failed to cache ${asset}`);
      await cache.put(asset, response);
    })
  );
}

self.addEventListener('install', (e) => {
  e.waitUntil(cacheAppShell());
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put('./index.html', copy);
        });
        return response;
      }).catch(async () => {
        const cachedPage = await caches.match('./index.html', { ignoreSearch: true });
        return cachedPage || caches.match('./', { ignoreSearch: true });
      })
    );
    return;
  }

  if (e.request.url.includes('fonts.googleapis.com') || e.request.url.includes('fonts.gstatic.com')) {
    e.respondWith(
      fetch(e.request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  if (isSameOrigin) {
    e.respondWith(
      caches.match(e.request, { ignoreSearch: true }).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
          }
          return response;
        });
      })
    );
  }
});
