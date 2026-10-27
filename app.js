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
const pImg = (p, w = 600, h) => IMG(p.img, w, h);
const img = (p, w, h, cls = "") =>
  `<img src="${pImg(p, w, h)}" alt="${escapeHtml(p.name)}" loading="lazy" class="${cls}" data-icon="${catOf(p).icon}" onload="this.classList.add('loaded')" onerror="imgFail(this)" />`;

// Rasm yuklanmasa — kategoriya ikonkasini ko'rsatamiz
window.imgFail = (el) => {
  const box = document.createElement("div");
  box.className = "img-fallback";
  box.innerHTML = svgIcon(el.dataset.icon || "laptop");
  el.replaceWith(box);
};

// =====================================================================
// ---------- Do'kon: sarlavha, menyu, bosh sahifa, katalog, mahsulot oynasi ----------
// =====================================================================
const ico = (id, cls = "ic") => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}" /></svg>`;

// ---------- Mavzu va ovoz ----------
const applyTheme = (t) => {
  document.documentElement.dataset.theme = t; store.set("store_theme", t);
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = t === "dark" ? "#111418" : "#ffffff";
};
// Yangi dizayn yorug' mavzuda boshlanadi (eski "theme" kaliti hisobga olinmaydi)
applyTheme(store.get("store_theme", "light"));
$("#themeBtn").addEventListener("click", () => { applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"); sfx("toggle"); });
(() => {
  const btn = $("#soundBtn");
  if (!window.SFX) { btn.hidden = true; return; }
  const pop = document.createElement("div");
  pop.className = "sp-pop"; pop.hidden = true;
  pop.innerHTML = `<b>Ovoz effektlari</b>
    <label class="sp-row"><span>Ovoz</span><input type="checkbox" id="spOn" class="sp-switch" data-sfx="none" /></label>
    <label class="sp-row sp-vol"><span>Balandlik</span><input type="range" id="spVol" min="0" max="100" step="5" /></label>
    ${SFX.canVibrate ? `<label class="sp-row"><span>Tebranish (telefon)</span><input type="checkbox" id="spHap" class="sp-switch" data-sfx="none" /></label>` : ""}`;
  btn.parentElement.appendChild(pop);
  const sync = () => {
    $("#spOn").checked = SFX.on; $("#spVol").value = Math.round(SFX.volume * 100);
    $("#spVol").disabled = !SFX.on; if ($("#spHap")) $("#spHap").checked = SFX.haptic;
  };
  btn.addEventListener("click", (e) => { e.stopPropagation(); sync(); pop.hidden = !pop.hidden; });
  document.addEventListener("click", (e) => { if (!pop.hidden && !pop.contains(e.target) && e.target !== btn) pop.hidden = true; });
  $("#spOn").addEventListener("change", (e) => { SFX.setOn(e.target.checked); sync(); });
  $("#spVol").addEventListener("change", () => SFX.play("notify"));
  $("#spVol").addEventListener("input", (e) => SFX.setVolume(e.target.value / 100));
  $("#spHap")?.addEventListener("change", (e) => SFX.setHaptic(e.target.checked));
})();

const toTop = $("#toTop");
addEventListener("scroll", () => {
  $("#header").classList.toggle("scrolled", scrollY > 30);
  toTop.classList.toggle("show", scrollY > 900);
}, { passive: true });
toTop.addEventListener("click", () => scrollTo({ top: 0 }));
$("#year").textContent = new Date().getFullYear();

// ---------- To'lov logotiplari ----------
const payLogo = (p) => `<span class="pay-logo" title="${p.name}">${p.svg}</span>`;
function renderPayments() {
  $("#footerPay").innerHTML = PAYMENTS.map(payLogo).join("");
  $("#miniPay").innerHTML = PAYMENTS.slice(0, 7).map(payLogo).join("");
  $("#payGrid").innerHTML = PAYMENTS.map((p, i) => `<label class="rcard">
      <input type="radio" name="payment" value="${p.id}" ${i === 0 ? "checked" : ""} />
      <span>${payLogo(p)}<b>${p.name}</b><small>${p.note}</small></span>
    </label>`).join("");
}

// ---------- Rasmlar: Wikimedia'dagi aniq versiya, bo'lmasa lokal nusxa ----------
const WM_W = [330, 500, 960];
function hiImg(id, w = 330) {
  if (!id || !id.startsWith("wm:")) return IMG(id);
  const path = id.slice(3), i = path.lastIndexOf("/"), dir = path.slice(0, i), name = path.slice(i + 1);
  if (/\.(svg|gif|tiff?)$/i.test(name)) return IMG(id);
  w = WM_W.find((x) => x >= w) || 960;
  if (/\.png$/i.test(name) && w > 500) w = 500;
  const e = encodeURIComponent(name);
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${dir}/${e}/${w}px-${e}`;
}
window.imgErr = (el) => {
  const m = el.src.match(/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/.+\/\d+px-(.+)$/);
  if (m && !el.dataset.f) { el.dataset.f = "1"; el.src = "img/" + decodeURIComponent(m[1]).replace(/[^A-Za-z0-9._-]/g, "_"); return; }
  imgFail(el);
};
const pic = (p, w = 330, cls = "") => `<img src="${esc(hiImg(p.img, w))}" alt="${esc(p.name)}" loading="lazy" decoding="async" class="${cls}" data-icon="${(catOf(p) || {}).icon || "laptop"}" onload="this.classList.add('loaded')" onerror="imgErr(this)" />`;

// ---------- Bo'limlar: do'kon menyusi (katalogdagi haqiqiy kategoriyalar va mahsulot nomlari asosida) ----------
const RX = {
  gpu: /\b(RTX|GTX|GeForce|Radeon|Arc A\d)/i,
  cpu: /\b(Core i\d|Core Ultra|Ryzen|Xeon|Threadripper|Athlon)\b/i,
  mb: /\b([ZBXH]\d{3}[A-Z]?|motherboard|ona plata)\b/i,
  ram: /\bDDR\d\b/i,
  gaming: /\b(gaming|OMEN|Alienware|ROG|Legion|Predator|Titan|Aurora)\b/i,
};
const isPart = (p, k) => p.cat === "parts" && RX[k].test(p.name);
const KNOWN = ["pc", "laptop", "parts", "storage", "monitor", "keyboard", "mouse", "audio", "gaming"];
const GROUPS = [
  { id: "pc", name: "Kompyuterlar", test: (p) => p.cat === "pc" },
  { id: "laptop", name: "Noutbuklar", test: (p) => p.cat === "laptop" },
  { id: "gpu", name: "Videokartalar", test: (p) => isPart(p, "gpu") },
  { id: "cpu", name: "Protsessorlar", test: (p) => isPart(p, "cpu") },
  { id: "mb", name: "Ona platalar", test: (p) => isPart(p, "mb") },
  { id: "ram", name: "RAM", test: (p) => isPart(p, "ram") },
  { id: "storage", name: "SSD va HDD", test: (p) => p.cat === "storage" },
  { id: "monitor", name: "Monitorlar", test: (p) => p.cat === "monitor" },
  { id: "periph", name: "Periferiya", test: (p) => ["keyboard", "mouse", "audio"].includes(p.cat), subs: ["keyboard", "mouse", "audio"] },
  { id: "acc", name: "Aksessuarlar", test: (p) => p.cat === "gaming" || (p.cat === "parts" && !["gpu", "cpu", "mb", "ram"].some((k) => isPart(p, k))) || !KNOWN.includes(p.cat) },
];
// Bosh sahifadagi kategoriya kartochkalari
const TILES = [
  { id: "gamingpc", name: "O'yin kompyuterlari", test: (p) => p.cat === "pc" && RX.gaming.test(p.name + " " + p.brand) },
  { id: "laptop", name: "Noutbuklar" }, { id: "gpu", name: "Videokartalar" }, { id: "cpu", name: "Protsessorlar" },
  { id: "mb", name: "Ona platalar" }, { id: "ram", name: "Operativ xotira" }, { id: "storage", name: "SSD va HDD" },
  { id: "monitor", name: "Monitorlar" },
  { id: "keyboard", name: "Klaviaturalar", test: (p) => p.cat === "keyboard" },
  { id: "mouse", name: "Sichqonchalar", test: (p) => p.cat === "mouse" },
  { id: "audio", name: "Quloqchinlar", test: (p) => p.cat === "audio" },
  { id: "acc", name: "Aksessuarlar" },
];
const ALL_F = Object.fromEntries([...GROUPS, ...TILES.filter((t) => t.test)].map((g) => [g.id, g]));
ALL_F.all = { id: "all", name: "Barcha mahsulotlar", test: () => true };
ALL_F.sale = { id: "sale", name: "Aksiyalar", test: (p) => p.old > p.price };
const inGroup = (id) => PRODUCTS.filter((p) => (ALL_F[id] || ALL_F.all).test(p));
const topBy = (list, n) => list.slice().sort((a, b) => (b.popular || 0) - (a.popular || 0)).slice(0, n);
const brandsOf = (list) => Object.entries(list.reduce((m, p) => ((m[p.brand] = (m[p.brand] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
const discountOf = (p) => (p.old > p.price ? Math.round((1 - p.price / p.old) * 100) : 0);
// Kartochkadagi qisqa xususiyatlar: birinchi 2 tasi
const specLine = (p) => Object.values(p.specs || {}).slice(0, 2).map((v) => esc(v)).join(" · ");

// ---------- Saralangan (ilova bilan umumiy: opus_fav) ----------
state.fav = store.get("fav", []).filter((id) => byId(id));
function toggleFav(id) {
  const on = !state.fav.includes(id);
  state.fav = on ? [id, ...state.fav] : state.fav.filter((x) => x !== id);
  store.set("fav", state.fav);
  sfx(on ? "checkOn" : "checkOff");
  $$(`[data-fav="${id}"]`).forEach((b) => { b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
  updateHeadCounts();
  if ($("#favDrawer").classList.contains("open")) renderFav();
  toast(on ? "Saralanganlarga qo'shildi" : "Saralanganlardan olib tashlandi");
}
function renderFav() {
  const L = state.fav.map(byId).filter(Boolean);
  $("#favItems").innerHTML = L.length ? L.map((p) => `<div class="citem" data-id="${p.id}">
      ${pic(p, 330, "loaded")}
      <div class="citem-info"><h5><button class="link" data-open-p="${p.id}">${esc(p.name)}</button></h5><b>${fmt(p.price)}</b>
        <div class="fav-acts"><button class="btn btn-primary btn-sm" data-fav-add="${p.id}" ${(p.stock || 0) <= 0 ? "disabled" : ""}>Savatga</button></div></div>
      <button class="rm" data-fav="${p.id}" title="Olib tashlash" aria-label="Olib tashlash">${ico("trash")}</button>
    </div>`).join("")
    : `<div class="drawer-empty">${ico("heart", "ic ic-xl")}<h4>Saralanganlar bo'sh</h4><p>Mahsulot kartochkasidagi yurakcha belgisini bosing.</p></div>`;
}
$("#favBtn").addEventListener("click", () => { renderFav(); openLayer($("#favDrawer")); });
$("#favItems").addEventListener("click", (e) => {
  const a = e.target.closest("[data-fav-add]"); if (a) addToCart(+a.dataset.favAdd, 1, a);
  const o = e.target.closest("[data-open-p]"); if (o) openProduct(+o.dataset.openP);
});
$("#cmpBtn").addEventListener("click", () => {
  if (state.compare.length >= 2) { renderCompare(); openLayer($("#compareModal")); }
  else toast(state.compare.length ? "Taqqoslash uchun yana bitta mahsulot tanlang" : "Mahsulot kartochkasidagi taqqoslash belgisini bosing (bir xil turdagi 2–3 ta mahsulot)");
});
function updateHeadCounts() {
  const f = $("#favCount"), c = $("#cmpCount");
  f.textContent = state.fav.length; f.hidden = !state.fav.length;
  c.textContent = state.compare.length; c.hidden = !state.compare.length;
}
document.addEventListener("click", (e) => {
  const f = e.target.closest("[data-fav]");
  if (f && !e.target.closest("#favItems [data-open-p]")) { e.preventDefault(); toggleFav(+f.dataset.fav); }
  if (e.target.closest("[data-open-orders]")) showOrders();
});

// ---------- Mahsulot kartochkasi ----------
function productCard(p) {
  const inCart = state.cart.some((x) => x.id === p.id), d = discountOf(p), stock = p.stock || 0;
  const fav = state.fav.includes(p.id), cmp = state.compare.includes(p.id);
  return `<article class="card" data-id="${p.id}">
    <div class="card-media">
      <a class="card-img" href="#p-${p.id}" data-open aria-label="${esc(p.name)} — batafsil">${pic(p, 330)}</a>
      <div class="card-badges">${d ? `<span class="b-sale">−${d}%</span>` : ""}${p.badge === "Yangi" ? `<span class="b-new">Yangi</span>` : ""}${p.badge === "Xit" ? `<span class="b-hit">Xit</span>` : ""}</div>
      <div class="card-tools">
        <button class="tool${fav ? " on" : ""}" data-fav="${p.id}" aria-pressed="${fav}" title="Saralanganga" aria-label="Saralanganga">${ico("heart")}</button>
        <button class="tool cmp${cmp ? " on" : ""}" data-cmp title="Taqqoslash" aria-label="Taqqoslash">${ico("compare")}</button>
      </div>
    </div>
    <div class="card-body">
      <span class="card-brand">${esc(p.brand)}</span>
      <a class="card-name" href="#p-${p.id}" data-open>${esc(p.name)}</a>
      ${specLine(p) ? `<p class="card-spec">${specLine(p)}</p>` : ""}
      <div class="card-rate">${p.reviews ? `${ico("star", "ic star")}<b>${p.rating}</b><span>(${p.reviews})</span>` : `<span class="muted">Sharh yo'q</span>`}</div>
      <div class="card-price">
        ${d ? `<span class="old">${fmt(p.old)}</span>` : ""}
        <span class="price">${fmt(p.price)}</span>
        <span class="monthly">${fmt(p.price / 12)} × 12 oy</span>
      </div>
      <div class="card-stock ${stock <= 0 ? "out" : stock <= 5 ? "low" : "ok"}">${stock <= 0 ? "Sotuvda yo'q" : stock <= 5 ? `Oz qoldi: ${stock} dona` : "Omborda bor"}</div>
      <button class="btn btn-primary btn-block add-btn${inCart ? " added" : ""}" data-add ${stock <= 0 ? "disabled" : ""}>${inCart ? `${ico("check")}Savatda` : `${ico("cart")}Savatga qo'shish`}</button>
    </div>
  </article>`;
}
// Kartochkalarga bosish (barcha to'rlar uchun)
document.addEventListener("click", (e) => {
  const card = e.target.closest(".card[data-id]");
  if (!card || e.target.closest("[data-fav]")) return;
  const id = +card.dataset.id;
  if (e.target.closest("[data-add]")) {
    e.preventDefault();
    if (state.cart.some((x) => x.id === id)) { renderCart(); openLayer($("#cartDrawer")); }
    else addToCart(id, 1, e.target.closest("[data-add]"));
  } else if (e.target.closest("[data-cmp]")) { e.preventDefault(); toggleCompare(id); updateHeadCounts(); }
  else if (e.target.closest("[data-open]")) { e.preventDefault(); openProduct(id); }
});

// ---------- Kategoriyalar menyusi va mega-menyu ----------
function renderNav() {
  const links = GROUPS.filter((g) => inGroup(g.id).length).map((g) => `<a href="#products" class="cn-link" data-group="${g.id}">${g.name}</a>`);
  $("#navList").innerHTML = `<a href="#products" class="cn-link cn-all" data-group="all">${ico("grid")}Katalog</a>${links.join("")}${PRODUCTS.some((p) => p.old > p.price) ? `<a href="#products" class="cn-link cn-sale" data-group="sale">Aksiyalar</a>` : ""}`;
  $("#ftCats").innerHTML = GROUPS.filter((g) => inGroup(g.id).length).map((g) => `<a href="#products" data-group="${g.id}">${g.name}</a>`).join("");
}
const mega = $("#mega");
let megaT = null;
function showMega(id, link) {
  const list = inGroup(id);
  if (!list.length || id === "sale") { mega.hidden = true; return; }
  const subs = id === "all" ? GROUPS.filter((g) => inGroup(g.id).length).map((g) => [g.id, g.name, inGroup(g.id).length])
    : (ALL_F[id].subs || []).map((c) => [c, (CATEGORIES.find((x) => x.id === c) || {}).name || c, PRODUCTS.filter((p) => p.cat === c).length]);
  const brands = brandsOf(list).slice(0, 10);
  mega.innerHTML = `<div class="wrap mega-in">
    ${subs.length ? `<div class="mega-col"><h6>${id === "all" ? "Bo'limlar" : "Turkum"}</h6>${subs.map(([g, n, c]) => `<a href="#products" data-group="${g}">${esc(n)} <small>${c}</small></a>`).join("")}</div>` : ""}
    <div class="mega-col"><h6>Brendlar</h6><div class="mega-brands">${brands.map(([b, c]) => `<a href="#products" data-group="${id}" data-brand="${esc(b)}">${esc(b)} <small>${c}</small></a>`).join("")}</div></div>
    <div class="mega-col mega-top"><h6>Ommabop</h6>${topBy(list, 3).map((p) => `<a href="#p-${p.id}" class="mega-p" data-open-p="${p.id}">${pic(p, 330)}<span><b>${esc(p.name)}</b><small>${fmt(p.price)}</small></span></a>`).join("")}</div>
    <a class="mega-all" href="#products" data-group="${id}">${esc(ALL_F[id].name)} — barcha ${list.length} ta mahsulot ${ico("right")}</a>
  </div>`;
  mega.hidden = false;
  $$(".cn-link").forEach((a) => a.classList.toggle("hover", a === link));
}
const hideMega = () => { mega.hidden = true; $$(".cn-link.hover").forEach((a) => a.classList.remove("hover")); };
$("#navList").addEventListener("mouseover", (e) => {
  const a = e.target.closest(".cn-link");
  if (!a || !matchMedia("(hover: hover) and (min-width: 1025px)").matches) return;
  clearTimeout(megaT); megaT = setTimeout(() => showMega(a.dataset.group, a), 120);
});
$("#nav").addEventListener("mouseleave", () => { clearTimeout(megaT); megaT = setTimeout(hideMega, 180); });
mega.addEventListener("mouseenter", () => clearTimeout(megaT));
document.addEventListener("click", (e) => {
  const g = e.target.closest("[data-group]");
  if (g) { e.preventDefault(); hideMega(); closeMenu(); applyGroup(g.dataset.group, g.dataset.brand); return; }
  const o = e.target.closest("[data-open-p]");
  if (o && !e.target.closest("#favItems")) { e.preventDefault(); hideMega(); openProduct(+o.dataset.openP); }
});
// Telefon: menyu chapdan chiqadi
const closeMenu = () => { $("#nav").classList.remove("open"); $("#burger").setAttribute("aria-expanded", "false"); document.body.classList.remove("menu-open"); };
$("#burger").addEventListener("click", () => {
  const open = !$("#nav").classList.contains("open");
  $("#nav").classList.toggle("open", open); $("#burger").setAttribute("aria-expanded", open); document.body.classList.toggle("menu-open", open);
});
document.addEventListener("click", (e) => { if (document.body.classList.contains("menu-open") && !e.target.closest("#nav, #burger")) closeMenu(); });

// ---------- Bosh sahifa ----------
function homeCard(p) { return productCard(p); }
function renderHome() {
  const P = PRODUCTS.filter((p) => (p.stock || 0) > 0);
  // A. Aksiya qatori — admin paneldagi aksiya sarlavhasi va haqiqiy chegirmadagi mahsulotlar soni
  const sale = PRODUCTS.filter((p) => p.old > p.price);
  $("#promoStrip").hidden = !(SETTINGS.dealTitle && sale.length);
  $("#dealTitle").textContent = SETTINGS.dealTitle || "";
  $("#promoInfo").textContent = sale.length ? `${sale.length} ta mahsulotda chegirma, eng kattasi −${Math.max(...sale.map(discountOf))}%` : "";

  // B. Hero: eng ommabop o'yin kompyuteri + videokarta va noutbuk
  const main = topBy(P.filter((p) => ALL_F.gamingpc.test(p)), 1)[0] || topBy(P, 1)[0];
  const side = [topBy(P.filter((p) => isPart(p, "gpu")), 1)[0], topBy(P.filter((p) => p.cat === "laptop"), 1)[0]].filter(Boolean);
  const brandsN = new Set(PRODUCTS.map((p) => p.brand)).size;
  $("#hero").innerHTML = main ? `<div class="hero-main">
      <div class="hero-copy">
        <span class="hero-kicker">${esc((catOf(main) || {}).name || "Tavsiya")}</span>
        <h1>Kompyuterlar, komplektlovchilar va periferiya</h1>
        <p>${PRODUCTS.length} ta mahsulot, ${brandsN} ta brend. Narxlar so'mda, Uzum Nasiya orqali 0% bo'lib to'lash va ${num(FREE_SHIP_FROM)} so'mdan yuqori xaridlarga bepul yetkazib berish.</p>
        <div class="hero-cta"><a class="btn btn-primary" href="#products" data-group="all">Katalogga o'tish</a>${sale.length ? `<a class="btn btn-ghost" href="#products" data-group="sale">Aksiyalar</a>` : ""}</div>
      </div>
      <a class="hero-prod" href="#p-${main.id}" data-open-p="${main.id}">
        <span class="hero-img">${pic(main, 960)}</span>
        <span class="hero-tag"><small>${esc(main.brand)}</small><b>${esc(main.name)}</b><span>${discountOf(main) ? `<s>${fmt(main.old)}</s>` : ""}${fmt(main.price)}</span></span>
      </a>
    </div>
    <div class="hero-side">${side.map((p) => `<a class="hero-tile" href="#p-${p.id}" data-open-p="${p.id}">
        <span class="ht-copy"><small>${esc(ALL_F[isPart(p, "gpu") ? "gpu" : "laptop"].name)}</small><b>${esc(p.name)}</b><span class="ht-price">${fmt(p.price)}${discountOf(p) ? ` <em>−${discountOf(p)}%</em>` : ""}</span></span>
        <span class="ht-img">${pic(p, 500)}</span>
      </a>`).join("")}</div>` : "";

  // C. Kategoriyalar (rasm — shu bo'limdagi eng ommabop mahsulot fotosi)
  $("#catGrid").innerHTML = TILES.map((t) => {
    const L = inGroup(t.id); if (!L.length) return "";
    const p = topBy(L, 1)[0];
    return `<a class="ctile" href="#products" data-group="${t.id}"><span class="ctile-img">${pic(p, 330)}</span><span class="ctile-t"><b>${t.name}</b><small>${L.length} ta mahsulot</small></span></a>`;
  }).join("");

  // D. Tavsiya etilgan: admin "Xit" belgisini qo'ygan mahsulotlar (bo'lmasa — eng ommaboplari)
  const hits = P.filter((p) => p.badge === "Xit");
  const featured = topBy(hits.length >= 5 ? hits : P, 10);
  $("#featuredGrid").innerHTML = featured.map(homeCard).join("");
  $("#featuredMeta").textContent = hits.length >= 5 ? `${hits.length} ta xit mahsulot` : "";
  // E. Ommabop va yangi kelganlar
  const featIds = new Set(featured.map((p) => p.id));
  $("#popularGrid").innerHTML = topBy(P.filter((p) => !featIds.has(p.id)), 5).map(homeCard).join("");
  const fresh = P.filter((p) => p.badge === "Yangi");
  const newest = (fresh.length >= 5 ? fresh : P).slice().sort((a, b) => b.id - a.id).slice(0, 5);
  $("#newGrid").innerHTML = newest.map(homeCard).join("");

  // F. O'yin uchun sozlama: videokarta + monitor + klaviatura + sichqoncha (haqiqiy narxlar yig'indisi)
  const pick = (f) => topBy(P.filter(f), 1)[0];
  const setup = [pick((p) => isPart(p, "gpu")), pick((p) => p.cat === "monitor"), pick((p) => p.cat === "keyboard"), pick((p) => p.cat === "mouse")].filter(Boolean);
  $("#setupSec").innerHTML = setup.length >= 3 ? `<div class="setup">
      <div class="setup-copy"><span class="hero-kicker">O'yin uchun sozlama</span><h2>Videokarta, monitor va periferiya bir joyda</h2>
        <p>Katalogdagi eng ommabop o'yin komplekti. Har birini alohida ko'rib, savatga qo'shishingiz mumkin.</p>
        <div class="setup-sum"><span>Jami:</span><b>${fmt(setup.reduce((s, p) => s + p.price, 0))}</b><small>yoki ${fmt(setup.reduce((s, p) => s + p.price, 0) / 12)} × 12 oy</small></div>
        <button class="btn btn-light" id="setupAdd">Hammasini savatga qo'shish</button></div>
      <div class="setup-items">${setup.map((p) => `<a class="setup-it" href="#p-${p.id}" data-open-p="${p.id}"><span class="setup-img">${pic(p, 330)}</span><small>${esc(p.brand)}</small><b>${esc(p.name)}</b><span>${fmt(p.price)}</span></a>`).join("")}</div>
    </div>` : "";
  const sa = $("#setupAdd");
  if (sa) sa.onclick = () => { let n = 0; setup.forEach((p) => { if (!state.cart.some((x) => x.id === p.id) && addToCart(p.id, 1, null, true) !== false) n++; }); toast(n ? `✅ ${n} ta mahsulot savatga qo'shildi` : "Bu mahsulotlar allaqachon savatda"); };

  // G. Brendlar (katalogda bor bo'lganlari)
  const want = ["ASUS", "MSI", "Gigabyte", "NVIDIA", "AMD", "Intel", "Logitech", "Razer", "Lenovo", "HP", "Apple", "Samsung", "Corsair", "Kingston"];
  const have = brandsOf(PRODUCTS);
  const strip = want.map((b) => have.find(([x]) => x.toLowerCase() === b.toLowerCase())).filter(Boolean);
  $("#brandStrip").innerHTML = strip.map(([b, n]) => `<a href="#products" class="brand-it" data-group="all" data-brand="${esc(b)}"><b>${esc(b)}</b><small>${n} ta mahsulot</small></a>`).join("");

  // H. Afzalliklar — faqat sozlamalardagi ma'lumotlar
  $("#benefitList").innerHTML = [
    ["truck", "Yetkazib berish", `${num(FREE_SHIP_FROM)} so'mdan yuqori xaridlarga bepul, qolganlariga ${fmt(SHIP_PRICE)}. Do'kondan o'zingiz olib ketishingiz ham mumkin.`],
    ["card", "To'lov usullari", `${PAYMENTS.filter((p) => p.id !== "uzum").map((p) => p.name).join(", ")}. Uzum Nasiya orqali 3–24 oyga 0% bo'lib to'lash.`],
    ["shield", "Original mahsulotlar", "Har bir mahsulot sahifasida original ekanligi va ishlab chiqaruvchi kafolati ko'rsatiladi."],
    ["headset", "Qo'llab-quvvatlash", `+998 71 200 00 00, har kuni 09:00–21:00. Buyurtma holati Telegram'dagi @opussmarketbot orqali keladi.`],
  ].map(([i, t, d]) => `<div class="benefit">${ico(i, "ic benefit-ic")}<div><b>${t}</b><p>${esc(d)}</p></div></div>`).join("");

  // Savollar
  $("#faqList").innerHTML = [
    ["Yetkazib berish qancha turadi?", `${num(FREE_SHIP_FROM)} so'mdan yuqori xaridlarda bepul, aks holda ${fmt(SHIP_PRICE)}. Rasmiylashtirishda "Do'kondan olib ketish" ni tanlasangiz — bepul.`],
    ["Bo'lib to'lash qanday ishlaydi?", "To'lov bosqichida \"Uzum Nasiya\" ni tanlab, 3, 6, 12 yoki 24 oy muddatini belgilaysiz. Oylik to'lov mahsulot narxining oylarga bo'linganiga teng (0% ustama)."],
    ["Buyurtma qanday tasdiqlanadi?", "Buyurtma bergach, Telegram'dagi @opussmarketbot botiga 6 xonali kod keladi. Kodni saytga kiritasiz — shundan so'ng chek botga yuboriladi va buyurtmangiz holatini \"Buyurtmalarim\" bo'limida kuzatasiz."],
    ["Buyurtmani bekor qilsam bo'ladimi?", "Ha, buyurtma \"Yangi\" holatida turgan paytda \"Buyurtmalarim\" bo'limidan bekor qilishingiz mumkin. Keyingi bosqichlarda operatorga qo'ng'iroq qiling."],
    ["Mahsulotlarga kafolat bormi?", "Rasmiy yetkazib beruvchidan olingan mahsulotlar \"Original\" belgisi bilan ko'rsatiladi va ishlab chiqaruvchi kafolati bilan beriladi. Batafsil ma'lumot uchun operatorga murojaat qiling."],
  ].map(([q, a]) => `<details><summary>${q}</summary><p>${esc(a)}</p></details>`).join("");
}
$("#promoGo").addEventListener("click", () => applyGroup("sale"));
document.addEventListener("click", (e) => {
  const g = e.target.closest("[data-goto-sort]"); if (g) { e.preventDefault(); applyGroup("all", null, g.dataset.gotoSort); }
  const c = e.target.closest("[data-goto-cat]"); if (c) { e.preventDefault(); applyGroup(c.dataset.gotoCat); }
});

// ---------- Katalog: filtrlar, saralash, qidiruv ----------
const PAGE = 20;
Object.assign(state, { group: "all", brands: new Set(), min: null, max: null, inStock: false, sale: false, orig: false, page: 1 });
const haystack = (p) => (p.name + " " + p.brand + " " + ((catOf(p) || {}).name || "") + " " + Object.entries(p.specs || {}).flat().join(" ")).toLowerCase();
function search(q) {
  q = q.trim().toLowerCase();
  if (!q) return PRODUCTS.slice();
  const words = q.split(/\s+/);
  return PRODUCTS.filter((p) => { const h = haystack(p); return words.every((w) => h.includes(w)); });
}
// Guruh, qidiruv va (ixtiyoriy) narx/holat filtrlari — brend ro'yxati sanog'i uchun brendsiz holat ham kerak
function baseList(skipBrand) {
  const g = ALL_F[state.group] || ALL_F.all;
  return search(state.query).filter((p) => g.test(p) &&
    (state.min == null || p.price >= state.min) && (state.max == null || p.price <= state.max) &&
    (!state.inStock || (p.stock || 0) > 0) && (!state.sale || p.old > p.price) && (!state.orig || p.original !== false) &&
    (skipBrand || !state.brands.size || state.brands.has(p.brand)));
}
function filtered() {
  const sorters = {
    popular: (a, b) => (b.popular || 0) - (a.popular || 0),
    cheap: (a, b) => a.price - b.price,
    expensive: (a, b) => b.price - a.price,
    new: (a, b) => b.id - a.id,
    rating: (a, b) => (b.reviews ? b.rating : 0) - (a.reviews ? a.rating : 0) || b.reviews - a.reviews,
    discount: (a, b) => discountOf(b) - discountOf(a),
  };
  return baseList().sort(sorters[state.sort] || sorters.popular);
}
function applyGroup(id, brand, sort) {
  state.group = ALL_F[id] ? id : "all";
  state.brands = new Set(brand ? [brand] : []);
  state.sale = id === "sale" ? false : state.sale;
  if (sort) { state.sort = sort; $("#sortSelect").value = sort; }
  if (id === "sale" && !sort) { state.sort = "discount"; $("#sortSelect").value = "discount"; }
  state.page = 1;
  renderProducts();
  $("#products").scrollIntoView({ behavior: "smooth" });
}
const PR = [["1 mln gacha", null, 1e6], ["1–5 mln", 1e6, 5e6], ["5–15 mln", 5e6, 15e6], ["15 mln dan", 15e6, null]];
function renderFilters() {
  const groups = [["all", "Barcha mahsulotlar"], ...GROUPS.map((g) => [g.id, g.name]), ["sale", "Aksiyalar"]];
  const q = search(state.query);
  const brands = brandsOf(baseList(true));
  const showAllB = $("#filtersBody").dataset.allBrands === "1";
  $("#filtersBody").innerHTML = `
    <div class="fgroup"><h6>Kategoriya</h6><div class="fcats">${groups.map(([id, n]) => {
      const c = q.filter((p) => ALL_F[id].test(p)).length;
      return c || id === state.group ? `<button class="fcat${state.group === id ? " on" : ""}" data-fg="${id}"><span>${n}</span><small>${c}</small></button>` : "";
    }).join("")}</div></div>
    <div class="fgroup"><h6>Narx, so'm</h6>
      <div class="frange"><input id="fMin" inputmode="numeric" placeholder="dan" value="${state.min != null ? num(state.min) : ""}" aria-label="Eng kam narx" /><span>—</span><input id="fMax" inputmode="numeric" placeholder="gacha" value="${state.max != null ? num(state.max) : ""}" aria-label="Eng yuqori narx" /></div>
      <div class="fquick">${PR.map(([n, a, b], i) => `<button class="${state.min === a && state.max === b ? "on" : ""}" data-pr="${i}">${n}</button>`).join("")}</div></div>
    <div class="fgroup"><h6>Brend</h6><div class="fbrands">${(showAllB ? brands : brands.slice(0, 10)).map(([b, n]) => `<label class="fcheck"><input type="checkbox" data-fb="${esc(b)}" ${state.brands.has(b) ? "checked" : ""} /><span>${esc(b)}</span><small>${n}</small></label>`).join("") || `<p class="muted">Brend topilmadi</p>`}</div>
      ${brands.length > 10 ? `<button class="fmore" id="fMoreB">${showAllB ? "Kamroq ko'rsatish" : `Yana ${brands.length - 10} ta brend`}</button>` : ""}</div>
    <div class="fgroup"><h6>Holati</h6>
      <label class="fcheck"><input type="checkbox" data-ft="inStock" ${state.inStock ? "checked" : ""} /><span>Omborda bor</span></label>
      <label class="fcheck"><input type="checkbox" data-ft="sale" ${state.sale ? "checked" : ""} /><span>Chegirmadagi</span></label>
      <label class="fcheck"><input type="checkbox" data-ft="orig" ${state.orig ? "checked" : ""} /><span>Original</span></label></div>`;
}
const numIn = (v) => { const n = +String(v).replace(/\D/g, ""); return n > 0 ? n : null; };
$("#filtersBody").addEventListener("click", (e) => {
  const g = e.target.closest("[data-fg]"); if (g) { state.group = g.dataset.fg; state.brands.clear(); state.page = 1; renderProducts(); return; }
  const r = e.target.closest("[data-pr]"); if (r) { const [, a, b] = PR[+r.dataset.pr]; const same = state.min === a && state.max === b; state.min = same ? null : a; state.max = same ? null : b; state.page = 1; renderProducts(); return; }
  if (e.target.closest("#fMoreB")) { const fb = $("#filtersBody"); fb.dataset.allBrands = fb.dataset.allBrands === "1" ? "" : "1"; renderFilters(); }
});
$("#filtersBody").addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset.fb) { t.checked ? state.brands.add(t.dataset.fb) : state.brands.delete(t.dataset.fb); }
  else if (t.dataset.ft) state[t.dataset.ft] = t.checked;
  else if (t.id === "fMin" || t.id === "fMax") { state.min = numIn($("#fMin").value); state.max = numIn($("#fMax").value); if (state.min && state.max && state.min > state.max) [state.min, state.max] = [state.max, state.min]; }
  else return;
  state.page = 1; renderProducts();
});
$("#filtersBody").addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.matches("#fMin, #fMax")) e.target.dispatchEvent(new Event("change", { bubbles: true })); });
function resetFilters() {
  Object.assign(state, { group: "all", min: null, max: null, inStock: false, sale: false, orig: false, page: 1, query: "" });
  state.brands.clear(); searchInput.value = "";
  renderProducts();
}
$("#resetFilters").addEventListener("click", resetFilters);
$("#sortSelect").addEventListener("change", (e) => { state.sort = e.target.value; state.page = 1; renderProducts(); });
// Telefon: filtrlar pastdan/chetdan chiqadigan oyna
const openFilters = () => { $("#filters").classList.add("open"); document.body.classList.add("filters-open"); };
const closeFilters = () => { $("#filters").classList.remove("open"); document.body.classList.remove("filters-open"); };
$("#filtOpen").addEventListener("click", openFilters);
$("#filtClose").addEventListener("click", closeFilters);
$("#filtApply").addEventListener("click", () => { closeFilters(); $("#products").scrollIntoView({ behavior: "smooth" }); });

function activeChips() {
  const c = [];
  if (state.query.trim()) c.push(["q", `"${state.query.trim()}"`]);
  if (state.group !== "all") c.push(["g", ALL_F[state.group].name]);
  state.brands.forEach((b) => c.push(["b:" + b, b]));
  if (state.min != null || state.max != null) c.push(["p", `${state.min != null ? num(state.min) : "0"} – ${state.max != null ? num(state.max) : "∞"} so'm`]);
  if (state.inStock) c.push(["inStock", "Omborda bor"]);
  if (state.sale) c.push(["sale", "Chegirmadagi"]);
  if (state.orig) c.push(["orig", "Original"]);
  return c;
}
$("#activeFilters").addEventListener("click", (e) => {
  const b = e.target.closest("[data-af]"); if (!b) return;
  const k = b.dataset.af;
  if (k === "all") return resetFilters();
  if (k === "q") { state.query = ""; searchInput.value = ""; }
  else if (k === "g") state.group = "all";
  else if (k.startsWith("b:")) state.brands.delete(k.slice(2));
  else if (k === "p") { state.min = null; state.max = null; }
  else state[k] = false;
  state.page = 1; renderProducts();
});

function renderProducts() {
  const list = filtered();
  const grid = $("#productGrid");
  grid.innerHTML = list.slice(0, state.page * PAGE).map(productCard).join("");
  const left = list.length - state.page * PAGE;
  $("#catMore").innerHTML = left > 0 ? `<button class="btn btn-ghost" id="catMoreBtn">Yana ko'rsatish (${Math.min(left, PAGE)} / ${left})</button>` : "";
  const g = ALL_F[state.group] || ALL_F.all;
  $("#catTitle").textContent = state.query.trim() ? `"${state.query.trim()}" bo'yicha natijalar` : g.name;
  $("#resultInfo").textContent = `${list.length} ta mahsulot`;
  const chips = activeChips();
  $("#activeFilters").innerHTML = chips.length ? chips.map(([k, t]) => `<button class="af" data-af="${esc(k)}">${esc(t)}${ico("close")}</button>`).join("") + `<button class="af af-clear" data-af="all">Hammasini tozalash</button>` : "";
  const n = chips.filter(([k]) => k !== "q").length;
  $("#filtN").hidden = !n; $("#filtN").textContent = n;
  $("#filtApply").textContent = `Ko'rsatish (${list.length})`;
  const empty = $("#emptyState");
  empty.hidden = list.length > 0;
  if (!list.length) {
    empty.innerHTML = PRODUCTS.length
      ? `${ico("search", "ic ic-xl")}<h3>Mos mahsulot topilmadi</h3><p>Qidiruv so'zini o'zgartiring yoki filtrlarni olib tashlang.</p><button class="btn btn-primary" data-af="all" id="emptyReset">Filtrlarni tozalash</button>`
      : `${ico("box", "ic ic-xl")}<h3>Katalog hozircha bo'sh</h3><p>Mahsulotlar admin panel orqali qo'shiladi: nomi, brendi, kategoriyasi, narxi (so'mda), ombordagi soni va rasmi. "E'lon qilish" dan keyin ular shu yerda ko'rinadi.</p>`;
    const er = $("#emptyReset"); if (er) er.onclick = resetFilters;
  }
  renderFilters();
}
$("#catMore").addEventListener("click", (e) => { if (e.target.closest("#catMoreBtn")) { state.page++; renderProducts(); } });
// Katalog yuklanmasa (internet yo'q) va mahsulot ham bo'lmasa — xato holati
function catalogError() {
  if (PRODUCTS.length) return;
  const empty = $("#emptyState");
  empty.hidden = false;
  empty.innerHTML = `${ico("box", "ic ic-xl")}<h3>Katalogni yuklab bo'lmadi</h3><p>Internet aloqasini tekshirib, sahifani yangilang.</p><button class="btn btn-primary" onclick="location.reload()">Qayta yuklash</button>`;
}
// Eski nom (boshqa joylardan chaqiriladi)
function renderCategories() { renderNav(); renderHome(); updateHeadCounts(); }

// ---------- Qidiruv va takliflar ----------
const searchInput = $("#searchInput");
const suggest = $("#suggest");
let sgIndex = -1, searchT;
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
  const list = search(q).sort((a, b) => (b.popular || 0) - (a.popular || 0));
  const groups = GROUPS.filter((g) => g.name.toLowerCase().includes(q.trim().toLowerCase()));
  sgIndex = -1;
  suggest.innerHTML = (groups.length ? `<div class="sg-groups">${groups.map((g) => `<button type="button" data-group="${g.id}">${ico("grid")}${g.name}</button>`).join("")}</div>` : "")
    + (list.length
      ? list.slice(0, 6).map((p) => `<div class="sg-item" data-id="${p.id}">${pic(p, 330)}<div><b>${highlight(p.name, q)}</b><small>${fmt(p.price)}</small></div></div>`).join("")
        + `<button type="button" class="sg-all">Barcha natijalar (${list.length})</button>`
      : `<div class="sg-empty">"${escapeHtml(q)}" bo'yicha hech narsa topilmadi</div>`);
  suggest.hidden = false;
}
function applySearch() {
  state.query = searchInput.value; state.group = "all"; state.brands.clear(); state.page = 1;
  suggest.hidden = true;
  renderProducts();
  $("#products").scrollIntoView({ behavior: "smooth" });
}
searchInput.addEventListener("input", () => { clearTimeout(searchT); searchT = setTimeout(renderSuggest, 150); });
searchInput.addEventListener("focus", renderSuggest);
searchInput.addEventListener("keydown", (e) => {
  const items = $$(".sg-item", suggest);
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    if (!items.length) return;
    sgIndex = (sgIndex + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items.forEach((it, i) => it.classList.toggle("active", i === sgIndex));
  } else if (e.key === "Enter" && sgIndex >= 0 && items[sgIndex]) {
    e.preventDefault(); suggest.hidden = true; openProduct(+items[sgIndex].dataset.id);
  } else if (e.key === "Escape") suggest.hidden = true;
});
$("#searchBox").addEventListener("submit", (e) => { e.preventDefault(); applySearch(); });
suggest.addEventListener("click", (e) => {
  const it = e.target.closest(".sg-item");
  if (it) { suggest.hidden = true; openProduct(+it.dataset.id); }
  else if (e.target.closest(".sg-all")) applySearch();
  else if (e.target.closest("[data-group]")) suggest.hidden = true;
});
document.addEventListener("click", (e) => { if (!e.target.closest("#searchBox")) suggest.hidden = true; });

// ---------- Mahsulot oynasi ----------
function openProduct(id) {
  const p = byId(id);
  if (!p) return;
  const c = catOf(p) || { name: "", icon: "laptop" };
  let qty = 1, months = 12;
  const sources = [p.img, ...(p.gallery || [])].filter(Boolean);
  const views = sources.map((s) => hiImg(s, 960));
  const credits = sources.map(CREDIT);
  const d = discountOf(p), stock = p.stock || 0;
  const grp = GROUPS.find((g) => g.test(p));
  const related = topBy(PRODUCTS.filter((x) => x.id !== p.id && (grp ? grp.test(x) : x.cat === p.cat) && (x.stock || 0) > 0), 4);
  $("#productModalBody").innerHTML = `<div class="pm">
    <nav class="pm-crumbs" aria-label="Yo'l"><span>Katalog</span>${ico("right")}<span>${esc(grp ? grp.name : c.name)}</span>${ico("right")}<span>${esc(p.brand)}</span></nav>
    <div class="pm-gallery">
      <div class="pm-main" id="pmMain"><img src="${esc(views[0])}" alt="${escapeHtml(p.name)}" data-icon="${c.icon}" onerror="imgErr(this)" /></div>
      ${views.length > 1 ? `<div class="pm-thumbs">${sources.map((s, i) => `<button class="${i === 0 ? "active" : ""}" data-v="${i}" aria-label="${i + 1}-rasm"><img src="${esc(hiImg(s, 330))}" alt="" onerror="imgErr(this)" /></button>`).join("")}</div>` : ""}
      ${credits[0] ? `<a class="pm-credit" id="pmCredit" href="${credits[0]}" target="_blank" rel="noopener">Foto: Wikimedia Commons — muallif va litsenziya</a>` : ""}
    </div>
    <div class="pm-info">
      <span class="pm-brand">${esc(p.brand)}</span>
      <h2>${esc(p.name)}</h2>
      <div class="pm-meta">
        <div class="rating">${ratingHTML(p, true)}</div>
        <span class="muted">Kod: ${p.id}</span>
        ${p.original !== false ? `<span class="pm-orig">${ico("shield")}Original</span>` : ""}
      </div>
      ${p.desc ? `<p class="pm-desc">${esc(p.desc)}</p>` : ""}
      ${Object.keys(p.specs || {}).length ? `<h3 class="pm-h">Xususiyatlar</h3><table class="specs">${Object.entries(p.specs).map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</table>` : ""}
    </div>
    <aside class="pm-buy">
      ${d ? `<div class="pm-old"><s>${fmt(p.old)}</s><span class="b-sale">−${d}%</span></div>` : ""}
      <div class="price">${fmt(p.price)}</div>
      ${d ? `<small class="pm-save">Tejaysiz: ${fmt(p.old - p.price)}</small>` : ""}
      <div class="pm-install">
        <span>Uzum Nasiya, 0%: <b id="pmMonthly"></b></span>
        <div class="months" id="pmMonths">${MONTHS.map((m) => `<button data-m="${m}" class="${m === months ? "active" : ""}">${m} oy</button>`).join("")}</div>
      </div>
      <div class="card-stock ${stock <= 0 ? "out" : stock <= 5 ? "low" : "ok"}">${stock <= 0 ? "Sotuvda yo'q" : stock <= 5 ? `Oz qoldi: ${stock} dona` : `Omborda: ${stock} dona`}</div>
      ${stock > 0 ? `<div class="pm-qty"><span>Miqdor</span><div class="qty-lg"><button data-q="-1" aria-label="Kamaytirish">−</button><span id="pmQty">1</span><button data-q="1" aria-label="Ko'paytirish">+</button></div></div>` : ""}
      <button class="btn btn-primary btn-block" id="pmAdd" ${stock <= 0 ? "disabled" : ""}>${ico("cart")}Savatga qo'shish</button>
      <button class="btn btn-ghost btn-block" id="pmBuy" ${stock <= 0 ? "disabled" : ""}>Hozir sotib olish</button>
      <div class="pm-acts">
        <button class="pm-act${state.fav.includes(p.id) ? " on" : ""}" data-fav="${p.id}">${ico("heart")}Saralash</button>
        <button class="pm-act${state.compare.includes(p.id) ? " on" : ""}" id="pmCmp">${ico("compare")}${state.compare.includes(p.id) ? "Taqqoslashda" : "Taqqoslash"}</button>
      </div>
      <ul class="pm-info-list">
        <li>${ico("truck")}<span>${p.price >= FREE_SHIP_FROM ? "Bepul yetkazib berish" : `Yetkazib berish: ${fmt(SHIP_PRICE)} (${num(FREE_SHIP_FROM)} so'mdan bepul)`}</span></li>
        <li>${ico("box")}<span>Do'kondan olib ketish — bepul</span></li>
        <li>${ico("card")}<span>${PAYMENTS.slice(0, 4).map((x) => x.name).join(", ")} va boshqalar</span></li>
      </ul>
    </aside>
  </div>
  <section class="pm-reviews" id="pmReviews"><div class="rv-wait">Sharhlar yuklanmoqda…</div></section>
  ${related.length ? `<section class="pm-related"><h3 class="pm-h">O'xshash mahsulotlar</h3><div class="pgrid pgrid-4">${related.map(productCard).join("")}</div></section>` : ""}`;

  const body = $("#productModalBody");
  $(".rating", body).classList.add("rv-jump");
  $(".rating", body).addEventListener("click", () => $("#pmReviews").scrollIntoView({ behavior: "smooth", block: "start" }));
  loadReviews(p);
  const updMonthly = () => ($("#pmMonthly").textContent = `${fmt((p.price * qty) / months)} / oy`);
  updMonthly();
  $$("[data-q]", body).forEach((b) => b.addEventListener("click", () => {
    qty = Math.max(1, Math.min(stock, qty + +b.dataset.q));
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
  $("#pmAdd").addEventListener("click", (e) => addToCart(id, qty, e.currentTarget));
  $("#pmCmp").addEventListener("click", (e) => {
    toggleCompare(id); updateHeadCounts();
    const on = state.compare.includes(id);
    e.currentTarget.classList.toggle("on", on);
    e.currentTarget.innerHTML = `${ico("compare")}${on ? "Taqqoslashda" : "Taqqoslash"}`;
  });
  $("#pmBuy").addEventListener("click", () => {
    if (!state.cart.some((x) => x.id === id) && addToCart(id, qty, null, true) === false) return;
    closeAll(); openCheckout();
  });
  openLayer($("#productModal"));
  $("#productModal .modal-box").scrollTop = 0;
  addRecent(id);
}

// ---------- Yaqinda ko'rilganlar ----------
function addRecent(id) {
  state.recent = [id, ...state.recent.filter((x) => x !== id)].slice(0, 10);
  store.set("recent", state.recent);
  renderRecent();
}
function renderRecent() {
  const list = state.recent.map(byId).filter(Boolean);
  $("#recentSection").hidden = !list.length;
  $("#recentList").innerHTML = list.map((p) => `<a class="rv" href="#p-${p.id}" data-open-p="${p.id}">
      <span class="rv-img">${pic(p, 330)}</span>
      <span class="rv-t"><b>${esc(p.name)}</b><small>${fmt(p.price)}</small></span>
    </a>`).join("");
}

// Havola orqali kelganda (#p-12) — mahsulotni ochamiz
{ const m = location.hash.match(/^#p(?:roduct)?-(\d+)$/); if (m) setTimeout(() => byId(+m[1]) && openProduct(+m[1]), 400); }

// Raqam: 1 234 567
function num(n) { return Math.round(n || 0).toLocaleString("ru-RU").replace(/[\s,]/g, " "); }
// Barcha to'rlardagi kartochkalar holatini (savatda / saralangan / taqqoslashda) yangilash
function syncCards() {
  $$(".card[data-id]").forEach((c) => {
    const id = +c.dataset.id, b = $("[data-add]", c);
    const inCart = state.cart.some((x) => x.id === id);
    if (b && !b.disabled) { b.classList.toggle("added", inCart); b.innerHTML = inCart ? `${ico("check")}Savatda` : `${ico("cart")}Savatga qo'shish`; }
    $("[data-cmp]", c)?.classList.toggle("on", state.compare.includes(id));
    const f = $("[data-fav]", c); if (f) f.classList.toggle("on", state.fav.includes(id));
  });
}
// Yuqori qatordagi matn: admin sozlamasidan (boshidagi emoji olib tashlanadi)
const cleanTop = (t) => String(t || "").replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/u, "");
$("#topbarText").textContent = cleanTop(SETTINGS.topbar) || `${num(FREE_SHIP_FROM)} so'mdan yuqori xaridlarga bepul yetkazib berish`;

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
  setTimeout(() => { updateBadges(true); renderCart(); syncCards(); }, srcEl ? 700 : 0);
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
    saveCart(); renderCart(); updateBadges(); syncCards();
  };
  if (el) { el.classList.add("removing"); setTimeout(done, 330); } else done();
}

function totals() {
  const sub = state.cart.reduce((s, x) => s + byId(x.id).price * x.qty, 0);
  const disc = state.promo ? sub * PROMOS[state.promo] : 0;
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
    box.innerHTML = `<div class="drawer-empty">${ico("cart", "ic ic-xl")}<h4>Savat bo'sh</h4><p>Katalogdan mahsulot tanlang va "Savatga qo'shish" tugmasini bosing.</p></div>`;
    $("#cartFoot").hidden = true;
    return;
  }
  $("#cartFoot").hidden = false;
  box.innerHTML = state.cart.map(({ id, qty }) => {
    const p = byId(id);
    return `<div class="citem" data-id="${id}">
      ${img(p, 140, 140, "loaded")}
      <div class="citem-info">
        <h5>${p.name}</h5><b>${fmt(p.price * qty)}</b>
        <div class="qty"><button data-d="-1">−</button><span>${qty}</span><button data-d="1">+</button></div>
      </div>
      <button class="rm" title="O'chirish" aria-label="O'chirish">${ico("trash")}</button>
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
async function showOrders() {
  if (!auth.user) return requireLogin("Buyurtmalaringizni ko'rish uchun akkauntingizga kiring", showOrders);
  const box = $("#orderItems");
  box.innerHTML = `<div class="drawer-empty"><div>⏳</div><p>Yuklanmoqda…</p></div>`;
  openLayer($("#ordersDrawer"));
  try { await loadOrders(); renderOrders(); }
  catch (e) { box.innerHTML = `<div class="drawer-empty"><div>⚠️</div><h4>Yuklab bo'lmadi</h4><p>${esc(e.message)}</p></div>`; }
}
function renderOrders() {
  const box = $("#orderItems");
  if (!state.orders.length) {
    box.innerHTML = `<div class="drawer-empty"><div>📦</div><h4>Hali buyurtmalar yo'q</h4><p>Birinchi xaridingizni amalga oshiring</p></div>`;
    return;
  }
  box.innerHTML = state.orders.map((o) => {
    const cancelled = o.status === "Bekor qilindi";
    const pending = !cancelled && o.confirmed === 0;
    const st = Math.max(0, TRACK.indexOf(o.status));
    const pay = payOf(o.payment);
    const items = o.items.map((i) => ({ ...i, p: byId(i.id) }));
    return `<div class="order-card${cancelled ? " cancelled" : ""}">
      <header><b>#${esc(o.id)}</b><span class="status${pending ? " pending" : ""}">${cancelled ? "Bekor qilindi" : pending ? "⏳ Tasdiqlanmagan" : TRACK_LABEL[st]}</span></header>
      <small class="muted">${new Date(o.created_at).toLocaleString("ru-RU")} · ${pay ? pay.name : esc(o.payment)}${o.months ? ` (${o.months} oy)` : ""} · ${DELIVERY[o.delivery] || ""}</small>
      <div class="thumbs">${items.map((i) => `<img src="${esc(IMG(i.p ? i.p.img : i.img))}" alt="" title="${esc(i.name)}" onerror="this.remove()" />`).join("")}</div>
      <ul>${items.map((i) => `<li>${esc(i.name)} × ${i.qty}</li>`).join("")}</ul>
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
    `<div class="sum-row"><span>${byId(id).name} × ${qty}</span><span>${fmt(byId(id).price * qty)}</span></div>`).join("") +
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
if (window.SFX) ["[data-add]", "#pmAdd", "[data-d]", ".rm", "#themeBtn", "#soundBtn", "#cartBtn", "#ordersBtn", "#accBtn", "[data-open]", "#checkoutBtn", "#pmBuy", "#cbOpen", "[data-cmp]", "#pmCmp", "[data-news]", ".sp-pop", "[data-fav]", "[data-open-p]", "[data-group]"].forEach((sel) => SFX.skip(sel));
document.addEventListener("mouseover", (e) => {
  if (!matchMedia("(hover: hover)").matches) return;
  const c = e.target.closest(".news-card");
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
  syncCards();
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
  updateHeadCounts();
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
    return `<tr class="${diff ? "diff" : ""}"><th scope="row">${label}</th>${cells.map((c) => `<td class="${c.best ? "best" : ""}">${c.v}</td>`).join("")}</tr>`;
  };
  $("#compareBody").innerHTML = `
    <h3 class="cmp-title">Solishtirish: ${catOf(list[0]).name}</h3>
    <p class="cmp-sub">${list.length} ta mahsulot yonma-yon. Eng arzon narx va eng yuqori reyting yashil rangda.</p>
    <div class="cmp-scroll">
      <table class="cmp-table">
        <thead><tr><th></th>${list.map((p) => `<th><div class="cmp-head">
          <img src="${pImg(p)}" alt="${escapeHtml(p.name)}" />
          <b>${p.name}</b>
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
  syncCards();
  renderCompareBar();
});
$("#compareBody").addEventListener("click", (e) => {
  const rm = e.target.closest("[data-cmp-rm]");
  const add = e.target.closest("[data-cmp-add]");
  if (rm) { toggleCompare(+rm.dataset.cmpRm); renderCompare(); }
  if (add) addToCart(+add.dataset.cmpAdd, 1, add);
});

// ---------- Ilova (PWA) ----------
// OPUS Android ilovasi ichida ochilgan bo'lsa — telefonning "Orqaga" tugmasi avval ochiq oynani yopadi (MainActivity.onBackPressed)
const IN_APP = /OPUSApp\//.test(navigator.userAgent);
if (IN_APP) document.documentElement.classList.add("in-app");
window.__opusBack = () => {
  if (!$$(".drawer.open, .modal.open").length) return false;
  closeAll();
  return true;
};
// Android ilova (APK) havolasi — admin panel sozlamasidan
(() => {
  const apk = SETTINGS.apk, link = $("#apkLink");
  if (!apk || !apk.url || IN_APP) return;
  link.href = apk.url; link.hidden = false;
  $("#apkMeta").textContent = apk.version ? `v${apk.version}` : "";
})();

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

// Yangilik rasmi ilova ikonkasi bo'lsa — matnda tilga olingan mahsulot fotosi (bo'lmasa eng ommabop mahsulot)
function newsImg(n, w = 500) {
  if (n.img && !n.img.startsWith("icons/")) return hiImg(n.img, w);
  const t = `${n.title} ${n.excerpt || ""} ${n.body || ""}`.toLowerCase();
  const p = PRODUCTS.find((x) => t.includes(x.name.toLowerCase())) || topBy(PRODUCTS, 1)[0];
  return p ? hiImg(p.img, w) : IMG(n.img);
}
function renderNews() {
  if (!NEWS_LIST.length) { $("#news").hidden = true; return; }
  const tags = [...new Set(NEWS_LIST.map((n) => n.tag).filter(Boolean))];
  $("#newsTabs").innerHTML = ["all", ...tags].map((t) =>
    `<button class="chip ${t === newsTag ? "active" : ""}" data-tag="${esc(t)}">${t === "all" ? "Barchasi" : esc(t)}</button>`).join("");
  const list = sortedNews().filter((n) => newsTag === "all" || n.tag === newsTag);
  $("#newsMore").hidden = newsAll || list.length <= 4;
  $("#newsGrid").innerHTML = list.slice(0, newsAll ? list.length : 4).map((n, i) => `
    <article class="news-card ${i === 0 ? "featured" : ""}" data-news="${n.id}" tabindex="0" role="button" aria-label="${esc(n.title)}">
      <div class="news-img"><img src="${esc(newsImg(n))}" alt="" loading="lazy" onerror="this.parentNode.classList.add('noimg');this.remove()" />${n.pinned ? `<span class="news-pin">📌 Muhim</span>` : ""}</div>
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
    ${n.img ? `<div class="na-img"><img src="${esc(newsImg(n, 960))}" alt="" onerror="this.parentNode.remove()" /></div>` : ""}
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
  ini.textContent = u ? initials(u.name) : "";
  $("#accLabel").textContent = u ? u.name.split(/\s+/)[0] : "Kirish";
  $("#accBtn").classList.toggle("on", !!u);
  $("#accBtn").title = u ? u.name + " — akkaunt" : "Kirish / Ro'yxatdan o'tish";
}

// Kirmagan bo'lsa — kirish oynasini ochadi, kirgandan keyin then() ni bajaradi
function requireLogin(msg, then) {
  afterLogin = then || null;
  openAuth("login", msg);
}
function openAuth(tab = "login", msg) {
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
function openAccount() {
  if (!auth.user) return openAuth("login");
  const u = auth.user, f = $("#profileForm").elements;
  $("#accAva").textContent = initials(u.name);
  $("#accName").textContent = u.name;
  $("#accPhone").textContent = fmtPhone(u.phone) + (u.email ? " · " + u.email : "");
  f.name.value = u.name || ""; f.email.value = u.email || ""; f.address.value = u.address || "";
  f.region.value = u.region || "Toshkent shahri";
  $("#passForm").reset();
  openLayer($("#accDrawer"));
  // Ma'lumotlar boshqa qurilmada o'zgargan bo'lishi mumkin — yangilab qo'yamiz
  api("GET", "/api/me").then((r) => setAuth(auth.token, r.user), (e) => { if (e.status === 401) { closeAll(); toast("Seans tugagan — qayta kiring"); } });
}
$("#accBtn").addEventListener("click", openAccount);
$("#accOrders").addEventListener("click", showOrders);
$("#accLogout").addEventListener("click", async () => {
  try { await api("POST", "/api/auth/logout"); } catch {}
  setAuth(null);
  closeAll();
  toast("Akkauntdan chiqdingiz");
});
$("#profileForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target.elements;
  if (f.name.value.trim().length < 2) return toast("⚠️ Ism familiyangizni kiriting");
  try {
    const r = await api("PATCH", "/api/me", { name: f.name.value.trim(), email: f.email.value.trim() || null, region: f.region.value, address: f.address.value.trim() });
    setAuth(auth.token, r.user);
    $("#accName").textContent = r.user.name; $("#accAva").textContent = initials(r.user.name);
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
      <div class="rv-form-foot"><small class="muted">Sharhingiz ismingiz bilan ko'rsatiladi</small><button class="btn btn-primary btn-sm">Yuborish</button></div>
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
  $("#rvWrite").addEventListener("click", () => {
    if (!auth.user) return requireLogin("Sharh yozish uchun akkauntingizga kiring", () => { openProduct(p.id); setTimeout(() => $("#rvWrite")?.click(), 900); });
    const f = $("#rvForm");
    f.hidden = !f.hidden;
    if (!f.hidden) f.elements.text.focus();
  });
  $("#rvForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = e.target.elements.text.value.trim();
    if (!rating) return toast("⭐ Avval yulduzcha bilan baho bering");
    if (text.length < 3) return toast("✍️ Fikringizni bir necha so'z bilan yozing");
    const btn = $("button.btn", e.target);
    btn.disabled = true;
    try {
      await api("POST", `/api/products/${p.id}/reviews`, { rating, text });
      toast("🙏 Rahmat! Sharhingiz qo'shildi");
      loadReviews(p, true);
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
    $("#topbarText").textContent = cleanTop(SETTINGS.topbar) || `${num(FREE_SHIP_FROM)} so'mdan yuqori xaridlarga bepul yetkazib berish`;
    renderCategories(); renderProducts(); renderCart(); renderRecent(); renderCompareBar(); renderNews(); updateBadges();
  } catch { catalogError(); }
}

// ---------- Admin: oldindan ko'rish ----------
if (window.OPUS_PREVIEW) { $("#previewBar").hidden = false; document.body.classList.add("is-preview"); }

// ---------- Admin sozlamalaridagi matnlar ----------

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
  try { TG.setHeaderColor("#ffffff"); TG.setBackgroundColor("#f4f6f8"); TG.setBottomBarColor?.("#ffffff"); } catch {}
  try { TG.disableVerticalSwipes?.(); } catch {}
  TG.BackButton.onClick(() => closeAll());
  tgAuth();
}
// Yangilik havolasi orqali kelganda (#news-3) — maqolani ochamiz
{ const m = location.hash.match(/^#news-(\d+)$/); if (m) setTimeout(() => openNews(+m[1]), 1500); }
