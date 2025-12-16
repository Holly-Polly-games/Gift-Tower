/* sw.js — Holly Polly Tower (fixed)
   - Быстрый старт за счёт кеша ассетов
   - Не застревает на старом index.html после переименований
   - Не кеширует 404
   - Не плодит кеш из-за ?_ts=...
*/

const CACHE_VERSION = "hp-tower-v3";          // <-- ВАЖНО: меняй при обновлениях
const RUNTIME_CACHE = `${CACHE_VERSION}-rt`;

self.addEventListener("install", (event) => {
  self.skipWaiting();
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

function isHtmlRequest(req, url) {
  return req.destination === "document" ||
         req.headers.get("accept")?.includes("text/html") ||
         url.pathname.endsWith(".html") ||
         url.pathname === "/" ||
         url.pathname.endsWith("/Gift-Tower/") ||           // на всякий случай под GH Pages
         url.pathname.endsWith("/Gift-Tower/index.html");
}

function isAssetRequest(req) {
  // ассеты/статика
  return (
    req.destination === "image" ||
    req.destination === "script" ||
    req.destination === "style"  ||
    req.destination === "font"   ||
    req.destination === "audio"  ||
    req.destination === "video"
  );
}

async function cachePutSafe(cache, req, res) {
  // НЕ кешируем ошибки / opaque (opaque бывает при кросс-домене, но у нас origin свой)
  if (!res || !res.ok || res.type === "opaque") return;
  await cache.put(req, res.clone());
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Кешируем только свой origin (GitHub Pages)
  if (url.origin !== self.location.origin) return;

  // Нормализуем URL для кеша: игнорим query (?_ts=...)
  const cacheKey = new Request(url.origin + url.pathname, {
    method: "GET",
    headers: req.headers,
    mode: req.mode,
    credentials: req.credentials,
    redirect: req.redirect
  });

  // HTML: stale-while-revalidate
  if (isHtmlRequest(req, url)) {
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME_CACHE);

      const cached = await cache.match(cacheKey);
      const networkPromise = (async () => {
        try {
          const fresh = await fetch(req, { cache: "no-store" });
          await cachePutSafe(cache, cacheKey, fresh);
          return fresh;
        } catch (e) {
          return null;
        }
      })();

      // Отдаём кеш мгновенно, но обновляем в фоне
      if (cached) {
        networkPromise; // фоновое обновление
        return cached;
      }

      const fresh = await networkPromise;
      return fresh || new Response("Offline", { status: 503 });
    })());
    return;
  }

  // Ассеты: cache-first + догрузка
  if (isAssetRequest(req)) {
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME_CACHE);

      const cached = await cache.match(cacheKey, { ignoreSearch: true });
      if (cached) return cached;

      try {
        const res = await fetch(req);
        await cachePutSafe(cache, cacheKey, res);
        return res;
      } catch (e) {
        return new Response("", { status: 504 });
      }
    })());
    return;
  }

  // Остальное (например json) — network-first, но без жёсткого кеша
  event.respondWith((async () => {
    try {
      return await fetch(req);
    } catch (e) {
      const cached = await caches.match(cacheKey);
      return cached || new Response("", { status: 504 });
    }
  })());
});

