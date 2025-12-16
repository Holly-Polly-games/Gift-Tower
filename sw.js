/* sw.js — Holly Polly Tower
   ✅ precache ассетов (чтобы 2-й запуск был мгновенный)
   ✅ cache-first для изображений
   ✅ network-first для html (чтобы обновления прилетали)
*/

const CACHE_VERSION = "hp-tower-v2";       // <-- меняй версию при каждом деплое
const PRECACHE = `${CACHE_VERSION}-precache`;
const RUNTIME  = `${CACHE_VERSION}-runtime`;

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./logo.png",

  "./background.webp",
  "./bonus.webp",
  "./coil.webp",
  "./bag1.webp",
  "./bag2.webp",

  "./TipA-1.webp",
  "./TipA-2.webp",

  "./TipB-1.webp",
  "./TipB-2.webp",
  "./TipB-3.webp",

  "./TipC-1.webp",
  "./TipC-2.webp",

  "./TipD-1.webp",
  "./TipD-2.webp",
  "./TipD-3.webp",
  "./TipD-4.webp",

  "./TipF-1.webp",
  "./TipF-2.webp",
  "./TipF-3.webp"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(PRECACHE);
    // ignoreSearch: чтобы "./index.html?v=..." совпадал с "./index.html"
    await cache.addAll(PRECACHE_URLS);
  })());
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

function isHTML(req, url){
  return req.destination === "document" || url.pathname.endsWith(".html") || url.pathname === "/" || url.pathname.endsWith("/Gift-Tower/");
}

function isAsset(req, url){
  const p = url.pathname.toLowerCase();
  return req.destination === "image"
    || p.endsWith(".webp") || p.endsWith(".png") || p.endsWith(".jpg") || p.endsWith(".jpeg")
    || p.endsWith(".js") || p.endsWith(".css");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // кешируем только свой origin (GitHub Pages)
  if (url.origin !== self.location.origin) return;

  // ✅ HTML: network-first (чтобы обновления прилетали), fallback cache
  if (isHTML(req, url)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(RUNTIME);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        const cached = await caches.match(req, { ignoreSearch:true });
        if (cached) return cached;
        const cachedIndex = await caches.match("./index.html", { ignoreSearch:true });
        return cachedIndex || new Response("Offline", { status: 503 });
      }
    })());
    return;
  }

  // ✅ Ассеты: cache-first
  if (isAsset(req, url)) {
    event.respondWith((async () => {
      const cached = await caches.match(req, { ignoreSearch:true });
      if (cached) return cached;

      try {
        const res = await fetch(req);
        const cache = await caches.open(RUNTIME);
        cache.put(req, res.clone());
        return res;
      } catch (e) {
        return new Response("", { status: 504 });
      }
    })());
    return;
  }
});
