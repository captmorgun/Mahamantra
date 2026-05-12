/* Service Worker — Mahamantra.online
   Стратегия: cache-first для статики, network-first для JSON */

const CACHE = "mahamantra-v9";
const STATIC = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/translations.json",
  "/icons/favicon-light.svg",
  "/icons/favicon-dark.svg",
  "/icons/ornament.png",
];

/* install: предзагрузка статики */
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

/* activate: чистим старые кэши */
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* fetch: cache-first */
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;

  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetched = fetch(e.request).then((resp) => {
        if (resp && resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => cached);

      return cached || fetched;
    })
  );
});
