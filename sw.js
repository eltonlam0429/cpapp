/* 離線快取：有網絡時一律拿最新的，沒有網絡才用快取。同步請求（Google）不經這裏。 */
const CACHE = 'us-cache';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res && res.ok && !url.pathname.endsWith('version.json')) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(async () => {
      const c = await caches.open(CACHE);
      return (await c.match(e.request)) || (await c.match(e.request, { ignoreSearch: true })) || (url.pathname.endsWith('/') || e.request.mode === 'navigate' ? c.match('./', { ignoreSearch: true }) : undefined) || Response.error();
    })
  );
});
