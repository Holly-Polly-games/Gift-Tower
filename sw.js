/* sw.js — Holly Polly Tower
   Кеширует ассеты, чтобы следующие запуски (в т.ч. через Telegram) были сильно быстрее.
*/

const CACHE_VERSION = "hp-tower-v1";
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  // Ничего не pre-cache'им жёстко (чтобы не ломаться из-за имен/обновлений).
  // Кеш будет наполняться при первой загрузке (runtime caching).
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => {
      if (!k.startsWith(CACHE_VERSION)) return caches.delete(k);
    }));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Кешируем только свой origin (GitHub Pages)
  if (url.origin !== self.location.origin) return;

  // Для html — network-first (чтобы обновления прилетали), с fallback на cache
  if (req.destination === "document" || url.pathname.endsWith(".html")) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        const cached = await caches.match(req);
        if (cached) return cached;
        // fallback: попробуем корневой документ
        const cachedIndex = await caches.match("./");
        return cachedIndex || new Response("Offline", { status: 503 });
      }
    })());
    return;
  }

  // Для ассетов (images/js/css) — cache-first + догрузка в кеш
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
      const res = await fetch(req);
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(req, res.clone());
      return res;
    } catch (e) {
      return new Response("", { status: 504 });
    }
  })());
});
