// OPUS MARKET — service worker: ilova tez ochilishi va internet sekin/yo'q bo'lganda ham ishlashi uchun kesh.
// Sayt yangilanganda VERSION ni oshiring.
const VERSION = "opus-v29";
const CORE = [
  "./", "index.html", "styles.css", "sfx.js", "assets.js", "data.js", "app.js", "showcase.js", "scrollfx.js",
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
  const url = new URL(req.url);
  // Keshlanmaydi: admin panel, GitHub API va "nocache" so'rovlari — ular doim yangi bo'lishi kerak
  if (url.pathname.includes("/admin") || url.searchParams.has("nocache")) return;
  const CDN = ["fonts.googleapis.com", "fonts.gstatic.com", "cdnjs.cloudflare.com"];
  if (url.origin !== location.origin && !CDN.includes(url.hostname)) return;

  // Sahifaning o'zi: avval internet (yangi versiya), bo'lmasa — kesh
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put("index.html", copy)); return res; })
        .catch(() => caches.match("index.html"))
    );
    return;
  }

  // Saytning o'z kod fayllari (JS, CSS, manifest): avval internet — versiyalar aralashib ketmasligi uchun.
  // Internet bo'lmasa — keshdagi nusxa.
  if (url.origin === location.origin && /\.(js|css|webmanifest|json)$/.test(url.pathname)) {
    e.respondWith(
      fetch(req)
        .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; })
        .catch(() => caches.match(req).then((hit) => hit || caches.match(req, { ignoreSearch: true })))
    );
    return;
  }

  // Rasmlar, shriftlar, Three.js: keshdan darhol, fonda yangilanadi
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
