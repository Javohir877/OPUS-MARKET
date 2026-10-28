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
const haptic = (ms = 8) => { try { if (window.SFX && !SFX.haptic) return; if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return; navigator.vibrate && navigator.vibrate(ms); } catch {} };
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
  // Android vidjeti uchun: sessiya tokenini ilovaga uzatamiz
  try { window.OPUSApp && OPUSApp.session && OPUSApp.session(auth.token || ""); } catch (e) {}
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
  if (d && d.PRODUCTS && d.PRODUCTS.length) { S.settings = d.SETTINGS || S.settings; S.cats = d.CATEGORIES || S.cats; S.products = d.PRODUCTS; S.news = d.NEWS || S.news; }
  applyRv();
}
// Reyting va sharhlar soni — serverdagi haqiqiy sharhlardan (katalogdagi qo'lda yozilgan sonlar ishlatilmaydi)
function applyRv() {
  const rv = store.get("app_rv", {});
  S.products.forEach((p) => { const s = rv[p.id]; p.reviews = s ? s[0] : 0; p.rating = s ? s[1] : 0; });
}
async function loadRv() {
  const r = await api("GET", "/api/reviews/summary");
  store.set("app_rv", r.s || {}); applyRv();
}
const rateTxt = (p) => p.reviews ? `<b>★</b> ${p.rating} <span>(${p.reviews} sharh)</span>` : `<span>☆ Hali baho yo'q</span>`;
applyCatalog(store.get("app_catalog", null));
async function loadCatalog() {
  const d = await api("GET", "/api/catalog");
  if (d.PRODUCTS && d.PRODUCTS.length) { applyCatalog(d); store.set("app_catalog", d); if (window.checkDrops) checkDrops(); }
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
  haptic(6); window.sfx && sfx("nav");
  const prev = current();
  const el = make(def);
  stacks[tab].push(el);
  stage.appendChild(el);
  const anim = def.anim || "enter";
  el.classList.add(anim);
  if (prev) { prev.classList.add("under"); setTimeout(() => { prev.classList.remove("under"); prev.setAttribute("inert", ""); }, 320); }
  setTimeout(() => el.classList.remove(anim), 360);
  mount(el); syncTabbar();
  return el;
}
function pop() {
  const s = stacks[tab];
  if (s.length < 2) return false;
  haptic(5); window.sfx && sfx("back");
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
  haptic(6); if (tab && window.sfx) sfx("tab");
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
function toast(msg, act) {
  if (/^(⚠️|⛔)/.test(msg) && window.sfx) sfx("error");
  const el = document.createElement("div");
  el.className = "toast" + (act ? " act" : "");
  el.innerHTML = `<span></span>${act ? `<button>${esc(act.t)}</button>` : ""}`;
  el.firstChild.textContent = msg;
  if (act) $("button", el).onclick = () => { el.remove(); act.fn(); };
  $("#toasts").appendChild(el);
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 260); }, act ? 4000 : 2400);
}
function openSheet(html, onMount) {
  haptic(6);
  // Har safar toza element: oldingi oynalarning tinglovchilari qolib ketmasin
  const ob = $("#sheetBody"), nb = ob.cloneNode(false); ob.replaceWith(nb);
  nb.innerHTML = html;
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
function card(p, o) {
  const d = disc(p), q = inCart(p.id), out = (p.stock || 0) <= 0, drop = S.drops && S.drops[p.id] > p.price;
  return `<article class="pc${out ? " out" : ""}" data-pid="${p.id}">
    <div class="pc-img">${fallbackIcon(p)}<img src="${esc(hi(p.img, 330))}" alt="" loading="lazy" onload="this.classList.add('ld')" onerror="imgErr(this)" />
      <button class="fav${S.fav.includes(p.id) ? " on" : ""}" data-fav="${p.id}" aria-label="Saralanganga">${heartSvg}</button>
      <div class="tags">${d ? `<span class="tag">−${d}%</span>` : ""}${drop ? `<span class="tag drop">📉 Arzonladi</span>` : ""}${p.badge === "Yangi" ? `<span class="tag new">Yangi</span>` : p.badge === "Xit" ? `<span class="tag hit">Xit</span>` : ""}</div>
    </div>
    <div class="pc-b">
      <span class="pc-m">${num(p.price / 12)} so'm/oy</span>
      <p class="pc-n">${esc(p.name)}</p>
      <span class="pc-r">${rateTxt(p)}</span>
      ${o && o.deal && !out ? `<span class="dealbar"><i style="--w:${Math.min(100, Math.max(10, (p.stock || 0) * 7))}%"></i><small>${p.stock <= 5 ? `🔥 Faqat ${p.stock} dona qoldi` : `Omborda ${p.stock} dona`}</small></span>` : ""}
      <div class="pc-p"><div>${d ? `<s>${num(p.old)}</s>` : ""}<b class="${d ? "sale" : ""}">${num(p.price)} <small>so'm</small></b></div>
        <button class="add${q ? " in" : ""}" data-add="${p.id}" ${out ? "disabled" : ""} aria-label="Savatga">${svg(q ? IC.check : IC.cart)}</button></div>
    </div>
  </article>`;
}
const grid = (list) => `<div class="grid">${list.map((p) => card(p)).join("")}</div>`;
function refreshCards() {
  $$(".pc, .rc").forEach((c) => {
    const id = +c.dataset.pid, q = inCart(id), b = $("[data-add]", c), f = $("[data-fav]", c);
    if (b) { b.classList.toggle("in", !!q); b.innerHTML = svg(q ? IC.check : IC.cart); }
    if (f) f.classList.toggle("on", S.fav.includes(id));
  });
}

// ---------- Savat va saralangan ----------
function saveCart() { store.set("cart", S.cart); badges(); }
function addToCart(id, qty = 1, silent) {
  const p = byId(id);
  if (!p || (p.stock || 0) <= 0) { toast("⛔ Bu mahsulot tugagan"); return false; }
  const it = S.cart.find((x) => x.id === p.id);
  const next = Math.min((it ? it.qty : 0) + qty, p.stock);
  if (it && it.qty >= p.stock) { toast(`⚠️ Omborda faqat ${p.stock} dona bor`); return false; }
  if (it) it.qty = next; else S.cart.push({ id: p.id, qty: next });
  saveCart(); haptic(15); window.sfx && sfx("add");
  if (!silent) toast("🛒 Savatga qo'shildi", { t: "Savatga", fn: () => switchTab("cart") });
  return true;
}
function setQty(id, qty) {
  const p = byId(id), it = S.cart.find((x) => x.id === +id);
  if (!it) return;
  if (qty <= 0) S.cart = S.cart.filter((x) => x.id !== +id);
  else it.qty = Math.min(qty, p ? p.stock : qty);
  saveCart(); haptic(6); if (window.sfx) sfx(qty <= 0 ? "remove" : "tick");
}
function toggleFav(id, btn) {
  id = +id;
  const on = !S.fav.includes(id);
  S.fav = on ? [id, ...S.fav] : S.fav.filter((x) => x !== id);
  store.set("fav", S.fav); badges(); haptic(on ? 18 : 6); if (window.sfx) sfx(on ? "checkOn" : "checkOff");
  { const fp = store.get("app_fav_prices", {}), pp = byId(id); if (on && pp) fp[id] = pp.price; else delete fp[id]; store.set("app_fav_prices", fp); }
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
    const card0 = a.closest(".pc, .rc");
    if (addToCart(a.dataset.add)) flyToCart(card0 && $("img", card0));
    refreshCards(); return;
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
  const top10 = P.slice().sort((a, b) => (b.popular || 0) * (b.rating || 4) - (a.popular || 0) * (a.rating || 4)).slice(0, 10);
  const forYou = recommend(12);
  const top = deals[0] || P[0];
  const pinned = S.news.find((n) => n.pinned) || S.news[0];
  const banners = [
    top && { cls: "red", small: "Aksiya", b: S.settings.dealTitle || "Katta chegirmalar", span: "Eng zo'r takliflar bir joyda", img: top.img, act: "deals" },
    { cls: "violet", small: "Uzum Nasiya", b: "0% bo'lib to'lash", span: "3, 6, 12 yoki 24 oyga — ortiqcha to'lovsiz", img: (P[1] || top || {}).img, act: "nasiya" },
    { cls: "green", small: "Yetkazib berish", b: "Bepul yetkazamiz", span: `${num(S.settings.freeShipFrom || 1000000)} so'mdan yuqori xaridlarda`, img: (P[2] || top || {}).img, act: "ship" },
    pinned && { cls: "dark", small: pinned.tag || "Yangilik", b: pinned.title, span: pinned.excerpt || "", img: newsCover(pinned), act: "news:" + pinned.id },
  ].filter(Boolean);
  const name = auth.user ? auth.user.name.split(" ")[0] : "";
  const upd = updateInfo();
  const unread = notifs().filter((n) => !n.read).length;
  return {
    html: `<div class="home-hdr" id="hh">
        <div class="home-top"><span class="brand"><i></i>OPUS<b>MARKET</b></span>
          <div class="hh-r"><span class="home-loc">📍 ${esc((auth.user && auth.user.region) || "Toshkent")}</span><button class="ib bell" data-notifs aria-label="Bildirishnomalar">${svg(IC.bell)}${unread ? `<i class="bell-n">${unread > 9 ? "9+" : unread}</i>` : ""}</button></div></div>
        <button class="searchbar" data-search>${svg(IC.search)}<span id="phTxt">Mahsulot va brendlarni qidirish</span></button>
      </div>
      <div class="sb pad-bar" id="homeSb">
        <div class="ptr" id="ptr">${svg(IC.refresh)}</div>
        ${upd ? `<button class="upd" data-upd>🚀 <span><b>Yangi versiya ${esc(upd.version)}</b><small>Ilovani yangilash uchun bosing</small></span><i>›</i></button>` : ""}
        <div class="stories" id="stories">${storiesData().map((st, i) => `<button class="story-b${seenStory(st.id) ? " seen" : ""}" data-story="${i}"><span class="ring"><img src="${esc(hi(st.cover, 330))}" alt="" onerror="imgErr(this)" />${st.emoji ? `<em>${st.emoji}</em>` : ""}</span><small>${esc(st.name)}</small></button>`).join("")}</div>
        ${name ? `<div class="sec hello"><h2>Salom, ${esc(name)} 👋</h2><small class="muted">${hello()}</small></div>` : ""}
        <div class="banners" id="banners">${banners.map((b) => `<button class="bn ${b.cls}" data-bn="${b.act}"><img src="${esc(hi(b.img, 500))}" alt="" onerror="imgErr(this)" /><small>${esc(b.small)}</small><b>${esc(b.b)}</b><span>${esc(b.span)}</span></button>`).join("")}</div>
        <div class="dots" id="bnDots">${banners.map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</div>
        <div class="sec"><div class="cats">${S.cats.map((c) => `<button class="cat" data-cat="${esc(c.id)}"><span class="ci"><img src="${esc(hi(c.img, 330))}" alt="" loading="lazy" onerror="imgErr(this)" /></span>${esc(c.name)}</button>`).join("")}</div></div>
        ${toolsRow()}
        ${deals.length ? `<div class="sec"><div class="sec-h"><h2>⚡ Kun takliflari <span class="timer" id="dealTimer"></span></h2><button data-open="deals">Barchasi</button></div><div class="hscroll">${deals.map((p) => card(p, { deal: true })).join("")}</div></div>` : ""}
        ${brandsRow()}${top10.length ? `<div class="sec"><div class="sec-h"><h2>🏆 TOP-10</h2><small class="muted">eng ko'p tanlanganlar</small></div><div class="hscroll t10s">${top10.map((p, i) => `<button class="t10" data-pid="${p.id}"><b class="t10-n">${i + 1}</b><span class="t10-i"><img src="${esc(hi(p.img, 330))}" alt="" loading="lazy" onerror="imgErr(this)" /></span><span class="t10-t">${esc(p.name)}</span><small>${fmt(p.price)}</small></button>`).join("")}</div></div>` : ""}
        ${lowRow()}${forYou.length ? `<div class="sec"><div class="sec-h"><h2>✨ Sizga yoqishi mumkin</h2></div><div class="hscroll">${forYou.map((p) => card(p)).join("")}</div></div>` : ""}
        ${fresh.length ? `<div class="sec"><div class="sec-h"><h2>🆕 Yangi kelganlar</h2></div><div class="hscroll">${fresh.map((p) => card(p)).join("")}</div></div>` : ""}
        ${recent.length ? `<div class="sec"><div class="sec-h"><h2>👀 Siz ko'rganlar</h2><button data-recent>Barchasi</button></div><div class="hscroll">${recent.map((p) => card(p)).join("")}</div></div>` : ""}
        ${S.news.length ? `<div class="sec"><div class="sec-h"><h2>📰 Yangiliklar</h2><button data-allnews>Barchasi</button></div><div class="hscroll reels">${S.news.slice(0, 8).map((n, i) => reel(n, i)).join("")}</div></div>` : ""}
        <div class="sec"><div class="sec-h"><h2>🔥 Siz uchun</h2></div><div id="feed">${grid(popular.slice(0, 20))}</div><div class="more" id="feedMore">${popular.length > 20 ? "Yuklanmoqda…" : "Hammasi ko'rsatildi ✨"}</div></div>
      </div>`,
    mount(el) {
      const sb = $("#homeSb", el), hh = $("#hh", el);
      $("[data-search]", el).onclick = () => openSearch();
      $("[data-notifs]", el).onclick = () => openNotifs();
      const an = $("[data-allnews]", el); if (an) an.onclick = () => openNewsFeed();
      const r = $("[data-recent]", el); if (r) r.onclick = () => openList({ title: "👀 Siz ko'rganlar", ids: S.recent.slice(), keepOrder: true });
      const u = $("[data-upd]", el); if (u) u.onclick = () => { location.href = upd.url; };
      $$("[data-open]", el).forEach((b) => (b.onclick = () => openList({ title: "⚡ Kun takliflari", deals: true })));
      $("#stories", el).addEventListener("click", (e) => { const b = e.target.closest("[data-story]"); if (b) openStories(+b.dataset.story); });
      // Sarlavha aylantirganda ixchamlashadi (faqat qidiruv qoladi)
      sb.addEventListener("scroll", () => hh.classList.toggle("mini", sb.scrollTop > 40), { passive: true });
      // Qidiruv qatoridagi matn almashib turadi
      const ph = ["Mahsulot va brendlarni qidirish", "Masalan: RTX 4070", "Masalan: MacBook", "Masalan: o'yin sichqonchasi", "Masalan: 27\" monitor"];
      let pi = 0;
      el._ph = setInterval(() => { const t = $("#phTxt", el); if (!t) return; pi = (pi + 1) % ph.length; t.classList.remove("swap"); void t.offsetWidth; t.classList.add("swap"); t.textContent = ph[pi]; }, 3500);
      // Bannerlar: avtomatik aylanish va nuqtalar
      const bn = $("#banners", el), dots = $$("#bnDots i", el);
      let idx = 0;
      bn.addEventListener("scroll", () => { idx = Math.round(bn.scrollLeft / bn.clientWidth); dots.forEach((d, i) => d.classList.toggle("on", i === idx)); }, { passive: true });
      el._bnTimer = setInterval(() => { if (!document.hidden && !el.hasAttribute("inert") && bn.firstElementChild) bn.scrollTo({ left: ((idx + 1) % dots.length) * (bn.firstElementChild.offsetWidth + 10), behavior: "smooth" }); }, 4500);
      bn.addEventListener("click", (e) => {
        const b = e.target.closest("[data-bn]"); if (!b) return;
        const a = b.dataset.bn;
        if (a === "deals") openList({ title: "⚡ Kun takliflari", deals: true });
        else if (a === "nasiya") infoSheet("💜 Uzum Nasiya — 0%", "Istalgan mahsulotni 3, 6, 12 yoki 24 oyga ortiqcha foizsiz bo'lib to'lab oling. Rasmiylashtirishda \"Uzum Nasiya\" to'lov usulini tanlang.");
        else if (a === "ship") infoSheet("🚚 Yetkazib berish", `Toshkent bo'ylab 24 soat ichida, viloyatlarga 2–4 ish kunida. ${num(S.settings.freeShipFrom || 1000000)} so'mdan yuqori xaridlarda — bepul, aks holda ${fmt(S.settings.shipPrice || 50000)}. Do'kondan o'zingiz olib ketishingiz ham mumkin.`);
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
        $("#feed .grid", el).insertAdjacentHTML("beforeend", next.map((p) => card(p)).join(""));
        if (shown >= popular.length) more.textContent = "Hammasi ko'rsatildi ✨";
      }, { root: sb, rootMargin: "400px" });
      io.observe(more); el._io = io;
      pullToRefresh(sb, $("#ptr", el), async () => { await loadCatalog(); await syncOrders().catch(() => {}); refreshRoot("home"); toast("↻ Yangilandi"); });
    },
    unmount(el) { clearInterval(el._timer); clearInterval(el._bnTimer); clearInterval(el._ph); el._io && el._io.disconnect(); },
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
        <div class="sec"><div class="ctiles">${S.cats.map((c) => `<button class="ctile" data-cat="${esc(c.id)}"><img src="${esc(hi(c.img, 330))}" alt="" loading="lazy" onerror="imgErr(this)" /><b>${esc(c.name)}</b><small>${count(c.id)} ta mahsulot</small></button>`).join("")}</div></div>
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
  const base = S.products.filter((p) => (!o.cat || p.cat === o.cat) && (!o.filter || o.filter(p)) && (!o.ids || o.ids.includes(p.id)));
  if (o.keepOrder && o.ids) base.sort((a, b) => o.ids.indexOf(a.id) - o.ids.indexOf(b.id));
  const allBrands = o.brand ? [] : [...new Set(base.map((p) => p.brand))].sort();
  const st = { sort: o.sort || (o.deals ? "disc" : o.keepOrder ? "keep" : "popular"), sale: !!o.deals, stock: false, orig: false, rating: 0, min: null, max: null, brands: new Set(), view: store.get("app_view", "grid") };
  const PR = [["1 mln gacha", 0, 1e6], ["1–5 mln", 1e6, 5e6], ["5–15 mln", 5e6, 15e6], ["15 mln+", 15e6, null]];
  const apply = (s) => base.filter((p) => (!s.sale || disc(p)) && (!s.stock || (p.stock || 0) > 0) && (!s.orig || p.original !== false) &&
    (!s.rating || (p.rating || 0) >= s.rating) && (s.min == null || p.price >= s.min) && (s.max == null || p.price <= s.max) && (!s.brands.size || s.brands.has(p.brand)));
  const nFilters = (s) => (s.min != null || s.max != null ? 1 : 0) + s.brands.size + (s.rating ? 1 : 0) + (s.stock ? 1 : 0) + (s.orig ? 1 : 0) + (s.sale ? 1 : 0);
  push({
    html: hdr(o.title, `<button class="ib" data-view aria-label="Ko'rinish">${svg(IC.view)}</button>`) +
      `<div class="chips"><button class="chip filt" data-filter>${svg(IC.filter)}Filtr<i id="fn"></i></button><button class="chip" data-sortbtn><span id="sortName"></span> ▾</button><button class="chip" data-f="sale">🏷 Chegirma</button><button class="chip" data-f="stock">✓ Omborda bor</button><button class="chip" data-r="4.5">⭐ 4.5+</button><button class="chip" data-f="orig">🛡 Original</button></div>
      <div class="sb"><p class="list-meta" id="meta"></p><div class="sec" style="padding-top:0" id="lst"></div></div>`,
    mount(el) {
      const draw = () => {
        const L = st.sort === "keep" ? apply(st) : sortList(apply(st), st.sort);
        $$("[data-f]", el).forEach((c) => c.classList.toggle("on", st[c.dataset.f]));
        $("[data-r]", el).classList.toggle("on", st.rating >= 4.5);
        const n = nFilters(st); $("#fn", el).textContent = n || ""; $("[data-filter]", el).classList.toggle("on", n > 0);
        $("#sortName", el).textContent = st.sort === "keep" ? "Ko'rilgan tartibda" : SORTS[st.sort];
        $("#meta", el).textContent = `${L.length} ta mahsulot`;
        $("[data-view]", el).innerHTML = svg(st.view === "grid" ? IC.view : IC.grid2);
        $("#lst", el).innerHTML = L.length ? (st.view === "list" ? `<div class="rows">${L.map(rowCard).join("")}</div>` : grid(L))
          : emptyBox("🔍", "Hech narsa topilmadi", "Filtrlarni o'zgartirib ko'ring", nFilters(st) ? `<button class="btn ghost" data-reset>Filtrlarni tozalash</button>` : "");
      };
      const filterSheet = () => {
        const t = { ...st, brands: new Set(st.brands) };
        openSheet(`<h3>Filtr</h3>
          <span class="lbl">Narx, so'm</span>
          <div class="range2"><input class="inp" id="fmin" inputmode="numeric" placeholder="dan" /><i>—</i><input class="inp" id="fmax" inputmode="numeric" placeholder="gacha" /></div>
          <div class="recent" style="margin-top:8px">${PR.map(([n2, a, b], i) => `<button data-pr="${i}">${n2}</button>`).join("")}</div>
          ${allBrands.length > 1 ? `<span class="lbl" style="display:block;margin-top:16px">Brend</span><div class="recent" style="margin-top:8px">${allBrands.map((b) => `<button data-fb="${esc(b)}">${esc(b)}</button>`).join("")}</div>` : ""}
          <span class="lbl" style="display:block;margin-top:16px">Reyting</span>
          <div class="seg" style="margin-top:8px"><button data-fr="0">Har qanday</button><button data-fr="4">4.0+</button><button data-fr="4.5">4.5+</button></div>
          <div class="tg-list" style="margin-top:14px">
            <button class="mi noarrow" data-ft="sale"><span class="ri">🏷</span><span>Faqat chegirmadagilar</span><span class="sw"></span></button>
            <button class="mi noarrow" data-ft="stock"><span class="ri">📦</span><span>Faqat omborda borlar</span><span class="sw"></span></button>
            <button class="mi noarrow" data-ft="orig"><span class="ri">🛡</span><span>Faqat original</span><span class="sw"></span></button>
          </div>
          <div class="sheet-foot"><button class="btn ghost" data-fx>Tozalash</button><button class="btn flex" data-fok>Ko'rsatish</button></div>`, (box) => {
          const numIn = (v) => { const n = +String(v).replace(/\D/g, ""); return n > 0 ? n : null; };
          const paint = () => {
            $("#fmin", box).value = t.min != null ? num(t.min) : ""; $("#fmax", box).value = t.max != null ? num(t.max) : "";
            $$("[data-pr]", box).forEach((b) => { const [, a, z] = PR[+b.dataset.pr]; b.classList.toggle("on", (t.min || 0) === a && t.max === z); });
            $$("[data-fb]", box).forEach((b) => b.classList.toggle("on", t.brands.has(b.dataset.fb)));
            $$("[data-fr]", box).forEach((b) => b.classList.toggle("on", +b.dataset.fr === t.rating));
            $$("[data-ft]", box).forEach((b) => $(".sw", b).classList.toggle("on", !!t[b.dataset.ft]));
            $("[data-fok]", box).textContent = `Ko'rsatish (${apply(t).length})`;
          };
          ["#fmin", "#fmax"].forEach((s2) => $(s2, box).addEventListener("change", () => { t.min = numIn($("#fmin", box).value); t.max = numIn($("#fmax", box).value); paint(); }));
          box.addEventListener("click", (e) => {
            const pr = e.target.closest("[data-pr]"); if (pr) { const [, a, z] = PR[+pr.dataset.pr]; t.min = a || null; t.max = z; }
            const fb = e.target.closest("[data-fb]"); if (fb) t.brands.has(fb.dataset.fb) ? t.brands.delete(fb.dataset.fb) : t.brands.add(fb.dataset.fb);
            const fr = e.target.closest("[data-fr]"); if (fr) t.rating = +fr.dataset.fr;
            const ft = e.target.closest("[data-ft]"); if (ft) t[ft.dataset.ft] = !t[ft.dataset.ft];
            if (e.target.closest("[data-fx]")) { Object.assign(t, { min: null, max: null, rating: 0, sale: false, stock: false, orig: false }); t.brands.clear(); }
            if (e.target.closest("[data-fok]")) { Object.assign(st, t); closeSheet(); draw(); $(".sb", el).scrollTop = 0; return; }
            paint();
          });
          paint();
        });
      };
      el.addEventListener("click", (e) => {
        const f = e.target.closest("[data-f]"); if (f) { st[f.dataset.f] = !st[f.dataset.f]; draw(); }
        if (e.target.closest("[data-r]")) { st.rating = st.rating >= 4.5 ? 0 : 4.5; draw(); }
        if (e.target.closest("[data-filter]")) filterSheet();
        if (e.target.closest("[data-reset]")) { Object.assign(st, { min: null, max: null, rating: 0, sale: false, stock: false, orig: false }); st.brands.clear(); draw(); }
        if (e.target.closest("[data-view]")) { st.view = st.view === "grid" ? "list" : "grid"; store.set("app_view", st.view); draw(); }
        if (e.target.closest("[data-sortbtn]")) openSheet(`<h3>Saralash</h3>${Object.entries(SORTS).map(([k, v]) => `<button class="opt${st.sort === k ? " on" : ""}" data-s="${k}">${v}</button>`).join("")}`, (box) =>
          box.addEventListener("click", (ev) => { const s2 = ev.target.closest("[data-s]"); if (s2) { st.sort = s2.dataset.s; closeSheet(); draw(); } }));
      });
      draw();
    },
  });
}
// Ro'yxat ko'rinishidagi keng kartochka
function rowCard(p) {
  const d = disc(p), q = inCart(p.id), out = (p.stock || 0) <= 0;
  return `<article class="rc${out ? " out" : ""}" data-pid="${p.id}">
    <div class="rc-img"><img src="${esc(hi(p.img, 330))}" alt="" loading="lazy" onerror="imgErr(this)" />${d ? `<span class="tag">−${d}%</span>` : ""}</div>
    <div class="rc-b"><p class="pc-n">${esc(p.name)}</p><span class="pc-r">${rateTxt(p)}</span>
      <span class="pc-m">${num(p.price / 12)} so'm/oy</span>
      <div class="pc-p"><div>${d ? `<s>${num(p.old)}</s>` : ""}<b class="${d ? "sale" : ""}">${num(p.price)} <small>so'm</small></b></div>
        <span style="display:flex;gap:6px"><button class="fav-s${S.fav.includes(p.id) ? " on" : ""}" data-fav="${p.id}" aria-label="Saralanganga">${heartSvg}</button><button class="add${q ? " in" : ""}" data-add="${p.id}" ${out ? "disabled" : ""} aria-label="Savatga">${svg(q ? IC.check : IC.cart)}</button></span></div></div>
  </article>`;
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
        res.innerHTML = catHits(q) + `<p class="list-meta" style="padding-top:12px">${L.length} ta natija</p><div class="sec" style="padding-top:0">${L.length ? grid(L) : emptyBox("🔍", "Topilmadi", `"${esc(q)}" bo'yicha mahsulot yo'q. Boshqacha yozib ko'ring.`)}</div>`;
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
  if (!$("#sheet").hidden) closeSheet();
  S.recent = [p.id, ...S.recent.filter((x) => x !== p.id)].slice(0, 30); store.set("recent", S.recent);
  if (S.drops[p.id]) { delete S.drops[p.id]; store.set("app_drops", S.drops); }
  const imgs = [p.img, ...(p.gallery || [])].filter(Boolean);
  const d = disc(p), stock = p.stock || 0;
  const similar = sortList(S.products.filter((x) => x.cat === p.cat && x.id !== p.id && (x.stock || 0) > 0), "popular").slice(0, 10);
  const together = complementary(p, 10);
  const freeFrom = S.settings.freeShipFrom || 1000000;
  push({
    noTab: true, anim: S.hero ? "hero-in" : "enter",
    html: `<header class="hdr clear phdr" id="ph"><button class="ib" data-back aria-label="Orqaga">${svg(IC.back)}</button><div class="ph-t"><b>${esc(p.name)}</b><small>${fmt(p.price)}</small></div><button class="ib" data-share aria-label="Ulashish">${svg(IC.share)}</button><button class="ib${S.fav.includes(p.id) ? " on" : ""}" data-pfav aria-label="Saralangan">${svg(IC.heart)}</button></header>
      <div class="sb pad-bar" id="psb">
        <div class="gal-wrap"><div class="gal" id="gal">${imgs.map((s, i) => `<img src="${esc(hi(s, 960))}" alt="" data-gi="${i}" onerror="imgErr(this)" />`).join("")}</div>
          ${imgs.length > 1 ? `<div class="dots" id="gd">${imgs.map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</div>` : ""}<span class="gal-hint">🔍 Kattalashtirish uchun bosing</span></div>
        <div class="pd">
          <div class="pd-price"><b class="${d ? "sale" : ""}">${fmt(p.price)}</b>${d ? `<s>${fmt(p.old)}</s><span class="tag">−${d}%</span>` : ""}</div>
          ${d ? `<div class="save">💰 Tejaysiz: <b>${fmt(p.old - p.price)}</b></div>` : ""}
          <h2 class="pd-name">${esc(p.name)}</h2>
          <div class="pd-meta"><button data-torv>${p.reviews ? `<b>★ ${p.rating}</b> · ${p.reviews} sharh` : "☆ Hali baho yo'q — birinchi bo'ling"}</button><button data-brand-go>${esc(p.brand)} ›</button>${p.original !== false ? `<span>🛡 Original</span>` : ""}<button class="cmp-btn${S.compare.includes(p.id) ? " on" : ""}" data-cmp="${p.id}">⚖️ Taqqoslash</button></div>
          <button class="nasiya" id="nas"><span>💜</span><div><b id="nasB">${fmt(p.price / S.months)} × ${S.months} oy</b><small>Uzum Nasiya orqali 0% bo'lib to'lash</small></div><span>›</span></button>
          <div class="box">
            <div class="row"><span class="ri">📦</span><div><b class="${stock <= 0 ? "stock-out" : stock <= 5 ? "stock-low" : "stock-ok"}">${stock <= 0 ? "Tugagan" : stock <= 5 ? `Tez tugaydi — ${stock} dona qoldi` : `Omborda ${stock} dona bor`}</b><small>OPUS MARKET omboridan</small></div></div>
            ${stock > 0 && stock <= 5 ? `<i class="stock-bar" style="--w:${Math.max(8, stock * 18)}%"></i>` : ""}
            <div class="row"><span class="ri">🚚</span><div><b>Yetkazish: ${deliveryDay()}</b><small>${p.price >= freeFrom ? "Bepul yetkazib beramiz" : `${fmt(S.settings.shipPrice || 50000)}, ${num(freeFrom)} so'mdan bepul`}</small></div></div>
            <div class="row"><span class="ri">🏬</span><div><b>Do'kondan olib ketish</b><small>Bepul · bugunoq, 09:00–21:00</small></div></div>
            <div class="row"><span class="ri">↩️</span><div><b>14 kun ichida qaytarish</b><small>Qadog'i buzilmagan bo'lsa</small></div></div>
          </div>
          ${p.desc ? `<div class="box"><h3>Tavsif</h3><p class="desc clamp" id="desc">${esc(p.desc)}</p>${p.desc.length > 160 ? `<button class="more-btn" data-more>Batafsil ▾</button>` : ""}</div>` : ""}
          ${p.specs && Object.keys(p.specs).length ? `<div class="box"><h3>Xususiyatlar</h3><dl class="specs">${Object.entries(p.specs).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl></div>` : ""}
          <div class="box" id="rvBox"><h3>Sharhlar</h3><div class="skel" style="height:60px"></div></div>
          ${together.length ? `<div><div class="sec-h" style="margin-top:6px"><h2>🧩 Bu bilan birga olishadi</h2></div><div class="hscroll">${together.map((x) => card(x)).join("")}</div></div>` : ""}
          ${similar.length ? `<div><div class="sec-h" style="margin-top:6px"><h2>O'xshash mahsulotlar</h2></div><div class="hscroll">${similar.map((x) => card(x)).join("")}</div></div>` : ""}
        </div>
      </div>
      <div class="buybar" id="buy"></div>`,
    mount(el) {
      const gal = $("#gal", el), gd = $$("#gd i", el), sb = $("#psb", el), ph = $("#ph", el);
      heroFly(el);
      gal.addEventListener("scroll", () => { const i = Math.round(gal.scrollLeft / gal.clientWidth); gd.forEach((x, k) => x.classList.toggle("on", k === i)); }, { passive: true });
      // Aylantirganda sarlavha qattiq fonga o'tadi va mahsulot nomi chiqadi
      sb.addEventListener("scroll", () => ph.classList.toggle("solid", sb.scrollTop > gal.offsetHeight - 80), { passive: true });
      // Rasm: bir bosish — kattalashtirish, ikki bosish — ❤️
      let tapT = null;
      gal.addEventListener("click", (e) => {
        const im = e.target.closest("[data-gi]"); if (!im) return;
        if (tapT) { clearTimeout(tapT); tapT = null; if (!S.fav.includes(p.id)) toggleFav(p.id, $("[data-pfav]", el)); heartBurst(e.clientX, e.clientY); return; }
        tapT = setTimeout(() => { tapT = null; openViewer(imgs, +im.dataset.gi); }, 260);
      });
      const drawBuy = () => {
        const q = inCart(p.id);
        $("#buy", el).innerHTML = stock <= 0 ? `<button class="btn ghost flex" data-notify-me>🔔 Kelganda xabar berish</button>`
          : q ? `<div class="stepper"><button data-q="-1">−</button><span>${q}</span><button data-q="1">+</button></div><button class="btn green flex" data-gocart>Savatga o'tish</button>`
          : `<div><small>${d ? `<s>${num(p.old)}</s>` : `${num(p.price / 12)} so'm/oy`}</small><b>${fmt(p.price)}</b></div><button class="btn flex" data-buy>${svg(IC.cart)} Savatga</button>`;
      };
      drawBuy();
      $("#buy", el).addEventListener("click", (e) => {
        if (e.target.closest("[data-buy]")) {
          if (addToCart(p.id, 1, true)) { flyToCart($("#gal img", el) || e.target); drawBuy(); refreshCards(); setTimeout(() => addedSheet(p), 420); }
        }
        const s = e.target.closest("[data-q]"); if (s) { setQty(p.id, inCart(p.id) + +s.dataset.q); drawBuy(); refreshCards(); }
        if (e.target.closest("[data-gocart]")) switchTab("cart");
        if (e.target.closest("[data-notify-me]")) { const w = store.get("app_wait", []); if (!w.includes(p.id)) store.set("app_wait", [...w, p.id]); toast("🔔 Mahsulot kelganda xabar beramiz"); }
      });
      $("[data-pfav]", el).onclick = (e) => toggleFav(p.id, e.currentTarget);
      $("[data-torv]", el).onclick = () => sb.scrollTo({ top: $("#rvBox", el).offsetTop - 70, behavior: "smooth" });
      $("[data-brand-go]", el).onclick = () => openList({ title: p.brand, brand: p.brand });
      const mb = $("[data-more]", el);
      if (mb) mb.onclick = () => { const dd = $("#desc", el); dd.classList.toggle("clamp"); mb.textContent = dd.classList.contains("clamp") ? "Batafsil ▾" : "Yig'ish ▴"; };
      $("[data-share]", el).onclick = () => {
        const url = `https://javohir877.github.io/OPUS-MARKET/#product-${p.id}`;
        if (navigator.share) navigator.share({ title: p.name, text: `${p.name} — ${fmt(p.price)}`, url }).catch(() => {});
        else navigator.clipboard?.writeText(url).then(() => toast("🔗 Havola nusxalandi"));
      };
      $("#nas", el).onclick = () => openSheet(`<h3>💜 Bo'lib to'lash</h3><p class="muted" style="margin-bottom:12px">Uzum Nasiya — 0% ustamasiz</p><div class="months">${MONTHS.map((m) => `<button data-m="${m}" class="${m === S.months ? "on" : ""}">${m} oy</button>`).join("")}</div><div class="box" style="margin-top:12px"><div class="sum"><div><span>Oylik to'lov</span><b id="mPay">${fmt(p.price / S.months)}</b></div><div><span>Jami</span><b>${fmt(p.price)}</b></div><div><span>Ustama</span><b style="color:var(--ok)">0 so'm</b></div></div></div><button class="btn block" style="margin-top:14px" id="mOk">Tanlash</button>`, (box) => {
        box.addEventListener("click", (e) => {
          const m = e.target.closest("[data-m]");
          if (m) { S.months = +m.dataset.m; $$("[data-m]", box).forEach((b) => b.classList.toggle("on", b === m)); $("#mPay", box).textContent = fmt(p.price / S.months); }
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
  if (r.count) {
    const cnt = [5, 4, 3, 2, 1].map((k) => r.reviews.filter((v) => v.rating === k).length);
    $(".rv-sum", box).insertAdjacentHTML("beforeend", `<div class="rv-bars">${cnt.map((c, i) => `<span><small>${5 - i}★</small><i style="--w:${(c / r.count) * 100}%"></i><small>${c}</small></span>`).join("")}</div>`);
  }
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
          closeSheet(); toast("🙏 Rahmat! Sharhingiz qo'shildi"); loadReviews(p, el); loadRv().then(() => refreshRoot("home")).catch(() => {});
        } catch (ex) { $("#rvErr", box).textContent = ex.message; $("#rvErr", box).hidden = false; b.disabled = false; }
      }
    });
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
          <button class="thumb" data-pid="${x.id}"><img src="${esc(hi(x.p.img, 330))}" alt="" onerror="imgErr(this)" /></button>
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
      haptic([20, 60, 30]); window.sfx && sfx("success"); setTimeout(confetti, 350);
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
async function loadOrders() {
  const r = await api("GET", "/api/orders"); S.orders = r.orders;
  try { window.OPUSApp && OPUSApp.orders && OPUSApp.orders(JSON.stringify(S.orders || [])); } catch (e) {}
  return S.orders;
}
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
          <div class="thumbs">${(o.items || []).slice(0, 4).map((i) => `<img src="${esc(hi((byId(i.id) || i).img, 330))}" alt="" onerror="imgErr(this)" />`).join("")}${(o.items || []).length > 4 ? `<span>+${o.items.length - 4}</span>` : ""}</div>
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
        ${tracker(o)}${cancelled ? `<p class="muted">Buyurtma bekor qilingan. Mahsulotlar omborga qaytarildi.</p>` : `<div class="tl">${STATUSES.map((s, i) => `<div class="${i < idx ? "done" : i === idx ? "done cur" : ""}">${s === "Yangi" && isPending(o) ? "Telegram kodi kutilmoqda" : s}</div>`).join("")}</div>`}
        ${isPending(o) ? `<button class="btn tg block" id="oConf">${svg(IC.tg)} Telegram kodi bilan tasdiqlash</button>` : ""}
      </div>
      <div class="box"><h3>Mahsulotlar</h3>${(o.items || []).map((i) => `<div class="row" data-pid="${i.id}"><img src="${esc(hi((byId(i.id) || i).img, 330))}" alt="" style="width:52px;height:52px;border-radius:10px;background:#fff;object-fit:contain;padding:3px" onerror="imgErr(this)" /><div><span style="font-size:13.5px">${esc(i.name)}</span><small>${i.qty} × ${fmt(i.price)}</small></div></div>`).join("")}</div>
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
// =====================================================================
// ---------- Qo'shimcha imkoniyatlar (v2.2) ----------
// =====================================================================
Object.assign(IC, {
  bell: "M12 22a2.5 2.5 0 002.5-2.5h-5A2.5 2.5 0 0012 22zm7-6V11a7 7 0 00-5.5-6.8V3a1.5 1.5 0 00-3 0v1.2A7 7 0 005 11v5l-2 2v1h18v-1l-2-2z",
  filter: "M3 5h18v2l-7 7v6l-4-2v-4L3 7z",
  view: "M3 4h18v4H3zm0 6h18v4H3zm0 6h18v4H3z",
  grid2: "M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z",
  close: "M18.3 5.7L12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7l-1.4-1.4L9.2 12 2.9 5.7l1.4-1.4 6.3 6.3 6.3-6.3z",
});
S.drops = store.get("app_drops", {});        // narxi tushgan saralanganlar: id → eski narx
const sfx = (n) => { try { window.SFX && SFX.play(n, { noHaptic: true }); } catch {} };
window.sfx = sfx;
if (window.SFX) SFX.skip("[data-add], [data-fav], [data-back], [data-buy], .tabbar button, [data-pid], [data-story], .story, .viewer, .onb");
const hello = () => { const h = new Date().getHours(); return h < 5 ? "Xayrli tun 🌙" : h < 11 ? "Xayrli tong ☀️" : h < 17 ? "Xayrli kun 🌤" : h < 22 ? "Xayrli kech 🌆" : "Xayrli tun 🌙"; };
const UZ_DAYS = ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"];
const UZ_MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
function deliveryDay() { const d = new Date(Date.now() + 864e5); return `ertaga, ${d.getDate()}-${UZ_MONTHS[d.getMonth()]} (${UZ_DAYS[d.getDay()]})`; }
function infoSheet(title, text) { openSheet(`<h3>${title}</h3><p class="muted" style="margin-bottom:14px;line-height:1.5">${esc(text)}</p><button class="btn block" id="isOk">Tushunarli</button>`, (b) => ($("#isOk", b).onclick = closeSheet)); }

// Tavsiyalar: ko'rilgan, saralangan va savatdagi kategoriyalar asosida
function recommend(n) {
  const w = {};
  S.recent.slice(0, 15).forEach((id, i) => { const p = byId(id); if (p) w[p.cat] = (w[p.cat] || 0) + 3 - i * 0.15; });
  S.fav.forEach((id) => { const p = byId(id); if (p) w[p.cat] = (w[p.cat] || 0) + 3; });
  S.cart.forEach((x) => { const p = byId(x.id); if (p) (COMPLEMENT[p.cat] || []).forEach((c) => (w[c] = (w[c] || 0) + 2)); });
  if (!Object.keys(w).length) return [];
  const seen = new Set([...S.recent.slice(0, 4), ...S.cart.map((x) => x.id)]);
  return S.products.filter((p) => (p.stock || 0) > 0 && !seen.has(p.id) && w[p.cat])
    .sort((a, b) => w[b.cat] * 100 + (b.popular || 0) - (w[a.cat] * 100 + (a.popular || 0))).slice(0, n);
}
const COMPLEMENT = { laptop: ["mouse", "audio", "storage", "keyboard"], pc: ["monitor", "keyboard", "mouse", "audio"], monitor: ["pc", "keyboard", "mouse"], keyboard: ["mouse", "audio", "monitor"], mouse: ["keyboard", "audio"], audio: ["gaming", "mouse"], parts: ["storage", "pc"], storage: ["parts", "laptop"], gaming: ["audio", "monitor"] };
function complementary(p, n) {
  const cats = COMPLEMENT[p.cat] || [];
  return S.products.filter((x) => cats.includes(x.cat) && (x.stock || 0) > 0)
    .sort((a, b) => cats.indexOf(a.cat) - cats.indexOf(b.cat) || (b.popular || 0) - (a.popular || 0))
    .filter((x, i, arr) => arr.findIndex((y) => y.cat === x.cat) === i || i < n * 2).slice(0, n);
}
// Yangi APK versiyasi chiqqanmi (admin paneldagi "Android ilova" sozlamasi)
function updateInfo() {
  const a = S.settings.apk || {};
  if (VERSION === "web" || !a.url || !a.version) return null;
  const v = (s) => String(s).split(".").map((x) => +x || 0);
  const [x, y] = [v(a.version), v(VERSION)];
  for (let i = 0; i < 3; i++) { if ((x[i] || 0) > (y[i] || 0)) return a; if ((x[i] || 0) < (y[i] || 0)) return null; }
  return null;
}

// ---------- Rasmni to'liq ekranda ko'rish (ikki bosish — kattalashtirish) ----------
let viewerEl = null;
function openViewer(imgs, start) {
  const v = viewerEl = document.createElement("div");
  v.className = "viewer";
  v.innerHTML = `<div class="vw-top"><span id="vwN">${start + 1} / ${imgs.length}</span><button class="ib" data-vx aria-label="Yopish">${svg(IC.close)}</button></div>
    <div class="vw-track">${imgs.map((s) => `<div class="vw-slide"><img src="${esc(hi(s, 960))}" alt="" onerror="imgErr(this)" /></div>`).join("")}</div><p class="vw-hint">Ikki marta bosing — kattalashtirish</p>`;
  document.body.appendChild(v);
  sfx("open");
  const tr = $(".vw-track", v);
  requestAnimationFrame(() => tr.scrollTo({ left: start * tr.clientWidth }));
  tr.addEventListener("scroll", () => { $("#vwN", v).textContent = `${Math.round(tr.scrollLeft / tr.clientWidth) + 1} / ${imgs.length}`; }, { passive: true });
  let last = 0;
  tr.addEventListener("click", (e) => {
    const sl = e.target.closest(".vw-slide"); if (!sl) return;
    const now = Date.now();
    if (now - last < 300) {
      const z = !sl.classList.contains("z");
      const r = sl.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
      sl.classList.toggle("z", z); tr.classList.toggle("locked", z); sfx(z ? "plus" : "minus");
      if (z) requestAnimationFrame(() => { sl.scrollLeft = sl.scrollWidth * fx - r.width / 2; sl.scrollTop = sl.scrollHeight * fy - r.height / 2; });
      last = 0;
    } else last = now;
  });
  $("[data-vx]", v).onclick = closeViewer;
}
function closeViewer() { if (!viewerEl) return; const v = viewerEl; viewerEl = null; v.classList.add("out"); sfx("close"); setTimeout(() => v.remove(), 200); }

// ---------- Animatsiyalar ----------
function heartBurst(x, y) {
  const h = document.createElement("div");
  h.className = "burst"; h.style.left = x + "px"; h.style.top = y + "px";
  h.innerHTML = `${heartSvg}${Array.from({ length: 8 }, (_, i) => `<i style="--a:${i * 45}deg"></i>`).join("")}`;
  document.body.appendChild(h); setTimeout(() => h.remove(), 900);
}
// Mahsulot rasmi savat ikonkasiga "uchib" boradi
function flyToCart(src) {
  const target = $('#tabbar [data-tab="cart"] svg');
  if (!src || !target || !src.getBoundingClientRect) return;
  const a = src.getBoundingClientRect(), b = target.getBoundingClientRect();
  if (!a.width) return;
  const f = document.createElement(src.tagName === "IMG" ? "img" : "div");
  if (src.tagName === "IMG") f.src = src.currentSrc || src.src;
  f.className = "fly";
  const size = Math.min(a.width, a.height, 160);
  Object.assign(f.style, { left: a.left + a.width / 2 - size / 2 + "px", top: a.top + a.height / 2 - size / 2 + "px", width: size + "px", height: size + "px" });
  document.body.appendChild(f);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
  f.animate([
    { transform: "translate(0,0) scale(1)", opacity: 1 },
    { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 120}px) scale(.55) rotate(-12deg)`, opacity: 1, offset: 0.5 },
    { transform: `translate(${dx}px, ${dy}px) scale(.08) rotate(10deg)`, opacity: 0.6 },
  ], { duration: 650, easing: "cubic-bezier(.5,0,.6,1)" }).onfinish = () => {
    f.remove();
    const btn = $('#tabbar [data-tab="cart"]'); btn.classList.remove("got"); void btn.offsetWidth; btn.classList.add("got");
  };
}
// "Savatga qo'shildi" oynasi + birga olinadigan mahsulotlar
function addedSheet(p) {
  const T = totals(), tog = complementary(p, 8), left = Math.max(0, T.free - T.subtotal);
  openSheet(`<div class="added"><img src="${esc(hi(p.img, 330))}" alt="" onerror="imgErr(this)" /><div><b>✅ Savatga qo'shildi</b><small>${esc(p.name)}</small></div></div>
    <div class="ship-prog" style="--w:${Math.min(100, (T.subtotal / T.free) * 100)}%;margin-top:12px">${left ? `<span>🚚 Bepul yetkazish uchun yana <b>${fmt(left)}</b></span>` : `<span>🎉 Yetkazib berish <b>bepul!</b></span>`}<i></i></div>
    ${tog.length ? `<div class="sec-h" style="margin:16px 0 8px"><h2 style="font-size:16px">🧩 Bu bilan birga olishadi</h2></div><div class="hscroll" style="margin:0 -16px;padding:2px 16px 6px">${tog.map((x) => card(x)).join("")}</div>` : ""}
    <div class="sheet-foot"><button class="btn ghost flex" id="adMore">Davom etish</button><button class="btn flex" id="adCart">Savatga o'tish</button></div>`, (b) => {
    $("#adMore", b).onclick = closeSheet;
    $("#adCart", b).onclick = () => { closeSheet(); switchTab("cart"); };
  });
}
// Konfetti (muvaffaqiyatli buyurtma)
function confetti() {
  sfx("confetti");
  const c = document.createElement("canvas");
  c.className = "confetti"; c.width = innerWidth; c.height = innerHeight;
  document.body.appendChild(c);
  const x = c.getContext("2d"), cols = ["#ff2a40", "#ffd43b", "#22c55e", "#2aabee", "#a46bff", "#fff"];
  const P = Array.from({ length: 140 }, () => ({ x: innerWidth / 2, y: innerHeight * 0.35, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4, s: 4 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: cols[(Math.random() * cols.length) | 0] }));
  const t0 = performance.now();
  const f = (now) => {
    x.clearRect(0, 0, c.width, c.height);
    P.forEach((p) => { p.vy += 0.38; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore(); });
    if (now - t0 < 3200) requestAnimationFrame(f); else c.remove();
  };
  requestAnimationFrame(f);
}

// ---------- Bildirishnomalar ----------
const notifs = () => store.get("app_notifs", []);
function addNotif(n, quiet) {
  const L = notifs();
  if (n.key && L.some((x) => x.key === n.key)) return;
  L.unshift({ ...n, id: Date.now() + Math.random(), at: Date.now(), read: false });
  store.set("app_notifs", L.slice(0, 50));
  if (!quiet) { sfx("notify"); toast(`${n.icon} ${n.title}`, n.act ? { t: "Ko'rish", fn: () => runNotif(n.act) } : null); }
  bellBadge();
}
function bellBadge() {
  const n = notifs().filter((x) => !x.read).length;
  $$(".bell").forEach((b) => { let i = $(".bell-n", b); if (!n) { i && i.remove(); return; } if (!i) { i = document.createElement("i"); i.className = "bell-n"; b.appendChild(i); } i.textContent = n > 9 ? "9+" : n; });
}
async function runNotif(a) {
  if (!a) return;
  if (a.pid) openProduct(a.pid);
  else if (a.order) { if (!S.orders) await loadOrders().catch(() => {}); const o = (S.orders || []).find((x) => x.id === a.order); if (o) { switchTab("profile"); setTimeout(() => openOrder(o), 60); } }
  else if (a.tab) switchTab(a.tab);
}
function openNotifs() {
  push({
    html: hdr("Bildirishnomalar", `<button class="ib" data-readall aria-label="Hammasini o'qildi">${svg(IC.check)}</button>`) + `<div class="sb"><div class="sec" id="nl" style="display:flex;flex-direction:column;gap:8px"></div></div>`,
    mount(el) {
      const draw = () => {
        const L = notifs();
        $("#nl", el).innerHTML = L.length ? L.map((n, i) => `<button class="ntf${n.read ? "" : " unread"}" data-ni="${i}"><span class="ri">${n.icon}</span><div><b>${esc(n.title)}</b><small>${esc(n.text || "")}</small><em>${ago(n.at)}</em></div></button>`).join("")
          : emptyBox("🔔", "Bildirishnoma yo'q", "Buyurtma holati o'zgarganda, saralangan mahsulot arzonlashganda shu yerda xabar paydo bo'ladi");
      };
      el.addEventListener("click", (e) => {
        const b = e.target.closest("[data-ni]");
        if (b) { const L = notifs(), n = L[+b.dataset.ni]; n.read = true; store.set("app_notifs", L); bellBadge(); draw(); runNotif(n.act); }
        if (e.target.closest("[data-readall]")) { store.set("app_notifs", notifs().map((n) => ({ ...n, read: true }))); bellBadge(); draw(); toast("✓ Hammasi o'qildi"); }
      });
      draw();
    },
    unmount() { refreshRoot("home"); },
  });
}
function ago(t) {
  const s = (Date.now() - t) / 1000;
  return s < 60 ? "hozirgina" : s < 3600 ? `${Math.floor(s / 60)} daqiqa oldin` : s < 86400 ? `${Math.floor(s / 3600)} soat oldin` : new Date(t).toLocaleDateString("ru-RU");
}
// Buyurtma holati o'zgarganini kuzatish (ilova ochiq turganda har daqiqada)
const ST_ICON = { "Tasdiqlandi": "✅", "Yig'ilmoqda": "📦", "Yo'lda": "🚚", "Yetkazildi": "🎉", "Bekor qilindi": "✕", "Yangi": "🆕" };
async function syncOrders() {
  if (!auth.token) return;
  const prev = store.get("app_order_st", {}), first = !Object.keys(prev).length;
  const L = await loadOrders(), next = {};
  L.forEach((o) => {
    const k = o.status + (o.confirmed ? "" : "*");
    next[o.id] = k;
    if (!first && prev[o.id] && prev[o.id] !== k) addNotif({ key: o.id + k, icon: ST_ICON[o.status] || "📦", title: `Buyurtma #${o.id}: ${o.status}`, text: o.status === "Yo'lda" ? "Kuryer yo'lga chiqdi — telefoningiz yoqiq tursin" : o.status === "Yetkazildi" ? "Xaridingiz uchun rahmat! Mahsulotga sharh qoldiring ⭐" : `Jami: ${fmt(o.total)}`, act: { order: o.id } });
  });
  store.set("app_order_st", next);
}
// Saralangan mahsulot arzonlashdi / kutilgan mahsulot omborga keldi
function checkDrops() {
  const fp = store.get("app_fav_prices", {});
  S.fav.forEach((id) => {
    const p = byId(id); if (!p) return;
    if (fp[id] && p.price < fp[id]) {
      S.drops[id] = fp[id];
      addNotif({ key: `drop${id}:${p.price}`, icon: "📉", title: "Narx tushdi!", text: `${p.name}: ${fmt(fp[id])} → ${fmt(p.price)}`, act: { pid: id } });
    }
    fp[id] = p.price;
  });
  store.set("app_fav_prices", fp); store.set("app_drops", S.drops);
  const wait = store.get("app_wait", []);
  const back = wait.filter((id) => (byId(id) || {}).stock > 0);
  back.forEach((id) => addNotif({ key: `back${id}`, icon: "📦", title: "Mahsulot omborga keldi!", text: byId(id).name, act: { pid: id } }));
  if (back.length) store.set("app_wait", wait.filter((id) => !back.includes(id)));
}

// ---------- Qidiruvda kategoriya va brend takliflari ----------
function catHits(q) {
  const s = q.toLowerCase();
  const cats = S.cats.filter((c) => c.name.toLowerCase().includes(s)).slice(0, 4);
  const brands = [...new Set(S.products.map((p) => p.brand))].filter((b) => b.toLowerCase().startsWith(s)).slice(0, 4);
  if (!cats.length && !brands.length) return "";
  return `<div class="chips" style="padding-bottom:0">${cats.map((c) => `<button class="chip" data-cat="${esc(c.id)}">🗂 ${esc(c.name)}</button>`).join("")}${brands.map((b) => `<button class="chip" data-brand-q="${esc(b)}">🏷 ${esc(b)}</button>`).join("")}</div>`;
}
document.addEventListener("click", (e) => { const c = e.target.closest("[data-cmp]"); if (c) { e.stopPropagation(); toggleCompare(c.dataset.cmp); } });
document.addEventListener("click", (e) => { const b = e.target.closest("[data-brand-q]"); if (b) openList({ title: b.dataset.brandQ, brand: b.dataset.brandQ }); });

// ---------- Birinchi ochilish: tanishuv ----------
function onboarding() {
  if (store.get("app_onboarded", false)) return;
  const promo = S.settings.promos && S.settings.promos.YANGI5 ? "YANGI5" : null;
  const slides = [
    { e: "🛒", t: "OPUS MARKET'ga xush kelibsiz!", p: "Noutbuk, kompyuter, monitor va aksessuarlar — original va kafolat bilan." },
    { e: "💜", t: "0% bo'lib to'lash", p: "Uzum Nasiya orqali 24 oygacha ortiqcha foizsiz. Click, Payme, karta yoki naqd — qanday qulay bo'lsa." },
    { e: "✈️", t: "Telegram orqali tasdiqlash", p: `Buyurtmani 6 xonali kod bilan tasdiqlaysiz, chek Telegram'ga keladi.${promo ? ` Birinchi xarid uchun ${promo} promo-kodi!` : ""}` },
  ];
  const o = document.createElement("div");
  o.className = "onb";
  o.innerHTML = `<button class="onb-skip">O'tkazib yuborish</button><div class="onb-track">${slides.map((s) => `<div class="onb-s"><div class="onb-art">${s.e}</div><h2>${s.t}</h2><p>${s.p}</p></div>`).join("")}</div>
    <div class="dots">${slides.map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</div><button class="btn block onb-next">Keyingi</button>`;
  document.body.appendChild(o);
  const tr = $(".onb-track", o), dots = $$(".dots i", o), nb = $(".onb-next", o);
  let i = 0;
  const done = () => { store.set("app_onboarded", true); o.classList.add("out"); setTimeout(() => o.remove(), 300); if (promo) addNotif({ key: "welcome", icon: "🎁", title: "Sovg'a: 5% chegirma", text: `Birinchi xaridingizda ${promo} promo-kodini savatda kiriting`, act: { tab: "cart" } }, true); };
  tr.addEventListener("scroll", () => { i = Math.round(tr.scrollLeft / tr.clientWidth); dots.forEach((d, k) => d.classList.toggle("on", k === i)); nb.textContent = i === slides.length - 1 ? "Boshlash 🚀" : "Keyingi"; }, { passive: true });
  nb.onclick = () => { if (i >= slides.length - 1) return done(); tr.scrollTo({ left: (i + 1) * tr.clientWidth, behavior: "smooth" }); };
  $(".onb-skip", o).onclick = done;
}

// ---------- Savatda surib o'chirish (qaytarish imkoni bilan) ----------
function enableSwipe(el) {
  let row = null, x0 = 0, y0 = 0, dx = 0, lock = null;
  el.addEventListener("touchstart", (e) => { row = e.target.closest(".ci-row"); if (!row) return; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; lock = null; row.style.transition = "none"; }, { passive: true });
  el.addEventListener("touchmove", (e) => {
    if (!row) return;
    const mx = e.touches[0].clientX - x0, my = e.touches[0].clientY - y0;
    if (lock == null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) lock = Math.abs(mx) > Math.abs(my) ? "x" : "y";
    if (lock !== "x") return;
    dx = Math.min(0, mx); row.style.transform = `translateX(${dx}px)`;
    row.parentElement.classList.toggle("arm", dx < -110);
  }, { passive: true });
  el.addEventListener("touchend", () => {
    if (!row) return;
    const r = row; row = null; r.style.transition = "";
    if (dx < -110) {
      const id = +r.dataset.row, qty = inCart(id);
      r.style.transform = "translateX(-110%)"; sfx("remove");
      setTimeout(() => { setQty(id, 0); refreshRoot("cart"); toast("🗑 Savatdan olib tashlandi", { t: "Qaytarish", fn: () => { S.cart.push({ id, qty }); saveCart(); refreshRoot("cart"); } }); }, 220);
    } else { r.style.transform = ""; r.parentElement.classList.remove("arm"); }
  });
}
// Ochiq qatlamlarni (stories, rasm ko'rish) "Orqaga" tugmasi yopadi
const __back0 = window.__opusBack;
window.__opusBack = () => {
  if (storyState) { storyState.close(); return true; }
  if (viewerEl) { closeViewer(); return true; }
  if ($(".onb")) return true;
  return __back0();
};

// =====================================================================
// ---------- v2.3: aniq rasmlar, o'tish animatsiyalari, taqqoslash ----------
// =====================================================================
// Wikimedia'dagi asl fotoning aniq versiyasi (standart o'lchamlar: 330 / 500 / 960). Yuklanmasa — lokal nusxa (imgErr).
const WM_W = [330, 500, 960];
function hi(id, w = 330) {
  if (!id || !id.startsWith("wm:")) return pic(id);
  const path = id.slice(3), i = path.lastIndexOf("/"), dir = path.slice(0, i), name = path.slice(i + 1);
  if (/\.(svg|gif|tiff?)$/i.test(name)) return pic(id);
  w = WM_W.find((x) => x >= w) || 960;
  if (/\.png$/i.test(name) && w > 500) w = 500; // PNG og'ir — 500 px yetarli
  const e = encodeURIComponent(name);
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${dir}/${e}/${w}px-${e}`;
}
// Aniq rasm yuklanmasa — lokal nusxaga o'tamiz, u ham bo'lmasa — elementni olib tashlaymiz
window.imgErr = (el) => {
  const m = el.src.match(/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/.+\/\d+px-(.+)$/);
  if (m && !el.dataset.f) { el.dataset.f = "1"; el.src = "../img/" + decodeURIComponent(m[1]).replace(/[^A-Za-z0-9._-]/g, "_"); return; }
  el.remove();
};

// Wikimedia sekin yoki yopiq bo'lsa: ekrandagi rasm ~8 soniyada yuklanmasa — lokal nusxa
{
  const slow = new WeakSet();
  setInterval(() => {
    $$("img[src*=\"upload.wikimedia.org\"]:not([data-f])").forEach((im) => {
      if (im.complete) return;
      const r = im.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth || !r.width) return;
      if (slow.has(im)) imgErr(im); else slow.add(im);
    });
  }, 4000);
}
// Tugmalarda "to'lqin" (ripple) effekti
document.addEventListener("pointerdown", (e) => {
  const b = e.target.closest(".btn, .chip, .mi, .opt, .seg button, .pay, .ctile, .recent button, .stats button");
  if (!b || b.disabled) return;
  const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2;
  const w = document.createElement("span");
  w.className = "ripple";
  Object.assign(w.style, { width: s + "px", height: s + "px", left: e.clientX - r.left - s / 2 + "px", top: e.clientY - r.top - s / 2 + "px" });
  if (getComputedStyle(b).position === "static") b.style.position = "relative";
  b.style.overflow = "hidden";
  b.appendChild(w); setTimeout(() => w.remove(), 600);
}, { passive: true });

// Kartochka rasmi mahsulot sahifasiga "uchib" o'tadi (shared element)
S.hero = null;
document.addEventListener("click", (e) => {
  const c = e.target.closest("[data-pid]");
  if (!c || e.target.closest("[data-add], [data-fav]")) return;
  const im = $("img", c);
  S.hero = im && im.complete && im.naturalWidth ? { rect: im.getBoundingClientRect(), src: im.currentSrc || im.src } : null;
}, true);
function heroFly(el) {
  const h = S.hero; S.hero = null;
  const target = $("#gal img", el);
  if (!h || !target) return false;
  const t = target.getBoundingClientRect();
  if (!t.width) return false;
  const f = document.createElement("img");
  f.src = h.src; f.className = "hero-fly";
  Object.assign(f.style, { left: h.rect.left + "px", top: h.rect.top + "px", width: h.rect.width + "px", height: h.rect.height + "px" });
  document.body.appendChild(f);
  target.style.opacity = "0";
  const sx = t.width / h.rect.width, sy = t.height / h.rect.height, s = Math.min(sx, sy);
  f.animate([
    { transform: "translate(0,0) scale(1)", borderRadius: "16px" },
    { transform: `translate(${t.left + t.width / 2 - (h.rect.left + h.rect.width / 2)}px, ${t.top + t.height / 2 - (h.rect.top + h.rect.height / 2)}px) scale(${s})`, borderRadius: "0px" },
  ], { duration: 420, easing: "cubic-bezier(.2,.8,.2,1)" });
  // Animatsiya qanday tugashidan qat'i nazar rasm albatta ko'rinadi
  setTimeout(() => { target.style.transition = "opacity .15s"; target.style.opacity = ""; setTimeout(() => f.remove(), 120); }, 430);
  return true;
}

// ---------- Taqqoslash (sayt bilan umumiy: opus_compare) ----------
S.compare = store.get("compare", []).filter((id) => byId(id));
function toggleCompare(id) {
  id = +id;
  const p = byId(id);
  if (S.compare.includes(id)) { S.compare = S.compare.filter((x) => x !== id); toast("⚖️ Taqqoslashdan olib tashlandi"); }
  else {
    const first = byId(S.compare[0]);
    if (first && first.cat !== p.cat) { S.compare = []; toast("⚖️ Faqat bir xil turdagi mahsulotlar taqqoslanadi — ro'yxat yangilandi"); }
    if (S.compare.length >= 3) S.compare.shift();
    S.compare.push(id);
    if (S.compare.length >= 2) toast(`⚖️ Taqqoslashda ${S.compare.length} ta mahsulot`, { t: "Ko'rish", fn: openCompare });
    else toast("⚖️ Taqqoslashga qo'shildi — yana bitta tanlang");
  }
  store.set("compare", S.compare); sfx("chip");
  $$(`[data-cmp="${id}"]`).forEach((b) => b.classList.toggle("on", S.compare.includes(id)));
}
function openCompare() {
  push({
    noTab: true,
    html: hdr("⚖️ Taqqoslash", `<button class="ib" data-cclear aria-label="Tozalash">${svg(IC.trash)}</button>`) + `<div class="sb" id="cmpSb"></div>`,
    mount(el) {
      const draw = () => {
        const L = S.compare.map(byId).filter(Boolean);
        if (L.length < 2) { $("#cmpSb", el).innerHTML = emptyBox("⚖️", "Taqqoslash uchun 2–3 ta mahsulot tanlang", "Mahsulot sahifasidagi \"⚖️ Taqqoslash\" tugmasini bosing (bir xil turdagi mahsulotlar)", L.length ? `<p class="muted">Tanlangan: ${esc(L[0].name)}</p>` : ""); return; }
        const keys = [...new Set(L.flatMap((p) => Object.keys(p.specs || {})))];
        const minP = Math.min(...L.map((p) => p.price)), maxR = Math.max(...L.map((p) => p.rating || 0));
        $("#cmpSb", el).innerHTML = `<div class="cmp" style="--n:${L.length}">
          <div class="cmp-row head">${L.map((p) => `<div class="cmp-c"><button class="cmp-x" data-cx="${p.id}" aria-label="Olib tashlash">✕</button><button data-pid="${p.id}" class="cmp-img"><img src="${esc(hi(p.img, 330))}" alt="" onerror="imgErr(this)" /></button><b>${esc(p.name)}</b></div>`).join("")}</div>
          <p class="cmp-k">Narx</p><div class="cmp-row">${L.map((p) => `<div class="cmp-c${p.price === minP ? " best" : ""}"><b>${fmt(p.price)}</b>${p.price === minP ? "<small>🏆 eng arzon</small>" : `<small>+${fmt(p.price - minP)}</small>`}</div>`).join("")}</div>
          <p class="cmp-k">Reyting</p><div class="cmp-row">${L.map((p) => `<div class="cmp-c${p.reviews && p.rating === maxR ? " best" : ""}"><b>${p.reviews ? "★ " + p.rating : "—"}</b><small>${p.reviews || 0} sharh</small></div>`).join("")}</div>
          <p class="cmp-k">Omborda</p><div class="cmp-row">${L.map((p) => `<div class="cmp-c"><b class="${(p.stock || 0) <= 0 ? "stock-out" : (p.stock || 0) <= 5 ? "stock-low" : "stock-ok"}">${(p.stock || 0) <= 0 ? "Tugagan" : p.stock + " dona"}</b></div>`).join("")}</div>
          ${keys.map((k) => `<p class="cmp-k">${esc(k)}</p><div class="cmp-row">${L.map((p) => `<div class="cmp-c">${esc((p.specs || {})[k] || "—")}</div>`).join("")}</div>`).join("")}
          <div class="cmp-row" style="margin-top:12px">${L.map((p) => `<div class="cmp-c"><button class="btn sm block" data-cadd="${p.id}" ${(p.stock || 0) <= 0 ? "disabled" : ""}>${inCart(p.id) ? "✓ Savatda" : "Savatga"}</button></div>`).join("")}</div>
        </div>`;
      };
      el.addEventListener("click", (e) => {
        const x = e.target.closest("[data-cx]"); if (x) { toggleCompare(x.dataset.cx); draw(); }
        const a = e.target.closest("[data-cadd]"); if (a) { if (!inCart(a.dataset.cadd)) addToCart(a.dataset.cadd); draw(); }
        if (e.target.closest("[data-cclear]")) { S.compare = []; store.set("compare", []); draw(); }
      });
      draw();
    },
  });
}

// ---------- Buyurtmani kuzatish: jonli treker ----------
function tracker(o) {
  if (o.status === "Bekor qilindi") return "";
  const steps = [["🆕", "Qabul"], ["✅", "Tasdiq"], ["📦", "Yig'ish"], ["🚚", "Yo'lda"], ["🎉", "Yetkazildi"]];
  const i = Math.max(0, STATUSES.indexOf(o.status)), pct = (i / (steps.length - 1)) * 100;
  return `<div class="trk" style="--p:${pct}%"><div class="trk-line"><i></i><span class="trk-car">${o.status === "Yetkazildi" ? "🎉" : "🚚"}</span></div>
    <div class="trk-st">${steps.map(([e, t], k) => `<span class="${k < i ? "done" : k === i ? "cur" : ""}"><b>${e}</b>${t}</span>`).join("")}</div>
    <p class="trk-eta">${o.status === "Yetkazildi" ? "Buyurtma yetkazildi. Xaridingiz uchun rahmat!" : o.status === "Yo'lda" ? "Kuryer yo'lda — bugun yetib boradi" : `Taxminiy yetkazish: ${deliveryDay()}`}</p></div>`;
}

// ---------- Yangiliklar: "video" muqovalar, lenta va maqola ----------
// Yangilik rasmi ilova ikonkasi yoki yo'q bo'lsa — matnida tilga olingan mahsulot fotosini olamiz
function newsProducts(n) {
  const txt = `${n.title} ${n.excerpt || ""} ${n.body || ""}`.toLowerCase();
  const byName = S.products.filter((p) => txt.includes(p.name.toLowerCase()) || txt.includes(p.name.toLowerCase().split(" ").slice(0, 3).join(" ")));
  const byBrand = byName.length ? [] : S.products.filter((p) => p.brand.length > 2 && new RegExp(`\\b${p.brand.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(txt));
  return [...byName, ...byBrand].filter((p, i, a) => a.indexOf(p) === i).slice(0, 8);
}
function newsCover(n) {
  if (n.img && !/^icons\//.test(n.img)) return n.img;
  const p = newsProducts(n)[0] || S.products.slice().sort((a, b) => (b.popular || 0) - (a.popular || 0))[0];
  return p ? p.img : n.img;
}
const readMin = (n) => Math.max(1, Math.round(String(n.body || n.excerpt || "").split(/\s+/).length / 180));
const NEWS_TONE = { "Aksiya": "red", "Yangi kelgan": "green", "Maslahat": "violet", "Sharh": "dark", "Yangilik": "dark" };
// Bosh sahifa va lenta uchun "reels" kartochka: harakatlanuvchi muqova, nur o'tishi, progress
function reel(n, i = 0) {
  return `<button class="reel ${NEWS_TONE[n.tag] || "dark"}" data-news="${n.id}" style="--d:${(i % 3) * 1.3}s">
    <span class="reel-bg"><img src="${esc(hi(newsCover(n), 500))}" alt="" loading="lazy" onerror="imgErr(this)" /></span>
    <span class="reel-sh"></span>
    <span class="reel-top"><em>${esc(n.tag || "Yangilik")}</em>${n.pinned ? "<em>📌</em>" : ""}</span>
    <span class="reel-play">▶</span>
    <span class="reel-b"><b>${esc(n.title)}</b><small>${esc(n.date || "")} · ${readMin(n)} daq o'qish</small><i class="reel-prog"></i></span>
  </button>`;
}
function openNewsFeed(tag0) {
  let tag = tag0 || "";
  const tags = [...new Set(S.news.map((n) => n.tag || "Yangilik"))];
  push({
    html: hdr("📰 Yangiliklar") + `<div class="chips"><button class="chip" data-nt="">Hammasi</button>${tags.map((t) => `<button class="chip" data-nt="${esc(t)}">${esc(t)}</button>`).join("")}</div><div class="sb"><div class="sec" id="nf" style="padding-top:4px"></div></div>`,
    mount(el) {
      const draw = () => {
        $$("[data-nt]", el).forEach((c) => c.classList.toggle("on", c.dataset.nt === tag));
        const L = S.news.filter((n) => !tag || (n.tag || "Yangilik") === tag).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || String(b.date).localeCompare(String(a.date)));
        if (!L.length) { $("#nf", el).innerHTML = emptyBox("📰", "Yangilik yo'q", "Bu turdagi yangiliklar hali chiqmagan"); return; }
        const [f, ...rest] = L;
        $("#nf", el).innerHTML = `<button class="nf-hero" data-news="${f.id}"><span class="nf-img"><img src="${esc(hi(newsCover(f), 960))}" alt="" onerror="imgErr(this)" /></span><span class="reel-sh"></span>
            <span class="nf-t"><em>${esc(f.tag || "Yangilik")}</em><b>${esc(f.title)}</b><small>${esc(f.excerpt || "")}</small><small>${esc(f.date || "")} · ${readMin(f)} daq o'qish</small></span></button>
          <div class="nf-list">${rest.map((n, i) => `<button class="nf-row rv-in" data-news="${n.id}" style="--i:${i}"><span class="nf-th"><img src="${esc(hi(newsCover(n), 330))}" alt="" loading="lazy" onerror="imgErr(this)" /></span><span><em>${esc(n.tag || "Yangilik")}</em><b>${esc(n.title)}</b><small>${esc(n.date || "")} · ${readMin(n)} daq</small></span></button>`).join("")}</div>`;
      };
      el.addEventListener("click", (e) => { const c = e.target.closest("[data-nt]"); if (c) { tag = c.dataset.nt; draw(); } });
      draw();
    },
  });
}
function openNews(id) {
  const n = S.news.find((x) => x.id === id);
  if (!n) return;
  const prods = newsProducts(n), more = S.news.filter((x) => x.id !== n.id).slice(0, 4);
  const paras = String(n.body || n.excerpt || "").split(/\n\s*\n|\n(?=\d+\.)/).map((x) => x.trim()).filter(Boolean);
  push({
    noTab: true,
    html: `<header class="hdr clear phdr" id="ah"><button class="ib" data-back aria-label="Orqaga">${svg(IC.back)}</button><div class="ph-t"><b>${esc(n.title)}</b><small>${esc(n.tag || "Yangilik")}</small></div><button class="ib" data-nshare aria-label="Ulashish">${svg(IC.share)}</button></header>
      <i class="read-prog" id="rp"></i>
      <div class="sb" id="asb">
        <div class="art-hero" id="ahero"><img src="${esc(hi(newsCover(n), 960))}" alt="" onerror="imgErr(this)" /><span class="reel-sh"></span>
          <div class="art-ht"><em>${esc(n.tag || "Yangilik")}</em><h1>${esc(n.title)}</h1><small>📅 ${esc(n.date || "")} · ⏱ ${readMin(n)} daqiqa o'qish</small></div></div>
        <article class="art">
          ${n.excerpt ? `<p class="art-lead rv-in">${esc(n.excerpt)}</p>` : ""}
          ${paras.map((p, i) => `<p class="rv-in" style="--i:${i}">${esc(p)}</p>`).join("")}
          ${prods.length ? `<div class="rv-in"><div class="sec-h"><h2>🛍 Maqoladagi mahsulotlar</h2></div><div class="hscroll">${prods.map((p) => card(p)).join("")}</div></div>` : ""}
          ${more.length ? `<div class="rv-in"><div class="sec-h"><h2>📰 Boshqa yangiliklar</h2></div><div class="hscroll">${more.map((x, i) => reel(x, i)).join("")}</div></div>` : ""}
        </article>
      </div>`,
    mount(el) {
      const sb = $("#asb", el), hero = $("#ahero img", el), ah = $("#ah", el), rp = $("#rp", el);
      sb.addEventListener("scroll", () => {
        const y = sb.scrollTop;
        hero.style.transform = `translateY(${y * 0.45}px) scale(${1 + Math.min(y, 300) / 1500})`; // parallaks
        ah.classList.toggle("solid", y > 220);
        rp.style.width = Math.min(100, (y / Math.max(1, sb.scrollHeight - sb.clientHeight)) * 100) + "%";
      }, { passive: true });
      // Matn bloklari ekranga chiqqanda ketma-ket paydo bo'ladi
      const io = new IntersectionObserver((en) => en.forEach((x) => { if (x.isIntersecting) { x.target.classList.add("in"); io.unobserve(x.target); } }), { root: sb, threshold: 0.12 });
      $$(".rv-in", el).forEach((x) => io.observe(x)); el._io = io;
      $("[data-nshare]", el).onclick = () => {
        const url = `https://javohir877.github.io/OPUS-MARKET/#news-${n.id}`;
        if (navigator.share) navigator.share({ title: n.title, url }).catch(() => {}); else navigator.clipboard?.writeText(url).then(() => toast("🔗 Havola nusxalandi"));
      };
    },
    unmount(el) { el._io && el._io.disconnect(); },
  });
}

// ---------- Stories 2.0: 3D kub, barmoq bilan surish, Ken Burns, xira fon ----------
const seenStory = (id) => store.get("app_seen_stories", []).includes(id);
function storiesData() {
  const P = S.products.filter((p) => (p.stock || 0) > 0);
  const slideOf = (p, kicker) => ({ img: p.img, kicker, title: p.name, text: disc(p) ? `${fmt(p.price)} · avval ${fmt(p.old)}` : `${fmt(p.price)} · oyiga ${fmt(p.price / 12)}`, cta: { t: "Mahsulotni ko'rish", pid: p.id }, price: p });
  const out = [];
  const deals = P.filter((p) => disc(p)).sort((a, b) => disc(b) - disc(a));
  if (deals.length) out.push({ id: "deals", name: "Aksiyalar", emoji: "🔥", cover: deals[0].img, slides: deals.slice(0, 5).map((p) => slideOf(p, `🔥 −${disc(p)}% chegirma`)) });
  const fresh = P.filter((p) => p.badge === "Yangi");
  if (fresh.length) out.push({ id: "new", name: "Yangi", emoji: "🆕", cover: fresh[0].img, slides: fresh.slice(0, 5).map((p) => slideOf(p, "🆕 Yangi kelgan")) });
  if (S.news.length) out.push({ id: "news", name: "Yangiliklar", emoji: "📰", cover: newsCover(S.news[0]), slides: S.news.slice(0, 4).map((n) => ({ img: newsCover(n), kicker: n.tag || "Yangilik", title: n.title, text: n.excerpt || "", cta: { t: "O'qish", news: n.id } })) });
  out.push({ id: "nasiya", name: "Nasiya 0%", emoji: "💜", cover: (P[3] || P[0] || {}).img, slides: [
    { bg: "violet", art: "💜", kicker: "Uzum Nasiya", title: "0% bo'lib to'lash", text: "Istalgan mahsulotni 3, 6, 12 yoki 24 oyga ortiqcha foizsiz oling.", cta: { t: "Xarid qilish", list: "all" } },
    { bg: "violet", art: "🧾", kicker: "Qanday ishlaydi?", title: "1. Savatga qo'shing\n2. \"Uzum Nasiya\" ni tanlang\n3. Muddatni belgilang", text: "Operatorimiz qolganini o'zi rasmiylashtiradi." }] });
  S.cats.slice(0, 6).forEach((c) => {
    const L = P.filter((p) => p.cat === c.id).sort((a, b) => (b.popular || 0) - (a.popular || 0)).slice(0, 3);
    if (L.length) out.push({ id: "c-" + c.id, name: c.name, cover: c.img, slides: L.map((p) => slideOf(p, `⭐ ${c.name}: eng ommabop`)) });
  });
  out.push({ id: "ship", name: "Yetkazish", emoji: "🚚", cover: (P[5] || P[0] || {}).img, slides: [
    { bg: "green", art: "🚚", kicker: "Yetkazib berish", title: "Toshkent bo'ylab 24 soatda", text: `${num(S.settings.freeShipFrom || 1000000)} so'mdan yuqori xaridlarda — bepul. Viloyatlarga 2–4 kunda.` }] });
  return out;
}
let storyState = null;
function openStories(gi) {
  const groups = storiesData();
  const box = document.createElement("div");
  box.className = "story";
  document.body.appendChild(box);
  sfx("open");
  const st = storyState = { gi, si: 0, t0: 0, elapsed: 0, paused: false, raf: 0, box, groups, kb: 0 };
  const DUR = 5600;
  const markSeen = (id) => { const s = store.get("app_seen_stories", []); if (!s.includes(id)) store.set("app_seen_stories", [...s, id].slice(-40)); };
  const preload = () => { const g = groups[st.gi], nx = g.slides[st.si + 1] || (groups[st.gi + 1] || {}).slides?.[0]; if (nx && nx.img) { const im = new Image(); im.src = hi(nx.img, 960); } };
  const media = (s, g) => s.img
    ? `<div class="st-bgimg" style="background-image:url('${esc(hi(s.img, 330))}')"></div><img class="st-img kb${(st.kb++ % 3) + 1}" src="${esc(hi(s.img, 960))}" alt="" onerror="imgErr(this)" />`
    : `<div class="st-art kb1">${s.art || g.emoji || "✨"}</div><div class="st-orbs"><i></i><i></i><i></i></div>`;
  const draw = (fresh) => {
    const g = groups[st.gi], s = g.slides[st.si];
    markSeen(g.id);
    if (fresh || !$(".st-bars", box)) {
      box.innerHTML = `<div class="st-stage"></div><div class="st-bars">${g.slides.map(() => `<i><b></b></i>`).join("")}</div>
        <div class="st-top"><span class="st-av"><img src="${esc(hi(g.cover, 330))}" alt="" onerror="imgErr(this)" /></span><b>${esc(g.name)}</b><small>OPUS MARKET · hozir</small><button class="ib" data-stx aria-label="Yopish">${svg(IC.close)}</button></div>`;
    }
    $$(".st-bars b", box).forEach((b, i) => (b.style.width = i < st.si ? "100%" : "0%"));
    // Yangi slayd eskisining ustiga silliq chiqadi (crossfade)
    const stage = $(".st-stage", box), layer = document.createElement("div");
    layer.className = `st-layer ${s.bg || ""}`;
    layer.innerHTML = `<div class="st-media">${media(s, g)}</div>
      <div class="st-text"><small>${esc(s.kicker || "")}</small><h2>${esc(s.title).replace(/\n/g, "<br>")}</h2>${s.text ? `<p>${esc(s.text)}</p>` : ""}${s.cta ? `<button class="btn block" data-stcta>${esc(s.cta.t)} →</button>` : ""}</div>`;
    stage.appendChild(layer);
    const olds = $$(".st-layer", stage).slice(0, -1);
    setTimeout(() => olds.forEach((o) => o.remove()), 450);
    st.elapsed = 0; st.t0 = performance.now();
    preload();
  };
  const cube = (dir) => { box.classList.remove("cube-n", "cube-p"); void box.offsetWidth; box.classList.add(dir > 0 ? "cube-n" : "cube-p"); sfx("nav"); };
  const step = (dir) => {
    const g = groups[st.gi];
    if (dir > 0) {
      if (st.si < g.slides.length - 1) { st.si++; sfx("tick"); draw(); }
      else if (st.gi < groups.length - 1) { st.gi++; st.si = 0; cube(1); draw(true); }
      else close();
    } else {
      if (st.si > 0) { st.si--; sfx("tick"); draw(); }
      else if (st.gi > 0) { st.gi--; st.si = 0; cube(-1); draw(true); }
      else { st.elapsed = 0; st.t0 = performance.now(); }
    }
  };
  const loop = (now) => {
    if (!st.paused) {
      const p = Math.min(1, (st.elapsed + now - st.t0) / DUR);
      const bar = $$(".st-bars b", box)[st.si]; if (bar) bar.style.width = p * 100 + "%";
      if (p >= 1) step(1);
    }
    st.raf = requestAnimationFrame(loop);
  };
  const pause = () => { if (!st.paused) { st.paused = true; st.elapsed += performance.now() - st.t0; } };
  const resume = () => { if (st.paused) { st.paused = false; st.t0 = performance.now(); } };
  const close = () => { cancelAnimationFrame(st.raf); box.classList.add("out"); setTimeout(() => box.remove(), 260); storyState = null; sfx("close"); refreshRoot("home"); };
  st.close = close;
  // Barmoq bilan: yon tomonga surish — keyingi/oldingi guruh (3D), pastga — yopish, bosib turish — pauza
  let x0 = 0, y0 = 0, tDown = 0, drag = false, holdT = 0;
  box.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    x0 = e.clientX; y0 = e.clientY; tDown = Date.now(); drag = true; pause();
    holdT = setTimeout(() => box.classList.add("hold"), 220);
  });
  box.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - x0, dy = e.clientY - y0;
    if (dy > 10 && dy > Math.abs(dx)) box.style.transform = `translateY(${dy * 0.6}px) scale(${1 - Math.min(dy, 300) / 1500})`;
    else if (Math.abs(dx) > 10) box.style.transform = `perspective(1100px) rotateY(${(dx / innerWidth) * 50}deg)`, box.style.transformOrigin = dx < 0 ? "left center" : "right center";
  });
  const end = (e) => {
    if (!drag) return;
    drag = false; clearTimeout(holdT); box.classList.remove("hold");
    const dx = e.clientX - x0, dy = e.clientY - y0;
    box.style.transition = "transform .25s"; box.style.transform = "";
    setTimeout(() => (box.style.transition = ""), 260);
    if (dy > 110 && dy > Math.abs(dx)) return close();
    if (Math.abs(dx) > 70) {
      const dir = dx < 0 ? 1 : -1, g = groups[st.gi];
      if (dir > 0 && st.gi < groups.length - 1) { st.gi++; st.si = 0; cube(1); draw(true); }
      else if (dir < 0 && st.gi > 0) { st.gi--; st.si = 0; cube(-1); draw(true); }
      else if (dir > 0) return close();
      return resume();
    }
    if (Date.now() - tDown < 250 && Math.abs(dx) < 10) step(e.clientX < innerWidth / 3 ? -1 : 1);
    resume();
  };
  box.addEventListener("pointerup", end);
  box.addEventListener("pointercancel", end);
  box.addEventListener("click", (e) => {
    if (e.target.closest("[data-stx]")) return close();
    if (e.target.closest("[data-stcta]")) {
      const c = groups[st.gi].slides[st.si].cta;
      close();
      setTimeout(() => { if (c.pid) openProduct(c.pid); else if (c.news) openNews(c.news); else if (c.list) openList({ title: "🛍 Barcha mahsulotlar" }); }, 140);
    }
  });
  draw(true); st.raf = requestAnimationFrame(loop);
}


// Bosh sahifa qatorlari: tez tugaydiganlar, brendlar
function lowRow() {
  const L = S.products.filter((p) => (p.stock || 0) > 0 && p.stock <= 3).sort((a, b) => (b.popular || 0) - (a.popular || 0)).slice(0, 10);
  return L.length ? `<div class="sec"><div class="sec-h"><h2>⏳ Tez tugaydi</h2><small class="muted">ulgurib qoling</small></div><div class="hscroll">${L.map((p) => card(p, { deal: true })).join("")}</div></div>` : "";
}
function brandsRow() {
  const cnt = {};
  S.products.forEach((p) => (cnt[p.brand] = (cnt[p.brand] || 0) + 1));
  const B = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 12);
  return `<div class="sec"><div class="sec-h"><h2>🏷 Brendlar</h2></div><div class="hscroll brands">${B.map(([b, n], i) => `<button class="brand-c" data-brand-q="${esc(b)}" style="--h:${(i * 47) % 360}"><b>${esc(b)}</b><small>${n} ta</small></button>`).join("")}</div></div>`;
}
const ROOTS = { home: homeScreen, catalog: catalogScreen, cart: cartScreen, fav: favScreen, profile: profileScreen };
matchMedia("(prefers-color-scheme: light)").addEventListener("change", applyTheme);
applyTheme();
badges();
switchTab("home");
// Ilova boshqa joydan (sayt) o'zgargan savatni ko'rsin
addEventListener("storage", (e) => { if (e.key === "opus_cart") { S.cart = store.get("cart", []); badges(); refreshRoot("cart"); } });
// Yangi katalog: narx/ombor o'zgargan bo'lishi mumkin
loadCatalog().then(() => { refreshRoot("home"); refreshRoot("catalog"); badges(); }).catch(() => {});
loadRv().then(() => { refreshRoot("home"); refreshRoot("fav"); }).catch(() => {});
if (auth.token) api("GET", "/api/me").then((r) => setAuth(auth.token, r.user)).catch(() => {});
document.addEventListener("visibilitychange", () => { if (!document.hidden && Date.now() - (window.__lastSync || 0) > 120e3) { window.__lastSync = Date.now(); loadCatalog().then(() => tab === "home" && stacks.home.length === 1 && refreshRoot("home")).catch(() => {}); } });
// Telefon brauzerida ham: tizimning "orqaga" ishorasi stekni yopsin
// (Android ilovasida "Orqaga" tugmasini MainActivity o'zi __opusBack orqali boshqaradi)
if (VERSION === "web") {
  history.pushState({ app: 1 }, "");
  addEventListener("popstate", () => { if (window.__opusBack()) history.pushState({ app: 1 }, ""); });
}

// ---------- v2.2: ekranlarga qo'shimchalar ----------
// Savat: qatorlarni surib o'chirish
{
  const base = ROOTS.cart;
  ROOTS.cart = () => {
    const d = base(), m = d.mount;
    d.mount = (el) => {
      m && m(el);
      $$(".ci-row", el).forEach((r) => { const w = document.createElement("div"); w.className = "ci-wrap"; w.innerHTML = `<span class="ci-bg">🗑 O'chirish</span>`; r.replaceWith(w); w.appendChild(r); });
      enableSwipe(el);
      const hint = $(".ci-wrap", el);
      if (hint && !store.get("app_swipe_hint", false)) { store.set("app_swipe_hint", true); const r = $(".ci-row", hint); r.classList.add("hint"); }
    };
    return d;
  };
}
// Kabinet: bildirishnomalar, ko'rilganlar, ovoz va tebranish
{
  const base = ROOTS.profile;
  ROOTS.profile = () => {
    const d = base(), m = d.mount;
    d.mount = (el) => {
      m && m(el);
      const th = $('[data-m="theme"]', el);
      if (!th) return;
      const un = notifs().filter((n) => !n.read).length;
      const snd = window.SFX ? SFX.on : false, vib = window.SFX ? SFX.haptic : true;
      th.closest(".menu").insertAdjacentHTML("beforebegin", `<div class="menu">
        <button class="mi" data-x="notifs"><span class="ri">🔔</span><span>Bildirishnomalar</span>${un ? `<i class="cnt">${un}</i>` : ""}</button>
        <button class="mi" data-x="recent"><span class="ri">👀</span><span>Ko'rilgan mahsulotlar</span><small>${S.recent.length || ""}</small></button>
        <button class="mi" data-x="compare"><span class="ri">⚖️</span><span>Taqqoslash</span><small>${S.compare.length || ""}</small></button>
        <button class="mi" data-x="news"><span class="ri">📰</span><span>Yangiliklar</span><small>${S.news.length || ""}</small></button>
        ${window.SFX ? `<button class="mi noarrow" data-x="sound"><span class="ri">🔊</span><span>Ovoz effektlari</span><span class="sw${snd ? " on" : ""}"></span></button>
        <button class="mi noarrow" data-x="vib"><span class="ri">📳</span><span>Tebranish</span><span class="sw${vib ? " on" : ""}"></span></button>` : ""}
      </div>`);
      el.addEventListener("click", (e) => {
        const b = e.target.closest("[data-x]"); if (!b) return;
        const k = b.dataset.x;
        if (k === "notifs") openNotifs();
        if (k === "compare") openCompare();
        if (k === "news") openNewsFeed();
        if (k === "recent") openList({ title: "👀 Ko'rilganlar", ids: S.recent.slice(), keepOrder: true });
        if (k === "sound") { SFX.toggle(); $(".sw", b).classList.toggle("on", SFX.on); }
        if (k === "vib") { SFX.setHaptic(!SFX.haptic); $(".sw", b).classList.toggle("on", SFX.haptic); }
      });
    };
    return d;
  };
}
// Ishga tushirish: tanishuv, narxlar, buyurtmalar holati
checkDrops();
onboarding();
syncOrders().catch(() => {});
// Vidjetdan ochilgan bo'lsa — to'g'ridan-to'g'ri "Buyurtmalarim"
function openFromHash() {
  if (location.hash !== "#orders") return;
  history.replaceState(history.state, "", location.pathname + location.search);
  if (!auth.token) return switchTab("profile");
  switchTab("profile"); openOrders("active");
}
openFromHash();
addEventListener("hashchange", openFromHash);
// Kirish animatsiyasini yopamiz (kamida ~900ms ko'rinsin)
(function () {
  const el = document.getElementById("intro"); if (!el) return;
  const wait = Math.max(0, 950 - (performance.now() - (window.__introT || 0)));
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 600); }, wait);
})();
setInterval(() => { if (!document.hidden) syncOrders().catch(() => {}); }, 60000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) syncOrders().catch(() => {}); });

// =====================================================================
// ---------- v2.4: silliqlik, kompyuter yig'ish, tezkor ko'rish ----------
// =====================================================================
// Tab almashganda yo'nalishga qarab suriladi; qayta chizilgan ekranlar kartochkalarni qayta "o'ynatmaydi"
{
  const _switch = switchTab, _refresh = refreshRoot;
  switchTab = function (t, reset) {
    const from = TABS.indexOf(tab), had = tab;
    _switch(t, reset);
    moveInd();
    if (had && had !== t) { const top = current(); top.classList.remove("fade", "tab-l", "tab-r"); void top.offsetWidth; top.classList.add(TABS.indexOf(t) > from ? "tab-r" : "tab-l"); setTimeout(() => top.classList.remove("tab-l", "tab-r"), 300); }
  };
  refreshRoot = function (t) { _refresh(t); const el = stacks[t][0]; if (el) el.classList.add("quiet"); };
}
// Tab panelidagi suzuvchi indikator
const tbInd = document.createElement("i"); tbInd.className = "tb-ind"; $("#tabbar").appendChild(tbInd);
function moveInd() { const i = TABS.indexOf(tab); if (i >= 0) tbInd.style.transform = `translateX(${i * 100}%)`; }
moveInd();

// Chap chetdan surib orqaga qaytish (barmoq ortidan yuradi)
(function edgeSwipe() {
  let el = null, prev = null, x0 = 0, y0 = 0, dx = 0, t0 = 0, lock = null;
  const W = () => stage.clientWidth;
  const set = (x) => { el.style.transform = `translateX(${x}px)`; prev.style.transform = `translateX(${-0.22 * W() + 0.22 * x}px)`; prev.style.opacity = 0.6 + 0.4 * (x / W()); };
  stage.addEventListener("touchstart", (e) => {
    const s = stacks[tab]; if (!s || s.length < 2 || !$("#sheet").hidden) return;
    const t = e.touches[0]; if (t.clientX > 24) return;
    el = s[s.length - 1]; prev = s[s.length - 2]; x0 = t.clientX; y0 = t.clientY; dx = 0; t0 = Date.now(); lock = null;
  }, { passive: true });
  stage.addEventListener("touchmove", (e) => {
    if (!el) return;
    const t = e.touches[0], mx = t.clientX - x0, my = t.clientY - y0;
    if (lock == null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) {
      lock = mx > Math.abs(my) ? "x" : "y";
      if (lock === "y") { el = prev = null; return; }
      prev.classList.add("peek"); el.classList.add("dragging"); prev.classList.add("dragging");
    }
    if (lock !== "x") return;
    dx = Math.max(0, mx); set(dx);
  }, { passive: true });
  const end = () => {
    if (!el || lock !== "x") { el = prev = null; return; }
    const a = el, b = prev, v = dx / Math.max(1, Date.now() - t0), go = dx > W() * 0.35 || v > 0.6;
    el = prev = null;
    [a, b].forEach((x) => { x.classList.remove("dragging"); x.style.transition = "transform .24s cubic-bezier(.2,.8,.2,1), opacity .24s"; });
    if (go) { a.style.transform = `translateX(${W()}px)`; b.style.transform = "translateX(0)"; b.style.opacity = 1; }
    else { a.style.transform = ""; b.style.transform = `translateX(${-0.22 * W()}px)`; b.style.opacity = 0.6; }
    setTimeout(() => {
      [a, b].forEach((x) => { x.style.transition = x.style.transform = x.style.opacity = ""; });
      b.classList.remove("peek");
      if (!go) return;
      const s = stacks[tab]; if (s[s.length - 1] !== a) return;
      haptic(5); window.sfx && sfx("back");
      s.pop(); b.removeAttribute("inert");
      a._def.unmount && a._def.unmount(a); a.remove();
      b._def.onShow && b._def.onShow(b); syncTabbar();
    }, 250);
  };
  stage.addEventListener("touchend", end); stage.addEventListener("touchcancel", end);
})();

// Pastki oynani pastga tortib yopish
(function sheetDrag() {
  const sh = $("#sheet"); let y0 = null, dy = 0;
  sh.addEventListener("touchstart", (e) => { if (sh.scrollTop > 0) return; y0 = e.touches[0].clientY; dy = 0; }, { passive: true });
  sh.addEventListener("touchmove", (e) => { if (y0 == null) return; dy = e.touches[0].clientY - y0; if (dy < 0 || sh.scrollTop > 0) { dy = 0; return; } sh.style.transition = "none"; sh.style.transform = `translateY(${dy}px)`; }, { passive: true });
  sh.addEventListener("touchend", () => { if (y0 == null) return; y0 = null; sh.style.transition = sh.style.transform = ""; if (dy > 110) closeSheet(); });
})();

// Kartochkani bosib turish — tezkor ko'rish
(function quickPeek() {
  let tm = null, sx = 0, sy = 0, fired = false;
  document.addEventListener("touchstart", (e) => {
    const c = e.target.closest(".pc[data-pid], .rc[data-pid], .t10[data-pid]"); fired = false;
    if (!c || e.target.closest("[data-add], [data-fav], [data-cmp]")) return;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    c.classList.add("holding");
    tm = setTimeout(() => { tm = null; fired = true; c.classList.remove("holding"); haptic(18); quickView(+c.dataset.pid); }, 460);
    const clear = () => { clearTimeout(tm); tm = null; c.classList.remove("holding"); };
    c.addEventListener("touchend", clear, { once: true }); c.addEventListener("touchcancel", clear, { once: true });
  }, { passive: true });
  document.addEventListener("touchmove", (e) => { if (tm && Math.hypot(e.touches[0].clientX - sx, e.touches[0].clientY - sy) > 10) { clearTimeout(tm); tm = null; $$(".holding").forEach((x) => x.classList.remove("holding")); } }, { passive: true });
  document.addEventListener("click", (e) => { if (fired) { fired = false; e.stopPropagation(); e.preventDefault(); } }, true);
  document.addEventListener("contextmenu", (e) => { if (e.target.closest("[data-pid]")) e.preventDefault(); });
})();
function quickView(id) {
  const p = byId(id); if (!p) return;
  const d = disc(p), out = (p.stock || 0) <= 0;
  openSheet(`<div class="qv">
      <div class="qv-img"><img src="${esc(hi(p.img, 500))}" alt="" onerror="imgErr(this)" />${d ? `<span class="tag">−${d}%</span>` : ""}</div>
      <small class="muted">${esc(p.brand)} · ${esc(catOf(p.cat).name)}</small>
      <h3>${esc(p.name)}</h3>
      <div class="qv-row"><b>${fmt(p.price)}</b>${d ? `<s>${num(p.old)}</s>` : ""}<span class="pc-r">${rateTxt(p)}</span></div>
      <p class="muted qv-st">${out ? "⛔ Hozircha tugagan" : `✓ Omborda bor · ${num(p.price / 12)} so'm/oydan`}</p>
      <div class="qv-btns"><button class="btn ghost" data-qv="fav">${S.fav.includes(p.id) ? "💔 Olib tashlash" : "❤️ Saralash"}</button><button class="btn ghost" data-qv="open">Batafsil</button><button class="btn" data-qv="add" ${out ? "disabled" : ""}>${inCart(p.id) ? "✓ Savatda" : "🛒 Savatga"}</button></div>
    </div>`, (b) => b.addEventListener("click", (e) => {
    const k = e.target.closest("[data-qv]"); if (!k) return;
    const a = k.dataset.qv;
    if (a === "open") { closeSheet(); openProduct(p.id); }
    if (a === "fav") { toggleFav(p.id); closeSheet(); refreshCards(); }
    if (a === "add") { if (inCart(p.id)) { closeSheet(); switchTab("cart"); return; } if (addToCart(p.id)) { k.textContent = "✓ Savatda"; refreshCards(); setTimeout(closeSheet, 350); } }
  }));
}

// ---------- Kompyuter yig'ish (konfigurator) ----------
const PC_SLOTS = [
  { k: "cpu", t: "Protsessor", e: "🧠", m: (p) => p.cat === "parts" && /\b(Core i\d|Ryzen|Xeon)\b/i.test(p.name) },
  { k: "mb", t: "Ona plata", e: "🔲", m: (p) => p.cat === "parts" && /\b[ZBXH]\d{3}\b|motherboard|ona plata/i.test(p.name) },
  { k: "gpu", t: "Videokarta", e: "🎮", m: (p) => p.cat === "parts" && /RTX|GTX|Radeon|GeForce|Arc A\d/i.test(p.name) },
  { k: "ram", t: "Operativ xotira", e: "⚡", m: (p) => p.cat === "parts" && /\bDDR\d/i.test(p.name) },
  { k: "ssd", t: "Disk (SSD/HDD)", e: "💾", m: (p) => p.cat === "storage" && /NVMe|SSD|BarraCuda|A400|HDD/i.test(p.name) && !/Portable|Passport|Expansion|microSD|fleshka/i.test(p.name) },
  { k: "psu", t: "Blok pitaniya", e: "🔌", m: (p) => p.cat === "parts" && /\b\d{3,4}\s?W\b/i.test(p.name) },
  { k: "cool", t: "Sovutish", e: "❄️", m: (p) => p.cat === "parts" && /Noctua|NH-|cooler|kuler|AIO|Kraken/i.test(p.name) },
];
// Moslik: faqat aniq ma'lum bo'lgan holatlar tekshiriladi
const cpuSock = (n) => /i\d-1[2-4]\d{3}/i.test(n) ? "LGA1700" : /i\d-[89]\d{3}/i.test(n) ? "LGA1151" : /Ryzen \d \d{4}/i.test(n) ? (+n.match(/Ryzen \d (\d)\d{3}/i)[1] >= 7 ? "AM5" : "AM4") : null;
const mbSock = (n) => /\b[ZBH](3[67]0|390|360)\b/.test(n) ? "LGA1151" : /\b[ZBH](6[69]0|7[69]0)\b/.test(n) ? "LGA1700" : /\b[BX](4[57]0|5[57]0)\b/.test(n) ? "AM4" : /\b[BX](6[57]0|8[57]0)\b/.test(n) ? "AM5" : null;
const memOf = (n) => (n.match(/DDR(\d)/i) || [])[1];
const GPU_PSU = [[/5090/, 1000], [/4090/, 850], [/4080/, 750], [/7900 XTX/i, 800], [/7900 XT\b/i, 750], [/6800 XT/i, 750], [/4070 Ti/i, 700], [/4070/, 650], [/4060/, 550], [/3060/, 550]];
function pcCheck(b) {
  const P = (k) => b[k] && byId(b[k]), W = [];
  const cpu = P("cpu"), mb = P("mb"), ram = P("ram"), gpu = P("gpu"), psu = P("psu");
  if (cpu && mb) { const a = cpuSock(cpu.name), c = mbSock(mb.name); if (a && c && a !== c) W.push(`Protsessor (${a}) va ona plata (${c}) razyomi mos emas`); }
  if (mb && ram) { const s = mbSock(mb.name), r = memOf(ram.name), need = s === "LGA1151" || s === "AM4" ? "4" : s === "AM5" ? "5" : null; if (need && r && r !== need) W.push(`Ona plata DDR${need} xotirani qo'llaydi, tanlangani DDR${r}`); }
  if (gpu && psu) { const g = GPU_PSU.find(([re]) => re.test(gpu.name)), w = +(psu.name.match(/(\d{3,4})\s?W/i) || [])[1]; if (g && w && w < g[1]) W.push(`Bu videokarta uchun kamida ${g[1]}W blok tavsiya etiladi (tanlangan: ${w}W)`); }
  return W;
}
function openBuilder() {
  const b = store.get("app_build", {});
  Object.keys(b).forEach((k) => { if (!byId(b[k])) delete b[k]; });
  const save = () => store.set("app_build", b);
  push({
    noTab: true,
    html: hdr("🛠 Kompyuter yig'ish", `<button class="ib" data-bclear aria-label="Tozalash">${svg(IC.trash)}</button>`) + `<div class="sb" id="bSb"></div><div class="bbar" id="bBar"></div>`,
    mount(el) {
      const draw = () => {
        const items = PC_SLOTS.map((s) => ({ s, p: b[s.k] && byId(b[s.k]) }));
        const sum = items.reduce((a, x) => a + (x.p ? x.p.price : 0), 0), n = items.filter((x) => x.p).length, warn = pcCheck(b);
        $("#bSb", el).innerHTML = `<div class="b-hero"><div class="b-ring" style="--p:${(n / PC_SLOTS.length) * 100}%"><b>${n}/${PC_SLOTS.length}</b></div><div><h2>O'z kompyuteringizni yig'ing</h2><p class="muted">Har bir bo'limdan ehtiyot qism tanlang — narx va moslik shu yerda ko'rinadi.</p></div></div>
          ${warn.length ? `<div class="b-warn">${warn.map((w) => `<p>⚠️ ${esc(w)}</p>`).join("")}</div>` : n >= 2 ? `<div class="b-ok">✓ Tanlangan qismlarda ma'lum nomuvofiqlik topilmadi</div>` : ""}
          <div class="slots">${items.map(({ s, p }, i) => `<button class="slot${p ? " on" : ""}" data-slot="${s.k}" style="animation-delay:${i * 40}ms"><span class="sl-i">${p ? `<img src="${esc(hi(p.img, 330))}" alt="" onerror="imgErr(this)" />` : s.e}</span><span class="sl-t"><small>${s.t}</small><b>${p ? esc(p.name) : "Tanlash"}</b>${p ? `<em>${fmt(p.price)}</em>` : ""}</span>${p ? `<i class="sl-x" data-unset="${s.k}">✕</i>` : `<i class="sl-plus">+</i>`}</button>`).join("")}</div>
          <p class="muted b-note">Moslik faqat razyom, xotira turi va blok quvvati bo'yicha tekshiriladi. Savollar bo'lsa, operatorimiz yordam beradi.</p>`;
        $("#bBar", el).innerHTML = `<div><small class="muted">Jami · ${n} ta qism</small><b>${fmt(sum)}</b>${sum ? `<small class="muted">${num(sum / 12)} so'm/oydan</small>` : ""}</div><button class="btn" data-ball ${n ? "" : "disabled"}>🛒 Savatga</button>`;
      };
      const pick = (s) => {
        const L = S.products.filter(s.m).sort((x, y) => ((y.stock || 0) > 0) - ((x.stock || 0) > 0) || x.price - y.price);
        openSheet(`<h3>${s.e} ${s.t}</h3>${L.length ? `<div class="pick">${L.map((p) => { const out = (p.stock || 0) <= 0; return `<button class="pk${b[s.k] === p.id ? " on" : ""}" data-pk="${p.id}" ${out ? "disabled" : ""}><img src="${esc(hi(p.img, 330))}" alt="" onerror="imgErr(this)" /><span><b>${esc(p.name)}</b><small>${out ? "Tugagan" : fmt(p.price)}</small></span></button>`; }).join("")}</div>` : `<p class="muted">Hozircha bu bo'limda mahsulot yo'q.</p>`}`, (sb) =>
          sb.addEventListener("click", (e) => { const k = e.target.closest("[data-pk]"); if (!k) return; b[s.k] = +k.dataset.pk; save(); haptic(8); closeSheet(); draw(); }));
      };
      el.addEventListener("click", (e) => {
        const u = e.target.closest("[data-unset]"); if (u) { e.stopPropagation(); delete b[u.dataset.unset]; save(); draw(); return; }
        const s = e.target.closest("[data-slot]"); if (s) { pick(PC_SLOTS.find((x) => x.k === s.dataset.slot)); return; }
        if (e.target.closest("[data-bclear]")) { Object.keys(b).forEach((k) => delete b[k]); save(); draw(); return; }
        if (e.target.closest("[data-ball]")) {
          let ok = 0; Object.values(b).forEach((id) => { if (!inCart(id) && addToCart(id, 1, true)) ok++; });
          refreshCards(); badges(); toast(ok ? `🛒 ${ok} ta qism savatga qo'shildi` : "✓ Hammasi allaqachon savatda", { t: "Savat", fn: () => switchTab("cart") });
        }
      });
      draw();
    },
  });
}

// ---------- Byudjetga mos ----------
function openBudget() {
  const P = S.products.filter((p) => (p.stock || 0) > 0);
  const max = Math.max(...P.map((p) => p.price));
  let cat = "", val = Math.min(max, store.get("app_budget", 5e6));
  const steps = [500e3, 1e6, 3e6, 5e6, 10e6, 20e6];
  const count = () => P.filter((p) => p.price <= val && (!cat || p.cat === cat)).length;
  openSheet(`<h3>💰 Byudjetga mos</h3><p class="muted" style="margin:-6px 0 14px">Qancha sarflamoqchisiz?</p>
    <div class="bud-v" id="bv"></div><input type="range" class="bud-r" id="br" min="100000" max="${max}" step="50000" value="${val}" />
    <div class="chips bud-q">${steps.filter((x) => x < max).map((x) => `<button class="chip" data-bq="${x}">${x >= 1e6 ? x / 1e6 + " mln" : x / 1e3 + " ming"}</button>`).join("")}</div>
    <div class="chips bud-c"><button class="chip on" data-bc="">Hammasi</button>${S.cats.map((c) => `<button class="chip" data-bc="${esc(c.id)}">${esc(c.name)}</button>`).join("")}</div>
    <button class="btn block" id="bgo"></button>`, (b) => {
    const upd = () => { $("#bv", b).textContent = fmt(val); $("#br", b).value = val; $("#br", b).style.setProperty("--f", ((val - 100000) / (max - 100000)) * 100 + "%"); $("#bgo", b).textContent = `${count()} ta mahsulotni ko'rish`; };
    $("#br", b).addEventListener("input", (e) => { val = +e.target.value; upd(); });
    b.addEventListener("click", (e) => {
      const q = e.target.closest("[data-bq]"); if (q) { val = +q.dataset.bq; haptic(5); upd(); }
      const c = e.target.closest("[data-bc]"); if (c) { cat = c.dataset.bc; $$("[data-bc]", b).forEach((x) => x.classList.toggle("on", x === c)); upd(); }
    });
    $("#bgo", b).onclick = () => { store.set("app_budget", val); closeSheet(); const v = val, c = cat; openList({ title: `💰 ${fmt(v)} gacha`, filter: (p) => p.price <= v && (p.stock || 0) > 0 && (!c || p.cat === c), sort: "popular" }); };
    upd();
  });
}

// Bosh sahifadagi "Asboblar" qatori
function toolsRow() {
  const T = [["build", "🛠", "Kompyuter yig'ish", "o'zingiz tanlang"], ["budget", "💰", "Byudjetga mos", "narx bo'yicha"], ["cmp", "⚖️", "Taqqoslash", S.compare.length ? `${S.compare.length} ta tanlangan` : "2–4 mahsulot"], ["orders", "📦", "Buyurtmalarim", "holatini kuzating"]];
  return `<div class="sec"><div class="tools">${T.map(([k, e, t, s], i) => `<button class="tool t-${k}" data-tool="${k}" style="animation-delay:${i * 50}ms"><em>${e}</em><b>${t}</b><small>${esc(s)}</small></button>`).join("")}</div></div>`;
}
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-tool]"); if (!t) return;
  const k = t.dataset.tool;
  if (k === "build") openBuilder();
  if (k === "budget") openBudget();
  if (k === "cmp") S.compare.length ? openCompare() : toast("⚖️ Mahsulot sahifasida \"Taqqoslash\" tugmasini bosing");
  if (k === "orders") requireAuth(() => { switchTab("profile"); openOrders(); });
});
refreshRoot("home");
