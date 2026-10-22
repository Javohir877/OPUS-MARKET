// OPUS MARKET — service worker: ilova tez ochilishi va internet sekin/yo'q bo'lganda ham ishlashi uchun kesh.
// Sayt yangilanganda VERSION ni oshiring.
const VERSION = "opus-v1";
const CORE = [
  "./", "index.html", "styles.css", "data.js", "app.js", "showcase.js", "scrollfx.js",
  "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "img/hero.jpg", "img/deals.jpg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  // Sahifaning o'zi: avval internet (yangi versiya), bo'lmasa — kesh
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put("index.html", copy)); return res; })
        .catch(() => caches.match("index.html"))
    );
    return;
  }

  // Qolgan fayllar (CSS, JS, rasmlar, shriftlar, Three.js): keshdan darhol, fonda yangilanadi
  e.respondWith(
    caches.open(VERSION).then((cache) =>
      cache.match(req).then((hit) => {
        const net = fetch(req)
          .then((res) => { if (res.ok || res.type === "opaque") cache.put(req, res.clone()); return res; })
          .catch(() => hit);
        return hit || net;
      })
    )
  );
});
