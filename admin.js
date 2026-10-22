// ================= OPUS ADMIN =================
// Do'kon katalogini (sozlamalar, kategoriyalar, mahsulotlar, yangiliklar), buyurtmalar va mijozlarni boshqaradi.
// Hammasi OPUS serveri (Cloudflare Worker, API_BASE — assets.js) orqali. Admin tokeni faqat shu brauzer seansida saqlanadi.

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const fmt = (n) => Math.round(n || 0).toLocaleString("ru-RU").replace(/[\s,]/g, " ") + " so'm";
const num = (n) => Math.round(n || 0).toLocaleString("ru-RU").replace(/[\s,]/g, " ");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safe = (fn, def) => { try { return fn(); } catch { return def; } };
const ls = {
  get: (k, d) => safe(() => JSON.parse(localStorage.getItem(k)) ?? d, d),
  set: (k, v) => safe(() => localStorage.setItem(k, JSON.stringify(v))),
  del: (k) => safe(() => localStorage.removeItem(k)),
};
const ss = {
  get: (k) => safe(() => sessionStorage.getItem(k), null),
  set: (k, v) => safe(() => sessionStorage.setItem(k, v)),
  del: (k) => safe(() => sessionStorage.removeItem(k)),
};

const S = {
  token: ss.get("opus_admin_api"),
  data: null, baseJSON: "",
  uploads: {},          // "img/u-....jpg" → dataURL (hali serverga yuklanmagan rasmlar)
  orders: [], users: [], stats: null,
  view: "dash", editing: null,
};

// Sayt mavzusini (tun/kun) admin ham ishlatadi
document.documentElement.dataset.theme = safe(() => JSON.parse(localStorage.getItem("opus_theme")), null) ||
  (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

// ---------- Umumiy ----------
function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  $("#toasts").appendChild(el);
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 300); }, 3200);
}
const srcOf = (img) => (img ? S.uploads[img] || IMG(img) : "");
const catName = (id) => (S.data.CATEGORIES.find((c) => c.id === id) || {}).name || id;
const stockChip = (n) => n <= 0 ? `<span class="chip bad">⛔ Tugagan</span>` : n <= 5 ? `<span class="chip warn">⚠ Kam</span>` : `<span class="chip ok">✓ Bor</span>`;
const fmtPhone = (p) => { const d = String(p || "").replace(/\D/g, "").replace(/^998/, ""); return d ? "+998 " + [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].join(" ") : ""; };
const dt = (ms) => (ms ? new Date(ms).toLocaleString("ru-RU") : "—");

// ---------- Server API ----------
async function api(method, path, body) {
  let res;
  try {
    res = await fetch(API_BASE + path, {
      method, cache: "no-store",
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(S.token ? { Authorization: "Bearer " + S.token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw Object.assign(new Error("Server bilan aloqa yo'q. Internetni tekshiring."), { status: 0 });
  }
  let data = {};
  try { data = await res.json(); } catch {}
  if (res.status === 401 && path.startsWith("/api/admin/") && path !== "/api/admin/login") {
    // Seans tugagan (12 soat) — qulf ekraniga qaytamiz
    S.token = null; ss.del("opus_admin_api");
    showLock("Seans tugadi — parolni qayta kiriting.");
  }
  if (!res.ok) throw Object.assign(new Error(data.error || "Xatolik (" + res.status + ")"), { status: res.status });
  return data;
}
const apiError = (e) => e.message || String(e);

// ---------- Katalog ----------
function normalize(d) {
  d = JSON.parse(JSON.stringify(d));
  d.CATEGORIES = d.CATEGORIES || []; d.PRODUCTS = d.PRODUCTS || []; d.NEWS = d.NEWS || [];
  d.SETTINGS = { topbar: "", dealTitle: "", freeShipFrom: 1000000, shipPrice: 50000, promos: {}, apk: { url: "", version: "", sizeMB: 0 }, ...d.SETTINGS };
  delete d.SETTINGS.adminPass; // eski (serversiz) parol xeshi endi kerak emas
  d.SETTINGS.promos = d.SETTINGS.promos || {};
  d.SETTINGS.apk = { url: "", version: "", sizeMB: 0, ...(d.SETTINGS.apk || {}) };
  const pay = d.SETTINGS.pay || {};
  d.SETTINGS.pay = {
    payme: { merchantId: "", account: "order_id", ...(pay.payme || {}) },
    click: { serviceId: "", merchantId: "", ...(pay.click || {}) },
  };
  return d;
}
// data.js matnidan (serverda katalog hali bo'lmasa — boshlang'ich ma'lumot)
function parseData(text) {
  return normalize(new Function(text + "\n;return { SETTINGS: typeof SETTINGS !== 'undefined' ? SETTINGS : {}, CATEGORIES, PRODUCTS, NEWS: typeof NEWS !== 'undefined' ? NEWS : [] };")());
}
async function loadData() {
  const d = await api("GET", "/api/catalog");
  if (d.PRODUCTS && d.PRODUCTS.length) {
    S.data = normalize(d);
    S.baseJSON = JSON.stringify(S.data);
  } else {
    // Server bo'sh: data.js ni qoralama sifatida ochamiz — "E'lon qilish" uni serverga yozadi
    S.data = parseData(await (await fetch(`data.js?nocache=${Date.now()}`, { cache: "no-store" })).text());
    S.baseJSON = JSON.stringify({ SETTINGS: {}, CATEGORIES: [], PRODUCTS: [], NEWS: [] });
    toast("ℹ️ Serverda katalog hali yo'q — data.js yuklandi. Serverga yozish uchun \"E'lon qilish\" ni bosing.");
  }
  $("#syncInfo").textContent = `Ma'lumotlar yuklandi: ${new Date().toLocaleTimeString("ru-RU")}`;
}
async function loadServer() {
  const [st, o, u] = await Promise.all([api("GET", "/api/admin/stats"), api("GET", "/api/admin/orders"), api("GET", "/api/admin/users")]);
  S.stats = st; S.orders = o.orders; S.users = u.users;
}

// ---------- O'zgarishlarni kuzatish ----------
// Maydonlar tartibidan qat'i nazar solishtiramiz (null va yo'q maydon bir xil hisoblanadi)
const canon = (v) => Array.isArray(v) ? "[" + v.map(canon).join(",") + "]"
  : v && typeof v === "object" ? "{" + Object.keys(v).filter((k) => v[k] != null).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}"
  : JSON.stringify(v);
function diff() {
  const base = JSON.parse(S.baseJSON);
  const bm = new Map(base.PRODUCTS.map((p) => [p.id, canon(p)]));
  const changed = new Set();
  S.data.PRODUCTS.forEach((p) => { if (bm.get(p.id) !== canon(p)) changed.add(p.id); bm.delete(p.id); });
  let n = changed.size + bm.size;
  const nm = new Map((base.NEWS || []).map((x) => [x.id, canon(x)]));
  (S.data.NEWS || []).forEach((x) => { if (nm.get(x.id) !== canon(x)) n++; nm.delete(x.id); });
  n += nm.size;
  if (canon(base.SETTINGS) !== canon(S.data.SETTINGS)) n++;
  if (canon(base.CATEGORIES) !== canon(S.data.CATEGORIES)) n++;
  return { n, changed };
}
function markDirty() {
  const { n } = diff();
  $("#publishBtn").disabled = n === 0;
  $("#discardBtn").hidden = n === 0;
  $("#previewBtn").hidden = n === 0;
  $("#dirtyCount").hidden = n === 0;
  $("#dirtyCount").textContent = n;
  if (n) ls.set("opus_admin_draft", { data: S.data, uploads: S.uploads, at: Date.now() });
  else ls.del("opus_admin_draft");
}
function update() { renderAll(); markDirty(); }

// ---------- Ishga tushirish ----------
async function start() {
  await loadData();
  try { await loadServer(); } catch (ex) { toast("❌ " + apiError(ex)); }
  enterApp();
}
function refreshMode() {
  $("#adUser").innerHTML = `<span class="ad-mode">Serverga ulangan</span><span class="muted">"E'lon qilish" o'zgarishlarni saytga darhol yozadi</span>`
    + `<button class="ad-link" id="lockNowBtn">🔒 Chiqish</button>`;
  $("#lockNowBtn").addEventListener("click", lockNow);
  $("#publishBtn").title = "Saytga e'lon qilish (Ctrl+S)";
  $("#sheetMode").textContent = "Serverga ulangan — o'zgarishlar \"E'lon qilish\" bilan saytga yoziladi";
}
function enterApp() {
  $("#app").hidden = false;
  refreshMode();
  fillSelects();
  renderAll();
  markDirty();
  const draft = ls.get("opus_admin_draft", null);
  if (draft && JSON.stringify(draft.data) !== S.baseJSON) $("#draftBanner").hidden = false;
}

$("#draftRestore").addEventListener("click", () => {
  const d = ls.get("opus_admin_draft", null);
  if (d) { S.data = normalize(d.data); S.uploads = d.uploads || {}; update(); toast("💾 Qoralama tiklandi"); }
  $("#draftBanner").hidden = true;
});
$("#draftDrop").addEventListener("click", () => { ls.del("opus_admin_draft"); $("#draftBanner").hidden = true; });
$("#discardBtn").addEventListener("click", () => {
  const b = $("#discardBtn");
  if (!b.classList.contains("confirm")) {
    b.classList.add("confirm", "ad-danger"); b.textContent = "Ha, hammasini bekor qilish";
    setTimeout(() => { b.classList.remove("confirm", "ad-danger"); b.textContent = "Bekor qilish"; }, 3500);
    return;
  }
  S.data = JSON.parse(S.baseJSON); S.uploads = {};
  b.classList.remove("confirm", "ad-danger"); b.textContent = "Bekor qilish";
  update(); toast("↩️ O'zgarishlar bekor qilindi");
});

// ---------- Navigatsiya ----------
const TITLES = { dash: "Boshqaruv", products: "Mahsulotlar", news: "Yangiliklar", cats: "Kategoriyalar", orders: "Buyurtmalar", users: "Mijozlar", promos: "Promo-kodlar", settings: "Sozlamalar", history: "O'zgarishlar tarixi" };
const SHEET_VIEWS = ["news", "cats", "promos", "settings", "history"];
function go(view) {
  S.view = view;
  closeSheet();
  $$("button[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  $("#moreBtn").classList.toggle("active", SHEET_VIEWS.includes(view));
  $$(".ad-view").forEach((v) => (v.hidden = v.dataset.view !== view));
  $("#viewTitle").textContent = TITLES[view];
  scrollTo({ top: 0 });
}
["#adNav", "#adTabbar", "#adSheet"].forEach((s) => $(s).addEventListener("click", (e) => { const b = e.target.closest("button[data-view]"); if (b) go(b.dataset.view); }));

// Telefon: "Yana" menyusi (pastdan chiqadigan oyna)
function openSheet() { $("#adSheet").hidden = false; $("#sheetBg").hidden = false; requestAnimationFrame(() => $("#adSheet").classList.add("open")); $("#moreBtn").setAttribute("aria-expanded", "true"); }
function closeSheet() { $("#adSheet").classList.remove("open"); $("#sheetBg").hidden = true; $("#moreBtn").setAttribute("aria-expanded", "false"); setTimeout(() => { if (!$("#adSheet").classList.contains("open")) $("#adSheet").hidden = true; }, 250); }
$("#moreBtn").addEventListener("click", () => ($("#adSheet").classList.contains("open") ? closeSheet() : openSheet()));
$("#sheetBg").addEventListener("click", closeSheet);
$("#sheetLock").addEventListener("click", () => lockNow());
document.addEventListener("click", (e) => { const g = e.target.closest("[data-goto]"); if (g) go(g.dataset.goto); });

// ---------- Ko'rinishlar ----------
const STATUSES = ["Yangi", "Tasdiqlandi", "Yig'ilmoqda", "Yo'lda", "Yetkazildi", "Bekor qilindi"];
const statusChip = (s) => `<span class="chip ${s === "Bekor qilindi" ? "bad" : s === "Yetkazildi" ? "ok" : "warn"}">${esc(s)}</span>`;

function renderAll() {
  const P = S.data.PRODUCTS;
  $("#navProducts").textContent = P.length;
  $("#navOrders").textContent = S.stats ? (S.stats.byStatus || {})["Yangi"] || "" : "";
  $("#navUsers").textContent = S.stats ? S.stats.users : "";
  $("#navNews").textContent = (S.data.NEWS || []).length;
  renderKpis(); renderLow(); renderRecentOrders(); renderCats();
  renderProducts(); renderOrders(); renderUsers(); renderPromos(); renderSettings();
  renderNewsList(); renderCatEditor();
}

function renderKpis() {
  const P = S.data.PRODUCTS, st = S.stats || {};
  const units = P.reduce((s, p) => s + (+p.stock || 0), 0);
  const value = P.reduce((s, p) => s + p.price * (+p.stock || 0), 0);
  const low = P.filter((p) => p.stock <= 5), out = P.filter((p) => p.stock <= 0);
  const sale = P.filter((p) => p.old && p.old > p.price);
  const avgDisc = sale.length ? Math.round(sale.reduce((s, p) => s + (1 - p.price / p.old) * 100, 0) / sale.length) : 0;
  const tiles = [
    { t: "Bugungi savdo", v: fmt(st.todayRevenue), e: `${st.todayOrders || 0} ta buyurtma bugun`, hot: true },
    { t: "Buyurtmalar", v: st.orders || 0, e: (st.byStatus || {})["Yangi"] ? `🔔 ${st.byStatus["Yangi"]} tasi yangi` : "Jami: " + fmt(st.revenue), warn: !!(st.byStatus || {})["Yangi"] },
    { t: "Mijozlar", v: st.users || 0, e: st.newUsers ? `+${st.newUsers} ta oxirgi 7 kunda` : "Ro'yxatdan o'tganlar" },
    { t: "Mahsulotlar", v: P.length, e: `${S.data.CATEGORIES.length} ta kategoriya` },
    { t: "Omborda", v: num(units) + " dona", e: "Qiymati: " + fmt(value) },
    { t: "Kam qolgan", v: low.length, e: out.length ? `⛔ ${out.length} tasi tugagan` : "≤ 5 dona qolganlar", warn: low.length > 0 },
    { t: "Chegirmada", v: sale.length, e: sale.length ? `O'rtacha −${avgDisc}%` : "Chegirma yo'q" },
    { t: "Original belgisi", v: `${P.filter((p) => p.original !== false).length}/${P.length}`, e: "✓ belgili mahsulotlar" },
    { t: "Yangiliklar", v: (S.data.NEWS || []).length, e: (S.data.NEWS || []).length ? "Oxirgisi: " + (S.data.NEWS.map((n) => n.date).sort().pop() || "—") : "Hali yo'q" },
  ];
  $("#kpis").innerHTML = tiles.map((k) => `<div class="ad-kpi ${k.warn ? "warn" : ""} ${k.hot ? "hot" : ""}"><small>${k.t}</small><b>${k.v}</b><em>${k.e}</em></div>`).join("");
}

function renderLow() {
  const low = S.data.PRODUCTS.filter((p) => p.stock <= 5).sort((a, b) => a.stock - b.stock);
  $("#lowStock").innerHTML = low.length ? `<table class="ad-table" style="min-width:0">${low.map((p) => `
    <tr data-id="${p.id}">
      <td><img class="ad-thumb" src="${esc(srcOf(p.img))}" alt="" /></td>
      <td class="ad-pname"><b>${esc(p.name)}</b><small>${esc(catName(p.cat))}</small></td>
      <td>${stockChip(p.stock)}</td>
      <td class="num"><input class="cell sm" type="number" min="0" data-field="stock" value="${p.stock}" aria-label="Ombor" /></td>
    </tr>`).join("")}</table>` : `<p class="ad-empty">✓ Barcha mahsulotlar yetarli</p>`;
}

function renderRecentOrders() {
  const O = S.orders.slice(0, 5);
  $("#recentOrders").innerHTML = O.length ? `<table class="ad-table" style="min-width:0">${O.map((o) => `
    <tr><td><b>#${esc(o.id)}</b><br><small class="muted">${dt(o.created_at)}</small></td>
    <td>${esc(o.user_name || "—")}</td><td class="num">${fmt(o.total)}</td><td>${statusChip(o.status)}</td></tr>`).join("")}</table>`
    : `<p class="ad-empty">Hali buyurtma yo'q</p>`;
}

function renderCats() {
  const rows = S.data.CATEGORIES.map((c) => {
    const ps = S.data.PRODUCTS.filter((p) => p.cat === c.id);
    return { c, n: ps.length, units: ps.reduce((s, p) => s + (+p.stock || 0), 0), min: ps.length ? Math.min(...ps.map((p) => p.price)) : 0, max: ps.length ? Math.max(...ps.map((p) => p.price)) : 0 };
  });
  $("#catTable").innerHTML = `<table class="ad-table"><thead><tr><th>Kategoriya</th><th class="num">Mahsulotlar</th><th class="num">Omborda</th><th class="num">Narxlar oralig'i</th><th></th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td data-label="Kategoriya"><b>${esc(r.c.name)}</b></td><td class="num" data-label="Mahsulotlar">${r.n}</td><td class="num" data-label="Omborda">${num(r.units)} dona</td>
    <td class="num" data-label="Narxlar">${r.n ? `${fmt(r.min)} — ${fmt(r.max)}` : "—"}</td><td class="num"><button class="ad-link" data-filter-cat="${r.c.id}">Ko'rish →</button></td></tr>`).join("")}</tbody></table>`;
}
$("#catTable").addEventListener("click", (e) => {
  const b = e.target.closest("[data-filter-cat]");
  if (b) { $("#pCat").value = b.dataset.filterCat; go("products"); renderProducts(); }
});

function fillSelects() {
  const opts = S.data.CATEGORIES.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  $("#pCat").innerHTML = `<option value="">Barcha kategoriyalar</option>` + opts;
  $("#fCat").innerHTML = opts;
}

function renderProducts() {
  const q = $("#pSearch").value.trim().toLowerCase();
  const cat = $("#pCat").value, st = $("#pStock").value;
  const { changed } = diff();
  const list = S.data.PRODUCTS.filter((p) =>
    (!q || (p.name + " " + p.brand).toLowerCase().includes(q)) &&
    (!cat || p.cat === cat) &&
    (!st || (st === "low" && p.stock <= 5) || (st === "out" && p.stock <= 0) || (st === "sale" && p.old && p.old > p.price) || (st === "notorig" && p.original === false))
  );
  S.visible = list.map((p) => p.id);
  const allSel = list.length && list.every((p) => S.sel.has(p.id));
  $("#pTable").innerHTML = `<thead><tr><th><input type="checkbox" class="ad-cb" id="selAll" ${allSel ? "checked" : ""} aria-label="Hammasini tanlash" /></th><th></th><th>Mahsulot</th><th>Kategoriya</th><th class="num">Narx</th><th class="num">Eski narx</th><th class="num">Ombor</th><th>Holat</th><th>Belgi</th><th title="Original mahsulot">Original</th><th></th></tr></thead>
  <tbody>${list.length ? list.map((p) => `
    <tr data-id="${p.id}" class="${changed.has(p.id) ? "changed" : ""} ${S.sel.has(p.id) ? "selected" : ""}">
      <td class="c-cb"><input type="checkbox" class="ad-cb" data-sel ${S.sel.has(p.id) ? "checked" : ""} aria-label="Tanlash" /></td>
      <td class="c-img"><img class="ad-thumb" src="${esc(srcOf(p.img))}" alt="" loading="lazy" /></td>
      <td class="ad-pname c-name"><b title="${esc(p.name)}">${esc(p.name)}</b><small>${esc(p.brand)} · ${esc(catName(p.cat))} · ID ${p.id}</small></td>
      <td class="c-cat">${esc(catName(p.cat))}</td>
      <td class="num c-price" data-label="Narx"><input class="cell" type="number" inputmode="numeric" min="0" step="1000" data-field="price" value="${p.price}" aria-label="Narx" /></td>
      <td class="num c-old" data-label="Eski narx"><input class="cell" type="number" inputmode="numeric" min="0" step="1000" data-field="old" value="${p.old || ""}" placeholder="—" aria-label="Eski narx" /></td>
      <td class="num c-stock" data-label="Ombor"><input class="cell sm" type="number" inputmode="numeric" min="0" data-field="stock" value="${p.stock}" aria-label="Ombor" /></td>
      <td class="c-status">${stockChip(p.stock)}${p.old && p.old > p.price ? ` <span class="chip sale">−${Math.round((1 - p.price / p.old) * 100)}%</span>` : ""}</td>
      <td class="c-badge" data-label="Belgi"><select class="ad-status-select" data-field="badge" aria-label="Belgi">${["", "Yangi", "Xit"].map((b) => `<option value="${b}" ${(p.badge || "") === b ? "selected" : ""}>${b || "—"}</option>`).join("")}</select></td>
      <td class="c-orig" data-label="Original"><label class="ad-switch" title="Original belgisi"><input type="checkbox" data-field="original" ${p.original !== false ? "checked" : ""} aria-label="Original" /><span></span></label></td>
      <td class="c-act"><div class="ad-actions"><button data-act="edit">Tahrirlash</button><button data-act="dup" title="Nusxa olish" aria-label="Nusxa olish">⧉</button></div></td>
    </tr>`).join("") : `<tr><td colspan="11" class="ad-empty">Hech narsa topilmadi</td></tr>`}</tbody>`;
  renderBulk();
}

// ---------- Ommaviy amallar ----------
S.sel = new Set();
function renderBulk() {
  S.sel.forEach((id) => { if (!S.data.PRODUCTS.some((p) => p.id === id)) S.sel.delete(id); });
  $("#bulkBar").hidden = S.sel.size === 0;
  $("#bulkCount").textContent = `${S.sel.size} ta tanlandi`;
  const a = $("#bulkAction").value;
  $("#bulkValue").hidden = !["discount", "price", "stock"].includes(a);
  $("#bulkBadge").hidden = a !== "badge";
  $("#bulkValue").placeholder = a === "discount" ? "chegirma %, 0 — olib tashlash" : a === "price" ? "+10 yoki −5" : "dona";
}
$("#pTable").addEventListener("click", (e) => {
  if (e.target.id === "selAll") {
    S.visible.forEach((id) => (e.target.checked ? S.sel.add(id) : S.sel.delete(id)));
    renderProducts();
  } else if (e.target.matches("[data-sel]")) {
    const id = +e.target.closest("[data-id]").dataset.id;
    e.target.checked ? S.sel.add(id) : S.sel.delete(id);
    e.target.closest("tr").classList.toggle("selected", e.target.checked);
    renderBulk();
  }
});
$("#bulkAction").addEventListener("change", renderBulk);
$("#bulkClear").addEventListener("click", () => { S.sel.clear(); renderProducts(); });
const round1000 = (n) => Math.max(0, Math.round(n / 1000) * 1000);
$("#bulkApply").addEventListener("click", () => {
  const a = $("#bulkAction").value, x = parseFloat($("#bulkValue").value);
  const items = S.data.PRODUCTS.filter((p) => S.sel.has(p.id));
  if (!items.length) return;
  if (["discount", "price", "stock"].includes(a) && !isFinite(x)) { toast("⚠️ Qiymatni kiriting"); return; }
  if (a === "discount" && (x < 0 || x > 90)) { toast("⚠️ Chegirma 0–90% oralig'ida bo'lishi kerak"); return; }
  if (a === "delete") {
    const b = $("#bulkApply");
    if (!b.classList.contains("confirm")) {
      b.classList.add("confirm"); b.textContent = `Ha, ${items.length} tasini o'chirish`;
      setTimeout(() => { b.classList.remove("confirm"); b.textContent = "Qo'llash"; }, 3500);
      return;
    }
    b.classList.remove("confirm"); b.textContent = "Qo'llash";
    S.data.PRODUCTS = S.data.PRODUCTS.filter((p) => !S.sel.has(p.id));
  }
  items.forEach((p) => {
    if (a === "discount") {
      const base = p.old || p.price;
      if (x === 0) { p.price = base; p.old = null; }
      else { p.old = base; p.price = round1000(base * (1 - x / 100)); }
    }
    if (a === "price") { p.price = round1000(p.price * (1 + x / 100)); if (p.old && p.old <= p.price) p.old = null; }
    if (a === "stock") p.stock = Math.max(0, Math.round(x));
    if (a === "badge") { if ($("#bulkBadge").value) p.badge = $("#bulkBadge").value; else delete p.badge; }
    if (a === "orig1") p.original = true;
    if (a === "orig0") p.original = false;
  });
  const n = items.length;
  if (a === "delete") S.sel.clear();
  update();
  toast(a === "delete" ? `🗑 ${n} ta mahsulot o'chirildi` : `✓ ${n} ta mahsulotga qo'llandi`);
});

// ---------- CSV (Excel) eksport / import ----------
const CSV_COLS = ["id", "name", "brand", "cat", "price", "old", "stock", "badge", "original"];
const csvCell = (v) => { const s = v == null ? "" : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
function download(name, text, type = "text/csv;charset=utf-8") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + text], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
$("#csvExport").addEventListener("click", () => {
  const rows = [CSV_COLS.join(";"), ...S.data.PRODUCTS.map((p) => CSV_COLS.map((c) => csvCell(c === "original" ? (p.original === false ? 0 : 1) : p[c])).join(";"))];
  download(`opus-mahsulotlar-${new Date().toISOString().slice(0, 10)}.csv`, rows.join("\n"));
  toast("⬇ CSV yuklab olindi. Excel'da tahrirlab, \"CSV import\" orqali qaytaring.");
});
function parseCSV(text) {
  text = text.replace(/^﻿/, "");
  const delim = (text.split("\n")[0].match(/;/g) || []).length >= (text.split("\n")[0].match(/,/g) || []).length ? ";" : ",";
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}
$("#csvImport").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  const rows = parseCSV(await file.text());
  const head = (rows.shift() || []).map((h) => h.trim().toLowerCase());
  if (!head.includes("id")) { toast("❌ CSV'da \"id\" ustuni topilmadi. Avval \"⬇ CSV\" orqali namunani yuklab oling."); return; }
  let ok = 0, skip = 0;
  const numF = (v) => +String(v).replace(/[^\d.-]/g, "") || 0;
  rows.forEach((r) => {
    const v = Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()]));
    const p = S.data.PRODUCTS.find((x) => x.id === +v.id);
    if (!p) { skip++; return; }
    if ("name" in v && v.name) p.name = v.name;
    if ("brand" in v && v.brand) p.brand = v.brand;
    if ("cat" in v && S.data.CATEGORIES.some((c) => c.id === v.cat)) p.cat = v.cat;
    if ("price" in v && v.price) p.price = numF(v.price);
    if ("old" in v) p.old = numF(v.old) > p.price ? numF(v.old) : null;
    if ("stock" in v && v.stock !== "") p.stock = Math.max(0, Math.round(numF(v.stock)));
    if ("badge" in v) { if (["Yangi", "Xit"].includes(v.badge)) p.badge = v.badge; else delete p.badge; }
    if ("original" in v && v.original !== "") p.original = !["0", "yo'q", "no", "false"].includes(v.original.toLowerCase());
    ok++;
  });
  update();
  toast(`⬆ ${ok} ta mahsulot yangilandi${skip ? `, ${skip} ta qator (noma'lum ID) o'tkazib yuborildi` : ""}`);
});
["#pSearch", "#pCat", "#pStock"].forEach((s) => $(s).addEventListener("input", renderProducts));

// Jadvaldagi tezkor tahrir (narx, eski narx, ombor, belgi)
function onCellChange(e) {
  const f = e.target.dataset.field;
  const row = e.target.closest("[data-id]");
  if (!f || !row) return;
  const p = S.data.PRODUCTS.find((x) => x.id === +row.dataset.id);
  if (!p) return;
  if (f === "badge") { if (e.target.value) p.badge = e.target.value; else delete p.badge; }
  else if (f === "original") p.original = e.target.checked;
  else if (f === "old") p.old = +e.target.value > 0 ? +e.target.value : null;
  else p[f] = Math.max(0, +e.target.value || 0);
  row.classList.add("changed");
  renderKpis(); markDirty();
  if (f === "stock" && S.view === "dash") renderLow();
}
$("#pTable").addEventListener("change", onCellChange);
$("#lowStock").addEventListener("change", onCellChange);
$("#pTable").addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const id = +b.closest("[data-id]").dataset.id;
  if (b.dataset.act === "edit") openEdit(id);
  if (b.dataset.act === "dup") {
    const src = S.data.PRODUCTS.find((p) => p.id === id);
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = nextId(); copy.name += " (nusxa)"; copy.reviews = 0;
    S.data.PRODUCTS.splice(S.data.PRODUCTS.indexOf(src) + 1, 0, copy);
    update(); toast("⧉ Nusxa yaratildi — tahrirlashni unutmang");
  }
});
const nextId = () => Math.max(0, ...S.data.PRODUCTS.map((p) => p.id)) + 1;

// ---------- Mahsulotni tahrirlash ----------
const drawer = $("#editDrawer"), overlay = $("#overlay"), form = $("#editForm");
function openEdit(id) {
  const p = id ? S.data.PRODUCTS.find((x) => x.id === id) : null;
  S.editing = p ? p.id : null;
  $("#editTitle").textContent = p ? "Mahsulotni tahrirlash" : "Yangi mahsulot";
  const v = p || { name: "", brand: "", cat: S.data.CATEGORIES[0].id, price: 0, old: null, stock: 10, rating: 5, reviews: 0, popular: 50, desc: "", img: "", specs: {} };
  form.elements.name.value = v.name; form.elements.brand.value = v.brand; form.elements.cat.value = v.cat;
  form.elements.price.value = v.price; form.elements.old.value = v.old || ""; form.elements.stock.value = v.stock;
  form.elements.rating.value = v.rating; form.elements.reviews.value = v.reviews; form.elements.popular.value = v.popular;
  form.elements.badge.value = v.badge || ""; form.elements.desc.value = v.desc; form.elements.img.value = v.img || "";
  form.elements.original.checked = v.original !== false;
  $("#specList").innerHTML = "";
  const specs = Object.entries(v.specs || {});
  (specs.length ? specs : [["", ""]]).forEach(([k, val]) => addSpecRow(k, val));
  showPreview();
  $("#deleteBtn").hidden = !p;
  resetDelete();
  openDrawer(drawer);
  setTimeout(() => form.elements.name.focus(), 300);
}
function openDrawer(d) { d.classList.add("open"); overlay.classList.add("show"); document.body.classList.add("lock"); }
function closeEdit() { $$(".drawer.open").forEach((d) => d.classList.remove("open")); overlay.classList.remove("show"); document.body.classList.remove("lock"); }
overlay.addEventListener("click", closeEdit);
$$(".drawer [data-close]").forEach((b) => b.addEventListener("click", closeEdit));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && $(".drawer.open")) closeEdit();
  // Ctrl+S — e'lon qilish
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && S.data) { e.preventDefault(); if (!$("#publishBtn").disabled) publish(); }
});

// Rasmni brauzerda 800px gacha kichraytirib JPEG qiladi va e'lon qilinguncha xotirada saqlaydi
function resizeImage(file, prefix) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const im = new Image();
      im.onerror = () => reject(new Error("rasm emas"));
      im.onload = () => {
        const k = Math.min(1, 800 / Math.max(im.width, im.height));
        const c = document.createElement("canvas");
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        const g = c.getContext("2d");
        g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
        g.drawImage(im, 0, 0, c.width, c.height);
        const path = `img/${prefix}-${Date.now()}.jpg`;
        S.uploads[path] = c.toDataURL("image/jpeg", 0.85);
        resolve({ path, w: c.width, h: c.height });
      };
      im.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
$("#addProduct").addEventListener("click", () => openEdit(null));

function addSpecRow(k = "", v = "") {
  const row = document.createElement("div");
  row.className = "ad-spec";
  row.innerHTML = `<input placeholder="Masalan: Protsessor" value="${esc(k)}" aria-label="Xususiyat nomi" /><input placeholder="Qiymati" value="${esc(v)}" aria-label="Xususiyat qiymati" /><button type="button" title="O'chirish">✕</button>`;
  $("button", row).addEventListener("click", () => row.remove());
  $("#specList").appendChild(row);
}
$("#addSpec").addEventListener("click", () => addSpecRow());

function showPreview() {
  const path = form.elements.img.value.trim();
  $("#imgPreview").innerHTML = path ? `<img src="${esc(srcOf(path))}" alt="" onerror="this.replaceWith(document.createTextNode('Rasm topilmadi'))" />` : "Rasm yo'q";
}
form.elements.img.addEventListener("input", showPreview);

// Rasm yuklash: brauzerda 800px gacha kichraytirib JPEG qilamiz
$("#imgFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const r = await resizeImage(file, `u-${S.editing || "new"}`);
    form.elements.img.value = r.path;
    showPreview();
    toast(`📷 Rasm tayyor (${r.w}×${r.h}) — "Saqlash" va "E'lon qilish" ni bosing`);
  } catch { toast("❌ Bu faylni rasm sifatida ochib bo'lmadi"); }
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const f = form.elements;
  const specs = {};
  $$("#specList .ad-spec").forEach((r) => {
    const [k, v] = $$("input", r).map((i) => i.value.trim());
    if (k && v) specs[k] = v;
  });
  const val = {
    cat: f.cat.value, brand: f.brand.value.trim(), name: f.name.value.trim(),
    price: Math.max(0, +f.price.value || 0), old: +f.old.value > 0 ? +f.old.value : null,
    rating: Math.min(5, Math.max(0, +f.rating.value || 0)), reviews: Math.max(0, +f.reviews.value || 0),
    stock: Math.max(0, +f.stock.value || 0), popular: Math.min(100, Math.max(0, +f.popular.value || 0)),
    original: f.original.checked,
    img: f.img.value.trim(), desc: f.desc.value.trim(), specs,
  };
  if (!val.name || !val.brand) { toast("⚠️ Nomi va brendni kiriting"); return; }
  if (val.old && val.old <= val.price) { toast("⚠️ Eski narx yangi narxdan katta bo'lishi kerak (yoki bo'sh qoldiring)"); return; }
  // Maydonlar tartibi data.js dagidek: id, cat, brand, name, price, old, rating, reviews, stock, popular, original, badge, img, gallery, desc, specs
  const build = (id, gallery) => {
    const { desc, specs, img, ...head } = val;
    return { id, ...head, ...(f.badge.value ? { badge: f.badge.value } : {}), img, ...(gallery ? { gallery } : {}), desc, specs };
  };
  if (S.editing) {
    const i = S.data.PRODUCTS.findIndex((x) => x.id === S.editing);
    const old = S.data.PRODUCTS[i];
    // Asosiy rasm o'zgarsa, eski qo'shimcha fotolar endi mos kelmaydi
    S.data.PRODUCTS[i] = build(old.id, old.gallery && old.img === val.img ? old.gallery : null);
    toast("✓ Saqlandi — saytda ko'rinishi uchun \"E'lon qilish\" ni bosing");
  } else {
    // Yangi mahsulot uchun yuklangan rasm nomini haqiqiy ID ga moslaymiz
    const id = nextId();
    if (val.img.startsWith("img/u-new-") && S.uploads[val.img]) {
      const np = val.img.replace("u-new-", `u-${id}-`);
      S.uploads[np] = S.uploads[val.img]; delete S.uploads[val.img]; val.img = np;
    }
    S.data.PRODUCTS.unshift(build(id, null));
    toast("✓ Yangi mahsulot qo'shildi");
  }
  closeEdit(); update();
});

function resetDelete() { const b = $("#deleteBtn"); b.classList.remove("confirm"); b.textContent = "O'chirish"; }
$("#deleteBtn").addEventListener("click", () => {
  const b = $("#deleteBtn");
  if (!b.classList.contains("confirm")) {
    b.classList.add("confirm"); b.textContent = "Ha, o'chirilsin";
    setTimeout(resetDelete, 3500);
    return;
  }
  const p = S.data.PRODUCTS.find((x) => x.id === S.editing);
  S.data.PRODUCTS = S.data.PRODUCTS.filter((x) => x.id !== S.editing);
  closeEdit(); update(); toast(`🗑 "${p.name}" o'chirildi`);
});

// ---------- Yangiliklar ----------
const newsDrawer = $("#newsDrawer"), nForm = $("#newsForm");
const today = () => new Date().toISOString().slice(0, 10);
function renderNewsList() {
  const q = $("#nSearch").value.trim().toLowerCase();
  const base = new Map((JSON.parse(S.baseJSON).NEWS || []).map((n) => [n.id, canon(n)]));
  const list = (S.data.NEWS || []).slice()
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || String(b.date).localeCompare(String(a.date)))
    .filter((n) => !q || n.title.toLowerCase().includes(q));
  $("#newsList").innerHTML = list.length ? list.map((n) => `
    <article class="ad-news ${base.get(n.id) !== canon(n) ? "changed" : ""}" data-nid="${n.id}">
      <img src="${esc(srcOf(n.img))}" alt="" onerror="this.style.visibility='hidden'" />
      <div>
        <div class="ad-news-meta">${n.pinned ? `<span class="chip sale">📌 Tepada</span>` : ""}<span class="chip ok">${esc(n.tag || "Yangilik")}</span><span class="muted">${esc(n.date)}</span></div>
        <b>${esc(n.title)}</b>
        <p class="muted">${esc(n.excerpt || "")}</p>
      </div>
      <div class="ad-actions"><button data-nact="edit">Tahrirlash</button><button data-nact="pin" title="Tepaga mahkamlash">📌</button></div>
    </article>`).join("") : `<p class="ad-empty">Yangiliklar yo'q. "+ Yangi yangilik" ni bosing.</p>`;
}
$("#nSearch").addEventListener("input", renderNewsList);
$("#newsList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-nact]");
  if (!b) return;
  const id = +b.closest("[data-nid]").dataset.nid;
  const n = S.data.NEWS.find((x) => x.id === id);
  if (b.dataset.nact === "edit") openNewsEdit(id);
  if (b.dataset.nact === "pin") { if (n.pinned) delete n.pinned; else n.pinned = true; update(); }
});
$("#addNews").addEventListener("click", () => openNewsEdit(null));

function openNewsEdit(id) {
  const n = id ? S.data.NEWS.find((x) => x.id === id) : null;
  S.editingNews = n ? n.id : null;
  $("#newsTitle").textContent = n ? "Yangilikni tahrirlash" : "Yangi yangilik";
  const v = n || { title: "", tag: "Yangilik", date: today(), img: "", excerpt: "", body: "" };
  const f = nForm.elements;
  f.title.value = v.title; f.tag.value = v.tag || ""; f.date.value = v.date; f.img.value = v.img || "";
  f.excerpt.value = v.excerpt || ""; f.body.value = v.body || ""; f.pinned.checked = !!v.pinned;
  showNewsPreview();
  $("#nDelete").hidden = !n;
  $("#nDelete").classList.remove("confirm"); $("#nDelete").textContent = "O'chirish";
  openDrawer(newsDrawer);
  setTimeout(() => f.title.focus(), 300);
}
function showNewsPreview() {
  const p = nForm.elements.img.value.trim();
  $("#nImgPreview").innerHTML = p ? `<img src="${esc(srcOf(p))}" alt="" onerror="this.replaceWith(document.createTextNode('Rasm topilmadi'))" />` : "Rasm yo'q";
}
nForm.elements.img.addEventListener("input", showNewsPreview);
$("#nImgFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try { const r = await resizeImage(file, "news"); nForm.elements.img.value = r.path; showNewsPreview(); }
  catch { toast("❌ Bu faylni rasm sifatida ochib bo'lmadi"); }
});
nForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const f = nForm.elements;
  const v = {
    date: f.date.value || today(), tag: f.tag.value.trim() || "Yangilik", ...(f.pinned.checked ? { pinned: true } : {}),
    img: f.img.value.trim(), title: f.title.value.trim(), excerpt: f.excerpt.value.trim(), body: f.body.value.trim(),
  };
  if (!v.title) { toast("⚠️ Sarlavhani kiriting"); return; }
  if (!v.excerpt) v.excerpt = v.body.split(/\n/)[0].slice(0, 180);
  S.data.NEWS = S.data.NEWS || [];
  if (S.editingNews) {
    const i = S.data.NEWS.findIndex((x) => x.id === S.editingNews);
    S.data.NEWS[i] = { id: S.editingNews, ...v };
  } else {
    S.data.NEWS.unshift({ id: Math.max(0, ...S.data.NEWS.map((x) => x.id)) + 1, ...v });
  }
  closeEdit(); update();
  toast("✓ Yangilik saqlandi — saytda ko'rinishi uchun \"E'lon qilish\" ni bosing");
});
$("#nDelete").addEventListener("click", () => {
  const b = $("#nDelete");
  if (!b.classList.contains("confirm")) {
    b.classList.add("confirm"); b.textContent = "Ha, o'chirilsin";
    setTimeout(() => { b.classList.remove("confirm"); b.textContent = "O'chirish"; }, 3500);
    return;
  }
  S.data.NEWS = S.data.NEWS.filter((x) => x.id !== S.editingNews);
  closeEdit(); update(); toast("🗑 Yangilik o'chirildi");
});

// ---------- Kategoriyalar ----------
function renderCatEditor() {
  $("#cTable").innerHTML = `<thead><tr><th></th><th>Nomi</th><th>Kod (ID)</th><th class="num">Mahsulotlar</th><th></th></tr></thead><tbody>
  ${S.data.CATEGORIES.map((c) => `<tr data-cid="${esc(c.id)}">
    <td><img class="ad-thumb" src="${esc(srcOf(c.img))}" alt="" /></td>
    <td data-label="Nomi"><input class="cell wide" data-cfield="name" value="${esc(c.name)}" aria-label="Kategoriya nomi" /></td>
    <td data-label="Kod"><code>${esc(c.id)}</code></td>
    <td class="num" data-label="Mahsulotlar">${S.data.PRODUCTS.filter((p) => p.cat === c.id).length}</td>
    <td><div class="ad-actions"><label class="btn btn-ghost btn-sm ad-upload" style="margin:0">📷 Rasm<input type="file" data-cimg accept="image/*" hidden /></label></div></td>
  </tr>`).join("")}</tbody>`;
}
$("#cTable").addEventListener("change", async (e) => {
  const row = e.target.closest("[data-cid]");
  if (!row) return;
  const c = S.data.CATEGORIES.find((x) => x.id === row.dataset.cid);
  if (e.target.dataset.cfield === "name") { c.name = e.target.value.trim() || c.name; markDirty(); fillSelects(); }
  if (e.target.matches("[data-cimg]") && e.target.files[0]) {
    try { const r = await resizeImage(e.target.files[0], "cat-" + c.id); c.img = r.path; update(); toast("📷 Kategoriya rasmi yangilandi"); }
    catch { toast("❌ Bu faylni rasm sifatida ochib bo'lmadi"); }
  }
});

// ---------- Tarix (serverdagi katalog versiyalari) ----------
$("#historyLoad").addEventListener("click", loadHistory);
async function loadHistory() {
  const box = $("#historyList");
  box.innerHTML = `<p class="ad-empty">Yuklanmoqda…</p>`;
  try {
    const { versions } = await api("GET", "/api/admin/catalog/versions");
    box.innerHTML = versions.length ? `<div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>Saqlangan</th><th>Izoh</th><th></th></tr></thead><tbody>
      ${versions.map((v) => `<tr><td class="num" style="text-align:left" data-label="Saqlangan">${dt(v.saved_at)}</td>
      <td data-label="Izoh">${esc(v.note || "—")}</td>
      <td><div class="ad-actions"><button data-restore="${v.id}">Shu versiyani ochish</button></div></td></tr>`).join("")}
      </tbody></table></div>` : `<p class="ad-empty">Hali saqlangan versiya yo'q — birinchi "E'lon qilish" dan keyin paydo bo'ladi</p>`;
  } catch (ex) { box.innerHTML = `<p class="ad-empty">${esc(apiError(ex))}</p>`; }
}
$("#historyList").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-restore]");
  if (!b) return;
  b.disabled = true; b.textContent = "Ochilmoqda…";
  try {
    const catalog = await api("GET", "/api/admin/catalog/versions/" + b.dataset.restore);
    S.data = normalize(catalog);
    update(); go("products");
    toast("↩️ Eski versiya qoralama sifatida ochildi. Tekshiring va \"E'lon qilish\" ni bosing (yoki \"Bekor qilish\").");
  } catch (ex) { toast("❌ " + apiError(ex)); b.disabled = false; b.textContent = "Shu versiyani ochish"; }
});

// ---------- Oldindan ko'rish ----------
$("#previewBtn").addEventListener("click", () => {
  try {
    localStorage.setItem("opus_admin_preview", JSON.stringify({ ...S.data, uploads: S.uploads }));
    window.open("./?preview=1#products", "_blank", "noopener");
  } catch { toast("⚠️ Qoralama juda katta (ko'p rasm). Avval e'lon qiling yoki rasmlar sonini kamaytiring."); }
});

// ---------- Buyurtmalar (serverdan) ----------
const payName = (id) => (PAYMENTS.find((p) => p.id === id) || {}).name || id;
const itemsText = (o) => (o.items || []).map((i) => `${i.name} × ${i.qty}`);
$("#oStatus").innerHTML += STATUSES.map((s) => `<option>${s}</option>`).join("");
function renderOrders() {
  const oq = ($("#oSearch").value || "").trim().toLowerCase(), os = $("#oStatus").value;
  const O = S.orders.filter((o) => (!os || o.status === os) && (!oq || [o.id, o.user_name, o.user_phone, fmtPhone(o.user_phone)].join(" ").toLowerCase().includes(oq)));
  $("#oTable").innerHTML = `<thead><tr><th>Buyurtma</th><th>Mijoz</th><th>Manzil</th><th>Mahsulotlar</th><th>To'lov</th><th class="num">Summa</th><th>Holat</th></tr></thead><tbody>
  ${O.length ? O.map((o) => `<tr class="${o.status === "Yangi" ? "ad-row-new" : ""}">
    <td data-label="Buyurtma"><span><b>#${esc(o.id)}</b><br><small class="muted">${dt(o.created_at)}</small></span></td>
    <td data-label="Mijoz"><span>${o.user_id ? `<button class="ad-link" data-user="${o.user_id}">${esc(o.user_name || "—")}</button>` : "<i>o'chirilgan mijoz</i>"}<br><small class="muted">${o.user_phone ? `<a href="tel:+${esc(o.user_phone)}">${esc(fmtPhone(o.user_phone))}</a>` : ""}</small></span></td>
    <td data-label="Manzil"><span>${o.delivery === "pickup" ? "🏬 Do'kondan olib ketadi" : `${esc(o.region || "")}<br><small class="muted">${esc(o.address || "")}</small>`}${o.note ? `<br><small class="muted">💬 ${esc(o.note)}</small>` : ""}</span></td>
    <td data-label="Mahsulotlar"><span>${itemsText(o).map(esc).join("<br>")}</span></td>
    <td data-label="To'lov"><span>${esc(payName(o.payment))}${o.months ? `<br><small class="muted">${o.months} oy</small>` : ""}${o.promo ? `<br><small class="muted">🎟 ${esc(o.promo)}</small>` : ""}</span></td>
    <td class="num" data-label="Summa"><b>${fmt(o.total)}</b>${o.discount ? `<br><small class="muted">−${fmt(o.discount)}</small>` : ""}</td>
    <td data-label="Holat"><select class="ad-status-select" data-order="${esc(o.id)}" aria-label="Holat">${STATUSES.map((s) => `<option ${o.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></td>
  </tr>`).join("") : `<tr><td colspan="7" class="ad-empty">${S.orders.length ? "Hech narsa topilmadi" : "Hali buyurtma yo'q. Mijozlar saytda ro'yxatdan o'tib buyurtma berishi bilan shu yerda paydo bo'ladi."}</td></tr>`}</tbody>`;
}
$("#oSearch").addEventListener("input", renderOrders);
$("#oStatus").addEventListener("change", renderOrders);
async function reloadServer(msg) {
  try { await loadServer(); renderAll(); if (msg) toast(msg); } catch (ex) { toast("❌ " + apiError(ex)); }
}
$("#oReload").addEventListener("click", () => reloadServer("↻ Yangilandi"));
$("#uReload").addEventListener("click", () => reloadServer("↻ Yangilandi"));
$("#oExport").addEventListener("click", () => {
  const O = S.orders;
  if (!O.length) { toast("Eksport uchun buyurtma yo'q"); return; }
  const rows = [["Raqam", "Sana", "Mijoz", "Telefon", "Viloyat", "Manzil", "Mahsulotlar", "To'lov", "Promo", "Summa", "Holat"].join(";"),
    ...O.map((o) => [o.id, dt(o.created_at), o.user_name, fmtPhone(o.user_phone), o.region, o.delivery === "pickup" ? "Do'kondan" : o.address,
      itemsText(o).join(", "), payName(o.payment), o.promo || "", Math.round(o.total), o.status].map(csvCell).join(";"))];
  download(`opus-buyurtmalar-${today()}.csv`, rows.join("\n"));
});
$("#oTable").addEventListener("change", async (e) => {
  const id = e.target.dataset.order;
  if (!id) return;
  const sel = e.target, o = S.orders.find((x) => x.id === id), prev = o.status;
  sel.disabled = true;
  try {
    await api("PATCH", "/api/admin/orders/" + encodeURIComponent(id), { status: sel.value });
    o.status = sel.value;
    toast(`Buyurtma #${id}: ${sel.value}`);
    // Bekor qilish / qayta tiklash ombor qoldig'ini o'zgartiradi — katalog va statistikani yangilaymiz
    if ((prev === "Bekor qilindi") !== (sel.value === "Bekor qilindi")) await refreshStock();
    S.stats = await api("GET", "/api/admin/stats");
    renderAll();
  } catch (ex) { sel.value = prev; toast("❌ " + apiError(ex)); }
  sel.disabled = false;
});
// Server ombor qoldig'ini o'zi o'zgartirgan — qoralamadagi boshqa o'zgarishlarni saqlagan holda faqat "stock" ni olamiz
async function refreshStock() {
  const d = await api("GET", "/api/catalog"), base = JSON.parse(S.baseJSON);
  const stock = new Map(d.PRODUCTS.map((p) => [p.id, p.stock]));
  [S.data.PRODUCTS, base.PRODUCTS].forEach((list) => list.forEach((p) => { if (stock.has(p.id)) p.stock = stock.get(p.id); }));
  S.baseJSON = JSON.stringify(base);
}

// ---------- Mijozlar ----------
function renderUsers() {
  const q = ($("#uSearch").value || "").trim().toLowerCase();
  const U = S.users.filter((u) => !q || [u.name, u.phone, fmtPhone(u.phone), u.email].join(" ").toLowerCase().includes(q));
  $("#uTable").innerHTML = `<thead><tr><th>Mijoz</th><th>Telefon / email</th><th>Manzil</th><th class="num">Buyurtmalar</th><th class="num">Xarid summasi</th><th>Ro'yxatdan o'tgan</th><th></th></tr></thead><tbody>
  ${U.length ? U.map((u) => `<tr class="${u.blocked ? "ad-row-blocked" : ""}">
    <td data-label="Mijoz"><span class="ad-user-cell"><i class="ad-ava">${esc(initials(u.name))}</i><span><b>${esc(u.name)}</b>${u.blocked ? `<br><span class="chip bad">⛔ Bloklangan</span>` : ""}</span></span></td>
    <td data-label="Aloqa"><span><a href="tel:+${esc(u.phone)}">${esc(fmtPhone(u.phone))}</a>${u.email ? `<br><small class="muted">${esc(u.email)}</small>` : ""}</span></td>
    <td data-label="Manzil"><span>${esc(u.region || "—")}${u.address ? `<br><small class="muted">${esc(u.address)}</small>` : ""}</span></td>
    <td class="num" data-label="Buyurtmalar">${u.orders}</td>
    <td class="num" data-label="Xarid summasi"><b>${fmt(u.spent)}</b></td>
    <td data-label="Ro'yxatdan o'tgan"><span>${dt(u.created_at)}<br><small class="muted">Oxirgi kirish: ${dt(u.last_login)}</small></span></td>
    <td class="num"><button class="btn btn-ghost btn-sm" data-user="${u.id}">Batafsil →</button></td>
  </tr>`).join("") : `<tr><td colspan="7" class="ad-empty">${S.users.length ? "Hech kim topilmadi" : "Hali ro'yxatdan o'tgan mijoz yo'q"}</td></tr>`}</tbody>`;
}
const initials = (n) => String(n || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
$("#uSearch").addEventListener("input", renderUsers);
$("#uExport").addEventListener("click", () => {
  if (!S.users.length) { toast("Eksport uchun mijoz yo'q"); return; }
  const rows = [["ID", "Ism", "Telefon", "Email", "Viloyat", "Manzil", "Buyurtmalar", "Xarid summasi", "Ro'yxatdan o'tgan", "Oxirgi kirish", "Bloklangan"].join(";"),
    ...S.users.map((u) => [u.id, u.name, fmtPhone(u.phone), u.email || "", u.region || "", u.address || "", u.orders, Math.round(u.spent), dt(u.created_at), dt(u.last_login), u.blocked ? "ha" : ""].map(csvCell).join(";"))];
  download(`opus-mijozlar-${today()}.csv`, rows.join("\n"));
});
document.addEventListener("click", (e) => { const b = e.target.closest("[data-user]"); if (b) openUser(+b.dataset.user); });

async function openUser(id) {
  const box = $("#uBody");
  box.innerHTML = `<p class="ad-empty">Yuklanmoqda…</p>`;
  openDrawer($("#userDrawer"));
  let r;
  try { r = await api("GET", "/api/admin/users/" + id); } catch (ex) { box.innerHTML = `<p class="ad-empty">${esc(apiError(ex))}</p>`; return; }
  const u = r.user, spent = r.orders.filter((o) => o.status !== "Bekor qilindi").reduce((s, o) => s + o.total, 0);
  $("#uTitle").textContent = u.name;
  box.innerHTML = `
    <div class="ad-ucard ${u.blocked ? "blocked" : ""}">
      <i class="ad-ava lg">${esc(initials(u.name))}</i>
      <div><b>${esc(u.name)}</b><a href="tel:+${esc(u.phone)}">${esc(fmtPhone(u.phone))}</a>${u.email ? `<a href="mailto:${esc(u.email)}">${esc(u.email)}</a>` : ""}</div>
    </div>
    <div class="ad-ustats">
      <div><small>Buyurtmalar</small><b>${r.orders.length}</b></div>
      <div><small>Xarid summasi</small><b>${fmt(spent)}</b></div>
    </div>
    <dl class="ad-dl">
      <dt>Viloyat</dt><dd>${esc(u.region || "—")}</dd>
      <dt>Manzil</dt><dd>${esc(u.address || "—")}</dd>
      <dt>Ro'yxatdan o'tgan</dt><dd>${dt(u.created_at)}</dd>
      <dt>Oxirgi kirish</dt><dd>${dt(u.last_login)}</dd>
      <dt>Parol</dt><dd>🔒 shifrlangan — ko'rib bo'lmaydi</dd>
    </dl>
    <div class="ad-uactions">
      <button class="btn btn-ghost btn-sm" data-uact="reset">🔑 Parolni tiklash</button>
      <button class="btn btn-ghost btn-sm" data-uact="block">${u.blocked ? "✓ Blokdan chiqarish" : "⛔ Bloklash"}</button>
      <button class="btn btn-ghost btn-sm ad-danger" data-uact="delete">O'chirish</button>
    </div>
    <div id="uTemp"></div>
    <h4 class="ad-sub">Buyurtmalari</h4>
    ${r.orders.length ? r.orders.map((o) => `<div class="ad-uorder">
      <header><b>#${esc(o.id)}</b>${statusChip(o.status)}</header>
      <small class="muted">${dt(o.created_at)} · ${esc(payName(o.payment))} · ${o.delivery === "pickup" ? "Do'kondan" : esc(o.address || "")}</small>
      <p>${itemsText(o).map(esc).join("<br>")}</p>
      <b>${fmt(o.total)}</b>
    </div>`).join("") : `<p class="ad-empty">Hali buyurtma bermagan</p>`}`;
  box.onclick = async (e) => {
    const b = e.target.closest("[data-uact]");
    if (!b) return;
    const act = b.dataset.uact;
    if ((act === "delete" || act === "reset") && !b.classList.contains("confirm")) {
      b.classList.add("confirm"); const t = b.textContent;
      b.textContent = act === "delete" ? "Ha, o'chirilsin (buyurtmalar qoladi)" : "Ha, yangi parol berilsin";
      setTimeout(() => { if (b.isConnected) { b.classList.remove("confirm"); b.textContent = t; } }, 3500);
      return;
    }
    b.disabled = true;
    try {
      if (act === "reset") {
        const { password } = await api("POST", `/api/admin/users/${u.id}/reset-password`);
        $("#uTemp").innerHTML = `<div class="ad-temp-pass"><small>Vaqtinchalik parol — mijozga ayting (faqat bir marta ko'rsatiladi):</small><code>${esc(password)}</code><button class="ad-link" id="uCopy">Nusxalash</button></div>`;
        $("#uCopy").onclick = () => navigator.clipboard?.writeText(password).then(() => toast("📋 Nusxalandi"));
        b.classList.remove("confirm"); b.textContent = "🔑 Parolni tiklash";
        toast("🔑 Yangi parol yaratildi, mijozning eski seanslari yopildi");
      } else if (act === "block") {
        await api("PATCH", `/api/admin/users/${u.id}`, { blocked: !u.blocked });
        toast(u.blocked ? "✓ Mijoz blokdan chiqarildi" : "⛔ Mijoz bloklandi — endi kira olmaydi");
        await reloadServer(); return openUser(u.id);
      } else if (act === "delete") {
        await api("DELETE", `/api/admin/users/${u.id}`);
        closeEdit(); toast("Mijoz akkaunti o'chirildi");
        return reloadServer();
      }
    } catch (ex) { toast("❌ " + apiError(ex)); }
    b.disabled = false;
  };
}

// ---------- Promo-kodlar ----------
function renderPromos() {
  const P = Object.entries(S.data.SETTINGS.promos);
  $("#promoList").innerHTML = P.length ? P.map(([code, pct]) => `<div class="ad-promo"><code>${esc(code)}</code><span><b>−${pct}%</b> chegirma</span>
    <div class="ad-actions"><button data-rm-promo="${esc(code)}">O'chirish</button></div></div>`).join("") : `<p class="ad-empty">Promo-kodlar yo'q</p>`;
}
$("#promoList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-rm-promo]");
  if (!b) return;
  delete S.data.SETTINGS.promos[b.dataset.rmPromo];
  update(); toast(`Promo-kod ${b.dataset.rmPromo} o'chirildi`);
});
$("#promoForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const code = $("#promoCode").value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const pct = Math.round(+$("#promoPct").value);
  if (!code || !(pct >= 1 && pct <= 90)) { toast("⚠️ Kod (lotin harf/raqam) va 1–90% oralig'idagi chegirmani kiriting"); return; }
  S.data.SETTINGS.promos[code] = pct;
  e.target.reset(); update(); toast(`🎟 ${code} (−${pct}%) qo'shildi`);
});

// ---------- Sozlamalar ----------
function renderSettings() {
  const s = S.data.SETTINGS, f = $("#settingsForm").elements;
  if (document.activeElement && document.activeElement.form === $("#settingsForm")) return;
  f.topbar.value = s.topbar || ""; f.dealTitle.value = s.dealTitle || "";
  f.freeShipFrom.value = s.freeShipFrom; f.shipPrice.value = s.shipPrice;
  f.apkUrl.value = s.apk.url || ""; f.apkVersion.value = s.apk.version || ""; f.apkSize.value = s.apk.sizeMB || "";
  f.pmMerchant.value = s.pay.payme.merchantId || ""; f.pmAccount.value = s.pay.payme.account || "order_id";
  f.clService.value = s.pay.click.serviceId || ""; f.clMerchant.value = s.pay.click.merchantId || "";
  renderPayState();
}
function renderPayState() {
  const p = S.data.SETTINGS.pay, on = [p.payme.merchantId && "Payme", p.click.serviceId && p.click.merchantId && "Click"].filter(Boolean);
  $("#payState").textContent = on.length ? "Ulangan: " + on.join(", ") : "Ulanmagan";
  $("#payState").classList.toggle("demo", !on.length);
}
$("#settingsForm").addEventListener("input", () => {
  const s = S.data.SETTINGS, f = $("#settingsForm").elements;
  s.topbar = f.topbar.value; s.dealTitle = f.dealTitle.value;
  s.freeShipFrom = Math.max(0, +f.freeShipFrom.value || 0); s.shipPrice = Math.max(0, +f.shipPrice.value || 0);
  s.apk = { url: f.apkUrl.value.trim(), version: f.apkVersion.value.trim(), sizeMB: +f.apkSize.value || 0 };
  s.pay = {
    payme: { merchantId: f.pmMerchant.value.trim(), account: f.pmAccount.value.trim() || "order_id" },
    click: { serviceId: f.clService.value.replace(/\D/g, ""), merchantId: f.clMerchant.value.replace(/\D/g, "") },
  };
  renderPayState();
  markDirty();
});
$("#settingsForm").addEventListener("submit", (e) => e.preventDefault());

// ---------- E'lon qilish (serverga) ----------
$("#publishBtn").addEventListener("click", publish);
async function publish() {
  const btn = $("#publishBtn"), label = btn.firstChild.textContent;
  btn.disabled = true; btn.firstChild.textContent = "E'lon qilinmoqda… ";
  try {
    // 1) Yangi yuklangan rasmlar → server ("srv:..." yo'li bilan almashtiramiz)
    const all = [...S.data.PRODUCTS, ...(S.data.NEWS || []), ...S.data.CATEGORIES];
    const used = new Set(all.map((x) => x.img));
    let imgs = 0;
    for (const [path, dataUrl] of Object.entries(S.uploads)) {
      if (!used.has(path)) continue;
      const r = await api("POST", "/api/admin/images", { data: dataUrl });
      all.forEach((x) => { if (x.img === path) x.img = r.path; });
      delete S.uploads[path];
      imgs++;
    }
    // 2) Ombor qoldig'i: panel ochilgandan beri mijozlar xarid qilgan bo'lishi mumkin.
    //    Admin o'zgartirmagan mahsulotlarda serverdagi joriy qoldiqni saqlaymiz.
    const cur = await api("GET", "/api/catalog"), base = JSON.parse(S.baseJSON);
    const curStock = new Map((cur.PRODUCTS || []).map((p) => [p.id, p.stock]));
    const baseStock = new Map(base.PRODUCTS.map((p) => [p.id, p.stock]));
    S.data.PRODUCTS.forEach((p) => { if (curStock.has(p.id) && baseStock.get(p.id) === p.stock) p.stock = curStock.get(p.id); });
    // 3) Katalogni yozamiz (server oldingi holatni "Tarix" ga saqlaydi)
    const { n } = diff();
    await api("PUT", "/api/admin/catalog", { ...S.data, note: `Admin panel: ${n} ta o'zgarish${imgs ? `, ${imgs} ta rasm` : ""}` });
    S.baseJSON = JSON.stringify(S.data);
    ls.del("opus_admin_draft");
    renderAll();
    $("#syncInfo").textContent = `E'lon qilindi: ${new Date().toLocaleTimeString("ru-RU")} · saytda darhol ko'rinadi`;
    toast("🚀 E'lon qilindi! O'zgarishlar saytda darhol ko'rinadi.");
  } catch (ex) {
    toast("❌ " + apiError(ex));
  } finally {
    btn.firstChild.textContent = label;
    markDirty();
  }
}
addEventListener("beforeunload", (e) => { if (S.data && S.token && diff().n) { e.preventDefault(); e.returnValue = ""; } });

// ---------- Admin kirishi ----------
// Parol serverda tekshiriladi (PBKDF2 xeshi D1 bazasida). Brauzerda faqat 12 soatlik seans tokeni (sessionStorage) turadi.
function showLock(msg) {
  $("#app").hidden = true;
  $("#lock").hidden = false;
  const err = $("#lockError");
  err.textContent = msg || ""; err.hidden = !msg;
  setTimeout(() => $("#lockInput").focus(), 100);
}
function unlocked() {
  $("#lock").hidden = true;
  start().catch((ex) => { if (ex.status !== 401) { toast("❌ Ma'lumotlarni yuklab bo'lmadi: " + apiError(ex)); showLock(apiError(ex)); } });
}

$("#lockEye").addEventListener("click", () => {
  const i = $("#lockInput");
  i.type = i.type === "password" ? "text" : "password";
  i.focus();
});

$("#lockForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("#lockError"), btn = $("#lockBtn"), input = $("#lockInput");
  btn.disabled = true; btn.textContent = "Tekshirilmoqda…"; err.hidden = true;
  try {
    const r = await api("POST", "/api/admin/login", { password: input.value });
    S.token = r.token; ss.set("opus_admin_api", r.token);
    input.value = "";
    unlocked();
  } catch (ex) {
    err.textContent = ex.status === 401 ? "Parol noto'g'ri." : apiError(ex);
    err.hidden = false;
    input.classList.remove("invalid"); void input.offsetWidth; input.classList.add("invalid");
    input.select();
  }
  btn.disabled = false; btn.textContent = "Ochish";
});

// Parolni o'zgartirish — darhol kuchga kiradi
$("#passForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const old = $("#pOld").value, a = $("#pNew").value, b = $("#pNew2").value;
  if (a.length < 8) { toast("⚠️ Parol kamida 8 belgidan iborat bo'lsin"); return; }
  if (a !== b) { toast("⚠️ Parollar bir xil emas"); return; }
  try {
    await api("POST", "/api/admin/password", { old, new: a });
    e.target.reset();
    toast("🔒 Admin paroli o'zgartirildi");
  } catch (ex) { toast("❌ " + apiError(ex)); }
});

async function lockNow() {
  try { await api("POST", "/api/admin/logout"); } catch {}
  S.token = null; ss.del("opus_admin_api");
  location.reload();
}

// Sahifa ochilganda: shu seansda kirilgan bo'lsa — to'g'ridan-to'g'ri panel, aks holda parol
if (S.token) unlocked();
else setTimeout(() => $("#lockInput").focus(), 100);
