// ================= OPUS ADMIN =================
// Do'kon ma'lumotlari (data.js) ni tahrirlaydi va GitHub API orqali bitta commit bilan saytga e'lon qiladi.
// Token faqat brauzerda saqlanadi va faqat api.github.com ga yuboriladi.

const CFG = { owner: "Javohir877", repo: "OPUS-MARKET", branch: "main", dataPath: "data.js", swPath: "sw.js" };
const API = "https://api.github.com";

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

const S = {
  token: null, user: null, demo: false,
  data: null, baseJSON: "", baseSha: null,
  uploads: {},          // "img/u-....jpg" → dataURL (hali e'lon qilinmagan rasmlar)
  published: new Set(), // e'lon qilingan yuklamalar
  view: "dash", editing: null,
};

// Sayt mavzusini (tun/kun) admin ham ishlatadi
document.documentElement.dataset.theme = safe(() => JSON.parse(localStorage.getItem("opus_theme")), null) ||
  (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
$("#repoName").textContent = CFG.repo;

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

// ---------- GitHub API ----------
async function gh(path, opts = {}) {
  const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  if (S.token) headers.Authorization = "Bearer " + S.token;
  if (opts.body) headers["Content-Type"] = "application/json";
  const res = await fetch(API + path, { ...opts, headers, cache: "no-store" });
  if (!res.ok) {
    let msg = "HTTP " + res.status;
    try { msg = (await res.json()).message || msg; } catch {}
    const e = new Error(msg); e.status = res.status; throw e;
  }
  return res.status === 204 ? null : res.json();
}
const repoPath = (p) => `/repos/${CFG.owner}/${CFG.repo}${p}`;
const b64ToText = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), (c) => c.charCodeAt(0)));
const bytesToB64 = (bytes) => { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
const textToB64 = (t) => bytesToB64(new TextEncoder().encode(t));
function apiError(e) {
  if (e.status === 401) return "Token yaroqsiz yoki muddati o'tgan. Yangi token yarating.";
  if (e.status === 403 || e.status === 404) return `Token "${CFG.repo}" repozitoriysiga yozish huquqiga ega emas (Contents: Read and write kerak).`;
  if (e.status === 409 || e.status === 422) return "GitHub o'zgarishni qabul qilmadi: repo boshqa joyda o'zgargan. Sahifani yangilab, qayta urinib ko'ring.";
  if (e instanceof TypeError) return "Internetga ulanib bo'lmadi. Aloqani tekshiring.";
  return "Xato: " + e.message;
}

// ---------- data.js: o'qish va yozish ----------
function parseData(text) {
  const d = new Function(text + "\n;return { SETTINGS: typeof SETTINGS !== 'undefined' ? SETTINGS : {}, CATEGORIES, PRODUCTS, NEWS: typeof NEWS !== 'undefined' ? NEWS : [] };")();
  d.SETTINGS = { topbar: "", dealTitle: "", freeShipFrom: 1000000, shipPrice: 50000, promos: {}, apk: { url: "", version: "", sizeMB: 0 }, ...d.SETTINGS };
  d.SETTINGS.promos = d.SETTINGS.promos || {};
  d.SETTINGS.apk = { url: "", version: "", sizeMB: 0, ...(d.SETTINGS.apk || {}) };
  return d;
}
function serializeData(d) {
  const line = (o) => "  " + JSON.stringify(o);
  return `// OPUS MARKET — do'kon ma'lumotlari. Bu faylni admin panel (admin.html) tahrirlaydi va qayta yozadi.
// O'zgarmas narsalar (rasm yordamchilari, to'lov logotiplari, ikonkalar) — assets.js da.
// Oxirgi tahrir: ${new Date().toLocaleString("ru-RU")} (admin panel)

const SETTINGS = ${JSON.stringify(d.SETTINGS, null, 2)};

const CATEGORIES = [
${d.CATEGORIES.map(line).join(",\n")}
];

const PRODUCTS = [
${d.PRODUCTS.map(line).join(",\n")}
];

// Yangiliklar. body: xatboshilar bo'sh qator (\\n\\n) bilan ajratiladi.
const NEWS = [
${(d.NEWS || []).map(line).join(",\n")}
];
`;
}
async function loadData() {
  let text;
  if (S.token) {
    const f = await gh(repoPath(`/contents/${CFG.dataPath}?ref=${CFG.branch}`));
    text = b64ToText(f.content);
    S.baseSha = f.sha;
  } else {
    text = await (await fetch(`${CFG.dataPath}?nocache=${Date.now()}`, { cache: "no-store" })).text();
    S.baseSha = "demo";
  }
  S.data = parseData(text);
  S.baseJSON = JSON.stringify(S.data);
  $("#syncInfo").textContent = `Ma'lumotlar yuklandi: ${new Date().toLocaleTimeString("ru-RU")}${S.demo ? " · ko'rish rejimi" : ""}`;
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
  if (n) ls.set("opus_admin_draft", { baseSha: S.baseSha, data: S.data, uploads: S.uploads, at: Date.now() });
  else ls.del("opus_admin_draft");
}
function update() { renderAll(); markDirty(); }

// ---------- Ishga tushirish ----------
// Token shart emas: panel paroldan keyin darhol ochiladi.
// GitHub ulanishi — Sozlamalarda, ixtiyoriy (ulansa "E'lon qilish" saytga to'g'ridan-to'g'ri yozadi).
const TOKEN_KEY = "opus_admin_token";
async function connectToken(token) {
  S.token = token.trim();
  const user = await gh("/user");
  const repo = await gh(repoPath(""));
  if (repo.permissions && repo.permissions.push === false) { const e = new Error("no push"); e.status = 403; throw e; }
  S.user = user; S.demo = false;
}
function forgetToken() {
  S.token = null; S.user = null; S.demo = true;
  safe(() => { sessionStorage.removeItem(TOKEN_KEY); localStorage.removeItem(TOKEN_KEY); });
}
async function start() {
  const saved = safe(() => sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY), null);
  if (saved) { try { await connectToken(saved); } catch { forgetToken(); } }
  S.demo = !S.token;
  try { await loadData(); }
  catch (ex) { toast("❌ " + apiError(ex)); forgetToken(); await loadData(); }
  enterApp();
}
function refreshMode() {
  const on = !!S.token;
  $("#adUser").innerHTML = (on
    ? `<span class="ad-mode">GitHub'ga ulangan</span><b>${esc(S.user.login)}</b><span class="muted">"E'lon qilish" saytga to'g'ridan-to'g'ri yozadi</span>`
    : `<span class="ad-mode demo">Mahalliy rejim</span><span class="muted">"Saqlash" tayyor data.js faylini yuklab beradi</span>`)
    + `<button class="ad-link" id="lockNowBtn">🔒 Qulflash</button>`;
  $("#lockNowBtn").addEventListener("click", lockNow);
  $("#publishBtn").firstChild.textContent = on ? "E'lon qilish " : "Saqlash ";
  $("#publishBtn").title = on ? "Saytga e'lon qilish (Ctrl+S)" : "data.js va yangi rasmlarni yuklab olish (Ctrl+S)";
  $("#ghState").textContent = on ? "Ulangan: " + S.user.login : "Ulanmagan";
  $("#ghState").classList.toggle("demo", !on);
  $("#ghForm").classList.toggle("connected", on);
  $("#ghDisconnect").hidden = !on;
  $("#syncInfo").textContent = `Ma'lumotlar yuklandi: ${new Date().toLocaleTimeString("ru-RU")}${on ? "" : " · mahalliy rejim"}`;
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

// Sozlamalar → GitHub ulanishi (ixtiyoriy)
$("#ghForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const token = $("#tokenInput").value, err = $("#loginError"), btn = $("#loginBtn");
  err.hidden = true;
  if (!token.trim()) { err.textContent = "Tokenni kiriting."; err.hidden = false; return; }
  btn.disabled = true; btn.textContent = "Tekshirilmoqda…";
  try {
    await connectToken(token);
    safe(() => ($("#rememberInput").checked ? localStorage : sessionStorage).setItem(TOKEN_KEY, S.token));
    // Saytdagi joriy data.js versiyasi — e'lon qilishda boshqa joydagi o'zgarishlar ustidan yozmaslik uchun
    const f = await gh(repoPath(`/contents/${CFG.dataPath}?ref=${CFG.branch}`));
    S.baseSha = f.sha;
    $("#tokenInput").value = "";
    refreshMode(); markDirty();
    toast("✓ GitHub'ga ulandi — endi \"E'lon qilish\" saytga to'g'ridan-to'g'ri yozadi");
  } catch (ex) { forgetToken(); err.textContent = apiError(ex); err.hidden = false; refreshMode(); }
  btn.disabled = false; btn.textContent = "Ulash";
});
$("#ghDisconnect").addEventListener("click", () => {
  forgetToken(); S.baseSha = "demo";
  refreshMode(); markDirty();
  toast("GitHub ulanishi uzildi — \"Saqlash\" endi faylni yuklab beradi");
});

$("#draftRestore").addEventListener("click", () => {
  const d = ls.get("opus_admin_draft", null);
  if (d) { S.data = d.data; S.uploads = d.uploads || {}; update(); toast("💾 Qoralama tiklandi"); }
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
const TITLES = { dash: "Boshqaruv", products: "Mahsulotlar", news: "Yangiliklar", cats: "Kategoriyalar", orders: "Buyurtmalar", promos: "Promo-kodlar", settings: "Sozlamalar", history: "O'zgarishlar tarixi" };
function go(view) {
  S.view = view;
  $$("#adNav button").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  $$(".ad-view").forEach((v) => (v.hidden = v.dataset.view !== view));
  $("#viewTitle").textContent = TITLES[view];
  scrollTo({ top: 0 });
}
$("#adNav").addEventListener("click", (e) => { const b = e.target.closest("[data-view]"); if (b) go(b.dataset.view); });
document.addEventListener("click", (e) => { const g = e.target.closest("[data-goto]"); if (g) go(g.dataset.goto); });

// ---------- Ko'rinishlar ----------
const orders = () => ls.get("opus_orders", []);
const STATUSES = ["Yangi", "Tasdiqlandi", "Yig'ilmoqda", "Yo'lda", "Yetkazildi", "Bekor qilindi"];
const statusOf = (id) => ls.get("opus_admin_status", {})[id] || "Yangi";

function renderAll() {
  const P = S.data.PRODUCTS;
  $("#navProducts").textContent = P.length;
  $("#navOrders").textContent = orders().length;
  $("#navNews").textContent = (S.data.NEWS || []).length;
  renderKpis(); renderLow(); renderRecentOrders(); renderCats();
  renderProducts(); renderOrders(); renderPromos(); renderSettings();
  renderNewsList(); renderCatEditor();
}

function renderKpis() {
  const P = S.data.PRODUCTS, O = orders();
  const units = P.reduce((s, p) => s + (+p.stock || 0), 0);
  const value = P.reduce((s, p) => s + p.price * (+p.stock || 0), 0);
  const low = P.filter((p) => p.stock <= 5), out = P.filter((p) => p.stock <= 0);
  const sale = P.filter((p) => p.old && p.old > p.price);
  const avgDisc = sale.length ? Math.round(sale.reduce((s, p) => s + (1 - p.price / p.old) * 100, 0) / sale.length) : 0;
  const tiles = [
    { t: "Mahsulotlar", v: P.length, e: `${S.data.CATEGORIES.length} ta kategoriya` },
    { t: "Omborda", v: num(units) + " dona", e: "Qiymati: " + fmt(value) },
    { t: "Kam qolgan", v: low.length, e: out.length ? `⛔ ${out.length} tasi tugagan` : "≤ 5 dona qolganlar", warn: low.length > 0 },
    { t: "Chegirmada", v: sale.length, e: sale.length ? `O'rtacha −${avgDisc}%` : "Chegirma yo'q" },
    { t: "Original belgisi", v: `${P.filter((p) => p.original !== false).length}/${P.length}`, e: "✓ belgili mahsulotlar" },
    { t: "Yangiliklar", v: (S.data.NEWS || []).length, e: (S.data.NEWS || []).length ? "Oxirgisi: " + (S.data.NEWS.map((n) => n.date).sort().pop() || "—") : "Hali yo'q" },
    { t: "Buyurtmalar", v: O.length, e: O.length ? "Jami: " + fmt(O.reduce((s, o) => s + o.total, 0)) : "Shu brauzerda hali yo'q" },
  ];
  $("#kpis").innerHTML = tiles.map((k) => `<div class="ad-kpi ${k.warn ? "warn" : ""}"><small>${k.t}</small><b>${k.v}</b><em>${k.e}</em></div>`).join("");
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
  const O = orders().slice(-5).reverse();
  $("#recentOrders").innerHTML = O.length ? `<table class="ad-table" style="min-width:0">${O.map((o) => `
    <tr><td><b>#${esc(o.id)}</b><br><small class="muted">${new Date(o.date).toLocaleString("ru-RU")}</small></td>
    <td>${esc(o.name || "—")}</td><td class="num">${fmt(o.total)}</td><td><span class="chip ${statusOf(o.id) === "Bekor qilindi" ? "bad" : statusOf(o.id) === "Yetkazildi" ? "ok" : "warn"}">${statusOf(o.id)}</span></td></tr>`).join("")}</table>`
    : `<p class="ad-empty">Bu brauzerda hali buyurtma berilmagan</p>`;
}

function renderCats() {
  const rows = S.data.CATEGORIES.map((c) => {
    const ps = S.data.PRODUCTS.filter((p) => p.cat === c.id);
    return { c, n: ps.length, units: ps.reduce((s, p) => s + (+p.stock || 0), 0), min: ps.length ? Math.min(...ps.map((p) => p.price)) : 0, max: ps.length ? Math.max(...ps.map((p) => p.price)) : 0 };
  });
  $("#catTable").innerHTML = `<table class="ad-table"><thead><tr><th>Kategoriya</th><th class="num">Mahsulotlar</th><th class="num">Omborda</th><th class="num">Narxlar oralig'i</th><th></th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td><b>${esc(r.c.name)}</b></td><td class="num">${r.n}</td><td class="num">${num(r.units)} dona</td>
    <td class="num">${r.n ? `${fmt(r.min)} — ${fmt(r.max)}` : "—"}</td><td class="num"><button class="ad-link" data-filter-cat="${r.c.id}">Ko'rish →</button></td></tr>`).join("")}</tbody></table>`;
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
      <td><input type="checkbox" class="ad-cb" data-sel ${S.sel.has(p.id) ? "checked" : ""} aria-label="Tanlash" /></td>
      <td><img class="ad-thumb" src="${esc(srcOf(p.img))}" alt="" loading="lazy" /></td>
      <td class="ad-pname"><b title="${esc(p.name)}">${esc(p.name)}</b><small>${esc(p.brand)} · ID ${p.id}</small></td>
      <td>${esc(catName(p.cat))}</td>
      <td class="num"><input class="cell" type="number" min="0" step="1000" data-field="price" value="${p.price}" aria-label="Narx" /></td>
      <td class="num"><input class="cell" type="number" min="0" step="1000" data-field="old" value="${p.old || ""}" placeholder="—" aria-label="Eski narx" /></td>
      <td class="num"><input class="cell sm" type="number" min="0" data-field="stock" value="${p.stock}" aria-label="Ombor" /></td>
      <td>${stockChip(p.stock)}${p.old && p.old > p.price ? ` <span class="chip sale">−${Math.round((1 - p.price / p.old) * 100)}%</span>` : ""}</td>
      <td><select class="ad-status-select" data-field="badge" aria-label="Belgi">${["", "Yangi", "Xit"].map((b) => `<option value="${b}" ${(p.badge || "") === b ? "selected" : ""}>${b || "—"}</option>`).join("")}</select></td>
      <td><label class="ad-switch" title="Original belgisi"><input type="checkbox" data-field="original" ${p.original !== false ? "checked" : ""} /><span></span></label></td>
      <td><div class="ad-actions"><button data-act="edit">Tahrirlash</button><button data-act="dup" title="Nusxa olish">⧉</button></div></td>
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
    <td><input class="cell wide" data-cfield="name" value="${esc(c.name)}" aria-label="Kategoriya nomi" /></td>
    <td><code>${esc(c.id)}</code></td>
    <td class="num">${S.data.PRODUCTS.filter((p) => p.cat === c.id).length}</td>
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

// ---------- Tarix (GitHub commitlari) ----------
$("#historyLoad").addEventListener("click", loadHistory);
async function loadHistory() {
  const box = $("#historyList");
  box.innerHTML = `<p class="ad-empty">Yuklanmoqda…</p>`;
  try {
    const list = await gh(repoPath(`/commits?path=${CFG.dataPath}&sha=${CFG.branch}&per_page=25`));
    box.innerHTML = list.length ? `<div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>Sana</th><th>O'zgarish</th><th>Muallif</th><th></th></tr></thead><tbody>
      ${list.map((c, i) => `<tr><td class="num" style="text-align:left">${new Date(c.commit.author.date).toLocaleString("ru-RU")}${i === 0 ? ` <span class="chip ok">joriy</span>` : ""}</td>
      <td>${esc(c.commit.message.split("\n")[0])}</td><td>${esc((c.author && c.author.login) || c.commit.author.name)}</td>
      <td><div class="ad-actions">${i === 0 ? "" : `<button data-restore="${c.sha}">Shu versiyani ochish</button>`}<a class="btn btn-ghost btn-sm" href="${esc(c.html_url)}" target="_blank" rel="noopener">GitHub ↗</a></div></td></tr>`).join("")}
      </tbody></table></div>` : `<p class="ad-empty">Tarix topilmadi</p>`;
  } catch (ex) { box.innerHTML = `<p class="ad-empty">${esc(apiError(ex))}</p>`; }
}
$("#historyList").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-restore]");
  if (!b) return;
  b.disabled = true; b.textContent = "Ochilmoqda…";
  try {
    const f = await gh(repoPath(`/contents/${CFG.dataPath}?ref=${b.dataset.restore}`));
    S.data = parseData(b64ToText(f.content));
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

// ---------- Buyurtmalar ----------
function renderOrders() {
  const oq = ($("#oSearch").value || "").trim().toLowerCase();
  const O = orders().slice().reverse().filter((o) => !oq || [o.id, o.name, o.phone].join(" ").toLowerCase().includes(oq));
  const payName = (id) => (PAYMENTS.find((p) => p.id === id) || {}).name || id;
  $("#oTable").innerHTML = `<thead><tr><th>Buyurtma</th><th>Mijoz</th><th>Manzil</th><th>Mahsulotlar</th><th>To'lov</th><th class="num">Summa</th><th>Holat</th></tr></thead><tbody>
  ${O.length ? O.map((o) => `<tr>
    <td><b>#${esc(o.id)}</b><br><small class="muted">${new Date(o.date).toLocaleString("ru-RU")}</small></td>
    <td>${esc(o.name || "—")}<br><small class="muted">${esc(o.phone || "")}</small></td>
    <td>${o.delivery === "pickup" ? "🏬 Do'kondan olib ketadi" : `${esc(o.region || "")}<br><small class="muted">${esc(o.address || "")}</small>`}</td>
    <td>${(o.items || []).map((i) => { const p = S.data.PRODUCTS.find((x) => x.id === i.id); return `${esc(p ? p.name : "ID " + i.id)} × ${i.qty}`; }).join("<br>")}</td>
    <td>${esc(payName(o.payment))}${o.months ? `<br><small class="muted">${o.months} oy</small>` : ""}</td>
    <td class="num"><b>${fmt(o.total)}</b></td>
    <td><select class="ad-status-select" data-order="${esc(o.id)}" aria-label="Holat">${STATUSES.map((s) => `<option ${statusOf(o.id) === s ? "selected" : ""}>${s}</option>`).join("")}</select></td>
  </tr>`).join("") : `<tr><td colspan="7" class="ad-empty">Bu brauzerda hali buyurtma yo'q. Saytda sinov buyurtmasi bering — u shu yerda paydo bo'ladi.</td></tr>`}</tbody>`;
}
$("#oSearch").addEventListener("input", renderOrders);
$("#oExport").addEventListener("click", () => {
  const O = orders();
  if (!O.length) { toast("Eksport uchun buyurtma yo'q"); return; }
  const payName = (id) => (PAYMENTS.find((p) => p.id === id) || {}).name || id;
  const rows = [["Raqam", "Sana", "Mijoz", "Telefon", "Viloyat", "Manzil", "Mahsulotlar", "To'lov", "Summa", "Holat"].join(";"),
    ...O.map((o) => [o.id, new Date(o.date).toLocaleString("ru-RU"), o.name, o.phone, o.region, o.delivery === "pickup" ? "Do'kondan" : o.address,
      (o.items || []).map((i) => { const p = S.data.PRODUCTS.find((x) => x.id === i.id); return `${p ? p.name : "ID " + i.id} x${i.qty}`; }).join(", "),
      payName(o.payment), Math.round(o.total), statusOf(o.id)].map(csvCell).join(";"))];
  download(`opus-buyurtmalar-${today()}.csv`, rows.join("\n"));
});
$("#oTable").addEventListener("change", (e) => {
  const id = e.target.dataset.order;
  if (!id) return;
  const st = ls.get("opus_admin_status", {}); st[id] = e.target.value; ls.set("opus_admin_status", st);
  renderRecentOrders(); toast(`Buyurtma #${id}: ${e.target.value}`);
});

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
}
$("#settingsForm").addEventListener("input", () => {
  const s = S.data.SETTINGS, f = $("#settingsForm").elements;
  s.topbar = f.topbar.value; s.dealTitle = f.dealTitle.value;
  s.freeShipFrom = Math.max(0, +f.freeShipFrom.value || 0); s.shipPrice = Math.max(0, +f.shipPrice.value || 0);
  s.apk = { url: f.apkUrl.value.trim(), version: f.apkVersion.value.trim(), sizeMB: +f.apkSize.value || 0 };
  markDirty();
});
$("#settingsForm").addEventListener("submit", (e) => e.preventDefault());

// ---------- E'lon qilish (bitta commit) ----------
$("#publishBtn").addEventListener("click", publish);
async function publish() {
  const btn = $("#publishBtn");
  if (S.demo) {
    // Mahalliy rejim: tayyor data.js va yangi yuklangan rasmlarni kompyuterga yuklab beramiz
    const save = (name, href) => { const a = document.createElement("a"); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove(); };
    const url = URL.createObjectURL(new Blob([serializeData(S.data)], { type: "text/javascript" }));
    save("data.js", url);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    const used = new Set([...S.data.PRODUCTS.map((p) => p.img), ...(S.data.NEWS || []).map((n) => n.img), ...S.data.CATEGORIES.map((c) => c.img)]);
    const imgs = Object.entries(S.uploads).filter(([p]) => used.has(p));
    imgs.forEach(([path, dataUrl], i) => setTimeout(() => save(path.replace(/^img\//, ""), dataUrl), 400 * (i + 1)));
    toast(imgs.length
      ? `⬇️ data.js va ${imgs.length} ta rasm yuklab olindi. data.js ni loyiha papkasiga, rasmlarni img/ papkasiga qo'ying.`
      : "⬇️ data.js yuklab olindi. Uni loyiha papkasidagi eski data.js o'rniga qo'ying — keyin saytga joylanadi.");
    return;
  }
  const label = btn.firstChild.textContent;
  btn.disabled = true; btn.firstChild.textContent = "E'lon qilinmoqda… ";
  try {
    // 1) Boshqa joyda o'zgargan bo'lsa — ustidan yozib yubormaymiz
    const cur = await gh(repoPath(`/contents/${CFG.dataPath}?ref=${CFG.branch}`));
    if (cur.sha !== S.baseSha && !S.force) {
      S.force = true;
      toast("⚠️ data.js oxirgi yuklashdan keyin boshqa joyda o'zgargan. Ustidan yozish uchun yana bir bor \"E'lon qilish\" ni bosing yoki sahifani yangilang.");
      return;
    }
    // 2) Joriy commit va tree
    const ref = await gh(repoPath(`/git/ref/heads/${CFG.branch}`));
    const head = await gh(repoPath(`/git/commits/${ref.object.sha}`));
    // 3) Fayllar: data.js, sw.js (kesh versiyasi +1) va yangi rasmlar
    const files = [{ path: CFG.dataPath, b64: textToB64(serializeData(S.data)) }];
    const sw = await gh(repoPath(`/contents/${CFG.swPath}?ref=${CFG.branch}`));
    const swText = b64ToText(sw.content).replace(/const VERSION = "opus-v(\d+)"/, (_, n) => `const VERSION = "opus-v${+n + 1}"`);
    files.push({ path: CFG.swPath, b64: textToB64(swText) });
    const used = new Set([...S.data.PRODUCTS.map((p) => p.img), ...(S.data.NEWS || []).map((n) => n.img), ...S.data.CATEGORIES.map((c) => c.img)]);
    Object.entries(S.uploads).forEach(([path, url]) => {
      if (used.has(path) && !S.published.has(path)) files.push({ path, b64: url.split(",")[1], upload: true });
    });
    const tree = [];
    for (const f of files) {
      const blob = await gh(repoPath("/git/blobs"), { method: "POST", body: JSON.stringify({ content: f.b64, encoding: "base64" }) });
      tree.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
      if (f.path === CFG.dataPath) f.sha = blob.sha;
    }
    const newTree = await gh(repoPath("/git/trees"), { method: "POST", body: JSON.stringify({ base_tree: head.tree.sha, tree }) });
    const { n } = diff();
    const commit = await gh(repoPath("/git/commits"), { method: "POST", body: JSON.stringify({
      message: `Admin panel: ${n} ta o'zgarish${files.some((f) => f.upload) ? `, ${files.filter((f) => f.upload).length} ta rasm` : ""}`,
      tree: newTree.sha, parents: [head.sha],
    }) });
    await gh(repoPath(`/git/refs/heads/${CFG.branch}`), { method: "PATCH", body: JSON.stringify({ sha: commit.sha }) });

    files.filter((f) => f.upload).forEach((f) => S.published.add(f.path));
    S.baseSha = files[0].sha; S.baseJSON = JSON.stringify(S.data); S.force = false;
    ls.del("opus_admin_draft");
    markDirty(); renderProducts();
    $("#syncInfo").textContent = `E'lon qilindi: ${new Date().toLocaleTimeString("ru-RU")} · sayt 1–2 daqiqada yangilanadi`;
    toast("🚀 E'lon qilindi! Sayt 1–2 daqiqada yangilanadi.");
  } catch (ex) {
    toast("❌ " + apiError(ex));
  } finally {
    btn.firstChild.textContent = label;
    markDirty();
  }
}
addEventListener("beforeunload", (e) => { if (S.data && diff().n && !S.demo) { e.preventDefault(); e.returnValue = ""; } });

// ---------- Admin paroli ----------
// Parolning o'zi hech qayerda saqlanmaydi — faqat PBKDF2-SHA256 xeshi (150 000 takror).
// Standart parol xeshi shu yerda; admin parolni o'zgartirsa, yangi xesh data.js → SETTINGS.adminPass ga yoziladi.
const DEFAULT_PASS = { salt: "opus-market-admin-v1", iter: 150000, hash: "d318ded1f0994c0f13405888a3ac6be9e7ee69912a902749d2848f00d2317a57" };
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
async function pbkdf2(pw, salt, iter) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: iter }, key, 256));
}
async function currentPass() {
  try {
    const d = parseData(await (await fetch(`${CFG.dataPath}?nocache=${Date.now()}`, { cache: "no-store" })).text());
    if (d.SETTINGS.adminPass && d.SETTINGS.adminPass.hash) return d.SETTINGS.adminPass;
  } catch {}
  return DEFAULT_PASS;
}
let PASS = DEFAULT_PASS;
const ss = {
  get: (k) => safe(() => sessionStorage.getItem(k), null),
  set: (k, v) => safe(() => sessionStorage.setItem(k, v)),
  del: (k) => safe(() => sessionStorage.removeItem(k)),
};

function unlocked() {
  $("#lock").hidden = true;
  start().catch((ex) => toast("❌ Ma'lumotlarni yuklab bo'lmadi: " + apiError(ex)));
}

$("#lockEye").addEventListener("click", () => {
  const i = $("#lockInput");
  i.type = i.type === "password" ? "text" : "password";
  i.focus();
});

$("#lockForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("#lockError"), btn = $("#lockBtn"), input = $("#lockInput");
  // Ketma-ket xato urinishlardan keyin kutish vaqti
  const until = +ss.get("opus_admin_wait") || 0;
  if (Date.now() < until) {
    err.textContent = `Juda ko'p xato urinish. ${Math.ceil((until - Date.now()) / 1000)} soniyadan keyin qayta urinib ko'ring.`;
    err.hidden = false; return;
  }
  btn.disabled = true; btn.textContent = "Tekshirilmoqda…"; err.hidden = true;
  let ok = false;
  try { ok = (await pbkdf2(input.value, PASS.salt, PASS.iter || 150000)) === PASS.hash; }
  catch { err.textContent = "Brauzer parolni tekshira olmadi (sayt https orqali ochilishi kerak)."; err.hidden = false; }
  btn.disabled = false; btn.textContent = "Ochish";
  if (ok) {
    ss.set("opus_admin_unlock", PASS.hash);
    ss.del("opus_admin_fails"); ss.del("opus_admin_wait");
    input.value = "";
    unlocked();
    return;
  }
  if (!err.hidden) return;
  const fails = (+ss.get("opus_admin_fails") || 0) + 1;
  ss.set("opus_admin_fails", fails);
  if (fails >= 5) ss.set("opus_admin_wait", Date.now() + 30000 * (fails - 4));
  err.textContent = fails >= 5 ? "Parol noto'g'ri. Juda ko'p urinish — 30 soniya kuting." : `Parol noto'g'ri (${fails}/5).`;
  err.hidden = false;
  input.classList.remove("invalid"); void input.offsetWidth; input.classList.add("invalid");
  input.select();
});

// Parolni o'zgartirish (yangi xesh "E'lon qilish" bilan saytga yoziladi)
$("#passForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const a = $("#pNew").value, b = $("#pNew2").value;
  if (a.length < 8) { toast("⚠️ Parol kamida 8 belgidan iborat bo'lsin"); return; }
  if (a !== b) { toast("⚠️ Parollar bir xil emas"); return; }
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  S.data.SETTINGS.adminPass = { salt, iter: 150000, hash: await pbkdf2(a, salt, 150000) };
  e.target.reset();
  markDirty();
  toast(`🔒 Yangi parol tayyor — kuchga kirishi uchun "${S.token ? "E'lon qilish" : "Saqlash"}" ni bosing`);
});

function lockNow() {
  ss.del("opus_admin_unlock");
  location.reload();
}

// Sahifa ochilganda: parol so'raymiz (shu seansda kiritilgan bo'lsa — o'tkazib yuboramiz)
(async () => {
  PASS = await currentPass();
  if (ss.get("opus_admin_unlock") === PASS.hash) unlocked();
  else setTimeout(() => $("#lockInput").focus(), 100);
})();

