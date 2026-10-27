// ================= OPUS MARKET — mobil ilova =================
// Android ilovasi (va telefon brauzeri) uchun alohida interfeys: pastki tablar, ekranlar steki, savat, buyurtma.
// Server — saytniki bilan bir xil (API_BASE, assets.js). Savat va akkaunt sayt bilan umumiy (localStorage "opus_*").

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (n) => Math.round(n || 0).toLocaleString("ru-RU").replace(/[\s,]/g, " ");
const fmt = (n) => num(n) + " so'm";
const VERSION = (navigator.userAgent.match(/OPUSApp\/([\d.]+)/) || [])[1] || "web";
const SHOP_PHONE = "+998712000000";
const BOT = "opussmarketbot";
const REGIONS = ["Toshkent shahri", "Toshkent viloyati", "Samarqand", "Buxoro", "Andijon", "Farg'ona", "Namangan", "Qashqadaryo", "Surxondaryo", "Xorazm", "Navoiy", "Jizzax", "Sirdaryo", "Qoraqalpog'iston"];
const STATUSES = ["Yangi", "Tasdiqlandi", "Yig'ilmoqda", "Yo'lda", "Yetkazildi"];
const MONTHS = [3, 6, 12, 24];

const store = {
  get(k, d) { try { const v = localStorage.getItem("opus_" + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("opus_" + k, JSON.stringify(v)); } catch {} },
};
// Rasm manzili: ilova /app/ papkasida, rasmlar esa sayt ildizida
const pic = (id) => { const u = IMG(id); return !u ? "" : /^(https?:|data:|blob:)/.test(u) ? u : "../" + u; };
const haptic = (ms = 8) => { try { navigator.vibrate && navigator.vibrate(ms); } catch {} };
const svg = (d) => `<svg viewBox="0 0 24 24"><path d="${d}"/></svg>`;
const IC = {
  back: "M15.4 4.6L8 12l7.4 7.4-1.4 1.4L5.2 12l8.8-8.8z",
  search: "M10 3a7 7 0 015.6 11.2l5.1 5.1-1.4 1.4-5.1-5.1A7 7 0 1110 3zm0 2a5 5 0 100 10 5 5 0 000-10z",
  cart: "M7 18a2 2 0 110 4 2 2 0 010-4zm10 0a2 2 0 110 4 2 2 0 010-4zM1 2h3.3l1 2H21a1 1 0 011 1.2l-1.6 8A2 2 0 0118.4 15H8.1l-.9 1.6V17H19v2H7a2 2 0 01-1.8-2.9l1.4-2.6L3.1 4H1V2z",
  plus: "M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z",
  check: "M9 16.2l-3.5-3.5L4 14.2l5 5 11-11-1.4-1.4z",
  trash: "M9 3h6l1 1h4v2H4V4h4zm-3 5h12l-1 13H7zm4 2v9h1.5v-9zm3.5 0v9H15v-9z",
  share: "M18 16a3 3 0 00-2.4 1.2l-6.7-3.4a3 3 0 000-1.6l6.7-3.4A3 3 0 1015 7l-6.7 3.4a3 3 0 100 3.2L15 17a3 3 0 103-1z",
  sort: "M3 6h18v2H3zm3 5h12v2H6zm4 5h4v2h-4z",
  refresh: "M17.7 6.3A8 8 0 104 13h2a6 6 0 1110.3-4.3L13 12h8V4z",
  heart: "M12 21l-1.5-1.3C5.4 15.1 2 12 2 8.2 2 5.1 4.4 2.7 7.5 2.7c1.7 0 3.4.8 4.5 2.1a6 6 0 014.5-2.1c3.1 0 5.5 2.4 5.5 5.5 0 3.8-3.4 6.9-8.5 11.5z",
  tg: "M21.9 4.3l-3.2 15.1c-.2 1-.9 1.3-1.7.8l-4.8-3.6-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.3-.1-.5-.6-.2L6.5 13.1l-4.7-1.5c-1-.3-1-1 .2-1.5L20.5 3c.9-.3 1.6.2 1.4 1.3z",
};
const heartSvg = `<svg viewBox="0 0 24 24"><path d="${IC.heart}"/></svg>`;

// ---------- Holat ----------
const S = {
  settings: SETTINGS, cats: CATEGORIES, products: PRODUCTS, news: typeof NEWS !== "undefined" ? NEWS : [],
  cart: store.get("cart", []).filter((x) => x && x.id && x.qty > 0),
  fav: store.get("fav", []),
  recent: store.get("recent", []),
  searches: store.get("app_searches", []),
  promo: store.get("app_promo", null),
  months: 12,
  orders: null,
};
const auth = { token: store.get("token", null), user: store.get("user", null) };
const byId = (id) => S.products.find((p) => p.id === +id);
const catOf = (id) => S.cats.find((c) => c.id === id) || {};
const disc = (p) => (p.old && p.old > p.price ? Math.round((1 - p.price / p.old) * 100) : 0);
const inCart = (id) => (S.cart.find((x) => x.id === +id) || {}).qty || 0;

function setAuth(token, user) {
  auth.token = token || null; auth.user = token ? user : null;
  store.set("token", auth.token); store.set("user", auth.user);
  if (!token) S.orders = null;
}
async function api(method, path, body) {
  let res;
  try {
    res = await fetch(API_BASE + path, {
      method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(auth.token ? { Authorization: "Bearer " + auth.token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch { throw Object.assign(new Error("Internet aloqasi yo'q. Qayta urinib ko'ring."), { status: 0 }); }
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    if (res.status === 401 && auth.token && !path.startsWith("/api/auth/")) { setAuth(null); refreshRoot("profile"); }
    throw Object.assign(new Error(data.error || "Xatolik (" + res.status + ")"), { status: res.status });
  }
  return data;
}

// Katalog: avval keshdan (bir zumda), keyin serverdan yangisi
function applyCatalog(d) {
  if (!d || !d.PRODUCTS || !d.PRODUCTS.length) return;
  S.settings = d.SETTINGS || S.settings; S.cats = d.CATEGORIES || S.cats; S.products = d.PRODUCTS; S.news = d.NEWS || S.news;
}
applyCatalog(store.get("app_catalog", null));
async function loadCatalog() {
  const d = await api("GET", "/api/catalog");
  if (d.PRODUCTS && d.PRODUCTS.length) { applyCatalog(d); store.set("app_catalog", d); }
}

// ---------- Ekranlar steki ----------
const TABS = ["home", "catalog", "cart", "fav", "profile"];
const stacks = Object.fromEntries(TABS.map((t) => [t, []]));
let tab = null;
const stage = $("#stage");

function make(def) {
  const el = document.createElement("section");
  el.className = "screen " + (def.cls || "");
  el.innerHTML = def.html;
  el._def = def;
  return el;
}
function mount(el) { el._def.mount && el._def.mount(el); }
function current() { const s = stacks[tab]; return s ? s[s.length - 1] : null; }
function syncTabbar() {
  const top = current();
  document.body.classList.toggle("no-tab", !!(top && top._def.noTab));
  $$("#tabbar button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
}
function push(def) {
  haptic(6);
  const prev = current();
  const el = make(def);
  stacks[tab].push(el);
  stage.appendChild(el);
  el.classList.add("enter");
  if (prev) { prev.classList.add("under"); setTimeout(() => { prev.classList.remove("under"); prev.setAttribute("inert", ""); }, 320); }
  setTimeout(() => el.classList.remove("enter"), 340);
  mount(el); syncTabbar();
  return el;
}
function pop() {
  const s = stacks[tab];
  if (s.length < 2) return false;
  haptic(5);
  const el = s.pop(), prev = current();
  prev.removeAttribute("inert");
  prev.classList.add("back-in");
  el.classList.add("leave");
  el._def.unmount && el._def.unmount(el);
  setTimeout(() => { el.remove(); prev.classList.remove("back-in"); }, 270);
  if (prev._def.onShow) prev._def.onShow(prev);
  syncTabbar();
  return true;
}
function switchTab(t, reset) {
  if (t === tab && !reset) {
    // Shu tabni qayta bosish: boshiga qaytish / yuqoriga aylantirish
    if (stacks[t].length > 1) { while (stacks[t].length > 1) { const el = stacks[t].pop(); el._def.unmount && el._def.unmount(el); el.remove(); } current().removeAttribute("inert"); syncTabbar(); }
    else { const sb = $(".sb", current()); sb && sb.scrollTo({ top: 0, behavior: "smooth" }); }
    return;
  }
  haptic(6);
  const prev = current();
  if (prev) prev.setAttribute("inert", "");
  tab = t;
  if (!stacks[t].length) { const el = make(ROOTS[t]()); stacks[t].push(el); stage.appendChild(el); mount(el); }
  else refreshRoot(t);
  // Boshqa tablarning ekranlari doim yashirin
  TABS.forEach((x) => stacks[x].forEach((el) => { if (x !== t) el.setAttribute("inert", ""); }));
  const top = current();
  top.removeAttribute("inert");
  top.classList.add("fade"); setTimeout(() => top.classList.remove("fade"), 220);
  syncTabbar();
}
// Tab ildiz ekranini qayta chizish (ma'lumot o'zgarganda)
function refreshRoot(t) {
  const s = stacks[t];
  if (!s.length) return;
  const old = s[0], el = make(ROOTS[t]());
  const sb = $(".sb", old), y = sb ? sb.scrollTop : 0;
  if (old.hasAttribute("inert")) el.setAttribute("inert", "");
  old._def.unmount && old._def.unmount(old);
  old.replaceWith(el); s[0] = el; mount(el);
  const nsb = $(".sb", el); if (nsb) nsb.scrollTop = y;
}
// Android "Orqaga" tugmasi (MainActivity.onBackPressed) shuni chaqiradi
window.__opusBack = () => {
  if (!$("#sheet").hidden) { closeSheet(); return true; }
  if (pop()) return true;
  if (tab !== "home") { switchTab("home"); return true; }
  return false;
};
$("#tabbar").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) switchTab(b.dataset.tab); });

// ---------- Umumiy UI ----------
function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast"; el.textContent = msg;
  $("#toasts").appendChild(el);
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 260); }, 2400);
}
function openSheet(html, onMount) {
  haptic(6);
  $("#sheetBody").innerHTML = html;
  $("#sheet").hidden = false; $("#sheetBg").hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => $("#sheet").classList.add("open")));
  onMount && onMount($("#sheetBody"));
}
function closeSheet() {
  $("#sheet").classList.remove("open"); $("#sheetBg").hidden = true;
  setTimeout(() => { if (!$("#sheet").classList.contains("open")) $("#sheet").hidden = true; }, 300);
}
$("#sheetBg").addEventListener("click", closeSheet);
const hdr = (title, right = "") => `<header class="hdr"><button class="ib" data-back aria-label="Orqaga">${svg(IC.back)}</button><h1>${esc(title)}</h1>${right}</header>`;
const emptyBox = (em, h, p, btn) => `<div class="empty"><div class="em">${em}</div><h3>${h}</h3><p>${p}</p>${btn || ""}</div>`;
document.addEventListener("click", (e) => { if (e.target.closest("[data-back]")) pop(); });

function badges() {
  const n = S.cart.reduce((a, x) => a + x.qty, 0);
  const cb = $("#cartBadge"), fb = $("#favBadge");
  if (cb.textContent !== String(n) && n) { cb.classList.remove("bump"); void cb.offsetWidth; cb.classList.add("bump"); }
  cb.hidden = !n; cb.textContent = n > 99 ? "99+" : n;
  fb.hidden = !S.fav.length; fb.textContent = S.fav.length;
}

// ---------- Mahsulot kartochkasi ----------
const fallbackIcon = (p) => `<span class="fb"><svg viewBox="0 0 24 24">${ICONS[catOf(p.cat).icon] || ICONS.laptop}</svg></span>`;
function card(p) {
  const d = disc(p), q = inCart(p.id), out = (p.stock || 0) <= 0;
  return `<article class="pc${out ? " out" : ""}" data-pid="${p.id}">
    <div class="pc-img">${fallbackIcon(p)}<img src="${esc(pic(p.img))}" alt="" loading="lazy" onload="this.classList.add('ld')" onerror="this.remove()" />
      <button class="fav${S.fav.includes(p.id) ? " on" : ""}" data-fav="${p.id}" aria-label="Saralanganga">${heartSvg}</button>
      <div class="tags">${d ? `<span class="tag">−${d}%</span>` : ""}${p.badge === "Yangi" ? `<span class="tag new">Yangi</span>` : p.badge === "Xit" ? `<span class="tag hit">Xit</span>` : ""}</div>
    </div>
    <div class="pc-b">
      <span class="pc-m">${num(p.price / 12)} so'm/oy</span>
      <p class="pc-n">${esc(p.name)}</p>
      <span class="pc-r"><b>★</b> ${p.rating || "—"} <span>(${p.reviews || 0} sharh)</span></span>
      <div class="pc-p"><div>${d ? `<s>${num(p.old)}</s>` : ""}<b class="${d ? "sale" : ""}">${num(p.price)} <small>so'm</small></b></div>
        <button class="add${q ? " in" : ""}" data-add="${p.id}" ${out ? "disabled" : ""} aria-label="Savatga">${svg(q ? IC.check : IC.cart)}</button></div>
    </div>
  </article>`;
}
const grid = (list) => `<div class="grid">${list.map(card).join("")}</div>`;
function refreshCards() {
  $$(".pc").forEach((c) => {
    const id = +c.dataset.pid, q = inCart(id), b = $("[data-add]", c), f = $("[data-fav]", c);
    if (b) { b.classList.toggle("in", !!q); b.innerHTML = svg(q ? IC.check : IC.cart); }
    if (f) f.classList.toggle("on", S.fav.includes(id));
  });
}

// ---------- Savat va saralangan ----------
function saveCart() { store.set("cart", S.cart); badges(); }
function addToCart(id, qty = 1, silent) {
  const p = byId(id);
  if (!p || (p.stock || 0) <= 0) { toast("⛔ Bu mahsulot tugagan"); return; }
  const it = S.cart.find((x) => x.id === p.id);
  const next = Math.min((it ? it.qty : 0) + qty, p.stock);
  if (it && it.qty >= p.stock) { toast(`Omborda faqat ${p.stock} dona bor`); return; }
  if (it) it.qty = next; else S.cart.push({ id: p.id, qty: next });
  saveCart(); haptic(15);
  if (!silent) toast("🛒 Savatga qo'shildi");
}
function setQty(id, qty) {
  const p = byId(id), it = S.cart.find((x) => x.id === +id);
  if (!it) return;
  if (qty <= 0) S.cart = S.cart.filter((x) => x.id !== +id);
  else it.qty = Math.min(qty, p ? p.stock : qty);
  saveCart(); haptic(6);
}
function toggleFav(id, btn) {
  id = +id;
  const on = !S.fav.includes(id);
  S.fav = on ? [id, ...S.fav] : S.fav.filter((x) => x !== id);
  store.set("fav", S.fav); badges(); haptic(on ? 18 : 6);
  if (btn) { btn.classList.toggle("on", on); btn.classList.remove("pop"); void btn.offsetWidth; btn.classList.add("pop"); }
  $$(`[data-fav="${id}"]`).forEach((b) => b.classList.toggle("on", on));
  if (on) toast("❤️ Saralanganlarga qo'shildi");
  if (tab !== "fav") refreshRoot("fav");
}
document.addEventListener("click", (e) => {
  const f = e.target.closest("[data-fav]");
  if (f) { e.stopPropagation(); toggleFav(f.dataset.fav, f); return; }
  const a = e.target.closest("[data-add]");
  if (a) {
    e.stopPropagation();
    if (inCart(a.dataset.add)) { switchTab("cart"); return; }
    addToCart(a.dataset.add); refreshCards(); return;
  }
  const c = e.target.closest("[data-pid]");
  if (c) { openProduct(+c.dataset.pid); return; }
  const k = e.target.closest("[data-cat]");
  if (k) { openList({ title: catOf(k.dataset.cat).name, cat: k.dataset.cat }); return; }
  const n = e.target.closest("[data-news]");
  if (n) openNews(+n.dataset.news);
});

// =====================================================================
// ---------- Bosh sahifa ----------
// =====================================================================
function homeScreen() {
  const P = S.products.filter((p) => (p.stock || 0) > 0);
  const deals = P.filter((p) => disc(p)).sort((a, b) => disc(b) - disc(a)).slice(0, 12);
  const fresh = P.filter((p) => p.badge === "Yangi").slice(0, 12);
  const recent = S.recent.map(byId).filter(Boolean).slice(0, 12);
  const popular = S.products.slice().sort((a, b) => (b.popular || 0) - (a.popular || 0));
  const top = deals[0] || P[0];
  const pinned = S.news.find((n) => n.pinned) || S.news[0];
  const banners = [
    top && { cls: "red", small: "Aksiya", b: S.settings.dealTitle || "Katta chegirmalar", span: "Eng zo'r takliflar bir joyda", img: top.img, act: "deals" },
    { cls: "violet", small: "Uzum Nasiya", b: "0% bo'lib to'lash", span: "3, 6, 12 yoki 24 oyga — ortiqcha to'lovsiz", img: (P[1] || top || {}).img, act: "nasiya" },
    { cls: "green", small: "Yetkazib berish", b: "Bepul yetkazamiz", span: `${num(S.settings.freeShipFrom || 1000000)} so'mdan yuqori xaridlarda`, img: (P[2] || top || {}).img, act: "ship" },
    pinned && { cls: "dark", small: pinned.tag || "Yangilik", b: pinned.title, span: pinned.excerpt || "", img: pinned.img, act: "news:" + pinned.id },
  ].filter(Boolean);
  const name = auth.user ? auth.user.name.split(" ")[0] : "";
  return {
    html: `<div class="home-hdr">
        <div class="home-top"><span class="brand"><i></i>OPUS<b>MARKET</b></span><span class="home-loc">📍 ${esc((auth.user && auth.user.region) || "Toshkent")}</span></div>
        <button class="searchbar" data-search>${svg(IC.search)}<span>Mahsulot va brendlarni qidirish</span></button>
      </div>
      <div class="sb pad-bar" id="homeSb">
        <div class="ptr" id="ptr">${svg(IC.refresh)}</div>
        ${name ? `<div class="sec" style="padding-bottom:0"><h2 style="font-size:20px">Salom, ${esc(name)} 👋</h2></div>` : ""}
        <div class="banners" id="banners">${banners.map((b, i) => `<button class="bn ${b.cls}" data-bn="${b.act}"><img src="${esc(pic(b.img))}" alt="" onerror="this.remove()" /><small>${esc(b.small)}</small><b>${esc(b.b)}</b><span>${esc(b.span)}</span></button>`).join("")}</div>
        <div class="dots" id="bnDots">${banners.map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</div>
        <div class="sec"><div class="cats">${S.cats.map((c) => `<button class="cat" data-cat="${esc(c.id)}"><span class="ci"><img src="${esc(pic(c.img))}" alt="" loading="lazy" onerror="this.outerHTML='<svg viewBox=&quot;0 0 24 24&quot; width=&quot;30&quot; fill=&quot;currentColor&quot;>${(ICONS[c.icon] || "").replace(/"/g, "&quot;")}</svg>'" /></span>${esc(c.name)}</button>`).join("")}</div></div>
        ${deals.length ? `<div class="sec"><div class="sec-h"><h2>⚡ Kun takliflari <span class="timer" id="dealTimer"></span></h2><button data-open="deals">Barchasi</button></div><div class="hscroll">${deals.map(card).join("")}</div></div>` : ""}
        ${fresh.length ? `<div class="sec"><div class="sec-h"><h2>🆕 Yangi kelganlar</h2></div><div class="hscroll">${fresh.map(card).join("")}</div></div>` : ""}
        ${recent.length ? `<div class="sec"><div class="sec-h"><h2>👀 Siz ko'rganlar</h2></div><div class="hscroll">${recent.map(card).join("")}</div></div>` : ""}
        ${S.news.length ? `<div class="sec"><div class="sec-h"><h2>📰 Yangiliklar</h2></div><div class="hscroll">${S.news.slice(0, 8).map((n) => `<button class="news-c" data-news="${n.id}"><img src="${esc(pic(n.img))}" alt="" loading="lazy" onerror="this.remove()" /><div><small>${esc(n.tag || "Yangilik")}</small><b>${esc(n.title)}</b></div></button>`).join("")}</div></div>` : ""}
        <div class="sec"><div class="sec-h"><h2>🔥 Siz uchun</h2></div><div id="feed">${grid(popular.slice(0, 20))}</div><div class="more" id="feedMore">${popular.length > 20 ? "Yuklanmoqda…" : "Hammasi ko'rsatildi ✨"}</div></div>
      </div>`,
    mount(el) {
      const sb = $("#homeSb", el);
      $("[data-search]", el).onclick = () => openSearch();
      $$("[data-open]", el).forEach((b) => (b.onclick = () => openList({ title: "⚡ Kun takliflari", deals: true })));
      // Bannerlar: avtomatik aylanish va nuqtalar
      const bn = $("#banners", el), dots = $$("#bnDots i", el);
      let idx = 0;
      bn.addEventListener("scroll", () => { idx = Math.round(bn.scrollLeft / bn.clientWidth); dots.forEach((d, i) => d.classList.toggle("on", i === idx)); }, { passive: true });
      el._bnTimer = setInterval(() => { if (!document.hidden && !el.hasAttribute("inert")) bn.scrollTo({ left: ((idx + 1) % dots.length) * (bn.firstElementChild.offsetWidth + 10), behavior: "smooth" }); }, 4500);
      bn.addEventListener("click", (e) => {
        const b = e.target.closest("[data-bn]"); if (!b) return;
        const a = b.dataset.bn;
        if (a === "deals") openList({ title: "⚡ Kun takliflari", deals: true });
        else if (a === "nasiya") openSheet(`<h3>💜 Uzum Nasiya — 0%</h3><p class="muted" style="margin-bottom:14px">Istalgan mahsulotni 3, 6, 12 yoki 24 oyga ortiqcha foizsiz bo'lib to'lab oling. Rasmiylashtirishda "Uzum Nasiya" to'lov usulini tanlang.</p><button class="btn block" id="nsOk">Tushunarli</button>`, (b) => ($("#nsOk", b).onclick = closeSheet));
        else if (a === "ship") openSheet(`<h3>🚚 Yetkazib berish</h3><p class="muted" style="margin-bottom:14px">Toshkent bo'ylab 24 soat ichida, viloyatlarga 2–4 ish kunida. ${num(S.settings.freeShipFrom || 1000000)} so'mdan yuqori xaridlarda — bepul, aks holda ${fmt(S.settings.shipPrice || 50000)}. Do'kondan o'zingiz olib ketishingiz ham mumkin.</p><button class="btn block" id="nsOk">Tushunarli</button>`, (b) => ($("#nsOk", b).onclick = closeSheet));
        else if (a.startsWith("news:")) openNews(+a.slice(5));
      });
      // Kun takliflari taymeri (yarim tungacha)
      const tick = () => { const t = $("#dealTimer", el); if (!t) return; const d = new Date(), end = new Date(d); end.setHours(24, 0, 0, 0); const s = Math.floor((end - d) / 1000); t.textContent = [s / 3600, (s % 3600) / 60, s % 60].map((x) => String(Math.floor(x)).padStart(2, "0")).join(":"); };
      tick(); el._timer = setInterval(tick, 1000);
      // Cheksiz lenta
      let shown = 20;
      const more = $("#feedMore", el);
      const io = new IntersectionObserver((en) => {
        if (!en[0].isIntersecting || shown >= popular.length) return;
        const next = popular.slice(shown, shown + 20); shown += next.length;
        $("#feed .grid", el).insertAdjacentHTML("beforeend", next.map(card).join(""));
        if (shown >= popular.length) more.textContent = "Hammasi ko'rsatildi ✨";
      }, { root: sb, rootMargin: "400px" });
      io.observe(more); el._io = io;
      pullToRefresh(sb, $("#ptr", el), async () => { await loadCatalog(); refreshRoot("home"); toast("↻ Yangilandi"); });
    },
    unmount(el) { clearInterval(el._timer); clearInterval(el._bnTimer); el._io && el._io.disconnect(); },
  };
}
// Yuqoridan tortib yangilash
function pullToRefresh(sb, ind, run) {
  let y0 = null, dy = 0, busy = false;
  sb.addEventListener("touchstart", (e) => { if (sb.scrollTop <= 0 && !busy) y0 = e.touches[0].clientY; }, { passive: true });
  sb.addEventListener("touchmove", (e) => {
    if (y0 == null) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    if (dy > 0 && sb.scrollTop <= 0) { ind.style.transition = "none"; ind.style.height = Math.min(70, dy * 0.45) + "px"; ind.firstChild.style.transform = `rotate(${dy * 2}deg)`; }
  }, { passive: true });
  sb.addEventListener("touchend", async () => {
    if (y0 == null) return;
    y0 = null; ind.style.transition = "";
    if (dy * 0.45 > 52) {
      busy = true; ind.style.height = "52px"; ind.classList.add("spin"); haptic(12);
      try { await run(); } catch (ex) { toast("⚠️ " + ex.message); }
      busy = false; ind.classList.remove("spin");
    }
    ind.style.height = "0"; dy = 0;
  });
}

// =====================================================================
// ---------- Katalog ----------
// =====================================================================
function catalogScreen() {
  const count = (id) => S.products.filter((p) => p.cat === id).length;
  const brands = [...new Set(S.products.map((p) => p.brand))].sort((a, b) => S.products.filter((p) => p.brand === b).length - S.products.filter((p) => p.brand === a).length).slice(0, 16);
  return {
    html: `<div class="home-hdr"><h1 style="font-size:22px">Katalog</h1><button class="searchbar" data-search>${svg(IC.search)}<span>Qidirish</span></button></div>
      <div class="sb pad-bar">
        <div class="sec"><div class="ctiles">${S.cats.map((c) => `<button class="ctile" data-cat="${esc(c.id)}"><img src="${esc(pic(c.img))}" alt="" loading="lazy" onerror="this.remove()" /><b>${esc(c.name)}</b><small>${count(c.id)} ta mahsulot</small></button>`).join("")}</div></div>
        <div class="sec"><div class="sec-h"><h2>Brendlar</h2></div><div class="recent">${brands.map((b) => `<button data-brand="${esc(b)}">${esc(b)}</button>`).join("")}</div></div>
        <div class="sec"><div class="sec-h"><h2>Tanlovlar</h2></div><div class="recent"><button data-sel="deals">⚡ Chegirmalar</button><button data-sel="new">🆕 Yangi</button><button data-sel="top">⭐ Eng yuqori reyting</button><button data-sel="cheap">💸 1 mln gacha</button></div></div>
      </div>`,
    mount(el) {
      $("[data-search]", el).onclick = () => openSearch();
      el.addEventListener("click", (e) => {
        const b = e.target.closest("[data-brand]"); if (b) return openList({ title: b.dataset.brand, brand: b.dataset.brand });
        const s = e.target.closest("[data-sel]"); if (!s) return;
        const k = s.dataset.sel;
        if (k === "deals") openList({ title: "⚡ Chegirmalar", deals: true });
        if (k === "new") openList({ title: "🆕 Yangi", filter: (p) => p.badge === "Yangi" });
        if (k === "top") openList({ title: "⭐ Eng yuqori reyting", filter: (p) => (p.rating || 0) >= 4.8, sort: "rating" });
        if (k === "cheap") openList({ title: "💸 1 mln so'mgacha", filter: (p) => p.price <= 1000000, sort: "cheap" });
      });
    },
  };
}

// Ro'yxat ekrani: kategoriya, brend, chegirmalar, qidiruv natijasi
const SORTS = { popular: "Ommabop", cheap: "Avval arzonlari", exp: "Avval qimmatlari", rating: "Yuqori reyting", disc: "Katta chegirma" };
function sortList(list, s) {
  const L = list.slice();
  if (s === "cheap") L.sort((a, b) => a.price - b.price);
  else if (s === "exp") L.sort((a, b) => b.price - a.price);
  else if (s === "rating") L.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  else if (s === "disc") L.sort((a, b) => disc(b) - disc(a));
  else L.sort((a, b) => (b.popular || 0) - (a.popular || 0));
  return L.sort((a, b) => ((a.stock || 0) <= 0) - ((b.stock || 0) <= 0)); // tugaganlar oxirida
}
function openList(o) {
  const st = { sort: o.sort || (o.deals ? "disc" : "popular"), stock: false, sale: !!o.deals, orig: false, brand: o.brand || "" };
  const base = S.products.filter((p) => (!o.cat || p.cat === o.cat) && (!o.filter || o.filter(p)) && (!o.ids || o.ids.includes(p.id)));
  const brands = o.brand ? [] : [...new Set(base.map((p) => p.brand))];
  push({
    html: hdr(o.title, `<button class="ib" data-sortbtn aria-label="Saralash">${svg(IC.sort)}</button>`) +
      `<div class="chips"><button class="chip" data-f="sale">🏷 Chegirma</button><button class="chip" data-f="stock">✓ Omborda bor</button><button class="chip" data-f="orig">🛡 Original</button>${brands.length > 1 ? brands.map((b) => `<button class="chip" data-b="${esc(b)}">${esc(b)}</button>`).join("") : ""}</div>
      <div class="sb"><p class="list-meta" id="meta"></p><div class="sec" style="padding-top:0" id="lst"></div></div>`,
    mount(el) {
      const draw = () => {
        const L = sortList(base.filter((p) => (!st.sale || disc(p)) && (!st.stock || (p.stock || 0) > 0) && (!st.orig || p.original !== false) && (!st.brand || p.brand === st.brand)), st.sort);
        $$("[data-f]", el).forEach((c) => c.classList.toggle("on", st[c.dataset.f]));
        $$("[data-b]", el).forEach((c) => c.classList.toggle("on", st.brand === c.dataset.b));
        $("#meta", el).textContent = `${L.length} ta mahsulot · ${SORTS[st.sort]}`;
        $("#lst", el).innerHTML = L.length ? grid(L) : emptyBox("🔍", "Hech narsa topilmadi", "Filtrlarni o'zgartirib ko'ring");
      };
      el.addEventListener("click", (e) => {
        const f = e.target.closest("[data-f]"); if (f) { st[f.dataset.f] = !st[f.dataset.f]; haptic(5); draw(); }
        const b = e.target.closest("[data-b]"); if (b) { st.brand = st.brand === b.dataset.b ? "" : b.dataset.b; haptic(5); draw(); }
        if (e.target.closest("[data-sortbtn]")) openSheet(`<h3>Saralash</h3>${Object.entries(SORTS).map(([k, v]) => `<button class="opt${st.sort === k ? " on" : ""}" data-s="${k}">${v}</button>`).join("")}`, (box) =>
          box.addEventListener("click", (ev) => { const s = ev.target.closest("[data-s]"); if (s) { st.sort = s.dataset.s; closeSheet(); draw(); } }));
      });
      draw();
    },
  });
}

// ---------- Qidiruv ----------
function openSearch(q0 = "") {
  push({
    html: `<header class="hdr"><button class="ib" data-back aria-label="Orqaga">${svg(IC.back)}</button><label class="searchbar" style="flex:1">${svg(IC.search)}<input id="q" type="search" placeholder="Masalan: ASUS noutbuk" value="${esc(q0)}" autocomplete="off" enterkeyhint="search" /></label></header>
      <div class="sb" id="res"></div>`,
    mount(el) {
      const inp = $("#q", el), res = $("#res", el);
      const words = (s) => s.toLowerCase().split(/\s+/).filter(Boolean);
      const draw = () => {
        const q = inp.value.trim();
        if (!q) {
          res.innerHTML = `${S.searches.length ? `<div class="sec"><div class="sec-h"><h2>Oxirgi qidiruvlar</h2><button data-clear>Tozalash</button></div><div class="recent">${S.searches.map((s) => `<button data-q="${esc(s)}">🕘 ${esc(s)}</button>`).join("")}</div></div>` : ""}
            <div class="sec"><div class="sec-h"><h2>Ommabop</h2></div><div class="recent">${["Noutbuk", "Monitor", "RTX", "Klaviatura", "Sichqoncha", "Quloqchin", "SSD", "Apple", "ASUS", "Logitech"].map((s) => `<button data-q="${s}">🔥 ${s}</button>`).join("")}</div></div>`;
          return;
        }
        const W = words(q);
        const L = sortList(S.products.filter((p) => { const t = `${p.name} ${p.brand} ${catOf(p.cat).name || ""}`.toLowerCase(); return W.every((w) => t.includes(w)); }), "popular");
        res.innerHTML = `<p class="list-meta" style="padding-top:12px">${L.length} ta natija</p><div class="sec" style="padding-top:0">${L.length ? grid(L) : emptyBox("🔍", "Topilmadi", `"${esc(q)}" bo'yicha mahsulot yo'q. Boshqacha yozib ko'ring.`)}</div>`;
      };
      let t;
      inp.addEventListener("input", () => { clearTimeout(t); t = setTimeout(draw, 160); });
      const remember = () => { const q = inp.value.trim(); if (q.length < 2) return; S.searches = [q, ...S.searches.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 8); store.set("app_searches", S.searches); };
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { remember(); inp.blur(); } });
      res.addEventListener("click", (e) => {
        if (e.target.closest("[data-pid]")) remember();
        const b = e.target.closest("[data-q]"); if (b) { inp.value = b.dataset.q; remember(); draw(); }
        if (e.target.closest("[data-clear]")) { S.searches = []; store.set("app_searches", []); draw(); }
      });
      draw();
      setTimeout(() => inp.focus(), 350);
    },
  });
}

// =====================================================================
// ---------- Mahsulot sahifasi ----------
// =====================================================================
function openProduct(id) {
  const p = byId(id);
  if (!p) return;
  S.recent = [p.id, ...S.recent.filter((x) => x !== p.id)].slice(0, 20); store.set("recent", S.recent);
  const imgs = [p.img, ...(p.gallery || [])].filter(Boolean);
  const d = disc(p), stock = p.stock || 0;
  const similar = sortList(S.products.filter((x) => x.cat === p.cat && x.id !== p.id && (x.stock || 0) > 0), "popular").slice(0, 10);
  const freeFrom = S.settings.freeShipFrom || 1000000;
  push({
    noTab: true,
    html: `<header class="hdr clear"><button class="ib" data-back aria-label="Orqaga">${svg(IC.back)}</button><span style="flex:1"></span><button class="ib" data-share aria-label="Ulashish">${svg(IC.share)}</button><button class="ib${S.fav.includes(p.id) ? " on" : ""}" data-pfav aria-label="Saralangan">${svg(IC.heart)}</button></header>
      <div class="sb pad-bar">
        <div class="gal-wrap"><div class="gal" id="gal">${imgs.map((s) => `<img src="${esc(pic(s))}" alt="" onerror="this.remove()" />`).join("")}</div>${imgs.length > 1 ? `<div class="dots" id="gd">${imgs.map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</div>` : ""}</div>
        <div class="pd">
          <div class="pd-price"><b class="${d ? "sale" : ""}">${fmt(p.price)}</b>${d ? `<s>${fmt(p.old)}</s><span class="tag">−${d}%</span>` : ""}</div>
          <h2 class="pd-name">${esc(p.name)}</h2>
          <div class="pd-meta"><span><b>★ ${p.rating || "—"}</b> · <span id="rvCount">${p.reviews || 0}</span> sharh</span><span>${esc(p.brand)}</span>${p.original !== false ? `<span>🛡 Original</span>` : ""}</div>
          <button class="nasiya" id="nas"><span>💜</span><div><b id="nasB">${fmt(p.price / S.months)} × ${S.months} oy</b><small>Uzum Nasiya orqali 0% bo'lib to'lash</small></div><span>›</span></button>
          <div class="box">
            <div class="row"><span class="ri">📦</span><div><b class="${stock <= 0 ? "stock-out" : stock <= 5 ? "stock-low" : "stock-ok"}">${stock <= 0 ? "Tugagan" : stock <= 5 ? `Tez tugaydi — ${stock} dona qoldi` : `Omborda ${stock} dona bor`}</b><small>OPUS MARKET omboridan</small></div></div>
            <div class="row"><span class="ri">🚚</span><div><b>Yetkazish: ertaga</b><small>${p.price >= freeFrom ? "Bepul yetkazib beramiz" : `${fmt(S.settings.shipPrice || 50000)}, ${num(freeFrom)} so'mdan bepul`}</small></div></div>
            <div class="row"><span class="ri">🏬</span><div><b>Do'kondan olib ketish</b><small>Bepul · bugunoq</small></div></div>
          </div>
          ${p.desc ? `<div class="box"><h3>Tavsif</h3><p class="desc">${esc(p.desc)}</p></div>` : ""}
          ${p.specs && Object.keys(p.specs).length ? `<div class="box"><h3>Xususiyatlar</h3><dl class="specs">${Object.entries(p.specs).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl></div>` : ""}
          <div class="box" id="rvBox"><h3>Sharhlar</h3><div class="skel" style="height:60px"></div></div>
          ${similar.length ? `<div><div class="sec-h" style="margin-top:6px"><h2>O'xshash mahsulotlar</h2></div><div class="hscroll">${similar.map(card).join("")}</div></div>` : ""}
        </div>
      </div>
      <div class="buybar" id="buy"></div>`,
    mount(el) {
      const gal = $("#gal", el), gd = $$("#gd i", el);
      gal.addEventListener("scroll", () => { const i = Math.round(gal.scrollLeft / gal.clientWidth); gd.forEach((x, k) => x.classList.toggle("on", k === i)); }, { passive: true });
      const drawBuy = () => {
        const q = inCart(p.id);
        $("#buy", el).innerHTML = stock <= 0 ? `<button class="btn block" disabled>Tugagan</button>`
          : q ? `<div class="stepper"><button data-q="-1">−</button><span>${q}</span><button data-q="1">+</button></div><button class="btn green flex" data-gocart>Savatga o'tish</button>`
          : `<div><small>${d ? `<s>${num(p.old)}</s>` : "Narxi"}</small><b>${fmt(p.price)}</b></div><button class="btn flex" data-buy>${svg(IC.cart)} Savatga qo'shish</button>`;
      };
      drawBuy();
      $("#buy", el).addEventListener("click", (e) => {
        if (e.target.closest("[data-buy]")) { addToCart(p.id); drawBuy(); refreshCards(); }
        const s = e.target.closest("[data-q]"); if (s) { setQty(p.id, inCart(p.id) + +s.dataset.q); drawBuy(); refreshCards(); }
        if (e.target.closest("[data-gocart]")) switchTab("cart");
      });
      $("[data-pfav]", el).onclick = (e) => toggleFav(p.id, e.currentTarget);
      $("[data-share]", el).onclick = () => {
        const url = `https://javohir877.github.io/OPUS-MARKET/#product-${p.id}`;
        if (navigator.share) navigator.share({ title: p.name, text: `${p.name} — ${fmt(p.price)}`, url }).catch(() => {});
        else navigator.clipboard?.writeText(url).then(() => toast("🔗 Havola nusxalandi"));
      };
      $("#nas", el).onclick = () => openSheet(`<h3>💜 Bo'lib to'lash</h3><p class="muted" style="margin-bottom:12px">Uzum Nasiya — 0% ustamasiz</p><div class="months">${MONTHS.map((m) => `<button data-m="${m}" class="${m === S.months ? "on" : ""}">${m} oy</button>`).join("")}</div><div class="box" style="margin-top:12px"><div class="sum"><div><span>Oylik to'lov</span><b id="mPay">${fmt(p.price / S.months)}</b></div><div><span>Jami</span><b>${fmt(p.price)}</b></div></div></div><button class="btn block" style="margin-top:14px" id="mOk">Tanlash</button>`, (box) => {
        box.addEventListener("click", (e) => {
          const m = e.target.closest("[data-m]");
          if (m) { S.months = +m.dataset.m; $$("[data-m]", box).forEach((b) => b.classList.toggle("on", b === m)); $("#mPay", box).textContent = fmt(p.price / S.months); haptic(5); }
          if (e.target.closest("#mOk")) { closeSheet(); $("#nasB", el).textContent = `${fmt(p.price / S.months)} × ${S.months} oy`; }
        });
      });
      loadReviews(p, el);
    },
  });
}
async function loadReviews(p, el) {
  const box = $("#rvBox", el);
  let r;
  try { r = await api("GET", `/api/products/${p.id}/reviews`); } catch { box.innerHTML = `<h3>Sharhlar</h3><p class="muted">Sharhlarni yuklab bo'lmadi</p>`; return; }
  const stars = (n) => "★".repeat(n) + `<i>${"★".repeat(5 - n)}</i>`;
  box.innerHTML = `<div class="sec-h" style="margin:0"><h3>Sharhlar (${r.count})</h3><button data-write style="color:var(--red2);font-weight:600">✍️ Yozish</button></div>
    ${r.count ? `<div class="rv-sum"><b>${r.avg}</b><div><span class="st" style="color:var(--gold)">${"★".repeat(Math.round(r.avg))}</span><br><small class="muted">${r.count} ta mijoz baholadi</small></div></div>` : `<p class="muted">Hali sharh yo'q — birinchi bo'lib fikr bildiring!</p>`}
    ${r.reviews.slice(0, 6).map((v) => `<div class="rv"><header><b>${esc(v.user_name || "Mijoz")}</b><span class="st">${stars(v.rating)}</span></header>
      <small class="muted">${new Date(v.created_at).toLocaleDateString("ru-RU")}${v.verified ? " · ✓ Xarid qilgan" : ""}</small><p>${esc(v.text)}</p>${v.reply ? `<div class="reply"><b>OPUS MARKET:</b> ${esc(v.reply)}</div>` : ""}</div>`).join("")}`;
  $("[data-write]", box).onclick = () => requireAuth(() => writeReview(p, el), "Sharh yozish uchun akkauntingizga kiring");
}
function writeReview(p, el) {
  let rating = 5;
  openSheet(`<h3>✍️ Fikringiz</h3><p class="muted" style="margin-bottom:10px">${esc(p.name)}</p><div class="stars-in" id="stars">${[1, 2, 3, 4, 5].map((i) => `<button data-r="${i}" class="on">★</button>`).join("")}</div>
    <textarea class="inp" id="rvText" rows="4" maxlength="1000" placeholder="Mahsulot sizga yoqdimi? Sifati, yetkazish…" style="margin-top:12px"></textarea>
    <p class="err-t" id="rvErr" hidden></p><button class="btn block" style="margin-top:12px" id="rvSend">Yuborish</button>`, (box) => {
    box.addEventListener("click", async (e) => {
      const s = e.target.closest("[data-r]");
      if (s) { rating = +s.dataset.r; $$("[data-r]", box).forEach((b) => b.classList.toggle("on", +b.dataset.r <= rating)); haptic(5); }
      if (e.target.closest("#rvSend")) {
        const b = $("#rvSend", box); b.disabled = true;
        try {
          await api("POST", `/api/products/${p.id}/reviews`, { rating, text: $("#rvText", box).value });
          closeSheet(); toast("🙏 Rahmat! Sharhingiz qo'shildi"); loadReviews(p, el);
        } catch (ex) { $("#rvErr", box).textContent = ex.message; $("#rvErr", box).hidden = false; b.disabled = false; }
      }
    });
  });
}

function openNews(id) {
  const n = S.news.find((x) => x.id === id);
  if (!n) return;
  push({
    html: hdr(n.tag || "Yangilik") + `<div class="sb"><article class="article"><img src="${esc(pic(n.img))}" alt="" onerror="this.remove()" /><small class="muted">${esc(n.date || "")}</small><h2>${esc(n.title)}</h2>${String(n.body || n.excerpt || "").split(/\n\s*\n/).map((x) => `<p>${esc(x)}</p>`).join("")}</article></div>`,
  });
}

// =====================================================================
// ---------- Savat ----------
// =====================================================================
function totals() {
  const items = S.cart.map((x) => ({ ...x, p: byId(x.id) })).filter((x) => x.p);
  const subtotal = items.reduce((a, x) => a + x.p.price * x.qty, 0);
  const oldSum = items.reduce((a, x) => a + (x.p.old && x.p.old > x.p.price ? x.p.old : x.p.price) * x.qty, 0);
  const pct = S.promo && S.settings.promos && S.settings.promos[S.promo] ? +S.settings.promos[S.promo] : 0;
  const discount = Math.round(subtotal * pct / 100);
  const free = S.settings.freeShipFrom || 1000000;
  return { items, subtotal, oldSum, pct, discount, free, count: items.reduce((a, x) => a + x.qty, 0) };
}
function cartScreen() {
  const T = totals();
  if (!T.items.length) return {
    html: `<div class="home-hdr"><h1 style="font-size:22px">Savat</h1></div><div class="sb pad-bar">${emptyBox("🛒", "Savatingiz bo'sh", "Bosh sahifadan yoqqan mahsulotlarni tanlang — ular shu yerda paydo bo'ladi", `<button class="btn" data-gohome>Xaridni boshlash</button>`)}</div>`,
    mount(el) { $("[data-gohome]", el).onclick = () => switchTab("home"); },
  };
  const left = Math.max(0, T.free - T.subtotal);
  return {
    html: `<div class="home-hdr"><div class="home-top"><h1 style="font-size:22px">Savat <small class="muted" style="font-size:14px;font-weight:500">${T.count} ta mahsulot</small></h1><button class="ib" data-clear aria-label="Tozalash">${svg(IC.trash)}</button></div></div>
      <div class="sb" style="padding-bottom:calc(170px + var(--safe-b))"><div class="sec" style="display:flex;flex-direction:column;gap:10px">
        <div class="ship-prog" style="--w:${Math.min(100, (T.subtotal / T.free) * 100)}%">${left ? `<span>🚚 Bepul yetkazish uchun yana <b>${fmt(left)}</b> xarid qiling</span>` : `<span>🎉 Yetkazib berish <b>bepul!</b></span>`}<i></i></div>
        ${T.items.map((x) => `<div class="ci-row" data-row="${x.id}">
          <button class="thumb" data-pid="${x.id}"><img src="${esc(pic(x.p.img))}" alt="" onerror="this.remove()" /></button>
          <div class="info"><p>${esc(x.p.name)}</p><div>${disc(x.p) ? `<s>${num(x.p.old * x.qty)}</s> ` : ""}<b>${fmt(x.p.price * x.qty)}</b></div>
            <div class="ctrl"><div class="stepper sm"><button data-dq="-1">−</button><span>${x.qty}</span><button data-dq="1">+</button></div>
              <span><button class="del" data-favc="${x.id}" aria-label="Saralangan" style="${S.fav.includes(x.id) ? "color:var(--red2)" : ""}">${svg(IC.heart)}</button><button class="del" data-del aria-label="O'chirish">${svg(IC.trash)}</button></span></div></div>
        </div>`).join("")}
        <div class="box"><h3>🎟 Promo-kod</h3>${T.pct ? `<div class="row"><span class="ri">✅</span><div><b>${esc(S.promo)} — ${T.pct}% chegirma</b><small>Kod qo'llandi</small></div><button class="del" data-unpromo aria-label="Olib tashlash">✕</button></div>`
          : `<form class="promo" id="promo"><input class="inp" name="code" placeholder="Kodni kiriting" autocapitalize="characters" style="text-transform:uppercase" /><button class="btn sm" style="height:50px">Qo'llash</button></form>`}</div>
        <div class="box"><div class="sum">
          <div><span>Mahsulotlar (${T.count})</span><span>${fmt(T.oldSum)}</span></div>
          ${T.oldSum > T.subtotal ? `<div class="disc"><span>Chegirma</span><span>−${fmt(T.oldSum - T.subtotal)}</span></div>` : ""}
          ${T.discount ? `<div class="disc"><span>Promo-kod</span><span>−${fmt(T.discount)}</span></div>` : ""}
          <div class="tot"><span>Jami</span><span>${fmt(T.subtotal - T.discount)}</span></div>
          <small class="muted">Yetkazish narxi keyingi qadamda hisoblanadi</small>
        </div></div>
      </div></div>
      <div class="buybar" style="bottom:calc(var(--tab-h) + var(--safe-b));padding-bottom:10px"><div><small>${T.count} ta mahsulot</small><b>${fmt(T.subtotal - T.discount)}</b></div><button class="btn flex" data-checkout>Rasmiylashtirish</button></div>`,
    mount(el) {
      el.addEventListener("click", (e) => {
        const row = e.target.closest("[data-row]");
        const dq = e.target.closest("[data-dq]");
        if (dq && row) { setQty(+row.dataset.row, inCart(row.dataset.row) + +dq.dataset.dq); refreshRoot("cart"); return; }
        if (e.target.closest("[data-del]") && row) { setQty(+row.dataset.row, 0); toast("Savatdan olib tashlandi"); refreshRoot("cart"); return; }
        const fc = e.target.closest("[data-favc]"); if (fc) { toggleFav(fc.dataset.favc); refreshRoot("cart"); return; }
        if (e.target.closest("[data-unpromo]")) { S.promo = null; store.set("app_promo", null); refreshRoot("cart"); return; }
        if (e.target.closest("[data-clear]")) openSheet(`<h3>Savatni tozalash?</h3><p class="muted" style="margin-bottom:14px">Barcha mahsulotlar savatdan olib tashlanadi.</p><div style="display:flex;gap:10px"><button class="btn ghost flex" id="no">Yo'q</button><button class="btn flex" id="yes">Tozalash</button></div>`, (b) => {
          $("#no", b).onclick = closeSheet;
          $("#yes", b).onclick = () => { S.cart = []; saveCart(); closeSheet(); refreshRoot("cart"); refreshCards(); };
        });
        if (e.target.closest("[data-checkout]")) requireAuth(openCheckout, "Buyurtma berish uchun akkauntingizga kiring");
      });
      const pf = $("#promo", el);
      if (pf) pf.addEventListener("submit", (e) => {
        e.preventDefault();
        const code = pf.elements.code.value.trim().toUpperCase();
        if (S.settings.promos && S.settings.promos[code]) { S.promo = code; store.set("app_promo", code); toast(`🎉 ${S.settings.promos[code]}% chegirma qo'llandi`); haptic(20); refreshRoot("cart"); }
        else { pf.elements.code.classList.remove("err"); void pf.offsetWidth; pf.elements.code.classList.add("err"); toast("⚠️ Bunday promo-kod yo'q"); }
      });
    },
  };
}

// ---------- Rasmiylashtirish ----------
function openCheckout() {
  const u = auth.user || {};
  const o = { delivery: "courier", payment: "click", months: 12, region: u.region || REGIONS[0], address: u.address || "", note: "" };
  push({
    noTab: true,
    html: hdr("Rasmiylashtirish") + `<div class="sb pad-bar" style="padding-bottom:calc(170px + var(--safe-b))"><div class="sec" style="display:flex;flex-direction:column;gap:12px" id="co"></div></div><div class="buybar" id="coBar"></div>`,
    mount(el) {
      const draw = () => {
        const T = totals();
        const ship = o.delivery === "pickup" || T.subtotal >= T.free ? 0 : (S.settings.shipPrice || 50000);
        const total = T.subtotal - T.discount + ship;
        $("#co", el).innerHTML = `
          <div class="box"><h3>📍 Qabul qilish usuli</h3>
            <div class="seg"><button data-dl="courier" class="${o.delivery === "courier" ? "on" : ""}">🚚 Kuryer</button><button data-dl="pickup" class="${o.delivery === "pickup" ? "on" : ""}">🏬 Do'kondan</button></div>
            ${o.delivery === "courier" ? `<div class="field"><span class="lbl">Viloyat</span><select class="inp" id="reg">${REGIONS.map((r) => `<option ${r === o.region ? "selected" : ""}>${r}</option>`).join("")}</select></div>
              <div class="field"><span class="lbl">Manzil</span><textarea class="inp" id="addr" rows="2" maxlength="200" placeholder="Ko'cha, uy, xonadon, mo'ljal">${esc(o.address)}</textarea></div>`
              : `<div class="row"><span class="ri">🏬</span><div><b>OPUS MARKET do'koni</b><small>Toshkent sh., Amir Temur ko'chasi · 09:00–21:00</small></div></div>`}
          </div>
          <div class="box"><h3>💳 To'lov usuli</h3><div class="pays">${PAYMENTS.map((p) => `<button class="pay${o.payment === p.id ? " on" : ""}" data-pay="${p.id}"><span class="logo">${p.svg}</span><div><b>${esc(p.name)}</b><small>${esc(p.note)}</small></div><span class="rd"></span></button>`).join("")}</div>
            ${o.payment === "uzum" ? `<span class="lbl">Muddat</span><div class="months">${MONTHS.map((m) => `<button data-mo="${m}" class="${m === o.months ? "on" : ""}">${m} oy</button>`).join("")}</div><small class="muted">Oyiga ${fmt(total / o.months)} · 0% ustama</small>` : ""}
          </div>
          <div class="box"><h3>💬 Izoh</h3><textarea class="inp" id="note" rows="2" maxlength="500" placeholder="Kuryer uchun izoh (ixtiyoriy)">${esc(o.note)}</textarea></div>
          <div class="box"><h3>🧾 Buyurtma</h3><div class="sum">
            <div><span>Mahsulotlar (${T.count})</span><span>${fmt(T.subtotal)}</span></div>
            ${T.discount ? `<div class="disc"><span>Promo-kod ${esc(S.promo)}</span><span>−${fmt(T.discount)}</span></div>` : ""}
            <div><span>Yetkazib berish</span><span>${ship ? fmt(ship) : `<b style="color:var(--ok)">Bepul</b>`}</span></div>
            <div class="tot"><span>Jami</span><span>${fmt(total)}</span></div></div>
            <small class="muted">Buyurtmani tasdiqlash uchun Telegram'ga 6 xonali kod yuboriladi.</small></div>`;
        $("#coBar", el).innerHTML = `<div><small>Jami</small><b>${fmt(total)}</b></div><button class="btn flex" id="place">Buyurtma berish</button>`;
      };
      const keep = () => { const r = $("#reg", el), a = $("#addr", el), n = $("#note", el); if (r) o.region = r.value; if (a) o.address = a.value; if (n) o.note = n.value; };
      el.addEventListener("click", async (e) => {
        const dl = e.target.closest("[data-dl]"); if (dl) { keep(); o.delivery = dl.dataset.dl; haptic(5); draw(); return; }
        const py = e.target.closest("[data-pay]"); if (py) { keep(); o.payment = py.dataset.pay; haptic(5); draw(); return; }
        const mo = e.target.closest("[data-mo]"); if (mo) { keep(); o.months = +mo.dataset.mo; draw(); return; }
        if (e.target.closest("#place")) {
          keep();
          if (o.delivery === "courier" && o.address.trim().length < 3) { const a = $("#addr", el); a.classList.remove("err"); void a.offsetWidth; a.classList.add("err"); a.focus(); toast("⚠️ Yetkazib berish manzilini kiriting"); return; }
          const b = $("#place", el); b.disabled = true; b.textContent = "Yuborilmoqda…";
          try {
            const r = await api("POST", "/api/orders", {
              items: S.cart.map((x) => ({ id: x.id, qty: x.qty })), delivery: o.delivery, region: o.region, address: o.address, note: o.note,
              payment: o.payment, months: o.payment === "uzum" ? o.months : null, promo: S.promo,
            });
            S.cart = []; saveCart(); S.promo = null; store.set("app_promo", null); S.orders = null;
            if (auth.user && o.delivery === "courier") { auth.user.region = o.region; auth.user.address = o.address; store.set("user", auth.user); }
            loadCatalog().catch(() => {});
            haptic(25);
            if (r.confirm) openConfirm(r.order, r.confirm, true);
            else openDone(r.order);
          } catch (ex) { toast("⚠️ " + ex.message); b.disabled = false; b.textContent = "Buyurtma berish"; }
        }
      });
      draw();
    },
  });
}

// ---------- Telegram kodi bilan tasdiqlash ----------
function openConfirm(order, confirm, fresh) {
  push({
    noTab: true,
    html: hdr("Tasdiqlash") + `<div class="sb"><div class="sec" style="display:flex;flex-direction:column;gap:14px" id="cf"></div></div>`,
    mount(el) {
      const started = Date.now();
      el._poll = setInterval(() => { if (Date.now() - started < 15 * 60e3 && !document.hidden) api("POST", "/api/tg/poll").catch(() => {}); }, 3000);
      const draw = (c) => {
        $("#cf", el).innerHTML = `<div class="tg-hero"><i>${svg(IC.tg)}</i><h2 style="font-size:20px">${c.linked ? "Kod Telegram'ga yuborildi" : "Telegram orqali tasdiqlang"}</h2>
            <p class="muted">Buyurtma <b>#${esc(order.id)}</b> · ${fmt(order.total)}</p></div>
          ${c.linked ? `<p class="muted" style="text-align:center">@${esc(c.bot || BOT)} botiga kelgan 6 xonali kodni kiriting</p>` : `<div class="box"><ol class="steps"><li><b>Telegram'da ochish</b> tugmasini bosing va <b>START</b> ni bosing</li><li>"📱 Raqamimni yuborish" tugmasini bosing</li><li>Bot yuborgan kodni shu yerga kiriting</li></ol>
            <a class="btn tg block" href="${esc(c.link)}" target="_blank" rel="noopener">${svg(IC.tg)} Telegram'da ochish</a></div>`}
          <label class="code" id="code"><input inputmode="numeric" autocomplete="one-time-code" maxlength="6" id="ci" aria-label="Tasdiqlash kodi" />${"<span></span>".repeat(6)}</label>
          <p class="err-t" id="cerr" hidden></p>
          <button class="btn block" id="cok">Tasdiqlash</button>
          <button class="btn ghost block" id="cre">↻ Kodni qayta yuborish</button>
          <small class="muted" style="text-align:center">Buyurtma 2 soat ichida tasdiqlanmasa, avtomatik bekor qilinadi.</small>`;
        const ci = $("#ci", el), boxes = $$("#code span", el);
        const paint = () => { const v = ci.value; boxes.forEach((b, i) => { b.textContent = v[i] || ""; b.classList.toggle("full", !!v[i]); b.classList.toggle("cur", i === Math.min(v.length, 5) && document.activeElement === ci); }); };
        ci.addEventListener("input", () => { ci.value = ci.value.replace(/\D/g, "").slice(0, 6); paint(); haptic(4); if (ci.value.length === 6) submit(); });
        ci.addEventListener("focus", paint); ci.addEventListener("blur", paint);
        const submit = async () => {
          const err = $("#cerr", el), b = $("#cok", el);
          if (ci.value.length !== 6) { err.textContent = "6 xonali kodni kiriting"; err.hidden = false; return; }
          b.disabled = true; err.hidden = true;
          try {
            const r = await api("POST", `/api/orders/${encodeURIComponent(order.id)}/confirm`, { code: ci.value });
            clearInterval(el._poll); openDone(r.order, true);
          } catch (ex) {
            err.textContent = ex.message; err.hidden = false; b.disabled = false; haptic(40);
            const c = $("#code", el); c.classList.remove("bad"); void c.offsetWidth; c.classList.add("bad");
            ci.value = ""; paint(); ci.focus();
          }
        };
        $("#cok", el).onclick = submit;
        $("#cre", el).onclick = async (e) => {
          const b = e.currentTarget; b.disabled = true;
          try {
            const r = await api("POST", `/api/orders/${encodeURIComponent(order.id)}/code`);
            if (r.confirmed) return openDone({ ...order, confirmed: 1 }, true);
            toast(r.linked ? "📨 Yangi kod Telegram'ga yuborildi" : "Avval Telegram'da botni oching");
            draw(r);
          } catch (ex) { toast("⚠️ " + ex.message); b.disabled = false; }
        };
        if (c.linked) setTimeout(() => ci.focus(), 400);
        paint();
      };
      draw(confirm);
    },
    unmount(el) { clearInterval(el._poll); },
  });
}
function openDone(order, confirmed) {
  // Rasmiylashtirish ekranlarini stekdan olib tashlaymiz — "Orqaga" savatga qaytarmasin
  const s = stacks[tab];
  while (s.length > 1) { const x = s.pop(); x._def.unmount && x._def.unmount(x); x.remove(); }
  current().setAttribute("inert", "");
  push({
    noTab: true,
    html: `<div class="sb"><div class="done"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="23"/><path d="M15 27l7.5 7.5L37.5 19"/></svg>
      <h2>${confirmed ? "Buyurtma tasdiqlandi!" : "Buyurtma qabul qilindi!"}</h2><p class="muted">Buyurtma raqami <b>#${esc(order.id)}</b><br>${confirmed ? "Chek Telegram'ga yuborildi. " : ""}Operatorimiz tez orada bog'lanadi.</p>
      <div class="box" style="width:100%;text-align:left"><div class="sum"><div><span>Summa</span><b>${fmt(order.total)}</b></div><div><span>To'lov</span><span>${esc((PAYMENTS.find((p) => p.id === order.payment) || {}).name || order.payment)}</span></div><div><span>Yetkazish</span><span>${order.delivery === "pickup" ? "Do'kondan" : esc(order.region || "Kuryer")}</span></div></div></div>
      <button class="btn block" id="dOrders">Buyurtmalarim</button><button class="btn ghost block" id="dHome">Xaridni davom ettirish</button></div></div>`,
    mount(el) {
      haptic([20, 60, 30]);
      $("#dOrders", el).onclick = () => { switchTab("profile", true); setTimeout(openOrders, 50); while (stacks.cart.length > 1) { const x = stacks.cart.pop(); x.remove(); } refreshRoot("cart"); };
      $("#dHome", el).onclick = () => { while (stacks[tab].length > 1) { const x = stacks[tab].pop(); x.remove(); } current().removeAttribute("inert"); refreshRoot(tab); switchTab("home"); };
    },
  });
}

// =====================================================================
// ---------- Saralangan ----------
// =====================================================================
function favScreen() {
  const L = S.fav.map(byId).filter(Boolean);
  return {
    html: `<div class="home-hdr"><h1 style="font-size:22px">Saralangan <small class="muted" style="font-size:14px;font-weight:500">${L.length ? L.length + " ta" : ""}</small></h1></div>
      <div class="sb pad-bar">${L.length ? `<div class="sec">${grid(L)}</div>` : emptyBox("❤️", "Hali hech narsa yo'q", "Mahsulotdagi ♥ belgisini bosing — yoqqanlaringiz shu yerda saqlanadi", `<button class="btn" data-gohome>Mahsulotlarni ko'rish</button>`)}</div>`,
    mount(el) { const g = $("[data-gohome]", el); if (g) g.onclick = () => switchTab("home"); },
  };
}

// =====================================================================
// ---------- Kabinet ----------
// =====================================================================
const initials = (n) => String(n || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const fmtPhone = (p) => { const d = String(p || "").replace(/\D/g, "").replace(/^998/, ""); return d ? "+998 " + [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].join(" ") : ""; };
function profileScreen() {
  const u = auth.user;
  const theme = store.get("app_theme", "system");
  const TH = { system: "Telefon sozlamasi", dark: "Tungi", light: "Kunduzgi" };
  const common = `<div class="menu">
      <button class="mi" data-m="theme"><span class="ri">🌓</span><span>Mavzu</span><small>${TH[theme]}</small></button>
      <a class="mi" href="https://t.me/${BOT}" target="_blank" rel="noopener"><span class="ri">✈️</span><span>Telegram bot</span><small>@${BOT}</small></a>
      <a class="mi" href="tel:${SHOP_PHONE}"><span class="ri">📞</span><span>Qo'llab-quvvatlash</span><small>${fmtPhone(SHOP_PHONE.slice(1))}</small></a>
      <button class="mi" data-m="about"><span class="ri">ℹ️</span><span>Ilova haqida</span><small>v${esc(VERSION)}</small></button>
    </div>`;
  if (!u) return {
    html: `<div class="home-hdr"><h1 style="font-size:22px">Kabinet</h1></div><div class="sb pad-bar">
      <div class="prof"><div class="ava">👤</div><div><b>Xush kelibsiz!</b><small>Buyurtma berish va kuzatish uchun kiring</small></div></div>
      <div style="padding:0 14px"><button class="btn block" data-login>Kirish yoki ro'yxatdan o'tish</button></div>${common}<p class="ver">OPUS MARKET · v${esc(VERSION)}</p></div>`,
    mount(el) { $("[data-login]", el).onclick = () => openAuth(); bindMenu(el); },
  };
  const O = S.orders || [];
  const active = O.filter((o) => !["Yetkazildi", "Bekor qilindi"].includes(o.status)).length;
  return {
    html: `<div class="home-hdr"><h1 style="font-size:22px">Kabinet</h1></div><div class="sb pad-bar">
      <div class="prof"><div class="ava">${esc(initials(u.name))}</div><div><b>${esc(u.name)}</b><small>${esc(fmtPhone(u.phone))}</small></div></div>
      <div class="stats"><button data-m="orders"><b>${S.orders ? O.length : "…"}</b><small>Buyurtmalar</small></button><button data-m="active"><b>${S.orders ? active : "…"}</b><small>Faol</small></button><button data-gofav><b>${S.fav.length}</b><small>Saralangan</small></button></div>
      <div class="menu">
        <button class="mi" data-m="orders"><span class="ri">📦</span><span>Buyurtmalarim</span></button>
        <button class="mi" data-m="edit"><span class="ri">👤</span><span>Shaxsiy ma'lumotlar</span></button>
        <button class="mi" data-m="pass"><span class="ri">🔒</span><span>Parolni o'zgartirish</span></button>
      </div>${common}
      <div class="menu"><button class="mi danger noarrow" data-m="logout"><span class="ri">🚪</span><span>Chiqish</span></button></div>
      <p class="ver">OPUS MARKET · v${esc(VERSION)}</p></div>`,
    mount(el) {
      bindMenu(el);
      $("[data-gofav]", el).onclick = () => switchTab("fav");
      if (!S.orders) loadOrders().then(() => { if (tab === "profile" && stacks.profile.length === 1) refreshRoot("profile"); }).catch(() => {});
    },
  };
}
async function loadOrders() { const r = await api("GET", "/api/orders"); S.orders = r.orders; return S.orders; }
function bindMenu(el) {
  el.addEventListener("click", (e) => {
    const m = e.target.closest("[data-m]"); if (!m) return;
    const k = m.dataset.m;
    if (k === "orders") openOrders();
    if (k === "active") openOrders("active");
    if (k === "edit") openEditProfile();
    if (k === "pass") openPassword();
    if (k === "theme") {
      const cur = store.get("app_theme", "system");
      openSheet(`<h3>🌓 Mavzu</h3>${[["system", "Telefon sozlamasi"], ["dark", "🌙 Tungi"], ["light", "☀️ Kunduzgi"]].map(([v, t]) => `<button class="opt${cur === v ? " on" : ""}" data-t="${v}">${t}</button>`).join("")}`, (b) =>
        b.addEventListener("click", (ev) => { const t = ev.target.closest("[data-t]"); if (t) { store.set("app_theme", t.dataset.t); applyTheme(); closeSheet(); refreshRoot("profile"); } }));
    }
    if (k === "about") openSheet(`<div class="tg-hero"><i style="background:var(--grad);box-shadow:0 12px 30px rgba(var(--prgb),.4)"><img src="../icons/icon-192.png" alt="" style="width:76px;border-radius:24px" /></i><h2 style="font-size:20px">OPUS MARKET</h2><p class="muted">Versiya ${esc(VERSION)}<br>Kompyuterlar va aksessuarlar do'koni</p></div><button class="btn block" id="ab">Yopish</button>`, (b) => ($("#ab", b).onclick = closeSheet));
    if (k === "logout") openSheet(`<h3>Akkauntdan chiqasizmi?</h3><p class="muted" style="margin-bottom:14px">Savat va saralanganlar saqlanib qoladi.</p><div style="display:flex;gap:10px"><button class="btn ghost flex" id="no">Yo'q</button><button class="btn flex" id="yes">Chiqish</button></div>`, (b) => {
      $("#no", b).onclick = closeSheet;
      $("#yes", b).onclick = async () => { closeSheet(); api("POST", "/api/auth/logout").catch(() => {}); setAuth(null); refreshRoot("profile"); refreshRoot("home"); toast("👋 Akkauntdan chiqdingiz"); };
    });
  });
}
function applyTheme() {
  let t = store.get("app_theme", "system");
  if (t === "system") t = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  document.documentElement.dataset.theme = t;
  $('meta[name="theme-color"]').content = t === "light" ? "#ffffff" : "#0c0708";
  try { window.OPUSApp && OPUSApp.theme && OPUSApp.theme(t); } catch {} // Android: status paneli rangi
}

// ---------- Kirish / ro'yxatdan o'tish ----------
function requireAuth(next, msg) {
  if (auth.user) return next();
  toast(msg || "Avval akkauntingizga kiring");
  openAuth(next);
}
function openAuth(next) {
  let mode = "login";
  push({
    noTab: true,
    html: hdr("Akkaunt") + `<div class="sb"><div class="sec" style="display:flex;flex-direction:column;gap:14px">
      <div class="tg-hero"><i style="background:var(--grad);box-shadow:0 12px 30px rgba(var(--prgb),.4)">${svg("M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-4.4 0-9 2.2-9 5.5V22h18v-2.5c0-3.3-4.6-5.5-9-5.5z")}</i><h2 style="font-size:21px" id="aT">Xush kelibsiz!</h2></div>
      <div class="seg"><button data-mode="login" class="on">Kirish</button><button data-mode="reg">Ro'yxatdan o'tish</button></div>
      <form id="af" style="display:flex;flex-direction:column;gap:12px" novalidate></form></div></div>`,
    mount(el) {
      const f = $("#af", el);
      const draw = () => {
        $$("[data-mode]", el).forEach((b) => b.classList.toggle("on", b.dataset.mode === mode));
        $("#aT", el).textContent = mode === "login" ? "Xush kelibsiz!" : "Yangi akkaunt";
        f.innerHTML = (mode === "reg" ? `<div class="field"><span class="lbl">Ismingiz</span><input class="inp" name="name" autocomplete="name" placeholder="Ism Familiya" /></div>` : "") +
          `<div class="field"><span class="lbl">Telefon raqami</span><div class="phone"><span>+998</span><input class="inp" name="phone" inputmode="tel" autocomplete="tel-national" placeholder="90 123 45 67" maxlength="12" /></div></div>
          <div class="field"><span class="lbl">Parol</span><input class="inp" name="password" type="password" autocomplete="${mode === "login" ? "current-password" : "new-password"}" placeholder="${mode === "login" ? "Parolingiz" : "Kamida 6 belgi"}" /></div>
          <p class="err-t" id="aerr" hidden></p>
          <button class="btn block">${mode === "login" ? "Kirish" : "Ro'yxatdan o'tish"}</button>`;
        const ph = f.elements.phone;
        ph.addEventListener("input", () => { const d = ph.value.replace(/\D/g, "").replace(/^998/, "").slice(0, 9); ph.value = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(" "); });
      };
      el.addEventListener("click", (e) => { const m = e.target.closest("[data-mode]"); if (m) { mode = m.dataset.mode; haptic(5); draw(); } });
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        const err = $("#aerr", el), b = $("button.btn", f);
        const phone = "998" + f.elements.phone.value.replace(/\D/g, "");
        err.hidden = true; b.disabled = true;
        try {
          const r = mode === "login"
            ? await api("POST", "/api/auth/login", { login: phone, password: f.elements.password.value })
            : await api("POST", "/api/auth/register", { name: f.elements.name.value.trim(), phone, password: f.elements.password.value });
          setAuth(r.token, r.user); haptic(20);
          toast(mode === "login" ? `👋 Salom, ${r.user.name}!` : `🎉 Xush kelibsiz, ${r.user.name}!`);
          pop(); refreshRoot("profile"); refreshRoot("home");
          if (next) setTimeout(next, 320);
        } catch (ex) { err.textContent = ex.message; err.hidden = false; b.disabled = false; haptic(40); }
      });
      draw();
    },
  });
}
function openEditProfile() {
  const u = auth.user;
  push({
    noTab: true,
    html: hdr("Shaxsiy ma'lumotlar") + `<div class="sb"><form class="sec" id="pf" style="display:flex;flex-direction:column;gap:12px">
      <div class="field"><span class="lbl">Ism</span><input class="inp" name="name" value="${esc(u.name)}" /></div>
      <div class="field"><span class="lbl">Telefon</span><input class="inp" value="${esc(fmtPhone(u.phone))}" disabled /></div>
      <div class="field"><span class="lbl">Email (ixtiyoriy)</span><input class="inp" name="email" type="email" value="${esc(u.email || "")}" /></div>
      <div class="field"><span class="lbl">Viloyat</span><select class="inp" name="region">${REGIONS.map((r) => `<option ${r === (u.region || REGIONS[0]) ? "selected" : ""}>${r}</option>`).join("")}</select></div>
      <div class="field"><span class="lbl">Manzil</span><textarea class="inp" name="address" rows="2">${esc(u.address || "")}</textarea></div>
      <p class="err-t" id="perr" hidden></p><button class="btn block">Saqlash</button></form></div>`,
    mount(el) {
      $("#pf", el).addEventListener("submit", async (e) => {
        e.preventDefault();
        const f = e.target, b = $("button", f);
        b.disabled = true;
        try {
          const r = await api("PATCH", "/api/me", { name: f.elements.name.value.trim(), email: f.elements.email.value.trim() || null, region: f.elements.region.value, address: f.elements.address.value.trim() });
          setAuth(auth.token, r.user); toast("✅ Saqlandi"); pop(); refreshRoot("profile");
        } catch (ex) { $("#perr", el).textContent = ex.message; $("#perr", el).hidden = false; b.disabled = false; }
      });
    },
  });
}
function openPassword() {
  push({
    noTab: true,
    html: hdr("Parolni o'zgartirish") + `<div class="sb"><form class="sec" id="pw" style="display:flex;flex-direction:column;gap:12px">
      <div class="field"><span class="lbl">Joriy parol</span><input class="inp" name="old" type="password" autocomplete="current-password" /></div>
      <div class="field"><span class="lbl">Yangi parol</span><input class="inp" name="nw" type="password" autocomplete="new-password" placeholder="Kamida 6 belgi" /></div>
      <p class="err-t" id="pwerr" hidden></p><button class="btn block">O'zgartirish</button></form></div>`,
    mount(el) {
      $("#pw", el).addEventListener("submit", async (e) => {
        e.preventDefault();
        const f = e.target, b = $("button", f);
        b.disabled = true;
        try { await api("POST", "/api/me/password", { old: f.elements.old.value, new: f.elements.nw.value }); toast("🔒 Parol o'zgartirildi"); pop(); }
        catch (ex) { $("#pwerr", el).textContent = ex.message; $("#pwerr", el).hidden = false; b.disabled = false; }
      });
    },
  });
}

// ---------- Buyurtmalar ----------
const isPending = (o) => o.confirmed === 0 && o.status === "Yangi";
const pill = (o) => isPending(o) ? `<span class="st-pill wait">⏳ Kod kutilmoqda</span>` : `<span class="st-pill ${o.status === "Yetkazildi" ? "ok" : o.status === "Bekor qilindi" ? "bad" : ""}">${esc(o.status)}</span>`;
function openOrders(f0) {
  let f = f0 || "all";
  const F = { all: "Hammasi", active: "Faol", done: "Yetkazilgan", cancel: "Bekor qilingan" };
  push({
    html: hdr("Buyurtmalarim") + `<div class="chips">${Object.entries(F).map(([k, v]) => `<button class="chip" data-of="${k}">${v}</button>`).join("")}</div><div class="sb"><div class="ptr" id="ptr">${svg(IC.refresh)}</div><div class="sec" style="display:flex;flex-direction:column;gap:10px;padding-top:4px" id="ol"></div></div>`,
    mount(el) {
      const draw = () => {
        $$("[data-of]", el).forEach((c) => c.classList.toggle("on", c.dataset.of === f));
        if (!S.orders) { $("#ol", el).innerHTML = `<div class="skel" style="height:130px"></div><div class="skel" style="height:130px"></div>`; return; }
        const L = S.orders.filter((o) => f === "all" || (f === "active" && !["Yetkazildi", "Bekor qilindi"].includes(o.status)) || (f === "done" && o.status === "Yetkazildi") || (f === "cancel" && o.status === "Bekor qilindi"));
        $("#ol", el).innerHTML = L.length ? L.map((o) => `<button class="ord" data-oid="${esc(o.id)}"><header><div><b>#${esc(o.id)}</b><br><small>${new Date(o.created_at).toLocaleString("ru-RU").slice(0, 17)}</small></div>${pill(o)}</header>
          <div class="thumbs">${(o.items || []).slice(0, 4).map((i) => `<img src="${esc(pic((byId(i.id) || i).img))}" alt="" onerror="this.remove()" />`).join("")}${(o.items || []).length > 4 ? `<span>+${o.items.length - 4}</span>` : ""}</div>
          <footer><span class="muted">${(o.items || []).reduce((a, i) => a + i.qty, 0)} ta mahsulot</span><b>${fmt(o.total)}</b></footer></button>`).join("")
          : emptyBox("📦", "Buyurtma yo'q", f === "all" ? "Birinchi xaridingizni qiling — buyurtmalar shu yerda kuzatiladi" : "Bu bo'limda buyurtma yo'q");
      };
      el.addEventListener("click", (e) => {
        const c = e.target.closest("[data-of]"); if (c) { f = c.dataset.of; haptic(5); draw(); }
        const o = e.target.closest("[data-oid]"); if (o) openOrder(S.orders.find((x) => x.id === o.dataset.oid));
      });
      el._def.onShow = draw;
      draw();
      const reload = async () => { await loadOrders(); draw(); refreshRoot("profile"); };
      reload().catch((ex) => { $("#ol", el).innerHTML = emptyBox("📡", "Yuklab bo'lmadi", ex.message); });
      pullToRefresh($(".sb", el), $("#ptr", el), reload);
    },
  });
}
function openOrder(o) {
  if (!o) return;
  const cancelled = o.status === "Bekor qilindi", idx = STATUSES.indexOf(o.status);
  push({
    html: hdr("#" + o.id) + `<div class="sb"><div class="sec" style="display:flex;flex-direction:column;gap:12px">
      <div class="box"><div class="sec-h" style="margin:0"><h3>Holat</h3>${pill(o)}</div>
        ${cancelled ? `<p class="muted">Buyurtma bekor qilingan. Mahsulotlar omborga qaytarildi.</p>` : `<div class="tl">${STATUSES.map((s, i) => `<div class="${i < idx ? "done" : i === idx ? "done cur" : ""}">${s === "Yangi" && isPending(o) ? "Telegram kodi kutilmoqda" : s}</div>`).join("")}</div>`}
        ${isPending(o) ? `<button class="btn tg block" id="oConf">${svg(IC.tg)} Telegram kodi bilan tasdiqlash</button>` : ""}
      </div>
      <div class="box"><h3>Mahsulotlar</h3>${(o.items || []).map((i) => `<div class="row" data-pid="${i.id}"><img src="${esc(pic((byId(i.id) || i).img))}" alt="" style="width:52px;height:52px;border-radius:10px;background:#fff;object-fit:contain;padding:3px" onerror="this.remove()" /><div><span style="font-size:13.5px">${esc(i.name)}</span><small>${i.qty} × ${fmt(i.price)}</small></div></div>`).join("")}</div>
      <div class="box"><div class="sum">
        <div><span>Mahsulotlar</span><span>${fmt(o.subtotal)}</span></div>
        ${o.discount ? `<div class="disc"><span>Chegirma${o.promo ? " (" + esc(o.promo) + ")" : ""}</span><span>−${fmt(o.discount)}</span></div>` : ""}
        <div><span>Yetkazish</span><span>${o.ship ? fmt(o.ship) : "Bepul"}</span></div>
        <div class="tot"><span>Jami</span><span>${fmt(o.total)}</span></div></div></div>
      <div class="box">
        <div class="row"><span class="ri">${o.delivery === "pickup" ? "🏬" : "🚚"}</span><div><b>${o.delivery === "pickup" ? "Do'kondan olib ketish" : "Kuryer orqali"}</b><small>${esc([o.region, o.address].filter(Boolean).join(", ") || "Toshkent sh., Amir Temur ko'chasi")}</small></div></div>
        <div class="row"><span class="ri">💳</span><div><b>${esc((PAYMENTS.find((p) => p.id === o.payment) || {}).name || o.payment)}</b><small>${o.months ? `${o.months} oyga bo'lib · oyiga ${fmt(o.total / o.months)}` : "To'lov usuli"}</small></div></div>
        ${o.note ? `<div class="row"><span class="ri">💬</span><div><small>${esc(o.note)}</small></div></div>` : ""}
      </div>
      <a class="btn ghost block" href="tel:${SHOP_PHONE}">📞 Operator bilan bog'lanish</a>
      ${o.status === "Yangi" ? `<button class="btn ghost block" style="color:var(--red2)" id="oCancel">Buyurtmani bekor qilish</button>` : ""}
    </div></div>`,
    mount(el) {
      const c = $("#oConf", el);
      if (c) c.onclick = async () => {
        c.disabled = true;
        try {
          const r = await api("POST", `/api/orders/${encodeURIComponent(o.id)}/code`);
          if (r.confirmed) { toast("✅ Buyurtma allaqachon tasdiqlangan"); await loadOrders(); pop(); return; }
          openConfirm(o, r);
        } catch (ex) { toast("⚠️ " + ex.message); }
        c.disabled = false;
      };
      const x = $("#oCancel", el);
      if (x) x.onclick = () => openSheet(`<h3>Buyurtmani bekor qilasizmi?</h3><p class="muted" style="margin-bottom:14px">#${esc(o.id)} · ${fmt(o.total)}</p><div style="display:flex;gap:10px"><button class="btn ghost flex" id="no">Yo'q</button><button class="btn flex" id="yes">Ha, bekor qilish</button></div>`, (b) => {
        $("#no", b).onclick = closeSheet;
        $("#yes", b).onclick = async () => {
          closeSheet();
          try { await api("POST", `/api/orders/${encodeURIComponent(o.id)}/cancel`); toast("Buyurtma bekor qilindi"); await loadOrders(); pop(); loadCatalog().catch(() => {}); }
          catch (ex) { toast("⚠️ " + ex.message); }
        };
      });
    },
  });
}

// =====================================================================
// ---------- Ishga tushirish ----------
// =====================================================================
const ROOTS = { home: homeScreen, catalog: catalogScreen, cart: cartScreen, fav: favScreen, profile: profileScreen };
matchMedia("(prefers-color-scheme: light)").addEventListener("change", applyTheme);
applyTheme();
badges();
switchTab("home");
// Ilova boshqa joydan (sayt) o'zgargan savatni ko'rsin
addEventListener("storage", (e) => { if (e.key === "opus_cart") { S.cart = store.get("cart", []); badges(); refreshRoot("cart"); } });
// Yangi katalog: narx/ombor o'zgargan bo'lishi mumkin
loadCatalog().then(() => { refreshRoot("home"); refreshRoot("catalog"); badges(); }).catch(() => {});
if (auth.token) api("GET", "/api/me").then((r) => setAuth(auth.token, r.user)).catch(() => {});
document.addEventListener("visibilitychange", () => { if (!document.hidden && Date.now() - (window.__lastSync || 0) > 120e3) { window.__lastSync = Date.now(); loadCatalog().then(() => tab === "home" && stacks.home.length === 1 && refreshRoot("home")).catch(() => {}); } });
// Telefon brauzerida ham: tizimning "orqaga" ishorasi stekni yopsin
// (Android ilovasida "Orqaga" tugmasini MainActivity o'zi __opusBack orqali boshqaradi)
if (VERSION === "web") {
  history.pushState({ app: 1 }, "");
  addEventListener("popstate", () => { if (window.__opusBack()) history.pushState({ app: 1 }, ""); });
}
