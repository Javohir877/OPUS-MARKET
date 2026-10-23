// ================= OPUS MARKET =================
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

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
function setAuth(token, user) {
  auth.token = token || null;
  auth.user = token ? user : null;
  store.set("token", auth.token);
  store.set("user", auth.user);
  if (!token) state.orders = [];
  renderAccBtn();
}
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

// ---------- Loader ----------
setTimeout(() => $("#loader").classList.add("hide"), 1400);

// ---------- Theme ----------
const applyTheme = (t) => { document.documentElement.dataset.theme = t; store.set("theme", t); };
applyTheme(store.get("theme", matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
$("#themeBtn").addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));

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
$("#heroImg").src = IMG(HERO_IMG, 900, 560);
$("#dealsImg").style.backgroundImage = "url(img/deals.jpg)";

(() => {
  const words = ["sizning qo'lingizda", "o'yinlar uchun", "ish uchun", "o'qish uchun"];
  const el = $("#typed");
  let w = 0, i = 0, del = false;
  (function tick() {
    const word = words[w];
    el.textContent = word.slice(0, i);
    if (!del && i < word.length) i++;
    else if (del && i > 0) i--;
    else if (!del) { del = true; return setTimeout(tick, 1600); }
    else { del = false; w = (w + 1) % words.length; }
    setTimeout(tick, del ? 45 : 90);
  })();
})();

(() => {
  const box = $("#particles");
  box.innerHTML = Array.from({ length: 22 }, () => {
    const s = 3 + Math.random() * 5;
    return `<span style="left:${Math.random() * 100}%;width:${s}px;height:${s}px;--dx:${(Math.random() - 0.5) * 200}px;animation-duration:${8 + Math.random() * 10}s;animation-delay:${-Math.random() * 15}s"></span>`;
  }).join("");
})();

(() => {
  const card = $("#tiltCard");
  const wrap = card.parentElement;
  wrap.addEventListener("mousemove", (e) => {
    const r = wrap.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    card.style.transform = `rotateY(${x * 22}deg) rotateX(${-y * 18}deg)`;
  });
  wrap.addEventListener("mouseleave", () => (card.style.transform = ""));
})();

// ---------- Reveal + counters ----------
const io = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (!en.isIntersecting) return;
    en.target.classList.add("visible");
    $$("[data-count]", en.target).forEach(countUp);
    io.unobserve(en.target);
  });
}, { threshold: 0.12 });
$$(".reveal").forEach((el, i) => { el.style.transitionDelay = (i % 4) * 0.08 + "s"; io.observe(el); });

function countUp(el) {
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

function renderCategories() {
  $("#catGrid").innerHTML = CATEGORIES.map((c) => {
    const n = PRODUCTS.filter((p) => p.cat === c.id).length;
    return `<div class="cat reveal" data-cat="${c.id}">
      <img src="${IMG(c.img, 500, 360)}" alt="${c.name}" loading="lazy" />
      <span class="cat-ic">${svgIcon(c.icon)}</span>
      <div><h4>${c.name}</h4><small>${n} ta mahsulot</small></div>
      <span class="cat-arrow">→</span>
    </div>`;
  }).join("");
  $$("#catGrid .cat").forEach((el) => {
    io.observe(el);
    el.addEventListener("click", () => { setCat(el.dataset.cat); $("#products").scrollIntoView(); });
    // Rasmning asosiy rangini topib, hover gradientini shu rangda qilamiz
    const im = $("img", el);
    const apply = () => { const t = imageTint(im); if (t) { el.style.setProperty("--tint", t.tint); el.style.setProperty("--tint-deep", t.deep); el.classList.add("tinted"); } };
    if (im.complete && im.naturalWidth) apply(); else im.addEventListener("load", apply, { once: true });
  });

  $("#chips").innerHTML = [`<button class="chip active" data-cat="all">Barchasi</button>`]
    .concat(CATEGORIES.map((c) => `<button class="chip" data-cat="${c.id}">${c.name}</button>`)).join("");
  $$("#chips .chip").forEach((b) => b.addEventListener("click", () => setCat(b.dataset.cat)));
}
function setCat(cat) {
  state.cat = cat;
  state.dealsOnly = false;
  $$("#chips .chip").forEach((b) => b.classList.toggle("active", b.dataset.cat === cat));
  renderProducts();
}

// ---------- Products ----------
const haystack = (p) => (p.name + " " + p.brand + " " + catOf(p).name + " " + Object.values(p.specs).join(" ")).toLowerCase();
function search(q) {
  q = q.trim().toLowerCase();
  if (!q) return PRODUCTS.slice();
  const words = q.split(/\s+/);
  return PRODUCTS.filter((p) => { const h = haystack(p); return words.every((w) => h.includes(w)); });
}

function filtered() {
  let list = search(state.query).filter((p) =>
    (state.cat === "all" || p.cat === state.cat) &&
    (state.maxPrice >= MAX_PRICE || p.price <= state.maxPrice) && // eng o'ngda — cheklanmagan
    (!state.dealsOnly || p.old)
  );
  const sorters = {
    popular: (a, b) => b.popular - a.popular,
    cheap: (a, b) => a.price - b.price,
    expensive: (a, b) => b.price - a.price,
    rating: (a, b) => b.rating - a.rating,
    discount: (a, b) => discount(b) - discount(a),
  };
  return list.sort(sorters[state.sort]);
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
      <span class="card-brand">${p.brand}</span>
      <span class="quick">👁 Tezkor ko'rish</span>
    </div>
    <button class="cmp ${compared ? "on" : ""}" data-cmp title="Solishtirish">${CMP_ICON}</button>
    <div class="card-body">
      <h4 data-open>${p.name}</h4>
      <div class="rating">${stars(p.rating)} <small>${p.rating} (${p.reviews})</small></div>
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
  const sig = [state.cat, state.query, state.maxPrice, state.sort, state.dealsOnly].join("|");
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
  const catName = state.cat === "all" ? "Barcha mahsulotlar" : CATEGORIES.find((c) => c.id === state.cat).name;
  $("#resultInfo").textContent = `${state.dealsOnly ? "Chegirmadagi mahsulotlar" : catName} — ${list.length} ta topildi`;
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
  const list = search(q).sort((a, b) => b.popular - a.popular);
  sgIndex = -1;
  suggest.innerHTML = list.length
    ? list.slice(0, 6).map((p) => `<div class="sg-item" data-id="${p.id}">
        <img src="${pImg(p, 250)}" alt="" />
        <div><b>${highlight(p.name, q)}</b><small>${fmt(p.price)}</small></div>
      </div>`).join("") + `<button class="sg-all">Barcha natijalar (${list.length}) →</button>`
    : `<div class="sg-empty">"${escapeHtml(q)}" bo'yicha hech narsa topilmadi</div>`;
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
});
document.addEventListener("click", (e) => { if (!e.target.closest("#searchBox")) suggest.hidden = true; });

// ---------- Filters ----------
const range = $("#priceRange");
range.max = MAX_PRICE;
range.value = state.maxPrice;
const updatePriceLabel = () => ($("#priceLabel").textContent = +range.value >= MAX_PRICE ? "Cheklanmagan" : fmt(+range.value));
updatePriceLabel();
range.addEventListener("input", () => { state.maxPrice = +range.value; updatePriceLabel(); renderProducts(); });
$("#sortSelect").addEventListener("change", (e) => { state.sort = e.target.value; renderProducts(); });
$("[data-filter-deal]").addEventListener("click", () => {
  setCat("all");
  state.dealsOnly = true;
  state.sort = "discount";
  $("#sortSelect").value = "discount";
  renderProducts();
});
$("#resetFilters").addEventListener("click", () => {
  state.query = ""; searchInput.value = "";
  state.maxPrice = MAX_PRICE; range.value = MAX_PRICE; updatePriceLabel();
  state.sort = "popular"; $("#sortSelect").value = "popular";
  setCat("all");
});

// ---------- Product modal ----------
function openProduct(id) {
  const p = byId(id);
  const c = catOf(p);
  let qty = 1;
  let months = 12;
  // Asosiy rasm + qo'shimcha haqiqiy fotolar (agar bo'lsa)
  const sources = [p.img, ...(p.gallery || [])];
  const views = sources.map((s) => IMG(s, 960));
  const credits = sources.map(CREDIT);
  $("#productModalBody").innerHTML = `<div class="pm">
    <div class="pm-gallery">
      <div class="pm-main" id="pmMain"><img src="${views[0]}" alt="${escapeHtml(p.name)}" data-icon="${c.icon}" onerror="imgFail(this)" /></div>
      ${views.length > 1 ? `<div class="pm-thumbs">${sources.map((s, i) => `<button class="${i === 0 ? "active" : ""}" data-v="${i}"><img src="${IMG(s, 250)}" alt="" /></button>`).join("")}</div>` : ""}
      ${credits[0] ? `<a class="pm-credit" id="pmCredit" href="${credits[0]}" target="_blank" rel="noopener">📷 Foto: Wikimedia Commons — muallif va litsenziya</a>` : ""}
      <div class="pm-pay">${PAYMENTS.map(payLogo).join("")}</div>
    </div>
    <div>
      <div class="pm-badges"><span class="pill">${c.name} · ${p.brand}</span>${p.original !== false ? `<span class="tag orig">${ORIG_ICON}Original</span>` : ""}</div>
      <h2>${p.name}</h2>
      <div class="rating">${stars(p.rating)} <small>${p.rating} · ${p.reviews} ta sharh</small></div>
      <p style="margin-top:10px">${p.desc}</p>
      <table class="specs">${Object.entries(p.specs).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("")}</table>
      ${p.old ? `<span class="old">${fmt(p.old)}</span>` : ""}
      <div class="price">${fmt(p.price)}</div>
      <div class="pm-install">
        Bo'lib to'lash (Uzum Nasiya, 0%): <b class="big" id="pmMonthly"></b>
        <div class="months" id="pmMonths">${MONTHS.map((m) => `<button data-m="${m}" class="${m === months ? "active" : ""}">${m} oy</button>`).join("")}</div>
      </div>
      <div class="stock">✔ Omborda: ${p.stock} dona · 🛡 Rasmiy kafolat</div>
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
      <div><b>${p.name}</b><small>${fmt(p.price)}</small></div>
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
  if (srcEl) flyToCart(srcEl, p);
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
  saveCart(); renderCart(); updateBadges();
}

function removeFromCart(id) {
  const el = $(`#cartItems [data-id="${id}"]`);
  const done = () => {
    state.cart = state.cart.filter((x) => x.id !== id);
    saveCart(); renderCart(); updateBadges(); renderProducts();
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
        <h5>${p.name}</h5><b>${fmt(p.price * qty)}</b>
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
      mountConfirm(slot, o, r, () => { renderOrders(); confetti(160); });
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
  closeAll(true);
  el.classList.add("open");
  overlay.classList.add("show");
  document.body.classList.add("lock");
}
function closeAll(keepOverlay) {
  $$(".drawer.open, .modal.open").forEach((x) => x.classList.remove("open"));
  if (!keepOverlay) { overlay.classList.remove("show"); document.body.classList.remove("lock"); }
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
    mountConfirm($("#confirmBox"), order, confirm, (done) => { showPaid(done, pay, true); confetti(240); });
    return;
  }
  showPaid(order, pay);
  confetti(240);
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
    inp.addEventListener("input", () => { inp.value = inp.value.replace(/D/g, "").slice(0, 6); if (inp.value.length === 6) f.requestSubmit(); });
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
$("#newsForm").addEventListener("submit", (e) => {
  e.preventDefault();
  e.target.reset();
  toast("📬 Obuna uchun rahmat! Promo-kod: YANGI5");
  confetti(60);
});

// ---------- Toast ----------
function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  $("#toasts").appendChild(el);
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 300); }, 2600);
}

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
function confetti(n = 150) {
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
          ${row("Reyting", list.map((p) => ({ v: "★ " + p.rating, best: p.rating === maxRating })))}
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

  // iPhone ekranidagi do'kon: eng ommabop 4 ta mahsulot
  $("#ipCards").innerHTML = PRODUCTS.slice().sort((a, b) => b.popular - a.popular).slice(0, 4).map((p) =>
    `<div class="ip-card"><img src="${pImg(p)}" alt="" loading="lazy" /><div><b>${escapeHtml(p.name)}</b><span>${fmt(p.price).replace(" so'm", "")}</span></div></div>`).join("");
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
    state.cart = state.cart.filter((x) => byId(x.id));
    if (state.promo && !PROMOS[state.promo]) state.promo = null;
    if (SETTINGS.topbar) $("#topbarText").textContent = SETTINGS.topbar;
    if (SETTINGS.dealTitle) $("#dealTitle").textContent = SETTINGS.dealTitle;
    renderCategories(); renderProducts(); renderCart(); renderRecent(); renderCompareBar(); renderNews(); updateBadges();
  } catch {}
}

// ---------- Admin: oldindan ko'rish ----------
if (window.OPUS_PREVIEW) { $("#previewBar").hidden = false; document.body.classList.add("is-preview"); }

// ---------- Admin sozlamalaridagi matnlar ----------
if (SETTINGS.topbar) $("#topbarText").textContent = SETTINGS.topbar;
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
updateBadges();
renderAccBtn();
loadCatalog();
// Saqlangan seans hali amaldami (admin bloklagan yoki parolni tiklagan bo'lishi mumkin)
if (auth.token) api("GET", "/api/me").then((r) => setAuth(auth.token, r.user), () => {});
// Yangilik havolasi orqali kelganda (#news-3) — maqolani ochamiz
{ const m = location.hash.match(/^#news-(\d+)$/); if (m) setTimeout(() => openNews(+m[1]), 1500); }
