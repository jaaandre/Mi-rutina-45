// Reuse the installed app's cache so an update can start on a slow connection.
const CACHE = 'mi-rutina-45-v3-campana';
const SCOPE = self.registration.scope;
const SHELL = new URL('./index.html', SCOPE).href;
const ASSETS = ['./index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const missing = [];
    for (const path of ASSETS) {
      const url = new URL(path, SCOPE).href;
      if (!(await cache.match(url))) missing.push(new Request(url, {cache: 'reload'}));
    }
    if (missing.length) await cache.addAll(missing);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('mi-rutina-45-') && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function refresh(cache, key, request) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(request, {cache: 'no-cache', signal: controller.signal});
    if (response.ok) await cache.put(key, response);
  } finally {
    clearTimeout(timer);
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || !request.url.startsWith(SCOPE)) return;

  event.respondWith((async () => {
    const url = new URL(request.url);
    url.search = '';
    url.hash = '';
    const home = request.mode === 'navigate' && (url.href === SCOPE || url.href === SHELL);
    const key = home ? SHELL : request;
    const cache = await caches.open(CACHE).catch(() => null);
    if (!cache) return fetch(request);

    const cached = await cache.match(key).catch(() => undefined);
    if (cached) {
      event.waitUntil(refresh(cache, key, request).catch(() => {}));
      return cached;
    }

    try {
      const response = await fetch(request, {cache: 'no-cache'});
      if (response.ok) event.waitUntil(cache.put(key, response.clone()).catch(() => {}));
      return response;
    } catch (error) {
      if (request.mode === 'navigate') {
        const shell = await cache.match(SHELL);
        if (shell) return shell;
      }
      throw error;
    }
  })());
});
