// ================= OPUS MARKET =================
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

// Ovoz effektlari (sfx.js). Fayl yuklanmagan bo'lsa ham sayt ishlayveradi.
const sfx = (name) => { try { window.SFX && window.SFX.play(name); } catch {} };

const store = {
  get(key, def) {
    try { const v = localStorage.getItem("opus_" + key); return v ? JSON.parse(v) : def; } catch { return def; }
  },
  set(key, val) {
    try { localStorage.setItem("opus_" + key, JSON.stringify(val)); } catch {}
  },
};

// Sozlamalar data.js dagi SETTINGS dan (admin panel tahrirlaydi)
// (serverdan yangi katalog kelganda applySettings() qayta hisoblaydi)
let PROMOS, FREE_SHIP_FROM, SHIP_PRICE;
function applySettings() {
  PROMOS = Object.fromEntries(Object.entries(SETTINGS.promos || {}).map(([k, v]) => [k.toUpperCase(), v / 100]));
  FREE_SHIP_FROM = SETTINGS.freeShipFrom;
  SHIP_PRICE = SETTINGS.shipPrice;
}
applySettings();

// ---------- Server API ----------
// Xatoda {error} matni bilan Error tashlaydi; err.status — HTTP holati (0 — tarmoq yo'q).
async function api(method, path, body) {
  let res;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(auth.token ? { Authorization: "Bearer " + auth.token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw Object.assign(new Error("Server bilan aloqa yo'q. Internetni tekshirib, qayta urinib ko'ring."), { status: 0 });
  }
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    if (res.status === 401 && auth.token && !path.startsWith("/api/auth/")) setAuth(null);
    throw Object.assign(new Error(data.error || "Xatolik yuz berdi (" + res.status + ")"), { status: res.status });
  }
  return data;
}
const auth = { token: store.get("token", null), user: store.get("user", null) };
// Telegram Mini App ichida ochilganmi (initData faqat Telegram ichida bo'ladi)
const TG = window.Telegram && Telegram.WebApp && Telegram.WebApp.initData ? Telegram.WebApp : null;
function setAuth(token, user) {
  auth.token = token || null;
  auth.user = token ? user : null;
  store.set("token", auth.token);
  store.set("user", auth.user);
  if (!token) state.orders = [];
  try { siteAlerts = null; siteMine = null; } catch (e) {}
  renderAccBtn();
}
// Reyting va sharhlar soni — serverdagi haqiqiy sharhlardan (katalogdagi qo'lda yozilgan sonlar ishlatilmaydi)
let RV = store.get("rv_summary", {});
function applyReviewStats() {
  PRODUCTS.forEach((p) => { const s = RV[p.id]; p.reviews = s ? s[0] : 0; p.rating = s ? s[1] : 0; });
}
applyReviewStats();
async function loadReviewStats() {
  try {
    const r = await api("GET", "/api/reviews/summary");
    RV = r.s || {}; store.set("rv_summary", RV);
    applyReviewStats(); renderProducts(); renderRecent();
  } catch {}
}
const ratingHTML = (p, long) => p.reviews
  ? `${stars(p.rating)} <small>${p.rating} ${long ? `· ${p.reviews} ta sharh` : `(${p.reviews})`}</small>`
  : `<small class="muted">☆ Hali baho yo'q</small>`;
const MONTHS = [3, 6, 12, 24];
const MAX_PRICE = 45000000;

const state = {
  cart: store.get("cart", []),          // [{id, qty}]
  orders: [],                           // serverdan (GET /api/orders)
  recent: store.get("recent", []),      // [id]
  compare: store.get("compare", []),    // [id], 3 tagacha, bitta kategoriyadan
  promo: store.get("promo", null),
  cat: "all",
  query: "",
  maxPrice: MAX_PRICE,
  sort: "popular",
  dealsOnly: false,
  months: 12,
};

const fmt = (n) => Math.round(n).toLocaleString("ru-RU").replace(/[\s,]/g, " ") + " so'm";
const byId = (id) => PRODUCTS.find((p) => p.id === id);
const catOf = (p) => CATEGORIES.find((c) => c.id === p.cat);
const payOf = (id) => PAYMENTS.find((p) => p.id === id);
const CMP_ICON = '<svg viewBox="0 0 24 24"><path d="M7 7h10.2l-2.6-2.6L16 3l5 5-5 5-1.4-1.4L17.2 9H7V7zm10 10H6.8l2.6 2.6L8 21l-5-5 5-5 1.4 1.4L6.8 15H17v2z"/></svg>';
const ORIG_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1l9 4v6c0 5.6-3.8 10.7-9 12-5.2-1.3-9-6.4-9-12V5l9-4zm-1.4 14.6l6.4-6.4-1.4-1.4-5 5-2.3-2.3-1.4 1.4 3.7 3.7z"/></svg>';
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const svgIcon = (name) => `<svg viewBox="0 0 24 24">${ICONS[name]}</svg>`;
const stars = (r) => "★".repeat(Math.round(r)) + "☆".repeat(5 - Math.round(r));
const discount = (p) => (p.old ? Math.round((1 - p.price / p.old) * 100) : 0);
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Fonsiz (studiya) rasmi bo'lsa — o'sha; ro'yxat katalog sozlamasida: SETTINGS.cutIds
const cutOf = (p) => (p && Array.isArray(SETTINGS.cutIds) && SETTINGS.cutIds.includes(p.id) ? "img/cut/p" + p.id + ".webp" : null);
const pImg = (p, w = 600, h) => cutOf(p) || IMG(p.img, w, h);
const img = (p, w, h, cls = "") =>
  `<img src="${pImg(p, w, h)}" alt="${escapeHtml(p.name)}" loading="lazy" class="${cls}" data-icon="${catOf(p).icon}" onload="this.classList.add('loaded')" onerror="imgFail(this)" />`;

// Rasm yuklanmasa — kategoriya ikonkasini ko'rsatamiz
window.imgFail = (el) => {
  const box = document.createElement("div");
  box.className = "img-fallback";
  box.innerHTML = svgIcon(el.dataset.icon || "laptop");
  el.replaceWith(box);
};

// ---------- Loader ----------
{
  // Birinchi kirishda — to'liq "yoqilish", shu seansda keyingi sahifa yangilanishlarida — tezkor
  let seen = false; try { seen = sessionStorage.getItem("opus_boot") === "1"; sessionStorage.setItem("opus_boot", "1"); } catch (e) {}
  const L = $("#loader"), pct = $("#ldPct"), dur = seen ? 500 : 1500, t0 = performance.now();
  if (seen) L.classList.add("quick");
  // 0 → 100% hisoblagich (sekinlashib boradi)
  (function step(t) {
    const k = Math.min(1, (t - t0) / dur);
    if (pct) pct.textContent = Math.round((1 - Math.pow(1 - k, 3)) * 100);
    if (k < 1) requestAnimationFrame(step);
  })(t0);
  setTimeout(() => { L.classList.add("hide"); setTimeout(() => L.remove(), 1000); }, dur + 120);
}

// ---------- Theme ----------
const applyTheme = (t) => { document.documentElement.dataset.theme = t; store.set("theme", t); };
applyTheme(store.get("theme", "dark")); // asosiy dizayn — to'q (grafit)
$("#themeBtn").addEventListener("click", () => { applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"); sfx("toggle"); });
// Ovoz sozlamalari: yoqish/o'chirish, balandlik, telefonda tebranish
(() => {
  const btn = $("#soundBtn");
  if (!window.SFX) { btn.hidden = true; return; }
  const pop = document.createElement("div");
  pop.className = "sp-pop"; pop.hidden = true;
  pop.innerHTML = `<b>Ovoz effektlari</b>
    <label class="sp-row"><span>Ovoz</span><input type="checkbox" id="spOn" class="sp-switch" data-sfx="none" /></label>
    <label class="sp-row sp-vol"><span>Balandlik</span><input type="range" id="spVol" min="0" max="100" step="5" /></label>
    ${SFX.canVibrate ? `<label class="sp-row"><span>Tebranish (telefon)</span><input type="checkbox" id="spHap" class="sp-switch" data-sfx="none" /></label>` : ""}
    <div class="sp-test"><button type="button" data-sfx="none" data-try="add">🛒</button><button type="button" data-sfx="none" data-try="success">🎉</button><button type="button" data-sfx="none" data-try="notify">🔔</button><button type="button" data-sfx="none" data-try="error">⚠️</button></div>`;
  btn.parentElement.appendChild(pop);
  const sync = () => {
    $("#spOn").checked = SFX.on; $("#spVol").value = Math.round(SFX.volume * 100);
    $("#spVol").disabled = !SFX.on; if ($("#spHap")) $("#spHap").checked = SFX.haptic;
  };
  btn.addEventListener("click", (e) => { e.stopPropagation(); sync(); pop.hidden = !pop.hidden; sfx(pop.hidden ? "close" : "open"); });
  document.addEventListener("click", (e) => { if (!pop.hidden && !pop.contains(e.target) && e.target !== btn) pop.hidden = true; });
  $("#spOn").addEventListener("change", (e) => { SFX.setOn(e.target.checked); sync(); });
  $("#spVol").addEventListener("change", () => SFX.play("notify"));
  $("#spVol").addEventListener("input", (e) => SFX.setVolume(e.target.value / 100));
  $("#spHap")?.addEventListener("change", (e) => SFX.setHaptic(e.target.checked));
  pop.addEventListener("click", (e) => { const t = e.target.closest("[data-try]"); if (t) SFX.play(t.dataset.try); });
})();

// ---------- Header ----------
const header = $("#header");
const toTop = $("#toTop");
window.addEventListener("scroll", () => {
  header.classList.toggle("scrolled", scrollY > 40);
  toTop.classList.toggle("show", scrollY > 600);
}, { passive: true });
toTop.addEventListener("click", () => scrollTo({ top: 0 }));
$("#burger").addEventListener("click", () => $("#nav").classList.toggle("open"));
$$("#nav a").forEach((a) => a.addEventListener("click", () => $("#nav").classList.remove("open")));
// Telefonda sarlavhadan menyuga ko'chirilgan tugmalar
$$("[data-proxy]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); $("#nav").classList.remove("open"); $("#" + b.dataset.proxy).click(); }));

// ---------- Menyu animatsiyasi: suzuvchi kapsula + aylanuvchi matn + hozirgi bo'lim ----------
(() => {
  const nav = $("#nav");
  const links = $$("a", nav);
  links.forEach((a, i) => {
    const t = a.textContent.trim();
    a.innerHTML = `<span class="nl"><span data-t="${esc(t)}">${esc(t)}</span></span>`;
    a.style.setProperty("--i", i);
  });
  const glider = document.createElement("span");
  glider.className = "nav-glider";
  nav.prepend(glider);

  let active = null;
  const moveTo = (a) => {
    if (!a || getComputedStyle(glider).display === "none") { nav.classList.remove("glide"); return; }
    glider.style.width = a.offsetWidth + "px";
    glider.style.transform = `translateX(${a.offsetLeft}px)`;
    nav.classList.add("glide");
  };
  links.forEach((a) => a.addEventListener("mouseenter", () => moveTo(a)));
  nav.addEventListener("mouseleave", () => moveTo(active));

  // Sahifa aylantirilganda — qaysi bo'lim ko'rinib turgan bo'lsa, kapsula o'sha havolada turadi
  const map = new Map(links.map((a) => [a.getAttribute("href").slice(1), a]).filter(([id]) => document.getElementById(id)));
  const vis = new Map();
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((e) => vis.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0));
    let best = null, ratio = 0;
    vis.forEach((r, id) => { if (r > ratio) { ratio = r; best = id; } });
    const next = best ? map.get(best) : null;
    if (next === active) return;
    links.forEach((a) => a.classList.toggle("active", a === next));
    active = next;
    if (!nav.matches(":hover")) moveTo(active);
  }, { threshold: [0, 0.15, 0.35, 0.6], rootMargin: "-80px 0px -35% 0px" });
  map.forEach((_, id) => spy.observe(document.getElementById(id)));
  addEventListener("resize", () => moveTo(active));
})();
$("#year").textContent = new Date().getFullYear();

// ---------- Hero ----------

$("#dealsImg").style.backgroundImage = "url(img/deals.jpg)";

// Hero: flagman mahsulotlar almashib turadi (katta foto + narx kartochkasi)
const heroFx = { i: 0, t: null, ids: [] };
// Foto orqasidagi katta xira yozuv: model nomi (RTX 5090, MacBook Pro...) yoki brend
const heroWord = (p) => {
  const m = String(p.name).match(/\b(RTX|RX|GTX)\s?\d{3,4}|MacBook\s\w+|iMac|ROG\s\w+|Legion|ThinkPad|XPS|Odyssey|UltraGear/i);
  return (m ? m[0] : p.brand || "OPUS").toUpperCase();
};
function renderHero() {
  const box = $("#phSlides"), dots = $("#phDots");
  if (!box) return;
  const pick = (cat) => PRODUCTS.filter((p) => p.cat === cat && (p.stock ?? 0) > 0).sort((x, y) => (y.popular || 0) - (x.popular || 0) || y.price - x.price)[0];
  const CUT = SETTINGS.heroCuts || {};
  const cut = PRODUCTS.filter((p) => CUT[p.id] && (p.stock ?? 0) > 0).sort((x, y) => y.price - x.price);
  const L = (cut.length >= 2 ? cut : ["parts", "laptop", "pc", "monitor", "audio"].map(pick).filter(Boolean)).slice(0, 4);
  const ids = L.map((p) => p.id).join(",");
  if (ids === heroFx.ids.join(",")) return;
  heroFx.ids = L.map((p) => p.id); heroFx.i = 0;
  box.innerHTML = L.map((p, i) => `<button class="ph-slide${i ? "" : " on"}" data-hp="${p.id}" aria-label="${esc(p.name)}">
      <span class="ph-word" aria-hidden="true">${esc(heroWord(p))}</span>
      <span class="ph-obj${CUT[p.id] ? " cut" : ""}"><img src="${CUT[p.id] ? IMG(CUT[p.id]) : pImg(p, 1000)}" alt="" ${i ? 'loading="lazy"' : ""} onerror="imgFail(this)" data-icon="${esc((catOf(p) || {}).icon || "laptop")}" /></span>
      <span class="ph-bar"><span><small>${esc((catOf(p) || {}).name || "")}</small><b>${esc(p.name)}</b></span><em>${fmt(p.price)}${p.old > p.price ? ` <s>${fmt(p.old)}</s>` : ""}</em><i class="ph-go">Ko'rish →</i></span>
    </button>`).join("");
  dots.innerHTML = L.map((_, i) => `<button class="${i ? "" : "on"}" data-hd="${i}" aria-label="${i + 1}-mahsulot"></button>`).join("");
  clearInterval(heroFx.t);
  if (L.length > 1) heroFx.t = setInterval(() => { if (!document.hidden) heroGo(heroFx.i + 1); }, 5200);
}
function heroGo(n) {
  const S = $$("#phSlides .ph-slide"), D = $$("#phDots button");
  if (!S.length) return;
  heroFx.i = (n + S.length) % S.length;
  S.forEach((x, k) => x.classList.toggle("on", k === heroFx.i));
  D.forEach((x, k) => x.classList.toggle("on", k === heroFx.i));
}
$("#phVisual") && $("#phVisual").addEventListener("click", (e) => {
  const d = e.target.closest("[data-hd]");
  if (d) { heroGo(+d.dataset.hd); clearInterval(heroFx.t); return; }
  const s = e.target.closest("[data-hp]");
  if (s) openProduct(+s.dataset.hp);
});
renderHero();
setTimeout(() => $$(".hero [data-count]").forEach(countUp), 400);

// ---------- Reveal + counters ----------
const io = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (!en.isIntersecting) return;
    en.target.classList.add("visible");
    $$("[data-count]", en.target).forEach(countUp);
    io.unobserve(en.target);
  });
}, { threshold: 0.12 });
$$(".reveal").forEach((el, i) => { el.style.setProperty("--rd", (i % 4) * 0.07 + "s"); io.observe(el); });
// Animatsiya tugagach — kesish (clip) butunlay olib tashlanadi, soyalar va hover effektlari kesilmaydi
document.addEventListener("animationend", (e) => { if (e.animationName === "scanIn") e.target.classList.add("done"); });

function countUp(el) {
  // Haqiqiy katalogdan: mahsulotlar va brendlar soni
  if (el.dataset.live === "products") el.dataset.count = PRODUCTS.length;
  if (el.dataset.live === "brands") el.dataset.count = new Set(PRODUCTS.map((p) => p.brand)).size;
  const target = +el.dataset.count;
  const start = performance.now();
  const dur = 1600;
  (function step(t) {
    const k = Math.min((t - start) / dur, 1);
    el.textContent = Math.floor(target * (1 - Math.pow(1 - k, 3))).toLocaleString("ru-RU");
    if (k < 1) requestAnimationFrame(step);
  })(start);
}

// ---------- Countdown ----------
(() => {
  let end = store.get("dealEnd", 0);
  if (!end || end < Date.now()) { end = Date.now() + 3 * 864e5 + 7 * 36e5; store.set("dealEnd", end); }
  const pad = (n) => String(n).padStart(2, "0");
  const set = (id, v) => {
    const el = $(id);
    if (el.textContent === v) return;
    el.textContent = v;
    el.classList.remove("tick"); void el.offsetWidth; el.classList.add("tick");
  };
  const tick = () => {
    const d = Math.max(0, end - Date.now());
    set("#cdD", pad(Math.floor(d / 864e5)));
    set("#cdH", pad(Math.floor((d / 36e5) % 24)));
    set("#cdM", pad(Math.floor((d / 6e4) % 60)));
    set("#cdS", pad(Math.floor((d / 1e3) % 60)));
  };
  tick(); setInterval(tick, 1000);
})();

$("#copyPromo").addEventListener("click", () => {
  navigator.clipboard?.writeText("OPUS10").catch(() => {});
  toast("📋 OPUS10 nusxalandi — savatda qo'llang");
});

// ---------- Payments ----------
const payLogo = (p) => `<span class="pay-logo" title="${p.name}">${p.svg}</span>`;
function renderPayments() {
  $("#payStrip").innerHTML = PAYMENTS.map((p) => `<div class="pay-tile">${payLogo(p)}<small>${p.note}</small></div>`).join("");
  $("#footerPay").innerHTML = PAYMENTS.map(payLogo).join("");
  $("#miniPay").innerHTML = PAYMENTS.slice(0, 7).map(payLogo).join("");
  $("#payGrid").innerHTML = PAYMENTS.map((p, i) => `<label class="rcard">
      <input type="radio" name="payment" value="${p.id}" ${i === 0 ? "checked" : ""} />
      <span>${payLogo(p)}<b>${p.name}</b><small>${p.note}</small></span>
    </label>`).join("");
}

// ---------- Categories ----------
// ---------- Rasmdan asosiy rangni aniqlash ----------
// Rasm 40×40 ga kichraytiriladi, piksellar 12 ta rang guruhiga (har 30°) bo'linadi va eng "yorqin"
// ko'p uchraydigan guruh tanlanadi (juda oq/qora/kulranglar hisobga olinmaydi). Rang so'ng chiroyli
// to'yinganlikka keltiriladi. Qaytaradi: { tint: "r, g, b", deep: "r, g, b" } (deep — to'qroq soya uchun).
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslToRgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
}
function imageTint(img) {
  try {
    const S = 40, c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0, S, S);
    const px = g.getImageData(0, 0, S, S).data;
    const buckets = Array.from({ length: 12 }, () => ({ w: 0, h: 0, s: 0, l: 0 }));
    let ar = 0, ag = 0, ab = 0, n = 0;
    for (let i = 0; i < px.length; i += 4) {
      const [h, s, l] = rgbToHsl(px[i], px[i + 1], px[i + 2]);
      ar += px[i]; ag += px[i + 1]; ab += px[i + 2]; n++;
      if (l < 0.1 || l > 0.93 || s < 0.22) continue;
      // To'yinganlik kvadrati — yorqin ranglar (RGB yoritgich, logotip) xira fondan ustun turadi
      const w = s * s * (1 - Math.abs(2 * l - 1));
      const b = buckets[Math.floor(h / 30) % 12];
      b.w += w; b.h += h * w; b.s += s * w; b.l += l * w;
    }
    const best = buckets.reduce((a, b) => (b.w > a.w ? b : a));
    let h, s;
    if (best.w > 2.5) { h = best.h / best.w; s = Math.max(0.6, best.s / best.w); }
    else { [h, s] = rgbToHsl(ar / n, ag / n, ab / n); s = Math.min(s, 0.18); } // deyarli rangsiz rasm — yumshoq kulrang
    return { tint: hslToRgb(h, s, 0.52).join(", "), deep: hslToRgb(h, Math.min(1, s * 0.9), 0.16).join(", ") };
  } catch { return null; }
}

// =====================================================================
// Katalog: kategoriya plitkalari + chap filtr paneli (narx, brend, tezkor belgilar, kategoriyaga xos filtrlar)
// Har bir filtr yonida — shu tanlov bilan nechta mahsulot qolishi. Holat manzilga (?cat=&brand=...) yoziladi.
// =====================================================================
state.brands = new Set();
state.minPrice = 0;
state.flags = { stock: false, deal: false, orig: false, new: false };
state.facets = {}; // { "Operativ xotira": Set(["16GB"]) }
const FLAG_LABEL = { stock: "Omborda bor", deal: "Chegirmada", orig: "Original", new: "Yangi" };
const SORTS = [["popular", "Ommabop"], ["new", "Yangi"], ["cheap", "Arzonroq"], ["expensive", "Qimmatroq"], ["discount", "Chegirma"]];
const PRICE_PRESETS = [[0, 5e6, "5 mln gacha"], [5e6, 15e6, "5–15 mln"], [15e6, 30e6, "15–30 mln"], [30e6, MAX_PRICE, "30 mln+"]];
const mln = (n) => (n >= 1e6 ? (Math.round(n / 1e5) / 10 + "").replace(".", ",") + " mln" : Math.round(n / 1e3) + " ming");

// Xususiyat qiymatini filtr uchun qisqa ko'rinishga keltirish ("16GB DDR5 6000" → "16GB")
function facetVal(p, key) {
  const v = (p.specs || {})[key];
  if (v == null) return null;
  const s = String(v), k = key.toLowerCase();
  let m;
  if (/xotira|ram/.test(k) && (m = s.match(/(\d+)\s?(GB|TB)/i))) return m[1] + m[2].toUpperCase();
  if (/videokarta|grafika|gpu/.test(k)) { m = s.match(/(RTX|GTX|RX|Arc)\s?[A-Z]?\d{3,4}(\s?(Ti|Super|XT|XTX))*/i); return m ? m[0].replace(/\s+/g, " ").toUpperCase().replace("SUPER", "Super") : /intel|uhd|iris|vega|ichki|integr|gpu/i.test(s) ? "Ichki grafika" : s.split(/[,(]/)[0].trim().slice(0, 22); }
  if (/protsessor|cpu/.test(k)) { m = s.match(/(Core\s?(Ultra\s?)?i?\d|Ryzen\s?\d|Apple\s?M\d(\s?(Pro|Max|Ultra))?|Xeon|Celeron|Pentium|Snapdragon)/i); return m ? m[0].replace(/\s+/g, " ").replace(/^core/i, "Core").replace(/^ryzen/i, "Ryzen") : s.split(/[,(]/)[0].trim().slice(0, 22); }
  if ((m = s.match(/(\d{2}(?:[.,]\d)?)\s?["”]/))) return m[1].replace(",", ".") + '"';
  if ((m = s.match(/(\d{2,3})\s?Hz/i))) return m[1] + " Hz";
  return s.split(/[,(]/)[0].trim().slice(0, 24) || null;
}
// Kategoriyaga xos filtrlar: ko'p mahsulotda bor, 2–9 xil qiymatli xususiyatlar (eng ko'pi 4 ta)
function facetKeys(list) {
  if (state.cat === "all" || list.length < 4) return [];
  const cnt = {};
  list.forEach((p) => Object.keys(p.specs || {}).forEach((k) => (cnt[k] = (cnt[k] || 0) + 1)));
  const PRI = ["Protsessor", "Videokarta", "Grafika", "Operativ xotira", "Xotira", "Displey", "Ekran", "Chastota"];
  return Object.keys(cnt)
    .filter((k) => cnt[k] >= list.length * 0.4)
    .map((k) => ({ k, vals: new Set(list.map((p) => facetVal(p, k)).filter(Boolean)) }))
    .filter((x) => x.vals.size >= 2 && x.vals.size <= 9)
    .sort((a, b) => (PRI.indexOf(a.k) + 1 || 99) - (PRI.indexOf(b.k) + 1 || 99))
    .slice(0, 4).map((x) => x.k);
}
// skip — sanash uchun shu filtrni hisobga olmaymiz (masalan, brend yonidagi sonlar)
function baseList(skip) {
  const deal = state.flags.deal || state.dealsOnly;
  return search(state.query).filter((p) =>
    (skip === "cat" || state.cat === "all" || p.cat === state.cat) &&
    (skip === "price" || (p.price >= state.minPrice && (state.maxPrice >= MAX_PRICE || p.price <= state.maxPrice))) &&
    (skip === "brand" || !state.brands.size || state.brands.has(p.brand)) &&
    (skip === "stock" || !state.flags.stock || (p.stock ?? 0) > 0) &&
    (skip === "deal" || !deal || p.old > p.price) &&
    (skip === "orig" || !state.flags.orig || p.original !== false) &&
    (skip === "new" || !state.flags.new || p.badge === "Yangi") &&
    Object.entries(state.facets).every(([k, set]) => skip === "f:" + k || !set.size || set.has(facetVal(p, k))));
}
function filtered() {
  const list = baseList();
  const sorters = {
    popular: (a, b) => b.popular - a.popular,
    new: (a, b) => b.id - a.id,
    cheap: (a, b) => a.price - b.price,
    expensive: (a, b) => b.price - a.price,
    rating: (a, b) => b.rating - a.rating,
    discount: (a, b) => discount(b) - discount(a),
  };
  if (state.query.trim() && state.sort === "popular") return list;
  return list.sort(sorters[state.sort] || sorters.popular);
}
const activeCount = () => state.brands.size + Object.values(state.flags).filter(Boolean).length + (state.dealsOnly && !state.flags.deal ? 1 : 0)
  + Object.values(state.facets).reduce((a, s) => a + s.size, 0) + (state.minPrice > 0 || state.maxPrice < MAX_PRICE ? 1 : 0);

// ---------- Kategoriya plitkalari ----------
function renderCategories() {
  const grid = $("#catGrid");
  if (grid) {
    grid.innerHTML = CATEGORIES.map((c) => {
      const n = PRODUCTS.filter((p) => p.cat === c.id).length;
      return `<div class="cat reveal${state.cat === c.id ? " on" : ""}" data-cat="${esc(c.id)}">
        <img src="${IMG(c.img, 500, 360)}" alt="${esc(c.name)}" loading="lazy" />
        <span class="cat-ic">${svgIcon(c.icon)}</span>
        <div><h4>${esc(c.name)}</h4><small>${n} ta mahsulot</small></div>
        <span class="cat-arrow">→</span>
      </div>`;
    }).join("");
    $$("#catGrid .cat").forEach((el) => {
      io.observe(el);
      const im = $("img", el);
      const apply = () => { const t = imageTint(im); if (t) { el.style.setProperty("--tint", t.tint); el.style.setProperty("--tint-deep", t.deep); el.classList.add("tinted"); } };
      if (im.complete && im.naturalWidth) apply(); else im.addEventListener("load", apply, { once: true });
    });
  }
  renderFilters();
}
function setCat(cat) {
  if (state.cat !== cat) state.facets = {};
  state.cat = cat;
  state.dealsOnly = false;
  $$("#catGrid .cat").forEach((b) => b.classList.toggle("on", b.dataset.cat === cat));
  renderProducts();
}
$("#catGrid").addEventListener("click", (e) => {
  const b = e.target.closest("[data-cat]"); if (!b) return;
  sfx("tap");
  setCat(b.dataset.cat);
  $("#products").scrollIntoView({ behavior: "smooth", block: "start" });
});


// ---------- Filtr paneli ----------
let brandQ = "", brandsOpen = false;
function renderFilters() {
  const side = $("#fltBody"); if (!side) return;
  const inCat = baseList("brand");
  // Brendlar (soni bilan) — joriy boshqa filtrlar bo'yicha
  const bc = {};
  inCat.forEach((p) => (bc[p.brand] = (bc[p.brand] || 0) + 1));
  const allBrands = [...new Set(PRODUCTS.filter((p) => state.cat === "all" || p.cat === state.cat).map((p) => p.brand))]
    .sort((a, b) => (bc[b] || 0) - (bc[a] || 0) || a.localeCompare(b));
  const bl = allBrands.filter((b) => !brandQ || b.toLowerCase().includes(brandQ.toLowerCase()));
  const shownB = brandsOpen || brandQ ? bl : bl.slice(0, 8);
  const flagN = (f) => baseList(f).filter((p) => f === "stock" ? (p.stock ?? 0) > 0 : f === "deal" ? p.old > p.price : f === "orig" ? p.original !== false : p.badge === "Yangi").length;
  const keys = facetKeys(PRODUCTS.filter((p) => p.cat === state.cat));
  const prices = baseList("price").map((p) => p.price);
  const hi = Math.max(1e6, ...PRODUCTS.map((p) => p.price));
  side.innerHTML = `
    <div class="fl-sec">
      <h5>Narx, so'm</h5>
      <div class="fl-range"><input type="number" inputmode="numeric" id="flMin" placeholder="dan" value="${state.minPrice || ""}" /><span>—</span><input type="number" inputmode="numeric" id="flMax" placeholder="gacha" value="${state.maxPrice < MAX_PRICE ? state.maxPrice : ""}" /></div>
      <div class="fl-dual" style="--a:${(state.minPrice / hi) * 100}%;--b:${(state.maxPrice >= MAX_PRICE ? 100 : (Math.min(state.maxPrice, hi) / hi) * 100)}%">
        <i></i><input type="range" id="flA" min="0" max="${hi}" step="100000" value="${state.minPrice}" aria-label="Eng kam narx" /><input type="range" id="flB" min="0" max="${hi}" step="100000" value="${state.maxPrice >= MAX_PRICE ? hi : Math.min(state.maxPrice, hi)}" aria-label="Eng yuqori narx" />
      </div>
      <div class="fl-pre">${PRICE_PRESETS.map(([a, b, t]) => { const n = prices.filter((x) => x >= a && x <= b).length; const on = state.minPrice === a && (b >= MAX_PRICE ? state.maxPrice >= MAX_PRICE : state.maxPrice === b); return `<button type="button" class="${on ? "on" : ""}" data-pp="${a}:${b}" ${n ? "" : "disabled"}>${t}<em>${n}</em></button>`; }).join("")}</div>
    </div>
    <div class="fl-sec">
      <h5>Tezkor</h5>
      ${Object.keys(FLAG_LABEL).map((f) => { const n = flagN(f), on = state.flags[f] || (f === "deal" && state.dealsOnly); return `<label class="fl-sw${n || on ? "" : " off"}"><input type="checkbox" data-flag="${f}" ${on ? "checked" : ""} /><span class="fl-tg"></span><span>${FLAG_LABEL[f]}</span><em>${n}</em></label>`; }).join("")}
    </div>
    <div class="fl-sec">
      <h5>Brend <small>${allBrands.length}</small></h5>
      ${allBrands.length > 8 ? `<input class="fl-search" id="flBrandQ" placeholder="Brend qidirish…" value="${esc(brandQ)}" />` : ""}
      <div class="fl-list" id="flBrands">${shownB.map((b) => { const n = bc[b] || 0, on = state.brands.has(b); return `<label class="fl-ck${n || on ? "" : " off"}"><input type="checkbox" data-brand="${esc(b)}" ${on ? "checked" : ""} /><span class="fl-box"></span><span>${esc(b)}</span><em>${n}</em></label>`; }).join("") || `<p class="fl-none">Topilmadi</p>`}</div>
      ${!brandQ && bl.length > 8 ? `<button type="button" class="fl-more" data-bmore>${brandsOpen ? "Yig'ish" : `Yana ${bl.length - 8} ta`}</button>` : ""}
    </div>
    ${keys.map((k) => {
      const base = baseList("f:" + k), c = {};
      base.forEach((p) => { const v = facetVal(p, k); if (v) c[v] = (c[v] || 0) + 1; });
      const vals = [...new Set(PRODUCTS.filter((p) => p.cat === state.cat).map((p) => facetVal(p, k)).filter(Boolean))]
        .sort((a, b) => (parseFloat(a) && parseFloat(b) ? parseFloat(a) - parseFloat(b) : (c[b] || 0) - (c[a] || 0)));
      const set = state.facets[k] || new Set();
      return `<div class="fl-sec"><h5>${esc(k)}</h5><div class="fl-tags">${vals.map((v) => `<button type="button" class="${set.has(v) ? "on" : ""}" data-fk="${esc(k)}" data-fv="${esc(v)}" ${c[v] || set.has(v) ? "" : "disabled"}>${esc(v)}<em>${c[v] || 0}</em></button>`).join("")}</div></div>`;
    }).join("")}`;
  // Yuqori panel: tanlangan filtrlar chiplari
  const chips = [];
  if (state.minPrice > 0 || state.maxPrice < MAX_PRICE) chips.push([`${state.minPrice ? mln(state.minPrice) : "0"} – ${state.maxPrice < MAX_PRICE ? mln(state.maxPrice) : "∞"}`, "price"]);
  Object.keys(state.flags).forEach((f) => state.flags[f] && chips.push([FLAG_LABEL[f], "flag:" + f]));
  if (state.dealsOnly && !state.flags.deal) chips.push(["Chegirmada", "flag:deal"]);
  state.brands.forEach((b) => chips.push([b, "brand:" + b]));
  Object.entries(state.facets).forEach(([k, s]) => s.forEach((v) => chips.push([v, "f:" + k + "\u0000" + v])));
  const cat = state.cat === "all" ? null : CATEGORIES.find((c) => c.id === state.cat);
  $("#fltChips").innerHTML = (cat ? `<button type="button" class="fc fc-cat" data-rm="cat">${svgIcon(cat.icon)}${esc(cat.name)}<i>✕</i></button>` : "")
    + chips.map(([t, k]) => `<button type="button" class="fc" data-rm="${esc(k)}">${esc(t)}<i>✕</i></button>`).join("")
    + (chips.length || cat ? `<button type="button" class="fc-clear" data-clear>Hammasini tozalash</button>` : "");
  const n = activeCount();
  $("#fltCount").textContent = n || "";
  $("#fltOpen em").textContent = n ? n : "";
  $$("#sortPills button").forEach((b) => b.classList.toggle("on", b.dataset.sort === state.sort));
  syncURL();
}
function syncURL() {
  const q = new URLSearchParams(location.search);
  ["cat", "brand", "min", "max", "f", "sort", "flags"].forEach((k) => q.delete(k));
  if (state.cat !== "all") q.set("cat", state.cat);
  if (state.brands.size) q.set("brand", [...state.brands].join(","));
  if (state.minPrice > 0) q.set("min", state.minPrice);
  if (state.maxPrice < MAX_PRICE) q.set("max", state.maxPrice);
  const fl = Object.keys(state.flags).filter((f) => state.flags[f]); if (fl.length) q.set("flags", fl.join(","));
  const fs = Object.entries(state.facets).filter(([, s]) => s.size).map(([k, s]) => k + ":" + [...s].join("|")); if (fs.length) q.set("f", fs.join(";"));
  if (state.sort !== "popular") q.set("sort", state.sort);
  const s = q.toString();
  history.replaceState(history.state, "", location.pathname + (s ? "?" + s : "") + location.hash);
}
(function readURL() {
  const q = new URLSearchParams(location.search);
  if (q.get("cat") && CATEGORIES.some((c) => c.id === q.get("cat"))) state.cat = q.get("cat");
  (q.get("brand") || "").split(",").filter(Boolean).forEach((b) => state.brands.add(b));
  if (+q.get("min")) state.minPrice = +q.get("min");
  if (+q.get("max")) state.maxPrice = +q.get("max");
  (q.get("flags") || "").split(",").forEach((f) => { if (f in state.flags) state.flags[f] = true; });
  (q.get("f") || "").split(";").filter(Boolean).forEach((x) => { const i = x.indexOf(":"); if (i > 0) state.facets[x.slice(0, i)] = new Set(x.slice(i + 1).split("|")); });
  if (SORTS.some(([k]) => k === q.get("sort"))) state.sort = q.get("sort");
})();

let fltT;
const refilter = (now) => { clearTimeout(fltT); fltT = setTimeout(() => renderProducts(), now ? 0 : 140); };
const fltPanel = $("#fltPanel");
fltPanel.addEventListener("click", (e) => {
  const pp = e.target.closest("[data-pp]");
  if (pp) { const [a, b] = pp.dataset.pp.split(":").map(Number); const on = pp.classList.contains("on"); state.minPrice = on ? 0 : a; state.maxPrice = on ? MAX_PRICE : b; return refilter(true); }
  const fk = e.target.closest("[data-fk]");
  if (fk) { const k = fk.dataset.fk, v = fk.dataset.fv, s = state.facets[k] || (state.facets[k] = new Set()); s.has(v) ? s.delete(v) : s.add(v); return refilter(true); }
  if (e.target.closest("[data-bmore]")) { brandsOpen = !brandsOpen; return renderFilters(); }
  if (e.target.closest("[data-fclear]")) return clearFilters();
  if (e.target.closest("[data-fclose]")) return closeFilters();
});
fltPanel.addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset.flag) { state.flags[t.dataset.flag] = t.checked; if (t.dataset.flag === "deal" && !t.checked) state.dealsOnly = false; return refilter(true); }
  if (t.dataset.brand) { t.checked ? state.brands.add(t.dataset.brand) : state.brands.delete(t.dataset.brand); return refilter(true); }
  if (t.id === "flMin" || t.id === "flMax") { state.minPrice = Math.max(0, +$("#flMin").value || 0); state.maxPrice = +$("#flMax").value > 0 ? +$("#flMax").value : MAX_PRICE; return refilter(true); }
});
fltPanel.addEventListener("input", (e) => {
  const t = e.target;
  if (t.id === "flBrandQ") {
    brandQ = t.value; const pos = t.selectionStart;
    renderFilters(); const ni = $("#flBrandQ"); if (ni) { ni.focus(); ni.setSelectionRange(pos, pos); }
    return;
  }
  if (t.id === "flA" || t.id === "flB") {
    let a = +$("#flA").value, b = +$("#flB").value;
    if (a > b) [a, b] = t.id === "flA" ? [b, b] : [a, a];
    const hi = +t.max;
    state.minPrice = a; state.maxPrice = b >= hi ? MAX_PRICE : b;
    t.parentElement.style.setProperty("--a", (a / hi) * 100 + "%"); t.parentElement.style.setProperty("--b", (b / hi) * 100 + "%");
    $("#flMin").value = a || ""; $("#flMax").value = b >= hi ? "" : b;
    clearTimeout(fltT); fltT = setTimeout(() => renderProducts(), 220);
  }
});
$("#fltChips").addEventListener("click", (e) => {
  if (e.target.closest("[data-clear]")) return clearFilters(true);
  const r = e.target.closest("[data-rm]"); if (!r) return;
  const k = r.dataset.rm;
  if (k === "cat") return setCat("all");
  if (k === "price") { state.minPrice = 0; state.maxPrice = MAX_PRICE; }
  else if (k.startsWith("flag:")) { const f = k.slice(5); state.flags[f] = false; if (f === "deal") state.dealsOnly = false; }
  else if (k.startsWith("brand:")) state.brands.delete(k.slice(6));
  else if (k.startsWith("f:")) { const [fk, v] = k.slice(2).split("\u0000"); state.facets[fk] && state.facets[fk].delete(v); }
  refilter(true);
});
$("#sortPills").addEventListener("click", (e) => { const b = e.target.closest("[data-sort]"); if (b) { state.sort = b.dataset.sort; sfx("tap"); refilter(true); } });
function clearFilters(withCat) {
  state.brands.clear(); state.minPrice = 0; state.maxPrice = MAX_PRICE; state.dealsOnly = false;
  Object.keys(state.flags).forEach((f) => (state.flags[f] = false)); state.facets = {}; brandQ = "";
  if (withCat) state.cat = "all";
  renderCategories(); renderProducts();
}
// Telefonda: filtr paneli pastdan chiqadigan oyna
function openFilters() { fltPanel.classList.add("open"); document.body.classList.add("lock"); $("#fltShade").classList.add("show"); }
function closeFilters() { fltPanel.classList.remove("open"); document.body.classList.remove("lock"); $("#fltShade").classList.remove("show"); }
$("#fltOpen").addEventListener("click", openFilters);
$("#fltShade").addEventListener("click", closeFilters);
$("#fltApply").addEventListener("click", () => { closeFilters(); $("#products").scrollIntoView({ behavior: "smooth" }); });
$("#sortPills").innerHTML = SORTS.map(([k, t]) => `<button type="button" data-sort="${k}" class="${state.sort === k ? "on" : ""}">${t}</button>`).join("");


// ---------- Products ----------
const haystack = (p) => (p.name + " " + p.brand + " " + ((catOf(p) || {}).name || "") + " " + Object.values(p.specs || {}).join(" ")).toLowerCase();
// Aqlli qidiruv (ilova bilan bir xil): kirill → lotin, ruscha/o'zbekcha sinonimlar, xato yozuvga chidamlilik, "5 mln gacha"
const CYR = { а: "a", б: "b", в: "v", г: "g", ғ: "g'", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y", к: "k", қ: "q", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ў: "o'", ф: "f", х: "x", ҳ: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya" };
const normQ = (s) => String(s).toLowerCase().replace(/[а-яёғқўҳ]/g, (c) => CYR[c] ?? c).replace(/[ʻʼ`’‘]/g, "'").replace(/\s+/g, " ").trim();
const SYN = [
  [/^(nout|notebook|laptop|noutbuk)/, { cat: "laptop" }], [/^(mish|mouse|sichqon)/, { cat: "mouse" }], [/^(klav|keyboard)/, { cat: "keyboard" }],
  [/^(monitor|ekran|display)/, { cat: "monitor" }], [/^(naush|quloq|headphone|headset|garnit)/, { cat: "audio" }], [/^(kompyut|komp$|pc$|sistem)/, { cat: "pc" }],
  [/^(igr|o'yin|oyin|gaming|geym)/, { cat: "gaming" }], [/^(disk|ssd|hdd|nakopit|xotira|fleshk)/, { cat: "storage" }],
  [/^(videokart|gpu|vidyuxa|grafik)/, { kw: /rtx|gtx|radeon|geforce/ }], [/^(protsess|protses|cpu|prosessor)/, { kw: /ryzen|core i\d|xeon/ }],
  [/^(operativ|ram$|ozu|operativka)/, { kw: /ddr\d/ }], [/^(blok|psu|pitan)/, { kw: /\d{3,4}\s?w\b/ }],
];
function lev(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let best = i;
    for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); best = Math.min(best, cur[j]); }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
function search(q0) {
  let q = normQ(q0 || ""), min = null, max = null, cheap = false;
  if (!q) return PRODUCTS.slice();
  const num = (v, u) => +v.replace(",", ".") * (/^m/.test(u) ? 1e6 : 1e3);
  q = q.replace(/(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)\s*(mln|million|m|ming|k|tys)\b/, (_, a, b, u) => { min = num(a, u); max = num(b, u); return " "; });
  q = q.replace(/(?:do\s+)?(\d+(?:[.,]\d+)?)\s*(mln|million|m|ming|k|tys)\b\s*(gacha|dan|do)?/, (_, v, u, w) => { if (w === "dan") min = num(v, u); else max = num(v, u); return " "; });
  q = q.replace(/\b(arzon|deshev|cheap|byudjet)\w*/, () => { cheap = true; return " "; });
  const rules = q.split(" ").filter((w) => w && !/^(va|uchun|bilan|dlya|i|na|the|for)$/.test(w)).map((w) => { const s = SYN.find(([re]) => re.test(w)); return { w, s: s && s[1] }; });
  const scored = [];
  PRODUCTS.forEach((p) => {
    if (min != null && p.price < min) return;
    if (max != null && p.price > max) return;
    const name = normQ(p.name), text = normQ(haystack(p)), toks = text.split(/[\s\-/()]+/);
    let score = 0;
    for (const r of rules) {
      if (text.includes(r.w)) { score += name.startsWith(r.w) ? 6 : toks.some((t) => t.startsWith(r.w)) ? 4 : 2; continue; }
      if (r.s && r.s.cat && p.cat === r.s.cat) { score += 3; continue; }
      if (r.s && r.s.kw && r.s.kw.test(name)) { score += 3; continue; }
      const tol = /\d/.test(r.w) ? 0 : r.w.length >= 7 ? 2 : r.w.length >= 4 ? 1 : 0;
      if (tol && toks.some((t) => lev(r.w, t.slice(0, r.w.length + 1), tol) <= tol || lev(r.w, t, tol) <= tol)) { score += 1; continue; }
      return;
    }
    scored.push({ p, score: score + ((p.stock || 0) > 0 ? 0.5 : 0) + (p.popular || 0) / 1000 });
  });
  scored.sort((a, b) => (cheap ? a.p.price - b.p.price : b.score - a.score));
  return scored.map((x) => x.p);
}

function productCard(p, i) {
  const inCart = state.cart.some((x) => x.id === p.id);
  const tags = [
    p.old ? `<span class="tag">−${discount(p)}%</span>` : "",
    p.badge === "Yangi" ? `<span class="tag new">Yangi</span>` : "",
    p.badge === "Xit" ? `<span class="tag hit">🔥 Xit</span>` : "",
    p.original !== false ? `<span class="tag orig" title="Original mahsulot — rasmiy yetkazib beruvchidan, soxta emas">${ORIG_ICON}Original</span>` : "",
    p.stock <= 5 ? `<span class="tag low">Oz qoldi: ${p.stock}</span>` : "",
  ].join("");
  const compared = state.compare.includes(p.id);
  return `<article class="card" data-id="${p.id}">
    <div class="card-img skeleton" data-open>
      ${img(p, 500, 400)}
      <div class="tags">${tags}</div>
      <span class="card-brand">${esc(p.brand)}</span>
    </div>
    <button class="cmp ${compared ? "on" : ""}" data-cmp title="Solishtirish">${CMP_ICON}</button>
    <div class="card-body">
      <h4 data-open>${esc(p.name)}</h4>
      <div class="rating">${ratingHTML(p)}</div>
      <div class="price-row">
        <div>
          ${p.old ? `<span class="old">${fmt(p.old)}</span>` : ""}
          <div class="price">${fmt(p.price)}</div>
          <span class="monthly">${fmt(p.price / 12)}/oy</span>
        </div>
        <button class="add-btn ${inCart ? "added" : ""}" data-add title="Savatga qo'shish">
          ${inCart
            ? '<svg viewBox="0 0 24 24"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>'
            : '<svg viewBox="0 0 24 24"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>'}
        </button>
      </div>
    </div>
  </article>`;
}

// Kartochkalar faqat filtr o'zgarganda (yoki birinchi marta) 3D animatsiya bilan chiqadi,
// savatga qo'shish kabi qayta chizishlarda emas
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
let lastSig = null;
const cardIO = new IntersectionObserver((entries) => entries.forEach((en) => {
  if (!en.isIntersecting) return;
  en.target.classList.remove("pre");
  en.target.classList.add("in");
  cardIO.unobserve(en.target);
}), { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

function renderProducts() {
  const list = filtered();
  const grid = $("#productGrid");
  grid.innerHTML = list.map(productCard).join("");
  const sig = [state.cat, state.query, state.minPrice, state.maxPrice, state.sort, state.dealsOnly, [...state.brands].join(), JSON.stringify(state.flags), Object.entries(state.facets).map(([k, v]) => k + [...v]).join()].join("|");
  if (sig !== lastSig && !reduceMotion) {
    const cols = getComputedStyle(grid).gridTemplateColumns.split(" ").length || 1;
    $$(".card", grid).forEach((c, i) => {
      c.classList.add("pre");
      c.style.setProperty("--d", (i % cols) * 0.09 + "s");
      cardIO.observe(c);
    });
  }
  lastSig = sig;
  $$("#productGrid img").forEach((im) => {
    const box = im.closest(".card-img");
    const done = () => box.classList.remove("skeleton");
    if (im.complete && im.naturalWidth) { im.classList.add("loaded"); done(); }
    else { im.addEventListener("load", done); im.addEventListener("error", done); }
  });
  $("#emptyState").hidden = list.length > 0;
  const catName = state.cat === "all" ? "Barcha mahsulotlar" : (CATEGORIES.find((c) => c.id === state.cat) || {}).name || "Mahsulotlar";
  $("#resultInfo").innerHTML = `${esc(state.dealsOnly ? "Chegirmadagi mahsulotlar" : catName)} · <b>${list.length}</b> ta topildi`;
  $("#fltApply").textContent = `Natijalarni ko'rsatish (${list.length})`;
  renderFilters();
}

$("#productGrid").addEventListener("click", (e) => {
  const card = e.target.closest(".card");
  if (!card) return;
  const id = +card.dataset.id;
  if (e.target.closest("[data-add]")) addToCart(id, 1, e.target.closest("[data-add]"));
  else if (e.target.closest("[data-cmp]")) toggleCompare(id);
  else if (e.target.closest("[data-open]")) openProduct(id);
});

// ---------- Search + suggestions ----------
const searchInput = $("#searchInput");
const suggest = $("#suggest");
let sgIndex = -1;
let searchT;

function highlight(text, q) {
  let out = escapeHtml(text);
  q.trim().split(/\s+/).filter(Boolean).forEach((w) => {
    const re = new RegExp("(" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig");
    out = out.replace(re, "<mark>$1</mark>");
  });
  return out;
}
function renderSuggest() {
  const q = searchInput.value;
  if (!q.trim()) { suggest.hidden = true; return; }
  const list = search(q);
  sgIndex = -1;
  suggest.innerHTML = list.length
    ? list.slice(0, 6).map((p) => `<div class="sg-item" data-id="${p.id}">
        <img src="${pImg(p, 250)}" alt="" />
        <div><b>${highlight(p.name, q)}</b><small>${fmt(p.price)}</small></div>
      </div>`).join("") + `<button class="sg-all">Barcha natijalar (${list.length}) →</button>`
    : `<div class="sg-empty">"${escapeHtml(q)}" bo'yicha hech narsa topilmadi</div><button class="sg-ai" type="button" data-sgai><img src="icons/opus-ai.svg" alt="" /> OPUS AI'dan so'rash</button>`;
  suggest.hidden = false;
}
function applySearch() {
  state.query = searchInput.value;
  suggest.hidden = true;
  renderProducts();
  $("#products").scrollIntoView();
}
searchInput.addEventListener("input", () => {
  clearTimeout(searchT);
  searchT = setTimeout(() => {
    renderSuggest();
    state.query = searchInput.value;
    renderProducts();
  }, 180);
});
searchInput.addEventListener("focus", renderSuggest);
searchInput.addEventListener("keydown", (e) => {
  const items = $$(".sg-item", suggest);
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    if (!items.length) return;
    sgIndex = (sgIndex + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items.forEach((it, i) => it.classList.toggle("active", i === sgIndex));
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (sgIndex >= 0 && items[sgIndex]) { suggest.hidden = true; openProduct(+items[sgIndex].dataset.id); }
    else applySearch();
  } else if (e.key === "Escape") suggest.hidden = true;
});
suggest.addEventListener("click", (e) => {
  const it = e.target.closest(".sg-item");
  if (it) { suggest.hidden = true; openProduct(+it.dataset.id); }
  else if (e.target.closest(".sg-all")) applySearch();
  else if (e.target.closest("[data-sgai]") && window.openOpusAI) { suggest.hidden = true; window.openOpusAI(searchInput.value); }
});
document.addEventListener("click", (e) => { if (!e.target.closest("#searchBox")) suggest.hidden = true; });

// ---------- Filters ----------
$("[data-filter-deal]") && $("[data-filter-deal]").addEventListener("click", () => {
  state.cat = "all"; state.facets = {};
  state.dealsOnly = true;
  state.sort = "discount";
  renderCategories(); renderProducts();
  $("#products").scrollIntoView({ behavior: "smooth" });
});
$("#resetFilters").addEventListener("click", () => {
  state.query = ""; searchInput.value = "";
  state.sort = "popular";
  clearFilters(true);
});

// ---------- Product modal ----------
function openProduct(id) {
  const p = byId(id);
  const c = catOf(p);
  let qty = 1;
  let months = 12;
  // Asosiy rasm + qo'shimcha haqiqiy fotolar (agar bo'lsa)
  const cutSrc = cutOf(p);
  // Fonsiz rasm birinchi, asl foto esa ikkinchi ko'rinish bo'lib qoladi
  const sources = cutSrc ? [p.img, p.img, ...(p.gallery || [])] : [p.img, ...(p.gallery || [])];
  const views = sources.map((s) => IMG(s, 960));
  if (cutSrc) views[0] = cutSrc;
  const credits = sources.map(CREDIT);
  $("#productModalBody").innerHTML = `<div class="pm">
    <div class="pm-gallery">
      <div class="pm-main" id="pmMain"><img src="${views[0]}" alt="${escapeHtml(p.name)}" data-icon="${c.icon}" onerror="imgFail(this)" /></div>
      ${views.length > 1 ? `<div class="pm-thumbs">${sources.map((s, i) => `<button class="${i === 0 ? "active" : ""}" data-v="${i}"><img src="${i === 0 && cutSrc ? cutSrc : IMG(s, 250)}" alt="" /></button>`).join("")}</div>` : ""}
      ${credits[0] ? `<a class="pm-credit" id="pmCredit" href="${credits[0]}" target="_blank" rel="noopener">📷 Foto: Wikimedia Commons — muallif va litsenziya</a>` : ""}
      <div class="pm-pay">${PAYMENTS.map(payLogo).join("")}</div>
    </div>
    <div>
      <div class="pm-badges"><span class="pill">${esc(c.name)} · ${esc(p.brand)}</span>${p.original !== false ? `<span class="tag orig">${ORIG_ICON}Original</span>` : ""}</div>
      <h2>${esc(p.name)}</h2>
      <div class="rating">${ratingHTML(p, true)}</div>
      <p style="margin-top:10px">${esc(p.desc)}</p>
      <table class="specs">${Object.entries(p.specs).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table>
      ${p.old ? `<span class="old">${fmt(p.old)}</span>` : ""}
      <div class="price">${fmt(p.price)}</div>
      <div class="pm-install">
        Bo'lib to'lash (Uzum Nasiya, 0%): <b class="big" id="pmMonthly"></b>
        <div class="months" id="pmMonths">${MONTHS.map((m) => `<button data-m="${m}" class="${m === months ? "active" : ""}">${m} oy</button>`).join("")}</div>
      </div>
      ${p.stock > 0 ? `<button type="button" class="pm-watch" id="pmWatch"></button>` : ""}
      <div class="stock${p.stock > 0 ? "" : " out"}">${p.stock > 0 ? `✔ Omborda: ${p.stock} dona` : "✖ Hozircha tugagan"} · 🛡 Rasmiy kafolat</div>
      ${p.stock > 0 ? "" : `<button type="button" class="btn btn-primary pm-back" id="pmBack"></button>`}
      ${p.original !== false ? `<div class="orig-box">
        <span class="orig-seal">${ORIG_ICON}</span>
        <div><b>100% original mahsulot — soxta emas</b>
        <span>Rasmiy yetkazib beruvchidan, zavod qadog'ida, seriya raqami va ishlab chiqaruvchi kafolati bilan. Seriya raqamini ${esc(p.brand)} rasmiy saytida tekshirishingiz mumkin.</span></div>
      </div>` : ""}
      <div class="pm-actions">
        <div class="qty-lg"><button data-q="-1">−</button><span id="pmQty">1</span><button data-q="1">+</button></div>
        <button class="btn btn-primary" id="pmAdd">Savatga qo'shish <span>→</span></button>
        <button class="btn btn-ghost" id="pmBuy">Hozir sotib olish</button>
        <button class="btn btn-ghost" id="pmCmp">${CMP_ICON.replace("<svg", '<svg width="18" height="18"')} ${state.compare.includes(p.id) ? "Solishtirishda ✓" : "Solishtirish"}</button>
      </div>
    </div>
  </div>
  <section class="pm-reviews" id="pmReviews"><div class="rv-wait">Sharhlar yuklanmoqda…</div></section>`;

  const body = $("#productModalBody");
  $(".rating", body).classList.add("rv-jump");
  $(".rating", body).addEventListener("click", () => $("#pmReviews").scrollIntoView({ behavior: "smooth", block: "start" }));
  loadReviews(p);
  const updMonthly = () => ($("#pmMonthly").textContent = `${fmt((p.price * qty) / months)}/oy`);
  updMonthly();
  $$("[data-q]", body).forEach((b) => b.addEventListener("click", () => {
    qty = Math.max(1, Math.min(p.stock, qty + +b.dataset.q));
    $("#pmQty").textContent = qty;
    updMonthly();
  }));
  $$("[data-m]", body).forEach((b) => b.addEventListener("click", () => {
    months = +b.dataset.m;
    $$("[data-m]", body).forEach((x) => x.classList.toggle("active", x === b));
    updMonthly();
  }));
  $$("[data-v]", body).forEach((b) => b.addEventListener("click", () => {
    $("#pmMain img").src = views[+b.dataset.v];
    const cr = $("#pmCredit");
    if (cr && credits[+b.dataset.v]) cr.href = credits[+b.dataset.v];
    $$("[data-v]", body).forEach((x) => x.classList.toggle("active", x === b));
  }));
  const main = $("#pmMain");
  main.addEventListener("mousemove", (e) => {
    const r = main.getBoundingClientRect();
    const im = $("img", main);
    if (im) im.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
  });
  $("#pmAdd").addEventListener("click", (e) => addToCart(id, qty, e.currentTarget));
  if (p.stock <= 0) { $("#pmAdd").disabled = true; $("#pmBuy").disabled = true; }
  // "Narxi tushsa" / "Kelganda" xabar berish
  const drawW = () => {
    const w = $("#pmWatch"), b = $("#pmBack");
    if (w) { const al = alertOf(id, "price"); w.classList.toggle("on", !!al); w.innerHTML = al ? `<span>✓</span><div><b>Narx kuzatilmoqda</b><small>${fmt(al.base_price)} dan arzonlashsa — Telegram va ilovaga xabar beramiz</small></div><em>Bekor qilish</em>` : `<span>📉</span><div><b>Narxi tushsa xabar berish</b><small>Arzonlashgan zahoti Telegram va ilovaga xabar keladi</small></div><em>Kuzatish</em>`; }
    if (b) { const on = !!alertOf(id, "stock"); b.classList.toggle("on", on); b.textContent = on ? "✓ Kelishi bilan xabar beramiz" : "🔔 Kelganda xabar berish"; }
  };
  drawW();
  [$("#pmWatch"), $("#pmBack")].forEach((x) => x && x.addEventListener("click", () => toggleAlert(id, x.id === "pmBack" ? "stock" : "price").then(drawW)));
  if (auth.token && !siteAlerts) loadAlerts().then(drawW).catch(() => {});
  $("#pmCmp").addEventListener("click", (e) => {
    toggleCompare(id);
    e.currentTarget.lastChild.textContent = state.compare.includes(id) ? " Solishtirishda ✓" : " Solishtirish";
  });
  $("#pmBuy").addEventListener("click", () => {
    if (addToCart(id, qty, null, true) === false) return;
    closeAll(); openCheckout();
  });
  openLayer($("#productModal"));
  addRecent(id);
}

// ---------- Recently viewed ----------
function addRecent(id) {
  state.recent = [id, ...state.recent.filter((x) => x !== id)].slice(0, 10);
  store.set("recent", state.recent);
  renderRecent();
}
function renderRecent() {
  const list = state.recent.map(byId).filter(Boolean);
  $("#recentSection").hidden = !list.length;
  $("#recentList").innerHTML = list.map((p) => `<div class="rv" data-id="${p.id}">
      <img src="${pImg(p, 400, 240)}" alt="${escapeHtml(p.name)}" loading="lazy" />
      <div><b>${esc(p.name)}</b><small>${fmt(p.price)}</small></div>
    </div>`).join("");
}
$("#recentList").addEventListener("click", (e) => {
  const rv = e.target.closest(".rv");
  if (rv) openProduct(+rv.dataset.id);
});

// ---------- Cart ----------
function saveCart() { store.set("cart", state.cart); }

function addToCart(id, qty = 1, srcEl, silent) {
  const p = byId(id);
  const item = state.cart.find((x) => x.id === id);
  const current = item ? item.qty : 0;
  if (current + qty > p.stock) { toast(`⚠️ Omborda faqat ${p.stock} dona bor`); return false; }
  if (item) item.qty += qty; else state.cart.push({ id, qty });
  saveCart();
  sfx("add");
  if (srcEl) { flyToCart(srcEl, p); setTimeout(() => sfx("coin"), 700); }
  setTimeout(() => { updateBadges(true); renderCart(); renderProducts(); }, srcEl ? 700 : 0);
  if (!silent) toast(`✅ "${p.name}" savatga qo'shildi`);
  return true;
}

function changeQty(id, d) {
  const item = state.cart.find((x) => x.id === id);
  if (!item) return;
  const p = byId(id);
  if (item.qty + d > p.stock) return toast(`⚠️ Omborda faqat ${p.stock} dona bor`);
  item.qty += d;
  if (item.qty <= 0) return removeFromCart(id);
  sfx(d > 0 ? "plus" : "minus");
  saveCart(); renderCart(); updateBadges();
}

function removeFromCart(id) {
  sfx("remove");
  const el = $(`#cartItems [data-id="${id}"]`);
  const done = () => {
    state.cart = state.cart.filter((x) => x.id !== id);
    saveCart(); renderCart(); updateBadges(); renderProducts();
  };
  if (el) { el.classList.add("removing"); setTimeout(done, 330); } else done();
}

function totals() {
  const sub = state.cart.reduce((s, x) => s + byId(x.id).price * x.qty, 0);
  const disc = state.promo && PROMOS[state.promo] ? sub * PROMOS[state.promo] : 0;
  const pickup = $("#checkoutForm").elements.delivery.value === "pickup";
  const ship = sub === 0 || pickup || sub >= FREE_SHIP_FROM ? 0 : SHIP_PRICE;
  return { sub, disc, ship, total: sub - disc + ship };
}

function renderCart() {
  const box = $("#cartItems");
  const t = totals();
  const left = FREE_SHIP_FROM - t.sub;
  $("#shipProgress").hidden = !state.cart.length;
  $("#shipText").innerHTML = left > 0
    ? `Bepul yetkazib berishga yana <b>${fmt(left)}</b> qoldi`
    : `🎉 Sizga <b>bepul yetkazib berish</b>!`;
  $("#shipBar").style.width = Math.min(100, (t.sub / FREE_SHIP_FROM) * 100) + "%";

  if (!state.cart.length) {
    box.innerHTML = `<div class="drawer-empty"><div>🛒</div><h4>Savat bo'sh</h4><p>Mahsulot qo'shing va xaridni boshlang</p></div>`;
    $("#cartFoot").hidden = true;
    return;
  }
  $("#cartFoot").hidden = false;
  box.innerHTML = state.cart.map(({ id, qty }) => {
    const p = byId(id);
    return `<div class="citem" data-id="${id}">
      ${img(p, 140, 140, "loaded")}
      <div class="citem-info">
        <h5>${esc(p.name)}</h5><b>${fmt(p.price * qty)}</b>
        <div class="qty"><button data-d="-1">−</button><span>${qty}</span><button data-d="1">+</button></div>
      </div>
      <button class="rm" title="O'chirish">🗑</button>
    </div>`;
  }).join("");
  $("#subTotal").textContent = fmt(t.sub);
  $("#discountRow").hidden = !t.disc;
  $("#discountVal").textContent = "−" + fmt(t.disc) + (state.promo ? ` (${state.promo})` : "");
  $("#shipVal").textContent = t.ship ? fmt(t.ship) : "Bepul";
  $("#grandTotal").textContent = fmt(t.total);
  $("#promoInput").value = state.promo || "";
}

$("#cartItems").addEventListener("click", (e) => {
  const row = e.target.closest(".citem");
  if (!row) return;
  const id = +row.dataset.id;
  if (e.target.closest("[data-d]")) changeQty(id, +e.target.closest("[data-d]").dataset.d);
  if (e.target.closest(".rm")) removeFromCart(id);
});

$("#promoBtn").addEventListener("click", () => {
  const code = $("#promoInput").value.trim().toUpperCase();
  if (!code) { state.promo = null; store.set("promo", null); renderCart(); return; }
  if (PROMOS[code]) {
    state.promo = code; store.set("promo", code);
    toast(`🎉 Promo-kod qo'llandi: −${Math.round(PROMOS[code] * 100)}%`);
    confetti(80);
  } else {
    toast("❌ Promo-kod noto'g'ri");
    const inp = $("#promoInput");
    inp.classList.add("invalid");
    setTimeout(() => inp.classList.remove("invalid"), 500);
  }
  renderCart();
});
$("#promoInput").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#promoBtn").click(); });

function updateBadges(bump) {
  const count = state.cart.reduce((s, x) => s + x.qty, 0);
  const cb = $("#cartCount");
  cb.textContent = count; cb.hidden = !count;
  if (bump) { cb.classList.remove("bump"); void cb.offsetWidth; cb.classList.add("bump"); }
}

function flyToCart(srcEl, p) {
  const from = srcEl.getBoundingClientRect();
  const to = $("#cartBtn").getBoundingClientRect();
  const el = document.createElement("div");
  el.className = "fly";
  el.innerHTML = `<img src="${pImg(p, 140, 140)}" alt="" />`;
  document.body.appendChild(el);
  const sx = from.left + from.width / 2 - 32, sy = from.top + from.height / 2 - 32;
  const ex = to.left + to.width / 2 - 32, ey = to.top + to.height / 2 - 32;
  el.animate([
    { transform: `translate(${sx}px, ${sy}px) scale(1) rotate(0)`, opacity: 1 },
    { transform: `translate(${(sx + ex) / 2}px, ${Math.min(sy, ey) - 140}px) scale(1.25) rotate(-15deg)`, opacity: 1, offset: 0.5 },
    { transform: `translate(${ex}px, ${ey}px) scale(.25) rotate(20deg)`, opacity: 0.3 },
  ], { duration: 750, easing: "cubic-bezier(.5,0,.3,1)" }).onfinish = () => el.remove();
}


// ---------- Orders ----------
const DELIVERY = { courier: "Kuryer", pickup: "Do'kondan olib ketish" };
// Holatni admin panel o'zgartiradi (server: Yangi → Tasdiqlandi → Yig'ilmoqda → Yo'lda → Yetkazildi)
const TRACK = ["Yangi", "Tasdiqlandi", "Yig'ilmoqda", "Yo'lda", "Yetkazildi"];
const TRACK_LABEL = ["Qabul qilindi", "Tasdiqlandi", "Yig'ilmoqda", "Yo'lda", "Yetkazildi"];
async function loadOrders() {
  if (!auth.token) { state.orders = []; return; }
  state.orders = (await api("GET", "/api/orders")).orders;
}
function showOrders() { openAccount("orders"); }
async function loadAccOrders() {
  const box = $("#orderItems");
  if (!state.orders || !state.orders.length) box.innerHTML = `<div class="drawer-empty"><p>Yuklanmoqda…</p></div>`;
  try { await loadOrders(); renderOrders(); }
  catch (e) { box.innerHTML = `<div class="drawer-empty"><h4>Yuklab bo'lmadi</h4><p>${esc(e.message)}</p></div>`; }
}
function renderOrders() {
  const box = $("#orderItems");
  if (!state.orders.length) {
    box.innerHTML = `<div class="drawer-empty"><img class="stk" src="icons/stk/bag.png" alt="" style="width:72px;height:72px" /><h4>Hali buyurtmalar yo'q</h4><p>Birinchi xaridingizni amalga oshiring</p><a href="#products" class="btn btn-primary btn-sm">Katalogga o'tish</a></div>`;
    accCount("#accCntOrders", 0);
    return;
  }
  accCount("#accCntOrders", state.orders.filter((o) => !["Yetkazildi", "Bekor qilindi"].includes(o.status)).length);
  box.innerHTML = state.orders.map((o) => {
    const cancelled = o.status === "Bekor qilindi";
    const pending = !cancelled && o.confirmed === 0;
    const st = Math.max(0, TRACK.indexOf(o.status));
    const pay = payOf(o.payment);
    const items = o.items.map((i) => ({ ...i, p: byId(i.id) }));
    return `<div class="order-card${cancelled ? " cancelled" : ""}">
      <header><b>#${esc(o.id)}</b><span class="status${pending ? " pending" : ""}">${cancelled ? "Bekor qilindi" : pending ? "⏳ Tasdiqlanmagan" : TRACK_LABEL[st]}</span></header>
      <small class="muted">${new Date(o.created_at).toLocaleString("ru-RU")} · ${pay ? pay.name : esc(o.payment)}${o.months ? ` (${o.months} oy)` : ""} · ${DELIVERY[o.delivery] || ""}</small>
      <div class="thumbs">${items.slice(0, 6).map((i) => `<img src="${esc(IMG(i.p ? i.p.img : i.img))}" alt="" title="${esc(i.name)}" onerror="this.remove()" />`).join("")}${items.length > 6 ? `<span class="thumbs-more">+${items.length - 6}</span>` : ""}</div>
      <ul>${items.slice(0, 4).map((i) => `<li>${esc(i.name)} × ${i.qty}</li>`).join("")}${items.length > 4 ? `<li class="muted">… yana ${items.length - 4} ta mahsulot</li>` : ""}</ul>
      ${pending ? `<button class="btn btn-primary btn-sm order-confirm" data-confirm="${esc(o.id)}">✈️ Telegram orqali tasdiqlash</button><div class="confirm-slot"></div>` : ""}
      ${cancelled || pending ? "" : `<div class="order-track" style="--p:${(st / (TRACK.length - 1)) * 84}%">${TRACK_LABEL.map((t, i) => `<span class="${i <= st ? "on" : ""}">${t}</span>`).join("")}</div>`}
      <b>${fmt(o.total)}</b>
      ${!cancelled && !pending && st < 4 && payLink(o) ? `<button class="btn btn-ghost btn-sm order-pay" data-pay="${esc(o.id)}">💳 ${pay.name} orqali to'lash (QR)</button><div class="pay-slot"></div>` : ""}
      ${o.status === "Yangi" ? `<button class="order-cancel" data-cancel="${esc(o.id)}">Buyurtmani bekor qilish</button>` : ""}
    </div>`;
  }).join("");
}

// ---------- Onlayn to'lov: Click / Payme havolasi va QR-kod ----------
// Payme: checkout.paycom.uz/ + base64("m=<merchant>;ac.<hisob>=<buyurtma>;a=<tiyin>;l=uz;c=<qaytish>")
// Click: my.click.uz/services/pay?service_id&merchant_id&amount(0.00)&transaction_param&return_url
// ID'lar admin panel → Sozlamalar → "Onlayn to'lov" da kiritiladi (SETTINGS.pay).
function payLink(order) {
  const cfg = SETTINGS.pay || {};
  const back = location.origin + location.pathname + "#orders";
  if (order.payment === "payme") {
    const c = cfg.payme || {};
    if (!c.merchantId) return null;
    return "https://checkout.paycom.uz/" + btoa([`m=${c.merchantId}`, `ac.${c.account || "order_id"}=${order.id}`, `a=${Math.round(order.total * 100)}`, "l=uz", `c=${back}`].join(";"));
  }
  if (order.payment === "click") {
    const c = cfg.click || {};
    if (!c.serviceId || !c.merchantId) return null;
    return "https://my.click.uz/services/pay?" + new URLSearchParams({
      service_id: c.serviceId, merchant_id: c.merchantId, amount: (+order.total).toFixed(2), transaction_param: order.id, return_url: back,
    });
  }
  return null;
}
let qrLoading = null;
const loadQR = () => window.QRCode ? Promise.resolve() : (qrLoading ||= new Promise((res, rej) => {
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
  s.onload = res; s.onerror = () => { qrLoading = null; rej(); };
  document.head.appendChild(s);
}));
function payBoxHTML(order) {
  if (!["click", "payme"].includes(order.payment)) return "";
  const pay = payOf(order.payment), url = payLink(order);
  if (!url) return `<div class="paybox off">${payLogo(pay)}<div><b>${pay.name} orqali onlayn to'lov hali ulanmagan</b><span>Operatorimiz siz bilan bog'lanib, to'lov havolasini yuboradi.</span></div></div>`;
  return `<div class="paybox">
    <div class="paybox-head">${payLogo(pay)}<div><small>To'lov summasi</small><b>${fmt(order.total)}</b></div><span class="paybox-id">#${esc(order.id)}</span></div>
    <div class="paybox-body">
      <div class="paybox-qr" data-qr="${esc(url)}" role="img" aria-label="${pay.name} to'lov QR-kodi"><span class="paybox-qr-wait"></span></div>
      <div class="paybox-steps">
        <b>Telefon orqali to'lash</b>
        <ol><li><b>${pay.name}</b> ilovasini oching</li><li>QR-skanerni tanlab, kodni skanerlang</li><li>Summani tekshirib, tasdiqlang</li></ol>
        <a class="btn btn-primary btn-sm paybox-btn" href="${esc(url)}" target="_blank" rel="noopener">${pay.name} ilovasida to'lash →</a>
        <small class="muted">Telefondan buyurtma bergan bo'lsangiz — shu tugmani bosing.</small>
      </div>
    </div>
  </div>`;
}
function mountQR(root) {
  $$("[data-qr]", root).forEach(async (el) => {
    try {
      await loadQR();
      el.innerHTML = "";
      new QRCode(el, { text: el.dataset.qr, width: 200, height: 200, colorDark: "#14060a", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.M });
    } catch { el.innerHTML = `<small>QR yuklanmadi — pastdagi tugmani bosing</small>`; }
  });
}
$("#orderItems").addEventListener("click", async (e) => {
  const cf = e.target.closest("[data-confirm]");
  if (cf) {
    const slot = cf.nextElementSibling, o = state.orders.find((x) => x.id === cf.dataset.confirm);
    if (slot.innerHTML) { slot.innerHTML = ""; return; }
    cf.disabled = true;
    try {
      const r = await api("POST", `/api/orders/${encodeURIComponent(o.id)}/code`);
      if (r.confirmed) { await loadOrders(); renderOrders(); return; }
      mountConfirm(slot, o, r, () => { renderOrders(); confetti(160, "check"); });
    } catch (ex) { toast("⚠️ " + ex.message); }
    cf.disabled = false;
    return;
  }
  const c = e.target.closest("[data-cancel]");
  if (c) {
    // Ikki bosqichli tasdiq: birinchi bosish — so'rash, ikkinchisi — bekor qilish
    if (!c.classList.contains("confirm")) {
      c.classList.add("confirm"); c.textContent = "Rostdan bekor qilinsinmi? Ha, bekor qilish";
      setTimeout(() => { if (c.isConnected) { c.classList.remove("confirm"); c.textContent = "Buyurtmani bekor qilish"; } }, 4000);
      return;
    }
    c.disabled = true;
    try {
      const { order } = await api("POST", `/api/orders/${encodeURIComponent(c.dataset.cancel)}/cancel`);
      state.orders = state.orders.map((o) => (o.id === order.id ? order : o));
      order.items.forEach((i) => { const p = byId(i.id); if (p) p.stock = (p.stock || 0) + i.qty; });
      renderOrders(); renderProducts();
      toast("Buyurtma bekor qilindi");
    } catch (err) { toast("⚠️ " + err.message); c.disabled = false; }
    return;
  }
  const b = e.target.closest("[data-pay]");
  if (!b) return;
  const slot = b.nextElementSibling;
  if (slot.innerHTML) { slot.innerHTML = ""; return; }
  const o = state.orders.find((x) => x.id === b.dataset.pay);
  slot.innerHTML = payBoxHTML(o);
  mountQR(slot);
});
// To'lov tizimidan qaytganda (#orders) — buyurtmalar ro'yxatini ochamiz
if (location.hash === "#orders") setTimeout(() => {
  showOrders();
  toast("💳 To'lov sahifasidan qaytdingiz. To'lov tasdiqlangach operatorimiz bog'lanadi.");
  history.replaceState(null, "", location.pathname + location.search);
}, 1600);

// ---------- Layers (drawer / modal) ----------
const overlay = $("#overlay");
function openLayer(el) {
  if (!el.classList.contains("open")) sfx("open");
  closeAll(true, true);
  el.classList.add("open");
  overlay.classList.add("show");
  document.body.classList.add("lock");
  if (TG) TG.BackButton.show();
}
function closeAll(keepOverlay, quiet) {
  const opened = $$(".drawer.open, .modal.open");
  if (opened.length && !quiet) sfx("close");
  opened.forEach((x) => x.classList.remove("open"));
  if (!keepOverlay) { overlay.classList.remove("show"); document.body.classList.remove("lock"); if (TG) TG.BackButton.hide(); }
  if (location.hash.startsWith("#news-")) history.replaceState(null, "", location.pathname + location.search);
}
overlay.addEventListener("click", () => closeAll());
$$(".modal").forEach((m) => m.addEventListener("click", (e) => { if (e.target === m) closeAll(); }));
document.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeAll(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAll(); });
$("#cartBtn").addEventListener("click", () => { renderCart(); openLayer($("#cartDrawer")); });
$("#ordersBtn").addEventListener("click", showOrders);

// ---------- Checkout ----------
let step = 1;
const form = $("#checkoutForm");
$("#checkoutBtn").addEventListener("click", openCheckout);

function openCheckout() {
  if (!state.cart.length) return toast("Savat bo'sh");
  if (!auth.user) return requireLogin("Xarid qilish uchun akkauntingizga kiring yoki ro'yxatdan o'ting", openCheckout);
  // Ma'lumotlarni akkauntdan to'ldiramiz (telefon — akkauntniki, o'zgarmaydi)
  const u = auth.user, f = form.elements;
  f.name.value = u.name || "";
  f.phone.value = fmtPhone(u.phone);
  f.phone.readOnly = true;
  f.email.value = u.email || "";
  if (u.region) f.region.value = u.region;
  if (u.address && !f.address.value) f.address.value = u.address;
  step = 1;
  form.hidden = false;
  $("#successPane").hidden = true;
  $("#steps").hidden = false;
  showStep();
  openLayer($("#checkoutModal"));
}

function showStep() {
  $$(".step").forEach((s) => {
    const n = +s.dataset.step;
    s.classList.toggle("active", n === step);
    s.classList.toggle("done", n < step);
  });
  $$(".step-pane").forEach((p) => p.classList.toggle("active", +p.dataset.pane === step));
  $("#prevStep").style.visibility = step === 1 ? "hidden" : "visible";
  $("#nextStep").innerHTML = step === 3 ? "Buyurtma berish ✓" : "Keyingi →";
  const addr = form.elements.address;
  const pickup = form.elements.delivery.value === "pickup";
  addr.required = !pickup;
  addr.closest("label").style.display = pickup ? "none" : "";
  if (step === 3) { renderInstall(); renderSummary(); }
}
form.addEventListener("change", (e) => {
  if (e.target.name === "delivery") showStep();
  if (e.target.name === "payment") { renderInstall(); renderSummary(); }
});

function renderInstall() {
  const method = form.elements.payment.value;
  const isUzum = method === "uzum";
  $("#installBox").hidden = !isUzum;
  // Click / Payme: buyurtmadan keyin QR-kod chiqishini oldindan aytamiz
  const pay = payOf(method), hint = $("#payHint");
  const ready = ["click", "payme"].includes(method) && payLink({ payment: method, id: "x", total: 1 });
  hint.hidden = !["click", "payme"].includes(method);
  hint.innerHTML = ready
    ? `📱 Buyurtma berilgach <b>${pay.name} QR-kodi</b> chiqadi — telefoningizdagi ${pay.name} ilovasi bilan skanerlab to'laysiz.`
    : `ℹ️ ${pay ? pay.name : ""} orqali onlayn to'lov hozircha ulanmagan — buyurtmadan keyin operator to'lov havolasini yuboradi.`;
  if (!isUzum) return;
  const total = totals().total;
  $("#months").innerHTML = MONTHS.map((m) => `<button type="button" data-m="${m}" class="${m === state.months ? "active" : ""}">${m} oy · ${fmt(total / m)}</button>`).join("");
}
$("#months").addEventListener("click", (e) => {
  const b = e.target.closest("[data-m]");
  if (!b) return;
  state.months = +b.dataset.m;
  renderInstall(); renderSummary();
});

function validateStep() {
  const pane = $(`.step-pane[data-pane="${step}"]`);
  let ok = true;
  $$("input:not([type=radio]), select, textarea", pane).forEach((f) => {
    if (f.closest("label")?.style.display === "none") return;
    let valid = f.checkValidity();
    if (f.name === "phone") valid = /^\+998 \d{2} \d{3} \d{2} \d{2}$/.test(f.value.trim());
    f.classList.toggle("invalid", !valid);
    if (!valid) ok = false;
  });
  if (!ok) toast("⚠️ Iltimos, maydonlarni to'g'ri to'ldiring");
  return ok;
}

// Telefon maskasi: +998 90 123 45 67
form.elements.phone.addEventListener("input", (e) => {
  let d = e.target.value.replace(/\D/g, "");
  if (d.startsWith("998")) d = d.slice(3);
  d = d.slice(0, 9);
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
  e.target.value = "+998" + (parts.length ? " " + parts.join(" ") : "");
});
form.elements.phone.addEventListener("focus", (e) => { if (!e.target.value) e.target.value = "+998 "; });

function renderSummary() {
  const t = totals();
  const pay = payOf(form.elements.payment.value);
  $("#orderSummary").innerHTML = state.cart.map(({ id, qty }) =>
    `<div class="sum-row"><span>${esc(byId(id).name)} × ${qty}</span><span>${fmt(byId(id).price * qty)}</span></div>`).join("") +
    (t.disc ? `<div class="sum-row discount-row"><span>Chegirma (${state.promo})</span><span>−${fmt(t.disc)}</span></div>` : "") +
    `<div class="sum-row"><span>Yetkazib berish</span><span>${t.ship ? fmt(t.ship) : "Bepul"}</span></div>
     <div class="sum-row"><span>To'lov usuli</span><span>${pay.name}</span></div>
     ${pay.id === "uzum" ? `<div class="sum-row"><span>Oylik to'lov (${state.months} oy)</span><span>${fmt(t.total / state.months)}</span></div>` : ""}
     <div class="sum-row total"><span>Jami</span><span>${fmt(t.total)}</span></div>`;
}

$("#prevStep").addEventListener("click", () => { if (step > 1) { step--; showStep(); } });
$("#nextStep").addEventListener("click", () => {
  if (!validateStep()) return;
  if (step < 3) { step++; showStep(); return; }
  placeOrder();
});

async function placeOrder() {
  const btn = $("#nextStep");
  btn.disabled = true;
  btn.innerHTML = "⏳ Yuborilmoqda...";
  const data = Object.fromEntries(new FormData(form));
  const pay = payOf(data.payment);
  let order, confirm;
  try {
    // Narx, chegirma va yetkazish serverda katalogdan qayta hisoblanadi
    ({ order, confirm } = await api("POST", "/api/orders", {
      items: state.cart.map(({ id, qty }) => ({ id, qty })),
      delivery: data.delivery, region: data.region, address: data.address, note: data.note,
      payment: data.payment, months: data.payment === "uzum" ? state.months : null, promo: state.promo,
    }));
    // Server manzilni akkauntga eslab qoladi; ism/email o'zgargan bo'lsa — profilni yangilaymiz
    Object.assign(auth.user, { region: data.region, address: data.address || auth.user.address });
    store.set("user", auth.user);
    if (data.name.trim() !== auth.user.name || (data.email || null) !== (auth.user.email || null)) {
      api("PATCH", "/api/me", { name: data.name, email: data.email }).then((r) => setAuth(auth.token, r.user), () => {});
    }
  } catch (e) {
    btn.disabled = false;
    btn.innerHTML = "Buyurtma berish ✓";
    if (e.status === 401) { closeAll(); return requireLogin("Seans tugagan — qayta kiring", openCheckout); }
    if (e.status === 409) loadCatalog();
    return toast("⚠️ " + e.message);
  }
  state.orders.unshift(order);
  state.cart = []; state.promo = null;
  saveCart(); store.set("promo", null);
  // Ombor qoldig'i serverda kamaydi — mahalliy nusxani ham moslaymiz
  order.items.forEach((i) => { const p = byId(i.id); if (p) p.stock = Math.max(0, (p.stock || 0) - i.qty); });
  updateBadges(); renderProducts(); renderCart();

  form.hidden = true;
  $("#steps").hidden = true;
  $("#orderId").textContent = "#" + order.id;
  $("#successPane").hidden = false;
  form.reset();
  btn.disabled = false;
  // Telegram orqali tasdiqlash kerak bo'lsa — avval kod, keyin to'lov
  if (confirm) {
    $("#successTitle").textContent = "Buyurtmani tasdiqlang";
    $("#successNote").textContent = "";
    $("#payBox").innerHTML = "";
    $(".check-anim", $("#successPane")).classList.add("wait");
    mountConfirm($("#confirmBox"), order, confirm, (done) => { showPaid(done, pay, true); playCheck(); confetti(240, null); });
    return;
  }
  showPaid(order, pay);
  playCheck();
  confetti(240, null);
}
// Galochka chizilishini boshidan ko'rsatib, unga mos ovozni chalamiz (doira → galochka "ding")
function playCheck() {
  const svg = $("#successPane .check-anim svg");
  if (svg) svg.replaceWith(svg.cloneNode(true));
  sfx("check");
}
function showPaid(order, pay, confirmedNow) {
  $("#confirmBox").innerHTML = "";
  $(".check-anim", $("#successPane")).classList.remove("wait");
  $("#successTitle").textContent = confirmedNow ? "Buyurtma tasdiqlandi!" : "Buyurtma qabul qilindi!";
  const online = ["click", "payme"].includes(pay.id);
  $("#payBox").innerHTML = payBoxHTML(order);
  mountQR($("#payBox"));
  $("#successNote").textContent = online
    ? (payLink(order) ? `Endi ${pay.name} orqali to'lovni amalga oshiring — QR-kodni skanerlang yoki tugmani bosing.` : "Operatorimiz tez orada siz bilan bog'lanadi.")
    : pay.id === "uzum"
      ? `Uzum Nasiya: ${order.months} oy davomida oyiga ${fmt(order.total / order.months)}. Operatorimiz tez orada bog'lanadi.`
      : "Operatorimiz tez orada siz bilan bog'lanadi.";
}

// ---------- Telegram orqali tasdiqlash ----------
// confirm: { linked, bot, link? } — server javobi. Kod kiritilgach onDone(order) chaqiriladi.
function mountConfirm(box, order, confirm, onDone) {
  const bot = "@" + (confirm.bot || "opussmarketbot");
  // Oyna ochiq turganda serverdan bot xabarlarini o'qishni so'raymiz (START, kontakt) — kod tezroq keladi
  const started = Date.now();
  const poll = setInterval(() => {
    if (!box.isConnected || !$(".tgc", box) || Date.now() - started > 15 * 60e3) return clearInterval(poll);
    if (!document.hidden || Date.now() - started < 120e3) api("POST", "/api/tg/poll").catch(() => {});
  }, 3000);
  const finish = onDone;
  onDone = (o) => { clearInterval(poll); finish(o); };
  const draw = (c) => {
    box.innerHTML = `<div class="tgc">
      <div class="tgc-head"><span class="tgc-logo"><svg viewBox="0 0 24 24"><path d="M21.9 4.3l-3.2 15.1c-.2 1-.9 1.3-1.7.8l-4.8-3.6-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.3-.1-.5-.6-.2L6.5 13.1l-4.7-1.5c-1-.3-1-1 .2-1.5L20.5 3c.9-.3 1.6.2 1.4 1.3z"/></svg></span>
        <div><b>Telegram orqali tasdiqlash</b><small>${c.linked ? `Kod Telegram'dagi <b>${esc(bot)}</b> botiga yuborildi` : "Bir martalik — keyingi buyurtmalarda kod darhol keladi"}</small></div></div>
      ${c.linked ? "" : `<ol class="tgc-steps">
        <li>Pastdagi tugma bilan <b>${esc(bot)}</b> botini oching va <b>START</b> ni bosing</li>
        <li>"📱 Raqamimni yuborish" tugmasini bosing (raqam akkauntingizdagi bilan bir xil bo'lishi kerak)</li>
        <li>Bot yuborgan 6 xonali kodni shu yerga kiriting</li></ol>
        <a class="btn btn-tg btn-block" href="${esc(c.link)}" target="_blank" rel="noopener">✈️ Telegram'da ochish</a>`}
      <form class="tgc-form" novalidate>
        <input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="• • • • • •" aria-label="Tasdiqlash kodi" />
        <button class="btn btn-primary">Tasdiqlash</button>
      </form>
      <p class="tgc-err" hidden></p>
      <div class="tgc-foot"><button type="button" class="tgc-resend">↻ Kodni qayta yuborish</button>${c.linked ? `<a href="https://t.me/${esc(c.bot)}" target="_blank" rel="noopener">Botni ochish ↗</a>` : ""}</div>
      <small class="muted">Buyurtma 2 soat ichida tasdiqlanmasa, avtomatik bekor qilinadi.</small>
    </div>`;
    const f = $(".tgc-form", box), err = $(".tgc-err", box), inp = f.elements.code;
    inp.addEventListener("input", () => { inp.value = inp.value.replace(/\D/g, "").slice(0, 6); if (inp.value.length === 6) f.requestSubmit(); });
    if (c.linked) setTimeout(() => inp.focus(), 300);
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (inp.value.length !== 6) { err.textContent = "6 xonali kodni kiriting"; err.hidden = false; return; }
      const b = $("button", f); b.disabled = true; err.hidden = true;
      try {
        const r = await api("POST", `/api/orders/${encodeURIComponent(order.id)}/confirm`, { code: inp.value });
        state.orders = state.orders.map((o) => (o.id === r.order.id ? r.order : o));
        toast("✅ Buyurtma tasdiqlandi! Chek Telegram'ga yuborildi");
        onDone(r.order);
      } catch (ex) {
        err.textContent = ex.message; err.hidden = false; b.disabled = false;
        inp.classList.remove("invalid"); void inp.offsetWidth; inp.classList.add("invalid"); inp.select();
      }
    });
    $(".tgc-resend", box).addEventListener("click", async (e) => {
      const b = e.currentTarget; b.disabled = true;
      try {
        const r = await api("POST", `/api/orders/${encodeURIComponent(order.id)}/code`);
        if (r.confirmed) return onDone({ ...order, confirmed: 1 });
        toast(r.linked ? "📨 Yangi kod Telegram'ga yuborildi" : "Avval Telegram'da botni oching");
        draw(r);
      } catch (ex) { toast("⚠️ " + ex.message); b.disabled = false; }
    });
  };
  draw(confirm);
}

// Newsletter
$("#promoCopy").addEventListener("click", () => {
  try { navigator.clipboard.writeText("YANGI5"); } catch {}
  toast("📋 YANGI5 nusxalandi — to'lov oynasida kiriting");
  confetti(40);
});

// ---------- Toast ----------
function toast(msg) {
  if (/^(⚠️|❌|⛔)/.test(msg)) sfx("error");
  else if (/^✅/.test(msg) && !/savatga/.test(msg)) sfx("ok");
  else if (/^(🔔|📨|🙏|👋|🎉)/.test(msg)) sfx("notify");
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  $("#toasts").appendChild(el);
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 300); }, 2600);
}

// ---------- Ovoz: bosish va kartalar ustidan o'tish ----------
// Savatga qo'shish, ochish/yopish kabi o'z ovozi bor tugmalar uchun click chalinmaydi
// Barcha tugmalar ovozini sfx.js o'zi beradi; bu yerda o'z ovozini kodda chaladigan tugmalar
// (savatga qo'shish, +/−, o'chirish, oyna ochish va h.k.) ikki marta jaranglamasligi uchun ro'yxatdan o'tkaziladi.
if (window.SFX) ["[data-add]", "#pmAdd", "[data-d]", ".rm", "#themeBtn", "#soundBtn", "#cartBtn", "#ordersBtn", "#accBtn", "[data-open]", "#checkoutBtn", "#pmBuy", "#cbOpen", "[data-cmp]", "#pmCmp", "[data-news]", ".sp-pop"].forEach((sel) => SFX.skip(sel));
document.addEventListener("mouseover", (e) => {
  if (!matchMedia("(hover: hover)").matches) return;
  const c = e.target.closest(".card, .cat, .news-card");
  if (c && !c.contains(e.relatedTarget)) sfx("hover");
});
document.addEventListener("input", (e) => { if (e.target.matches(".tgc-form input, input[name=password], input[name=phone], #searchInput, #promoInput, input[name=code]")) sfx("tick"); });
// "/" — qidiruvga o'tish (matn yozilayotgan joyda emas)
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && !e.target.closest("input, textarea, select, [contenteditable]")) { e.preventDefault(); $("#searchInput").focus(); sfx("tab"); }
});

// ---------- Ripple ----------
document.addEventListener("pointerdown", (e) => {
  const b = e.target.closest(".btn");
  if (!b) return;
  const r = b.getBoundingClientRect();
  const s = Math.max(r.width, r.height);
  const span = document.createElement("span");
  span.className = "ripple";
  span.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
  b.appendChild(span);
  setTimeout(() => span.remove(), 600);
});

// ---------- Confetti ----------
function confetti(n = 150, sound = "success") {
  if (sound) sfx(sound);
  const cv = $("#confetti"), ctx = cv.getContext("2d");
  cv.width = innerWidth; cv.height = innerHeight;
  const colors = ["#e10f2a", "#ff4d2e", "#ffb020", "#ffffff", "#8f0618"];
  const parts = Array.from({ length: n }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 200, y: innerHeight / 2,
    vx: (Math.random() - 0.5) * 16, vy: Math.random() * -18 - 4,
    s: Math.random() * 8 + 4, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
    c: colors[(Math.random() * colors.length) | 0],
  }));
  let frame = 0;
  (function draw() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    parts.forEach((p) => {
      p.vy += 0.45; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      ctx.restore();
    });
    if (++frame < 160) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, cv.width, cv.height);
  })();
}

// ---------- Solishtirish ----------
const MAX_COMPARE = 3;
function toggleCompare(id) {
  const p = byId(id);
  if (state.compare.includes(id)) {
    state.compare = state.compare.filter((x) => x !== id);
  } else {
    const first = byId(state.compare[0]);
    if (first && first.cat !== p.cat) {
      toast(`⚠️ Faqat bitta kategoriyadagi mahsulotlar solishtiriladi (${catOf(first).name}). Avval ro'yxatni tozalang.`);
      return;
    }
    if (state.compare.length >= MAX_COMPARE) { toast(`⚠️ Bir vaqtda ${MAX_COMPARE} tagacha mahsulot solishtiriladi`); return; }
    state.compare.push(id);
    toast(`⇄ "${p.name}" solishtirishga qo'shildi`);
  }
  sfx(state.compare.includes(id) ? "checkOn" : "checkOff");
  store.set("compare", state.compare);
  $$("#productGrid .card").forEach((c) => $("[data-cmp]", c)?.classList.toggle("on", state.compare.includes(+c.dataset.id)));
  renderCompareBar();
}

function renderCompareBar() {
  state.compare = state.compare.filter(byId);
  const n = state.compare.length;
  $("#compareBar").hidden = !n;
  document.body.classList.toggle("has-compare", n > 0);
  $("#cbItems").innerHTML = Array.from({ length: MAX_COMPARE }, (_, i) => {
    const p = byId(state.compare[i]);
    return p ? `<span class="cb-slot filled" title="${escapeHtml(p.name)}"><img src="${pImg(p)}" alt="" /></span>` : `<span class="cb-slot"></span>`;
  }).join("");
  $("#cbCount").textContent = `${n}/${MAX_COMPARE}`;
  $("#cbOpen").disabled = n < 2;
  $("#cbOpen").title = n < 2 ? "Kamida 2 ta mahsulot tanlang" : "";
}

function renderCompare() {
  const list = state.compare.map(byId).filter(Boolean);
  if (list.length < 2) { closeAll(); return; }
  const keys = [...new Set(list.flatMap((p) => Object.keys(p.specs)))];
  const minPrice = Math.min(...list.map((p) => p.price));
  const maxRating = Math.max(...list.map((p) => p.rating));
  const row = (label, cells) => {
    const diff = new Set(cells.map((c) => c.v)).size > 1;
    return `<tr class="${diff ? "diff" : ""}"><th scope="row">${label}</th>${cells.map((c) => `<td class="${c.best ? "best" : ""}">${esc(c.v)}</td>`).join("")}</tr>`;
  };
  $("#compareBody").innerHTML = `
    <h3 class="cmp-title">Solishtirish: ${esc(catOf(list[0]).name)}</h3>
    <p class="cmp-sub">${list.length} ta mahsulot yonma-yon. Eng arzon narx va eng yuqori reyting yashil rangda.</p>
    <div class="cmp-scroll">
      <table class="cmp-table">
        <thead><tr><th></th>${list.map((p) => `<th><div class="cmp-head">
          <img src="${pImg(p)}" alt="${escapeHtml(p.name)}" />
          <b>${esc(p.name)}</b>
          <button data-cmp-rm="${p.id}">Olib tashlash</button>
        </div></th>`).join("")}</tr></thead>
        <tbody>
          ${row("Narx", list.map((p) => ({ v: fmt(p.price), best: p.price === minPrice })))}
          ${row("Bo'lib to'lash", list.map((p) => ({ v: fmt(p.price / 12) + "/oy" })))}
          ${row("Reyting", list.map((p) => ({ v: p.reviews ? "★ " + p.rating : "—", best: p.reviews > 0 && p.rating === maxRating })))}
          ${row("Sharhlar", list.map((p) => ({ v: p.reviews + " ta" })))}
          ${row("Omborda", list.map((p) => ({ v: p.stock + " dona" })))}
          ${keys.map((k) => row(k, list.map((p) => ({ v: p.specs[k] || "—" })))).join("")}
          <tr><th></th>${list.map((p) => `<td><button class="btn btn-primary btn-sm" data-cmp-add="${p.id}">Savatga</button></td>`).join("")}</tr>
        </tbody>
      </table>
    </div>
    <p class="cmp-legend"><span>●</span> belgisi — qiymatlari farq qiladigan qatorlar</p>`;
}

$("#cbOpen").addEventListener("click", () => { renderCompare(); openLayer($("#compareModal")); });
$("#cbClear").addEventListener("click", () => {
  state.compare = []; store.set("compare", []);
  $$("#productGrid [data-cmp]").forEach((b) => b.classList.remove("on"));
  renderCompareBar();
});
$("#compareBody").addEventListener("click", (e) => {
  const rm = e.target.closest("[data-cmp-rm]");
  const add = e.target.closest("[data-cmp-add]");
  if (rm) { toggleCompare(+rm.dataset.cmpRm); renderCompare(); }
  if (add) addToCart(+add.dataset.cmpAdd, 1, add);
});

// ---------- Ilova (PWA) ----------
const isStandalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
let installPrompt = null;
function updateInstallUI() {
  $("#installBtn").hidden = !installPrompt || isStandalone;
  $("#appInstall").hidden = isStandalone;
  $("#appInstalled").hidden = !isStandalone;
}
async function installApp() {
  if (installPrompt) {
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    installPrompt = null;
    updateInstallUI();
    if (outcome === "accepted") { toast("📲 OPUS MARKET bosh ekranga qo'shildi"); confetti(120); }
  } else {
    // Brauzer avtomatik o'rnatishni taklif qilmasa (iPhone Safari va h.k.) — qo'lda qilish yo'riqnomasi
    $("#appHowto").hidden = !$("#appHowto").hidden;
  }
}
// OPUS Android ilovasi ichida ochilgan bo'lsa: "Ilovani yuklab oling" bo'limi kerak emas,
// telefonning "Orqaga" tugmasi esa avval ochiq oynani (savat, mahsulot…) yopadi (MainActivity.onBackPressed)
const IN_APP = /OPUSApp\//.test(navigator.userAgent);
if (IN_APP) document.documentElement.classList.add("in-app");
window.__opusBack = () => {
  if (!$$(".drawer.open, .modal.open").length) return false;
  closeAll();
  return true;
};
// Android APK, iPhone yo'riqnomasi, QR-kod va telefon maketi
(() => {
  const apk = SETTINGS.apk;
  const link = $("#apkLink");
  if (apk && apk.url) {
    link.href = apk.url;
    $("#apkMeta").textContent = `v${apk.version} · ${apk.sizeMB} MB`;
    link.addEventListener("click", () => toast("⬇️ OPUS APK yuklab olinmoqda… Tugagach faylni ochib o'rnating"));
  } else link.hidden = true;

  $("#iosBadge").addEventListener("click", () => {
    const box = $("#appHowto");
    box.hidden = !box.hidden;
    if (!box.hidden) box.scrollIntoView({ block: "nearest" });
  });

  // Kompyuterdan kirganlar uchun: telefon bilan skanerlash uchun QR
  if (apk && apk.url && matchMedia("(pointer: fine)").matches && innerWidth > 860) {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
    s.onload = () => {
      try {
        new QRCode($("#qrBox"), { text: apk.url, width: 160, height: 160, colorDark: "#1a0508", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.M });
        $("#appQr").hidden = false;
      } catch {}
    };
    document.head.appendChild(s);
  }

  if (apk && apk.sizeMB) $("#apkSize").textContent = apk.sizeMB + " MB";
  // iPhone ekranidagi do'kon: eng ommabop mahsulotlar (haqiqiy ilova dizaynida)
  const top = PRODUCTS.slice().sort((a, b) => b.popular - a.popular);
  $("#ipCards").innerHTML = top.slice(0, 6).map((p) =>
    `<div class="ip-card"><img src="${pImg(p, 300)}" alt="" loading="lazy" /><div><i>${fmt(Math.round(p.price / 12)).replace(" so'm", "")} so'm/oy</i><b>${escapeHtml(p.name)}</b><span>${fmt(p.price)}</span></div></div>`).join("");
  // Telefon ortidagi polaroid suratlar
  const pol = top.filter((p) => cutOf(p)).slice(0, 2);
  pol.forEach((p, i) => { const im = $("#ipPol" + (i + 1)); if (im) im.src = cutOf(p); });
  $("#ipStories").innerHTML = top.slice(6, 12).map((p) => `<span><img src="${pImg(p, 120)}" alt="" loading="lazy" /></span>`).join("");
  // Kalendar ikonkasida bugungi sana
  const now = new Date();
  $("#ipDow").textContent = ["Yak", "Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"][now.getDay()];
  $("#ipDay").textContent = now.getDate();
  // Ilova aynan OPUS ikonkasidan ochilib, unga qaytib yopiladi
  const scr = $("#ipScreen"), ic = $(".ip-app.opus");
  const origin = () => { if (!scr.clientWidth) return; const im = ic.firstElementChild; scr.style.setProperty("--ox", ((ic.offsetLeft + ic.offsetWidth / 2) / scr.clientWidth) * 100 + "%"); scr.style.setProperty("--oy", ((ic.offsetTop + im.offsetHeight / 2) / scr.clientHeight) * 100 + "%"); };
  origin(); addEventListener("load", origin);
  // Sichqoncha bilan telefon biroz buriladi (3D)
  const ph = $("#iphone"), vis = $(".app-visual");
  if (matchMedia("(pointer: fine)").matches && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    vis.addEventListener("pointermove", (e) => { const r = vis.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; ph.style.setProperty("--ry", (x * 22).toFixed(2) + "deg"); ph.style.setProperty("--rx", (-y * 14).toFixed(2) + "deg"); });
    vis.addEventListener("pointerleave", () => { ph.style.setProperty("--ry", "0deg"); ph.style.setProperty("--rx", "0deg"); });
  }
})();

addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installPrompt = e; updateInstallUI(); });
addEventListener("appinstalled", () => { installPrompt = null; updateInstallUI(); });
$("#installBtn").addEventListener("click", installApp);
$("#appInstall").addEventListener("click", installApp);
updateInstallUI();

// Faqat haqiqiy saytda (https) — lokal ishlab chiqishda kesh eski fayllarni ko'rsatib qo'ymasligi uchun
if ("serviceWorker" in navigator && location.protocol === "https:") {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

// ---------- Yangiliklar ----------
const NEWS_LIST = typeof NEWS !== "undefined" ? NEWS : [];
const MONTHS_UZ = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const fmtDate = (s) => { const d = new Date(s + "T00:00:00"); return isNaN(d) ? esc(s) : `${d.getDate()}-${MONTHS_UZ[d.getMonth()]}, ${d.getFullYear()}`; };
const sortedNews = () => NEWS_LIST.slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || String(b.date).localeCompare(String(a.date)));
let newsTag = "all", newsAll = false;

function renderNews() {
  if (!NEWS_LIST.length) { $("#news").hidden = true; return; }
  const tags = [...new Set(NEWS_LIST.map((n) => n.tag).filter(Boolean))];
  $("#newsTabs").innerHTML = ["all", ...tags].map((t) =>
    `<button class="chip ${t === newsTag ? "active" : ""}" data-tag="${esc(t)}">${t === "all" ? "Barchasi" : esc(t)}</button>`).join("");
  const list = sortedNews().filter((n) => newsTag === "all" || n.tag === newsTag);
  $("#newsMore").hidden = newsAll || list.length <= 4;
  $("#newsGrid").innerHTML = list.slice(0, newsAll ? list.length : 4).map((n, i) => `
    <article class="news-card ${i === 0 ? "featured" : ""}" data-news="${n.id}" tabindex="0" role="button" aria-label="${esc(n.title)}">
      <div class="news-img"><img src="${esc(IMG(n.img))}" alt="" loading="lazy" onerror="this.parentNode.classList.add('noimg');this.remove()" />${n.pinned ? `<span class="news-pin">📌 Muhim</span>` : ""}</div>
      <div class="news-text">
        <div class="news-meta"><span class="news-tag">${esc(n.tag || "Yangilik")}</span><time datetime="${esc(n.date)}">${fmtDate(n.date)}</time></div>
        <h3>${esc(n.title)}</h3>
        <p>${esc(n.excerpt || "")}</p>
        <span class="news-read">O'qish <span>→</span></span>
      </div>
    </article>`).join("");
}

function openNews(id) {
  const n = NEWS_LIST.find((x) => x.id === id);
  if (!n) return;
  const others = sortedNews().filter((x) => x.id !== id).slice(0, 3);
  $("#newsBody").innerHTML = `
    ${n.img ? `<div class="na-img"><img src="${esc(IMG(n.img))}" alt="" onerror="this.parentNode.remove()" /></div>` : ""}
    <div class="news-meta"><span class="news-tag">${esc(n.tag || "Yangilik")}</span><time datetime="${esc(n.date)}">${fmtDate(n.date)}</time></div>
    <h2>${esc(n.title)}</h2>
    <div class="na-body">${String(n.body || n.excerpt || "").split(/\n\s*\n/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("")}</div>
    <div class="na-foot">
      <button class="btn btn-ghost btn-sm" id="naShare">🔗 Havolani nusxalash</button>
      ${others.length ? `<div class="na-others"><b>Boshqa yangiliklar</b>${others.map((o) => `<button data-news-link="${o.id}"><span>${fmtDate(o.date)}</span>${esc(o.title)}</button>`).join("")}</div>` : ""}
    </div>`;
  openLayer($("#newsModal"));
  $("#newsModal .modal-box").scrollTop = 0;
  history.replaceState(null, "", "#news-" + id);
  $("#naShare").addEventListener("click", () => {
    const url = location.origin + location.pathname + "#news-" + id;
    navigator.clipboard?.writeText(url).then(() => toast("🔗 Havola nusxalandi"), () => toast(url));
  });
}

$("#newsTabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tag]");
  if (b) { newsTag = b.dataset.tag; newsAll = false; renderNews(); }
});
$("#newsMore").addEventListener("click", () => { newsAll = true; renderNews(); });
$("#newsGrid").addEventListener("click", (e) => { const c = e.target.closest("[data-news]"); if (c) openNews(+c.dataset.news); });
$("#newsGrid").addEventListener("keydown", (e) => { if (e.key === "Enter") { const c = e.target.closest("[data-news]"); if (c) openNews(+c.dataset.news); } });
$("#newsBody").addEventListener("click", (e) => { const b = e.target.closest("[data-news-link]"); if (b) openNews(+b.dataset.newsLink); });

// ---------- Akkaunt: kirish, ro'yxatdan o'tish, profil ----------
// "998901234567" → "+998 90 123 45 67"
const fmtPhone = (p) => { const d = String(p || "").replace(/\D/g, "").replace(/^998/, ""); return "+998 " + [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].join(" "); };
const initials = (n) => String(n || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
let afterLogin = null;

function renderAccBtn() {
  const u = auth.user, ini = $("#accIni");
  ini.hidden = !u;
  ini.innerHTML = u ? (u.avatar ? `<img src="${esc(u.avatar)}" alt="" />` : esc(initials(u.name))) : "";
  ini.classList.toggle("has-img", !!(u && u.avatar));
  if (u) paintAccAva();
  $("#accLabel").textContent = u ? u.name.split(/\s+/)[0] : "Kirish";
  $("#accBtn").classList.toggle("on", !!u);
  $("#accBtn").title = u ? u.name + " — akkaunt" : "Kirish / Ro'yxatdan o'tish";
}

// Kirmagan bo'lsa — kirish oynasini ochadi, kirgandan keyin then() ni bajaradi
function requireLogin(msg, then) {
  afterLogin = then || null;
  openAuth("login", msg, true);
}
function openAuth(tab = "login", msg, keep) {
  if (!keep) afterLogin = null; // oldingi yopilgan oynadan qolgan amal keyingi kirishda bajarilmasin
  $("#authSub").textContent = msg || "Akkauntingizga kiring yoki yangisini oching";
  $("#authModal").classList.toggle("why", !!msg);
  authTab(tab);
  $$(".auth-err").forEach((e) => (e.hidden = true));
  openLayer($("#authModal"));
  setTimeout(() => $(tab === "login" ? "#loginForm [name=login]" : "#registerForm [name=name]").focus(), 350);
}
function authTab(tab) {
  $$("[data-auth-tab]").forEach((b) => b.classList.toggle("active", b.dataset.authTab === tab));
  $(".auth-tabs").dataset.tab = tab;
  $("#loginForm").hidden = tab !== "login";
  $("#registerForm").hidden = tab !== "register";
  $("#authTitle").textContent = tab === "login" ? "Xush kelibsiz!" : "Yangi akkaunt";
}
$(".auth-tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-auth-tab]"); if (b) authTab(b.dataset.authTab); });
$$(".pw-eye").forEach((b) => b.addEventListener("click", () => {
  const i = b.previousElementSibling;
  i.type = i.type === "password" ? "text" : "password";
  b.classList.toggle("on", i.type === "text");
}));

function phoneMask(input) {
  input.addEventListener("input", (e) => {
    let d = e.target.value.replace(/\D/g, "");
    if (d.startsWith("998")) d = d.slice(3);
    d = d.slice(0, 9);
    const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
    e.target.value = "+998" + (parts.length ? " " + parts.join(" ") : "");
  });
  input.addEventListener("focus", (e) => { if (!e.target.value) e.target.value = "+998 "; });
}
phoneMask($("#registerForm [name=phone]"));

function authError(formEl, msg) {
  const el = $(".auth-err", formEl);
  el.textContent = msg;
  el.hidden = !msg;
}
async function authSubmit(formEl, path, body) {
  const btn = $("button.btn", formEl), label = btn.textContent;
  btn.disabled = true; btn.textContent = "⏳ Kuting...";
  try {
    const r = await api("POST", path, body);
    setAuth(r.token, r.user);
    if (TG) tgAuth(); // Telegram ichida kirgan bo'lsa — shu Telegram akkauntini bog'laymiz
    formEl.reset();
    closeAll();
    toast(path.endsWith("register") ? `🎉 Xush kelibsiz, ${r.user.name}! Akkaunt ochildi.` : `👋 Salom, ${r.user.name}!`);
    const next = afterLogin; afterLogin = null;
    if (next) setTimeout(next, 380);
  } catch (e) {
    authError(formEl, e.message);
  } finally {
    btn.disabled = false; btn.textContent = label;
  }
}
$("#loginForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target.elements;
  if (!f.login.value.trim() || !f.password.value) return authError(e.target, "Telefon (yoki email) va parolni kiriting");
  authSubmit(e.target, "/api/auth/login", { login: f.login.value.trim(), password: f.password.value });
});
$("#registerForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target.elements;
  $$("input", e.target).forEach((i) => i.classList.remove("invalid"));
  const bad = (el, msg) => { el.classList.add("invalid"); authError(e.target, msg); };
  if (f.name.value.trim().length < 2) return bad(f.name, "Ism familiyangizni kiriting");
  if (!/^\+998 \d{2} \d{3} \d{2} \d{2}$/.test(f.phone.value.trim())) return bad(f.phone, "Telefon raqamni to'liq kiriting: +998 90 123 45 67");
  if (f.email.value && !f.email.checkValidity()) return bad(f.email, "Email noto'g'ri");
  if (f.password.value.length < 6) return bad(f.password, "Parol kamida 6 ta belgidan iborat bo'lsin");
  if (f.password.value !== f.password2.value) return bad(f.password2, "Parollar bir xil emas");
  authSubmit(e.target, "/api/auth/register", { name: f.name.value.trim(), phone: f.phone.value, email: f.email.value.trim() || null, password: f.password.value });
});

// Profil oynasi
$("#profileForm [name=region]").innerHTML = $("#checkoutForm [name=region]").innerHTML;
// ---------- Profil rasmi: brauzerda 256×256 ga kesiladi va kichraytiriladi, serverga ~20–40 KB ketadi ----------
function paintAccAva() {
  const u = auth.user, box = $("#accAva"); if (!box || !u) return;
  box.innerHTML = u.avatar ? `<img src="${esc(u.avatar)}" alt="" />` : esc(initials(u.name));
  $("#accAvaBtn").classList.toggle("has-img", !!u.avatar);
  $("#accAvaRm").hidden = !u.avatar;
}
function squareImage(file, size = 256) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const s = Math.min(img.naturalWidth, img.naturalHeight), c = document.createElement("canvas");
      c.width = c.height = size;
      const g = c.getContext("2d"); g.imageSmoothingQuality = "high";
      g.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      let q = .86, out = c.toDataURL("image/jpeg", q);
      while (out.length > 85000 && q > .4) { q -= .12; out = c.toDataURL("image/jpeg", q); }
      res(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("Rasmni o'qib bo'lmadi")); };
    img.src = url;
  });
}
async function saveAvatar(avatar) {
  const btn = $("#accAvaBtn"); btn.classList.add("busy");
  try {
    const r = await api("PATCH", "/api/me", { avatar });
    setAuth(auth.token, r.user); paintAccAva();
    toast(avatar ? "Profil rasmi yangilandi" : "Profil rasmi olib tashlandi");
  } catch (e) { toast("⚠️ " + e.message); }
  btn.classList.remove("busy");
}
$("#accAvaBtn").addEventListener("click", () => $("#accAvaFile").click());
$("#accAvaFile").addEventListener("change", async (e) => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  if (!/^image\//.test(f.type)) return toast("⚠️ Rasm faylini tanlang");
  if (f.size > 15e6) return toast("⚠️ Rasm juda katta (15 MB gacha)");
  try { await saveAvatar(await squareImage(f)); } catch (ex) { toast("⚠️ " + ex.message); }
});
$("#accAvaRm").addEventListener("click", () => saveAvatar(null));

// ---------- Kabinet sahifasi (#account-orders, #account-watch, #account-reviews, #account-profile) ----------
const ACC_TABS = ["orders", "watch", "reviews", "profile"];
const accCount = (sel, n) => { const e = $(sel); if (e) e.textContent = n ? n : ""; };
function accTab(t) {
  $$("[data-acctab]").forEach((b) => { const on = b.dataset.acctab === t; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
  $$(".acc-pane").forEach((p) => (p.hidden = p.dataset.pane !== t));
  if (location.hash !== "#account-" + t) history.replaceState(null, "", "#account-" + t);
  if (t === "orders") loadAccOrders();
  if (t === "watch" || t === "reviews") renderAccWatch();
}
function closeAccount() {
  if (!document.body.classList.contains("acc-open")) return;
  document.body.classList.remove("acc-open");
  $("#accountPage").hidden = true;
}
$("#accountPage").addEventListener("click", (e) => { const b = e.target.closest("[data-acctab]"); if (b) { sfx("tab"); accTab(b.dataset.acctab); } });
$("#accBack").addEventListener("click", (e) => { e.preventDefault(); closeAccount(); history.pushState(null, "", location.pathname + location.search); scrollTo({ top: 0 }); });
// Sahifadagi boshqa havola (#products va h.k.) yoki "Orqaga" — kabinet yopiladi
addEventListener("hashchange", () => {
  const m = location.hash.match(/^#account(?:-(\w+))?$/);
  if (m) return openAccount(m[1]);
  if (!document.body.classList.contains("acc-open")) return;
  closeAccount();
  const t = location.hash.length > 1 && document.getElementById(location.hash.slice(1));
  if (t) requestAnimationFrame(() => t.scrollIntoView());
});
{ const m = location.hash.match(/^#account(?:-(\w+))?$/); if (m) setTimeout(() => openAccount(m[1]), 600); }
function openAccount(tab) {
  tab = ACC_TABS.includes(tab) ? tab : "orders";
  if (!auth.user) return requireLogin("Kabinetga kirish uchun akkauntingizga kiring", () => openAccount(tab));
  const u = auth.user, f = $("#profileForm").elements;
  paintAccAva();
  $("#accName").textContent = u.name;
  $("#accPhone").textContent = (u.phone ? fmtPhone(u.phone) : "Telefon kiritilmagan") + (u.email ? " · " + u.email : "");
  f.name.value = u.name || ""; f.email.value = u.email || ""; f.address.value = u.address || "";
  f.region.value = u.region || "Toshkent shahri";
  $("#passForm").reset();
  closeAll(false, true);
  const was = document.body.classList.contains("acc-open");
  document.body.classList.add("acc-open");
  $("#accountPage").hidden = false;
  if (!location.hash.startsWith("#account")) history.pushState(null, "", "#account-" + tab);
  accTab(tab);
  if (!was) {
    scrollTo({ top: 0 });
    const pg = $("#accountPage"); pg.classList.remove("acc-enter"); void pg.offsetWidth; pg.classList.add("acc-enter");
  }
  if (tab !== "watch" && tab !== "reviews") renderAccWatch(); // hisoblagichlar uchun
  // Ma'lumotlar boshqa qurilmada o'zgargan bo'lishi mumkin — yangilab qo'yamiz
  api("GET", "/api/me").then((r) => setAuth(auth.token, r.user), (e) => { if (e.status === 401) { closeAll(); toast("Seans tugagan — qayta kiring"); } });
}
$("#accBtn").addEventListener("click", () => openAccount("orders"));
$("#accLogout").addEventListener("click", async () => {
  try { await api("POST", "/api/auth/logout"); } catch {}
  setAuth(null);
  closeAll();
  closeAccount(); history.pushState(null, "", location.pathname + location.search); scrollTo({ top: 0 });
  toast("Akkauntdan chiqdingiz");
});
$("#profileForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target.elements;
  if (f.name.value.trim().length < 2) return toast("⚠️ Ism familiyangizni kiriting");
  try {
    const r = await api("PATCH", "/api/me", { name: f.name.value.trim(), email: f.email.value.trim() || null, region: f.region.value, address: f.address.value.trim() });
    setAuth(auth.token, r.user);
    $("#accName").textContent = r.user.name; paintAccAva();
    toast("✅ Ma'lumotlar saqlandi");
  } catch (err) { toast("⚠️ " + err.message); }
});
$("#passForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target.elements;
  if (f.password.value.length < 6) return toast("⚠️ Yangi parol kamida 6 ta belgi");
  try {
    await api("POST", "/api/me/password", { old: f.current.value, new: f.password.value });
    e.target.reset();
    toast("🔒 Parol yangilandi. Boshqa qurilmalardagi seanslar yopildi.");
  } catch (err) { toast("⚠️ " + err.message); }
});

// ---------- Mahsulot sharhlari ----------
const timeAgo = (ms) => {
  const d = Math.floor((Date.now() - ms) / 864e5);
  return d < 1 ? "bugun" : d < 2 ? "kecha" : d < 30 ? `${d} kun oldin` : new Date(ms).toLocaleDateString("ru-RU");
};
const starRow = (n) => `<span class="rv-stars" aria-label="${n} yulduz">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? "on" : ""}">★</i>`).join("")}</span>`;
async function loadReviews(p, fresh) {
  const box = $("#pmReviews");
  let data = { reviews: [], count: 0, avg: 0 };
  // fresh — o'z sharhimizni yuborgandan keyin 20 soniyalik keshni chetlab o'tamiz
  try { data = await api("GET", `/api/products/${p.id}/reviews${fresh ? "?t=" + Date.now() : ""}`); } catch {}
  if (!box.isConnected || $("#pmReviews") !== box) return; // boshqa mahsulot ochilib bo'lgan
  const dist = [5, 4, 3, 2, 1].map((s) => ({ s, n: data.reviews.filter((r) => r.rating === s).length }));
  box.innerHTML = `
    <div class="rv-head">
      <div class="rv-score">
        <b>${data.count ? data.avg.toFixed(1) : "—"}</b>
        ${starRow(Math.round(data.avg))}
        <small>${data.count ? `${data.count} ta mijoz sharhi` : "Hali sharh yo'q"}</small>
      </div>
      <div class="rv-dist">${dist.map((d) => `<div><span>${d.s}★</span><i><em style="width:${data.count ? (d.n / data.count) * 100 : 0}%"></em></i><small>${d.n}</small></div>`).join("")}</div>
      <button class="btn btn-primary btn-sm" id="rvWrite">✍️ Sharh yozish</button>
    </div>
    <form class="rv-form" id="rvForm" hidden>
      <div class="rv-pick" role="radiogroup" aria-label="Baho">${[1, 2, 3, 4, 5].map((i) => `<button type="button" data-star="${i}" aria-label="${i} yulduz">★</button>`).join("")}<span id="rvPickLabel">Baho bering</span></div>
      <textarea name="text" rows="3" maxlength="1000" placeholder="Mahsulot haqida fikringiz: sifati, ishlashi, yetkazib berish…"></textarea>
      <div class="rv-form-foot"><small class="muted">✓ "Xarid qilgan" belgisi bilan, do'kon tekshiruvidan so'ng chiqadi</small><button class="btn btn-primary btn-sm">Yuborish</button></div>
    </form>
    <div class="rv-list">${data.reviews.length ? data.reviews.map((r) => `
      <article class="rv-item">
        <header><i class="rv-ava">${esc(r.author[0] || "?")}</i><div><b>${esc(r.author)}</b>${r.verified ? `<span class="rv-ver">✓ Xarid qilgan</span>` : ""}<small>${timeAgo(r.created_at)}</small></div>${starRow(r.rating)}</header>
        <p>${esc(r.text)}</p>
        ${r.reply ? `<div class="rv-reply"><b>OPUS MARKET javobi:</b> ${esc(r.reply)}</div>` : ""}
      </article>`).join("") : `<p class="rv-empty">Bu mahsulotga birinchi bo'lib sharh qoldiring — boshqa xaridorlarga yordam bering! ⭐</p>`}</div>`;
  let rating = 0;
  const labels = ["", "Yomon", "O'rtacha emas", "Yaxshi", "Juda yaxshi", "A'lo!"];
  const paint = (n) => $$("[data-star]", box).forEach((b) => b.classList.toggle("on", +b.dataset.star <= n));
  $$("[data-star]", box).forEach((b) => {
    b.addEventListener("mouseenter", () => paint(+b.dataset.star));
    b.addEventListener("mouseleave", () => paint(rating));
    b.addEventListener("click", () => { rating = +b.dataset.star; paint(rating); $("#rvPickLabel").textContent = labels[rating]; });
  });
  $("#rvWrite").addEventListener("click", async () => {
    if (!auth.user) return requireLogin("Sharh yozish uchun akkauntingizga kiring", () => { openProduct(p.id); let n = 0; const t = setInterval(() => { const w = $("#rvWrite"); if (w || ++n > 40) { clearInterval(t); w && w.click(); } }, 150); });
    let m; try { m = await loadMine(true); } catch (err) { return toast("⚠️ " + err.message); }
    if (!m.bought.includes(p.id)) return toast("🛍 Sharhni faqat shu mahsulotni sotib olib, qabul qilgan mijozlar yoza oladi — shunda har bir baho haqiqiy bo'ladi");
    const f = $("#rvForm"), own = m.reviews.find((x) => x.product_id === p.id);
    if (own && f.hidden) { rating = own.rating; paint(rating); $("#rvPickLabel").textContent = labels[rating]; f.elements.text.value = own.text; }
    f.hidden = !f.hidden;
    if (!f.hidden) f.elements.text.focus();
  });
  if (auth.token) loadMine().then((m) => {
    if (!m || !box.isConnected) return;
    const own = m.reviews.find((x) => x.product_id === p.id), w = $("#rvWrite");
    if (own && own.pending) $(".rv-head", box).insertAdjacentHTML("afterend", `<p class="rv-pend">⏳ Sharhingiz tekshiruvda — tasdiqlangach shu yerda chiqadi</p>`);
    if (w && m.bought.includes(p.id)) w.textContent = own ? "✏️ Sharhni tahrirlash" : "⭐ Baho berish";
  }).catch(() => {});
  $("#rvForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = e.target.elements.text.value.trim();
    if (!rating) return toast("⭐ Avval yulduzcha bilan baho bering");
    if (text.length < 3) return toast("✍️ Fikringizni bir necha so'z bilan yozing");
    const btn = $("button.btn", e.target);
    btn.disabled = true;
    try {
      await api("POST", `/api/products/${p.id}/reviews`, { rating, text });
      toast("🙏 Rahmat! Sharhingiz tekshiruvdan so'ng chiqadi");
      siteMine = null; loadReviews(p, true);
      loadReviewStats(); renderTestimonials();
    } catch (err) {
      btn.disabled = false;
      if (err.status === 401) return requireLogin("Seans tugagan — qayta kiring", () => openProduct(p.id));
      toast("⚠️ " + err.message);
    }
  });
}

// ---------- Katalog serverdan ----------
// Sahifa avval data.js bilan darhol chiziladi, keyin serverdagi eng so'nggi katalog (narx, ombor, yangi mahsulotlar) bilan yangilanadi.
async function loadCatalog() {
  if (window.OPUS_PREVIEW) return;
  try {
    const d = await api("GET", "/api/catalog");
    if (!d.PRODUCTS || !d.PRODUCTS.length) return;
    PRODUCTS.splice(0, PRODUCTS.length, ...d.PRODUCTS);
    CATEGORIES.splice(0, CATEGORIES.length, ...d.CATEGORIES);
    if (d.NEWS) NEWS_LIST.splice(0, NEWS_LIST.length, ...d.NEWS);
    Object.keys(SETTINGS).forEach((k) => delete SETTINGS[k]);
    Object.assign(SETTINGS, d.SETTINGS);
    applySettings();
    applyReviewStats();
    state.cart = state.cart.filter((x) => byId(x.id));
    if (state.promo && !PROMOS[state.promo]) state.promo = null;
    if (SETTINGS.topbar) $("#topbarText").textContent = String(SETTINGS.topbar).replace(/^\p{Extended_Pictographic}️?\s*/u, "");
    if (SETTINGS.dealTitle) $("#dealTitle").textContent = SETTINGS.dealTitle;
    renderCategories(); renderProducts(); renderCart(); renderRecent(); renderCompareBar(); renderNews(); updateBadges(); renderHero(); renderBuilds(); renderConnect(); $$(".hero [data-live]").forEach((el) => { el.textContent = el.dataset.live === "products" ? PRODUCTS.length : new Set(PRODUCTS.map((p) => p.brand)).size; });
  } catch {}
}

// ---------- Admin: oldindan ko'rish ----------
if (window.OPUS_PREVIEW) { $("#previewBar").hidden = false; document.body.classList.add("is-preview"); }

// ---------- Admin sozlamalaridagi matnlar ----------
if (SETTINGS.topbar) $("#topbarText").textContent = String(SETTINGS.topbar).replace(/^\p{Extended_Pictographic}️?\s*/u, "");
if (SETTINGS.dealTitle) $("#dealTitle").textContent = SETTINGS.dealTitle;

// Lokal sinov nusxasi (kompyuterdagi server) — haqiqiy sayt bilan adashtirmaslik uchun belgi
if (/^(localhost|127.0.0.1)$/.test(location.hostname)) {
  const b = document.createElement("a");
  b.className = "local-badge"; b.href = "https://javohir877.github.io/OPUS-MARKET/";
  b.innerHTML = "🧪 LOKAL SINOV — Telegram kodi kelmaydi. <u>Haqiqiy saytni ochish →</u>";
  document.body.appendChild(b);
}

// ---------- Init ----------
renderPayments();
renderCategories();
renderProducts();
renderCart();
renderRecent();
renderCompareBar();
renderNews();
loadReviewStats();
renderTestimonials();
// "Mijozlar fikri": haqiqiy xaridorlarning so'nggi sharhlari (4–5★). Sharh bo'lmasa — bo'lim yashiriladi.
async function renderTestimonials() {
  const box = $("#testis");
  if (!box) return;
  let L = [];
  try { L = (await api("GET", "/api/reviews/latest")).reviews || []; } catch { return; }
  L = L.filter((r) => byId(r.product_id)); // o'chirilgan mahsulotlarning sharhlari ko'rsatilmaydi
  $("#reviews").hidden = !L.length;
  box.innerHTML = L.slice(0, 6).map((r) => {
    const p = byId(r.product_id), name = String(r.author || "Mijoz");
    return `<div class="testi">
      <div class="stars">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</div>
      <p>"${esc(r.text)}"</p>
      ${r.reply ? `<p class="testi-reply"><b>OPUS MARKET:</b> ${esc(r.reply)}</p>` : ""}
      <div class="testi-user"><span class="avatar">${esc(name.slice(0, 2).toUpperCase())}</span><div><b>${esc(name)}${r.verified ? ` <span class="rv-ver">✓ Xarid qilgan</span>` : ""}</b>
        ${p ? `<button class="testi-prod" data-tp="${p.id}">${esc(p.name)} →</button>` : ""}<small>${timeAgo(r.created_at)}</small></div></div>
    </div>`;
  }).join("");
}
document.addEventListener("click", (e) => { const b = e.target.closest("[data-tp]"); if (b) openProduct(+b.dataset.tp); });
updateBadges();
renderAccBtn();
loadCatalog();
// Saqlangan seans hali amaldami (admin bloklagan yoki parolni tiklagan bo'lishi mumkin)
if (auth.token) api("GET", "/api/me").then((r) => setAuth(auth.token, r.user), () => {});
// ---------- Telegram Mini App ----------
// Bot menyusidagi "🛒 Do'kon" tugmasi saytni Telegram ichida ochadi. Telegram akkaunti saytdagi akkauntga
// bog'langan bo'lsa — parolsiz kiramiz (Telegram imzosini server tekshiradi).
async function tgAuth() {
  try {
    const r = await api("POST", "/api/auth/telegram", { initData: TG.initData });
    if (r.token) {
      setAuth(r.token, r.user);
      toast(`👋 Salom, ${r.user.name}!`);
    } else if (r.user) setAuth(auth.token, r.user);
  } catch {}
}
if (TG) {
  document.documentElement.classList.add("tg-app");
  TG.ready();
  TG.expand();
  try { TG.setHeaderColor("#0c0708"); TG.setBackgroundColor("#0c0708"); TG.setBottomBarColor?.("#0c0708"); } catch {}
  try { TG.disableVerticalSwipes?.(); } catch {}
  TG.BackButton.onClick(() => closeAll());
  tgAuth();
}
// Yangilik havolasi orqali kelganda (#news-3) — maqolani ochamiz
{ const m = location.hash.match(/^#news-(\d+)$/); if (m) setTimeout(() => openNews(+m[1]), 1500); }

// ---------- OPUS AI — sayt uchun suhbat oynasi (ilova bilan bir xil server va tarix) ----------
(() => {
  if (IN_APP) return; // ilova ichida o'zining OPUS AI ekrani bor
  const KEY = "opus_app_ai";
  const load = () => { try { return (JSON.parse(localStorage.getItem(KEY)) || []).slice(-30); } catch { return []; } };
  const save = (m) => { try { localStorage.setItem(KEY, JSON.stringify(m.slice(-30))); } catch {} };
  let msgs = load(), busy = false;
  const SUG = ["📦 Buyurtmam qayerda?", "🛒 Savatimga nima mos keladi?", "🎮 10 mln gacha o'yin noutbuki", "🖥 Ofis uchun arzon monitor", "⚖️ RTX 4070 yoki RX 6800 XT?", "🛠 30 mln ga kompyuter yig'ib ber", "🎧 Shovqinni yutadigan quloqchin", "🚚 Yetkazish qancha turadi?"];
  const pById = (id) => PRODUCTS.find((p) => p.id === id);
  const html = (t, live, last) => {
    const ids = [];
    let follow = [];
    t = String(t).replace(/\[\[q:([^\]]*)\]\]\s*$/s, (_, q) => { follow = q.split("|").map((x) => x.trim()).filter(Boolean).slice(0, 3); return ""; }).replace(/\[\[q:[^\]]*$/s, "");
    let h = escapeHtml(t.trim()).replace(/\[{1,2}p:(\d+)\]{1,2}/g, (_, id) => { if (pById(+id) && !ids.includes(+id)) ids.push(+id); return ""; })
      .replace(/\[{1,2}p?:?\d*$/, "").replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>").replace(/(^|\n)\s*[*•-]\s+/g, "$1• ").replace(/\n{3,}/g, "\n\n").replace(/\n/g, "<br>");
    if (live) h += `<i class="oa-caret"></i>`;
    const cards = ids.slice(0, 4).map((id) => { const p = pById(id), out = (p.stock || 0) <= 0;
      return `<div class="oa-pc" data-oapid="${p.id}"><img src="${pImg(p, 200)}" alt="" loading="lazy" /><div><b>${escapeHtml(p.name)}</b><span>${fmt(p.price)}</span></div><button class="oa-add" data-oaadd="${p.id}" ${out ? "disabled" : ""} title="Savatga">${out ? "Tugagan" : "🛒"}</button></div>`; }).join("");
    const fu = !live && last && follow.length ? `<div class="oa-follow">${follow.map((q) => `<button type="button" data-oaq="${escapeHtml(q)}">${escapeHtml(q)}</button>`).join("")}</div>` : "";
    return h + (cards ? `<div class="oa-cards">${cards}</div>` : "") + fu;
  };
  const fab = document.createElement("button");
  fab.className = "oa-fab"; fab.id = "oaFab"; fab.title = "OPUS AI yordamchi"; fab.setAttribute("aria-label", "OPUS AI yordamchi");
  fab.innerHTML = `<i class="oa-halo"></i><img src="icons/opus-ai.svg" alt="OPUS AI" />`;
  const box = document.createElement("section");
  box.className = "oa-box"; box.id = "oaBox"; box.setAttribute("aria-label", "OPUS AI suhbat"); box.hidden = true;
  box.innerHTML = `<header class="oa-head"><img class="oa-logo" src="icons/opus-ai.svg" alt="" /><div><b>OPUS AI</b><small>Texnika tanlashda yordam beraman</small></div>
      <button class="oa-ib" data-oaclr title="Suhbatni tozalash">🗑</button><button class="oa-ib" data-oaclose title="Yopish">✕</button></header>
    <div class="oa-list" id="oaList"></div>
    <form class="oa-form" id="oaForm"><textarea id="oaIn" rows="1" maxlength="1000" placeholder="Savolingizni yozing…"></textarea><button class="oa-send" title="Yuborish"><svg viewBox="0 0 24 24"><path d="M3 20.5V14l9-2-9-2V3.5L22 12z"/></svg></button></form>
    <small class="oa-note">OPUS AI xato qilishi mumkin — narx va mavjudlikni mahsulot sahifasida tekshiring.</small>`;
  document.body.append(fab, box);
  const list = $("#oaList"), inp = $("#oaIn"), form = $("#oaForm");
  const bottom = () => requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
  const bubble = (m, i, all) => `<div class="oa-m ${m.role}"><div class="oa-b">${m.role === "ai" ? html(m.text, false, i === all.length - 1) : escapeHtml(m.text).replace(/\n/g, "<br>")}</div></div>`;
  const draw = () => {
    list.innerHTML = msgs.length ? msgs.map(bubble).join("") : `<div class="oa-hero"><img class="oa-logo lg" src="icons/opus-ai.svg" alt="" /><h3>Salom! Men OPUS AI 👋</h3>
      <p>Noutbuk, kompyuter, monitor yoki aksessuar tanlashda yordam beraman — faqat do'konimizdagi haqiqiy narxlar bilan.</p></div>
      <div class="oa-sug">${SUG.map((s) => `<button type="button" data-oaq="${escapeHtml(s.replace(/^\S+\s/, ""))}">${escapeHtml(s)}</button>`).join("")}</div>`;
    bottom();
  };
  // Oyna aynan ikonkaning o'zidan kattalashib chiqadi va yopilganda unga qaytib kiradi
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let anim = null;
  const fromFab = () => {
    const r = box.getBoundingClientRect(), f = fab.getBoundingClientRect();
    const s = Math.max(0.08, f.width / r.width);
    return `translate(${f.left + f.width / 2 - (r.left + r.width / 2)}px, ${f.top + f.height / 2 - (r.top + r.height / 2)}px) scale(${s})`;
  };
  const open = () => {
    if (box.classList.contains("open")) return;
    box.hidden = false; box.classList.add("open"); document.documentElement.classList.add("oa-on"); if (!busy) draw();
    const from = fromFab(); fab.classList.add("hide");
    if (anim) anim.cancel();
    if (!reduce) anim = box.animate([{ transform: from, opacity: 0, borderRadius: "60px" }, { transform: "none", opacity: 1, borderRadius: "24px" }], { duration: 380, easing: "cubic-bezier(.2,.9,.25,1)" });
    setTimeout(() => inp.focus(), 300);
  };
  const close = () => {
    if (!box.classList.contains("open")) return;
    box.classList.remove("open"); document.documentElement.classList.remove("oa-on");
    const done = () => { if (box.classList.contains("open")) return; box.hidden = true; fab.classList.remove("hide"); };
    if (reduce) return done();
    const to = fromFab(); if (anim) anim.cancel();
    anim = box.animate([{ transform: "none", opacity: 1, borderRadius: "24px" }, { transform: to, opacity: 0, borderRadius: "60px" }], { duration: 300, easing: "cubic-bezier(.4,0,.7,.2)", fill: "forwards" });
    const me = anim; let fin = false;
    const end = () => { if (fin) return; fin = true; if (anim === me) { me.cancel(); anim = null; } done(); };
    me.onfinish = end; setTimeout(end, 340);
  };
  const fit = () => { inp.style.height = "auto"; inp.style.height = Math.min(120, inp.scrollHeight) + "px"; };
  async function ask(q) {
    q = q.trim(); if (!q || busy) return;
    busy = true; form.classList.add("busy");
    msgs.push({ role: "user", text: q.slice(0, 1000) }); save(msgs); inp.value = ""; fit(); draw();
    list.insertAdjacentHTML("beforeend", `<div class="oa-m ai live"><div class="oa-b"><span class="oa-dots"><i></i><i></i><i></i></span></div></div>`);
    const b = $(".oa-m.live .oa-b", list); bottom();
    let text = "";
    try {
      const ctx = { cart: (state.cart || []).slice(0, 15), fav: (state.fav || []).slice(0, 10), recent: (state.recent || []).slice(0, 8) };
      const res = await fetch(API_BASE + "/api/ai", { method: "POST", headers: { "Content-Type": "application/json", ...(auth.token ? { Authorization: "Bearer " + auth.token } : {}) }, body: JSON.stringify({ messages: msgs.slice(-12).map((m) => ({ role: m.role, text: m.text.slice(0, 1500) })), ctx }) });
      if (!res.ok) { let e = {}; try { e = await res.json(); } catch {} throw new Error(e.error || "Xatolik (" + res.status + ")"); }
      const rd = res.body && res.body.getReader ? res.body.getReader() : null, dec = new TextDecoder();
      if (rd) { for (;;) { const { done, value } = await rd.read(); if (done) break; text += dec.decode(value, { stream: true }); b.innerHTML = html(text, true); if (list.scrollHeight - list.scrollTop - list.clientHeight < 160) bottom(); } }
      else text = await res.text();
      if (!text.trim()) throw new Error("Javob kelmadi. Qayta urinib ko'ring.");
      msgs.push({ role: "ai", text }); save(msgs);
      b.parentElement.classList.remove("live"); draw();
    } catch (ex) {
      b.parentElement.classList.remove("live"); b.parentElement.classList.add("err");
      b.innerHTML = `⚠️ ${escapeHtml(ex.message === "Failed to fetch" ? "Internet aloqasi yo'q" : ex.message)}<button type="button" class="oa-retry" data-oaretry>↻ Qayta so'rash</button>`;
      b.dataset.q = q; msgs.pop(); save(msgs);
    }
    busy = false; form.classList.remove("busy"); bottom();
  }
  fab.addEventListener("click", open);
  form.addEventListener("submit", (e) => { e.preventDefault(); ask(inp.value); });
  inp.addEventListener("input", fit);
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(inp.value); } });
  // Esc — chat oynasi qayerda fokus bo'lishidan qat'i nazar yopiladi
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && box.classList.contains("open")) close(); });
  box.addEventListener("click", (e) => {
    if (e.target.closest("[data-oaclose]")) return close();
    if (e.target.closest("[data-oaclr]")) { if (!busy) { msgs = []; save(msgs); draw(); } return; }
    const s = e.target.closest("[data-oaq]"); if (s) return ask(s.dataset.oaq);
    const r = e.target.closest("[data-oaretry]"); if (r) { const q = r.closest(".oa-b").dataset.q, m = r.closest(".oa-m"); if (m.previousElementSibling) m.previousElementSibling.remove(); m.remove(); return ask(q); }
    const a = e.target.closest("[data-oaadd]"); if (a) { e.stopPropagation(); addToCart(+a.dataset.oaadd, 1, a); return; }
    const c = e.target.closest("[data-oapid]"); if (c) { if (innerWidth < 640) close(); openProduct(+c.dataset.oapid); }
  });
  // Qidiruvdan ham chaqirish mumkin: window.openOpusAI("savol")
  window.openOpusAI = (q) => { open(); if (q) setTimeout(() => ask(q), 200); };
})();

// ---------- Kuzatuvlar ("Kelganda / arzonlashganda xabar ber") va xaridlarni baholash ----------
let siteAlerts = null, siteMine = null;
async function loadAlerts() {
  if (!auth.token) return (siteAlerts = []);
  return (siteAlerts = (await api("GET", "/api/alerts")).alerts);
}
async function loadMine(force) {
  if (!auth.token) return (siteMine = null);
  if (siteMine && !force) return siteMine;
  return (siteMine = await api("GET", "/api/reviews/mine"));
}
const alertOf = (pid, kind) => (siteAlerts || []).find((x) => x.product_id === pid && x.kind === kind);
function toggleAlert(pid, kind) {
  return new Promise((res) => {
    const go = async () => {
      try {
        if (!siteAlerts) await loadAlerts();
        if (alertOf(pid, kind)) {
          await api("DELETE", `/api/alerts/${pid}/${kind}`);
          siteAlerts = siteAlerts.filter((x) => !(x.product_id === pid && x.kind === kind));
          toast("🔕 Kuzatuv bekor qilindi");
        } else {
          const r = await api("POST", "/api/alerts", { product_id: pid, kind });
          siteAlerts.unshift(r.alert);
          window.sfx && sfx("success");
          toast(kind === "stock" ? "🔔 Omborga kelishi bilan xabar beramiz (Telegram va ilovaga)" : "📉 Narxi tushishi bilan xabar beramiz (Telegram va ilovaga)");
        }
      } catch (e) { toast("⚠️ " + e.message); }
      res();
    };
    if (auth.user) go(); else requireLogin("Kuzatish uchun akkauntingizga kiring", () => { openProduct(pid); go().then(() => openProduct(pid)); });
  });
}
async function renderAccWatch() {
  const box = $("#accWatch"), rbox = $("#accRate"); if (!box || !rbox) return;
  if (!box.children.length) box.innerHTML = `<div class="rv-wait">Yuklanmoqda…</div>`;
  if (!rbox.children.length) rbox.innerHTML = `<div class="rv-wait">Yuklanmoqda…</div>`;
  let al = [], m = null;
  try { [al, m] = await Promise.all([loadAlerts(), loadMine(true)]); } catch { box.innerHTML = rbox.innerHTML = `<p class="muted aw-empty">Yuklab bo'lmadi. Qayta urinib ko'ring.</p>`; return; }
  const all = m ? m.bought.map((id) => ({ p: byId(id), r: m.reviews.find((x) => x.product_id === id) })).filter((x) => x.p) : [];
  all.sort((x, y) => (x.r ? 1 : 0) - (y.r ? 1 : 0));
  const rate = all;
  const watch = al.map((x) => ({ a: x, p: byId(x.product_id) })).filter((x) => x.p);
  const row = (p, sub, btn) => `<div class="aw-row" data-open="${p.id}"><img src="${IMG(p.img, 120)}" alt="" onerror="this.style.visibility='hidden'" /><div><b>${esc(p.name)}</b><small>${sub}</small></div>${btn}</div>`;
  const stars = (n) => `<span class="aw-stars">${"★".repeat(n)}<i>${"★".repeat(5 - n)}</i></span>`;
  accCount("#accCntRate", rate.filter((x) => !x.r).length);
  accCount("#accCntWatch", watch.length);
  rbox.innerHTML = `<p class="acc-hint">Sotib olgan mahsulotlaringizga baho bering — sharhlar "✓ Xarid qilgan" belgisi bilan, tekshiruvdan so'ng chiqadi.</p>
    ${rate.length ? rate.map(({ p, r }) => row(p, !r ? "Hali baho bermagansiz" : r.pending ? "Tekshiruvda" : r.hidden ? "Do'kon tomonidan yashirilgan" : `${stars(r.rating)} Chop etilgan`, `<button type="button" class="btn ${r ? "btn-ghost" : "btn-primary"} btn-sm" data-rate="${p.id}">${r ? "Tahrirlash" : "Baholash"}</button>`)).join("")
      : `<div class="drawer-empty"><img class="stk" src="icons/stk/star.png" alt="" style="width:64px;height:64px" /><h4>Baholanadigan xarid yo'q</h4><p>Buyurtmangiz yetkazilgach, mahsulotlar shu yerda chiqadi.</p></div>`}`;
  box.innerHTML = `<p class="acc-hint">Mahsulot omborga kelsa yoki arzonlashsa — Telegram va ilovaga darhol xabar keladi.</p>
    ${watch.length ? watch.map(({ a, p }) => row(p, a.kind === "stock" ? (p.stock > 0 ? "✅ Omborda bor!" : "Omborga kelishini kutyapsiz") : `${fmt(a.base_price)} dan arzonlashsa · hozir ${fmt(p.price)}`, `<button type="button" class="aw-x" data-unwatch="${p.id}:${a.kind}" aria-label="O'chirish">✕</button>`)).join("")
      : `<div class="drawer-empty"><img class="stk" src="icons/stk/bell.png" alt="" style="width:64px;height:64px" /><h4>Kuzatuv yo'q</h4><p>Mahsulot oynasida «Narxi tushsa xabar berish» yoki «Kelganda xabar berish» tugmasini bosing.</p></div>`}`;
}
document.addEventListener("click", async (e) => {
  const box = e.target.closest("#accWatch, #accRate"); if (!box) return;
  const un = e.target.closest("[data-unwatch]");
  if (un) { const [pid, kind] = un.dataset.unwatch.split(":"); await toggleAlert(+pid, kind); return renderAccWatch(); }
  const rt = e.target.closest("[data-rate]");
  if (rt) { closeAll(); openProduct(+rt.dataset.rate); setTimeout(() => { $("#pmReviews")?.scrollIntoView({ behavior: "smooth" }); setTimeout(() => $("#rvWrite")?.click(), 500); }, 700); return; }
  const op = e.target.closest("[data-open]");
  if (op) { closeAll(); openProduct(+op.dataset.open); }
});
// Kirgan mijozga yangi xabarlar (omborga keldi, narx tushdi, sharh chop etildi)
async function siteNotices() {
  if (!auth.token) return;
  const since = store.get("ntc_since", 0);
  try {
    const r = await api("GET", "/api/notices?since=" + since);
    if (since) (r.notices || []).slice(0, 2).forEach((n, i) => setTimeout(() => toast(`${n.title} ${n.body}`), 1500 + i * 3500));
    store.set("ntc_since", r.now || Date.now());
  } catch {}
}
setTimeout(siteNotices, 2500);
// Ulashilgan havola: #product-12 yoki #p-12 — mahsulot oynasi ochiladi
{ const m = location.hash.match(/^#(?:product|p)-(\d+)$/); if (m) setTimeout(() => { if (byId(+m[1])) { openProduct(+m[1]); history.replaceState(null, "", location.pathname + location.search); } }, 900); }
document.addEventListener("visibilitychange", () => { if (!document.hidden) siteNotices(); });

// =====================================================================
// Test: "Sizga qanday kompyuter kerak?" — 3 savol → katalogdan 3 ta tavsiya
// =====================================================================
(() => {
  const Q = [
    { k: "goal", t: "Kompyuter nima uchun kerak?", o: [["game", "O'yinlar", "fire"], ["work", "Ish va dizayn", "paint-brush"], ["study", "O'qish va ofis", "file"], ["stream", "Striming va video", "video-camera"]] },
    { k: "budget", t: "Byudjetingiz qancha?", o: [["0-8", "8 mln gacha", "wallet"], ["8-15", "8–15 mln", "money-bag"], ["15-30", "15–30 mln", "dollar"], ["30-999", "30 mln dan yuqori", "trophy"]] },
    { k: "type", t: "Qaysi turi qulay?", o: [["pc", "Stol kompyuteri", "computer"], ["laptop", "Noutbuk", "mobile"], ["any", "Farqi yo'q", "tick"]] },
  ];
  let step = 0, ans = {};
  const body = $("#quizBody");
  if (!body) return;
  const spec = (p) => Object.values(p.specs || {}).join(" ") + " " + p.name;
  const score = (p, goal) => {
    const s = spec(p), gpu = /RTX|RX\s?\d|GTX|Radeon Pro|Vega II/i.test(s), ram = +((s.match(/(\d+)\s?GB\s?(DDR|LPDDR|ECC|unified)?/i) || [])[1] || 0);
    if (goal === "game") return (gpu ? 50 : 0) + (/gaming|rog|legion|omen|alienware|victus|tuf/i.test(p.name) ? 25 : 0) + Math.min(ram, 64) / 2;
    if (goal === "work") return (/apple|mac|xps|studio|surface|thinkpad/i.test(p.name) ? 40 : 0) + Math.min(ram, 64) + (/4K|5K|Retina|OLED/i.test(s) ? 15 : 0);
    if (goal === "study") return 60 - p.price / 1e6 + (/air|ofis|optiplex|nuc|go|chromebook|thinkpad/i.test(p.name) ? 25 : 0);
    return (gpu ? 35 : 0) + Math.min(ram, 64) * 1.2 + (/i7|i9|ryzen 7|ryzen 9|m\d (pro|max)/i.test(s) ? 20 : 0);
  };
  function results() {
    const [lo, hi] = ans.budget.split("-").map((x) => +x * 1e6);
    const cats = ans.type === "any" ? ["pc", "laptop"] : [ans.type];
    let L = PRODUCTS.filter((p) => cats.includes(p.cat) && (p.stock ?? 0) > 0 && p.price >= lo && p.price <= hi);
    let wide = false;
    if (L.length < 3) { wide = true; L = PRODUCTS.filter((p) => cats.includes(p.cat) && (p.stock ?? 0) > 0 && p.price <= hi * 1.25); }
    return { L: L.sort((a, b) => score(b, ans.goal) - score(a, ans.goal)).slice(0, 3), wide };
  }
  function draw() {
    if (step < Q.length) {
      const q = Q[step];
      body.innerHTML = `<div class="qz-step">
        <div class="qz-prog">${Q.map((_, i) => `<i class="${i <= step ? "on" : ""}"></i>`).join("")}</div>
        <small class="qz-n">${step + 1} / ${Q.length}-savol</small>
        <h3>${q.t}</h3>
        <div class="qz-opts">${q.o.map(([v, t, ic]) => `<button type="button" class="qz-opt${ans[q.k] === v ? " on" : ""}" data-qv="${v}"><img src="icons/stk/${ic}.png" alt="" /><span>${t}</span></button>`).join("")}</div>
        ${step ? `<button type="button" class="qz-back" data-qback>← Orqaga</button>` : ""}
      </div>`;
      return;
    }
    const { L, wide } = results();
    body.innerHTML = `<div class="qz-step qz-res">
      <div class="qz-prog">${Q.map(() => `<i class="on"></i>`).join("")}</div>
      <h3>Sizga mos variantlar</h3>
      <p class="qz-sub">${wide ? "Aynan shu byudjetda variant kam — yaqin narxdagilarni ham qo'shdik." : "Javoblaringiz bo'yicha katalogimizdan tanlandi."}</p>
      <div class="qz-list">${L.length ? L.map((p, i) => `<div class="qz-card" data-open-p="${p.id}">
        ${i === 0 ? `<span class="qz-best">Eng mos</span>` : ""}
        <div class="qz-img"><img src="${pImg(p, 400)}" alt="" onerror="imgFail(this)" data-icon="${esc((catOf(p) || {}).icon || "laptop")}" /></div>
        <b>${esc(p.name)}</b>
        <small>${esc(Object.values(p.specs || {}).slice(0, 2).join(" · "))}</small>
        <div class="qz-foot"><em>${fmt(p.price)}</em><button type="button" class="add-btn" data-qadd="${p.id}" aria-label="Savatga qo'shish"><svg viewBox="0 0 24 24"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg></button></div>
      </div>`).join("") : `<p class="qz-sub">Afsuski, mos variant topilmadi. Operatorimiz yordam beradi: <a href="tel:+998712000000">+998 71 200 00 00</a></p>`}</div>
      <div class="qz-actions"><button type="button" class="btn btn-ghost btn-sm" data-qagain>Qaytadan</button><button type="button" class="btn btn-ghost btn-sm" data-qai>OPUS AI bilan maslahatlashish</button></div>
    </div>`;
  }
  $("#quizStart").addEventListener("click", () => { step = 0; ans = {}; draw(); openLayer($("#quizModal")); });
  body.addEventListener("click", (e) => {
    const o = e.target.closest("[data-qv]");
    if (o) { ans[Q[step].k] = o.dataset.qv; sfx("tick"); step++; body.classList.remove("qz-anim"); void body.offsetWidth; body.classList.add("qz-anim"); return draw(); }
    if (e.target.closest("[data-qback]")) { step = Math.max(0, step - 1); return draw(); }
    if (e.target.closest("[data-qagain]")) { step = 0; ans = {}; return draw(); }
    if (e.target.closest("[data-qai]")) { closeAll(); const G = { game: "o'yinlar", work: "ish va dizayn", study: "o'qish", stream: "striming" }[ans.goal]; window.openOpusAI && openOpusAI(`${G} uchun ${ans.budget.replace("-", "–").replace("–999", "+")} mln so'm byudjetga kompyuter tanlab bering`); return; }
    const ad = e.target.closest("[data-qadd]");
    if (ad) { e.stopPropagation(); addToCart(+ad.dataset.qadd, 1, ad); return; }
    const c = e.target.closest("[data-open-p]");
    if (c) { const id = +c.dataset.openP; closeAll(); setTimeout(() => openProduct(id), 120); }
  });
})();

// =====================================================================
// Yig'ish g'oyalari — katalogdagi haqiqiy tayyor kompyuterlar
// =====================================================================
let buildTab = 0;
function renderBuilds() {
  const box = $("#buildGrid"); if (!box) return;
  const T = [
    { ids: [145, 144], tag: "Boshlang'ich", lvl: 1, title: "Arzon o'yin kompyuteri", note: "Ofis, o'qish va yengil o'yinlar uchun — eng tejamkor kirish nuqtasi." },
    { ids: [7, 59], tag: "Esports", lvl: 2, title: "Pro gaming to'plami", note: "Zamonaviy o'yinlar yuqori sozlamalarda — raqobatbardosh o'yinchilar uchun." },
    { ids: [6, 60], tag: "Ijodkor", lvl: 3, title: "Striming va montaj stansiyasi", note: "4K montaj, striming va eng og'ir o'yinlar — kelajak zaxirasi bilan." },
  ];
  const used = new Set();
  const L = T.map((t) => {
    const p = t.ids.map(byId).find((x) => x && (x.stock ?? 0) > 0 && !used.has(x.id)) || null;
    if (p) used.add(p.id);
    return p && { ...t, p };
  }).filter(Boolean);
  if (L.length < 2) { box.closest("section").hidden = true; return; }
  buildTab = Math.min(buildTab, L.length - 1);
  const { tag, lvl, title, note, p } = L[buildTab];
  const inCart = state.cart.some((x) => x.id === p.id);
  box.innerHTML = `
    <div class="bs-tabs" role="tablist">${L.map((x, k) => `<button type="button" role="tab" class="${k === buildTab ? "on" : ""}" data-bt="${k}"><em>0${k + 1}</em><span><b>${esc(x.tag)}</b><small>${fmt(x.p.price)}</small></span></button>`).join("")}</div>
    <div class="bs-panel" data-pid="${p.id}">
      <div class="bs-photo"><img src="${pImg(p, 900)}" alt="${esc(p.name)}" onerror="imgFail(this)" data-icon="pc" /><span class="bs-lvl">${[1, 2, 3].map((n) => `<i class="${n <= lvl ? "on" : ""}"></i>`).join("")}<b>${esc(tag)}</b></span></div>
      <div class="bs-info">
        <small class="bs-kicker">${esc(p.name)}</small>
        <h3>${esc(title)}</h3>
        <p>${esc(note)}</p>
        <dl class="bs-specs">${Object.entries(p.specs || {}).slice(0, 6).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
        <div class="bs-buy">
          <div><small>${p.old > p.price ? `<s>${fmt(p.old)}</s>` : "Narxi"}</small><b>${fmt(p.price)}</b><em>${fmt(p.price / 12)}/oy · 0%</em></div>
          <button type="button" class="btn btn-ghost" data-bopen>Batafsil</button>
          <button type="button" class="btn btn-primary" data-badd>${inCart ? "Savatda ✓" : "Savatga"}</button>
        </div>
      </div>
    </div>`;
}
$("#buildGrid") && $("#buildGrid").addEventListener("click", (e) => {
  const t = e.target.closest("[data-bt]");
  if (t) { buildTab = +t.dataset.bt; sfx("tab"); renderBuilds(); const pn = $("#buildGrid .bs-panel"); pn && pn.classList.add("swap"); return; }
  const pn = e.target.closest(".bs-panel"); if (!pn) return;
  const id = +pn.dataset.pid;
  if (e.target.closest("[data-badd]")) { addToCart(id, 1, e.target.closest("[data-badd]")); setTimeout(renderBuilds, 400); return; }
  if (e.target.closest("[data-bopen]") || e.target.closest(".bs-photo")) openProduct(id);
});
renderBuilds();

// =====================================================================
// Biz bilan aloqada bo'ling — Telegram, Instagram (sozlamada bo'lsa), telefon
// =====================================================================
function renderConnect() {
  const box = $("#connectLinks"); if (!box) return;
  const so = SETTINGS.social || {};
  const L = [
    so.tgChannel && { cls: "tg", href: "https://t.me/" + String(so.tgChannel).replace(/^@|https?:\/\/t\.me\//g, ""), t: "Telegram kanal", s: "t.me/" + String(so.tgChannel).replace(/^@|https?:\/\/t\.me\//g, ""), ic: "tg" },
    { cls: "tg", href: "https://t.me/opussmarketbot", t: "Telegram bot", s: "@opussmarketbot — buyurtma va kuzatish", ic: "tg" },
    so.instagram && { cls: "ig", href: "https://instagram.com/" + String(so.instagram).replace(/^@/, ""), t: "Instagram sahifa", s: "@" + String(so.instagram).replace(/^@/, ""), ic: "ig" },
    { cls: "ph", href: "tel:+998712000000", t: "Qo'ng'iroq qiling", s: "+998 71 200 00 00 · 09:00–21:00", ic: "ph" },
  ].filter(Boolean);
  const IC = {
    tg: '<svg viewBox="0 0 24 24"><path d="M21.9 4.3l-3.2 15.1c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-5 9.2-8.3c.4-.4-.1-.6-.6-.2L6.1 13 1.2 11.5c-1-.3-1-1 .2-1.5l19-7.3c.9-.3 1.7.2 1.5 1.6z"/></svg>',
    ig: '<svg viewBox="0 0 24 24"><path d="M12 7a5 5 0 100 10 5 5 0 000-10zm0 8.2a3.2 3.2 0 110-6.4 3.2 3.2 0 010 6.4zM17.3 5.5a1.2 1.2 0 100 2.4 1.2 1.2 0 000-2.4zM12 2.5c-2.6 0-2.9 0-3.9.1-3.4.2-5.3 2-5.5 5.5-.1 1-.1 1.3-.1 3.9s0 2.9.1 3.9c.2 3.4 2.1 5.3 5.5 5.5 1 .1 1.3.1 3.9.1s2.9 0 3.9-.1c3.4-.2 5.3-2.1 5.5-5.5.1-1 .1-1.3.1-3.9s0-2.9-.1-3.9c-.2-3.4-2.1-5.3-5.5-5.5-1-.1-1.3-.1-3.9-.1z"/></svg>',
    ph: '<svg viewBox="0 0 24 24"><path d="M6.6 10.8a15.1 15.1 0 006.6 6.6l2.2-2.2a1 1 0 011-.25 11.4 11.4 0 003.6.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.6a1 1 0 01-.25 1z"/></svg>',
  };
  box.innerHTML = L.map((x) => `<a class="ct-link ${x.cls}" href="${esc(x.href)}" ${x.href.startsWith("http") ? 'target="_blank" rel="noopener"' : ""}>
    <span class="ct-ic">${IC[x.ic]}</span><span class="ct-tx"><b>${esc(x.t)}</b><small>${esc(x.s)}</small></span><span class="ct-arr">→</span></a>`).join("");
}
renderConnect();

// =====================================================================
// Google orqali kirish (Google Identity Services). Client ID — admin sozlamasi SETTINGS.googleClientId
// =====================================================================
let gsiLoading = null;
const loadGSI = () => window.google && google.accounts ? Promise.resolve() : (gsiLoading ||= new Promise((res, rej) => {
  const s = document.createElement("script");
  s.src = "https://accounts.google.com/gsi/client"; s.async = true;
  s.onload = res; s.onerror = () => { gsiLoading = null; rej(); };
  document.head.appendChild(s);
}));
async function googleCredential(resp) {
  try {
    const r = await api("POST", "/api/auth/google", { credential: resp.credential });
    setAuth(r.token, r.user);
    closeAll();
    toast(r.created ? `🎉 Xush kelibsiz, ${r.user.name}! Akkaunt ochildi.` : `👋 Salom, ${r.user.name}!`);
    const next = afterLogin; afterLogin = null;
    if (r.user.needPhone) setTimeout(askPhone, 450);
    else if (next) setTimeout(next, 380);
  } catch (e) { toast("⚠️ " + e.message); }
}
async function setupGoogle() {
  const cid = SETTINGS.googleClientId;
  if (!cid || TG) return; // Telegram ichida Google oynasi ochilmaydi
  try { await loadGSI(); } catch { return; }
  google.accounts.id.initialize({ client_id: cid, callback: googleCredential, ux_mode: "popup", auto_select: false, context: "signin" });
  $$(".g-btn").forEach((el) => {
    el.innerHTML = "";
    google.accounts.id.renderButton(el, { theme: "filled_black", size: "large", shape: "pill", text: "continue_with", logo_alignment: "center", width: Math.min(360, el.clientWidth || 340), locale: "uz" });
    el.hidden = false; el.previousElementSibling.hidden = false;
  });
}
// Google orqali kirgan mijozdan telefon raqami bir marta so'raladi
function askPhone() {
  const p = prompt("Buyurtma va yetkazib berish uchun telefon raqamingizni kiriting (masalan, +998 90 123 45 67):");
  if (!p) return toast("ℹ️ Telefon raqamini keyin Kabinet → Profil bo'limida kiritishingiz mumkin");
  api("PATCH", "/api/me", { phone: p }).then((r) => { setAuth(auth.token, r.user); toast("✅ Telefon raqami saqlandi"); }, (e) => { toast("⚠️ " + e.message); setTimeout(askPhone, 300); });
}
$("#authModal") && new MutationObserver(() => { if ($("#authModal").classList.contains("open") && !$(".g-btn iframe, .g-btn div[role=button]")) setupGoogle(); })
  .observe($("#authModal"), { attributes: true, attributeFilter: ["class"] });

// =====================================================================
// Afzalliklar slaydi: rasm + matn almashadi, pastdagi yorliqlarda vaqt chizig'i
// =====================================================================
(() => {
  const S = $$("#fsStage .fs-slide"), T = $$(".fs-tab");
  if (!S.length) return;
  let i = 0, t = null, paused = false;
  const DUR = 5000;
  const go = (n) => {
    i = (n + S.length) % S.length;
    S.forEach((x, k) => x.classList.toggle("on", k === i));
    T.forEach((x, k) => { x.classList.toggle("on", k === i); const b = $(".fs-bar", x); b.style.animation = "none"; void b.offsetWidth; b.style.animation = ""; });
  };
  const loop = () => { clearInterval(t); t = setInterval(() => { if (!paused && !document.hidden) go(i + 1); }, DUR); };
  T.forEach((b) => b.addEventListener("click", () => { go(+b.dataset.fs); loop(); }));
  const box = $("#features");
  box.addEventListener("mouseenter", () => { paused = true; box.classList.add("paused"); });
  box.addEventListener("mouseleave", () => { paused = false; box.classList.remove("paused"); });
  loop();
})();
