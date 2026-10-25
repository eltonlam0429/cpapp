/* 離線快取：先用快取顯示，背景再更新。同步請求（Google）永遠走網絡。 */
const CACHE = 'us-v1';
const SHELL = ['./', 'index.html', 'style.css', 'js/data.js', 'js/ui.js', 'js/store.js', 'js/app.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const hit = await cache.match(e.request, { ignoreSearch: true });
      const net = fetch(e.request).then(res => {
        if (res && res.ok) cache.put(e.request, res.clone());
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
