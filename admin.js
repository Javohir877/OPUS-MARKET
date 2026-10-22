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
  const d = new Function(text + "\n;return { SETTINGS: typeof SETTINGS !== 'undefined' ? SETTINGS : {}, CATEGORIES, PRODUCTS };")();
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
  if (canon(base.SETTINGS) !== canon(S.data.SETTINGS)) n++;
  if (canon(base.CATEGORIES) !== canon(S.data.CATEGORIES)) n++;
  return { n, changed };
}
function markDirty() {
  const { n } = diff();
  $("#publishBtn").disabled = n === 0;
  $("#discardBtn").hidden = n === 0;
  $("#dirtyCount").hidden = n === 0;
  $("#dirtyCount").textContent = n;
  if (n) ls.set("opus_admin_draft", { baseSha: S.baseSha, data: S.data, uploads: S.uploads, at: Date.now() });
  else ls.del("opus_admin_draft");
}
function update() { renderAll(); markDirty(); }

// ---------- Kirish ----------
async function login(token, remember) {
  S.token = token.trim();
  const user = await gh("/user");
  const repo = await gh(repoPath(""));
  if (repo.permissions && repo.permissions.push === false) { const e = new Error("no push"); e.status = 403; throw e; }
  S.user = user;
  safe(() => (remember ? localStorage : sessionStorage).setItem("opus_admin_token", S.token));
  await loadData();
  enterApp();
}
async function enterDemo() {
  S.demo = true; S.token = null;
  await loadData();
  enterApp();
}
function enterApp() {
  $("#login").hidden = true;
  $("#app").hidden = false;
  $("#adUser").innerHTML = S.demo
    ? `<span class="ad-mode demo">Ko'rish rejimi</span><span class="muted">E'lon qilish o'rniga data.js faylini yuklab olasiz.</span><button class="ad-link" id="logoutBtn">Token bilan kirish</button>`
    : `<span class="ad-mode">GitHub'ga ulangan</span><b>${esc(S.user.login)}</b><span class="muted">${esc(CFG.owner)}/${esc(CFG.repo)}</span><button class="ad-link" id="logoutBtn">Chiqish</button>`;
  $("#logoutBtn").addEventListener("click", logout);
  $("#publishBtn").firstChild.textContent = S.demo ? "data.js yuklab olish " : "E'lon qilish ";
  fillSelects();
  renderAll();
  markDirty();
  const draft = ls.get("opus_admin_draft", null);
  if (draft && draft.baseSha === S.baseSha && JSON.stringify(draft.data) !== S.baseJSON) $("#draftBanner").hidden = false;
}
function logout() {
  safe(() => { sessionStorage.removeItem("opus_admin_token"); localStorage.removeItem("opus_admin_token"); });
  location.reload();
}

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const token = $("#tokenInput").value;
  const err = $("#loginError");
  err.hidden = true;
  if (!token.trim()) { err.textContent = "Tokenni kiriting."; err.hidden = false; return; }
  const btn = $("#loginBtn");
  btn.disabled = true; btn.textContent = "Tekshirilmoqda…";
  try { await login(token, $("#rememberInput").checked); }
  catch (ex) { S.token = null; err.textContent = apiError(ex); err.hidden = false; }
  btn.disabled = false; btn.textContent = "Kirish";
});
$("#demoBtn").addEventListener("click", () => enterDemo().catch((ex) => { $("#loginError").textContent = apiError(ex); $("#loginError").hidden = false; }));

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
const TITLES = { dash: "Boshqaruv", products: "Mahsulotlar", orders: "Buyurtmalar", promos: "Promo-kodlar", settings: "Sozlamalar" };
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
  renderKpis(); renderLow(); renderRecentOrders(); renderCats();
  renderProducts(); renderOrders(); renderPromos(); renderSettings();
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
    (!st || (st === "low" && p.stock <= 5) || (st === "out" && p.stock <= 0) || (st === "sale" && p.old && p.old > p.price))
  );
  $("#pTable").innerHTML = `<thead><tr><th></th><th>Mahsulot</th><th>Kategoriya</th><th class="num">Narx</th><th class="num">Eski narx</th><th class="num">Ombor</th><th>Holat</th><th>Belgi</th><th></th></tr></thead>
  <tbody>${list.length ? list.map((p) => `
    <tr data-id="${p.id}" class="${changed.has(p.id) ? "changed" : ""}">
      <td><img class="ad-thumb" src="${esc(srcOf(p.img))}" alt="" loading="lazy" /></td>
      <td class="ad-pname"><b title="${esc(p.name)}">${esc(p.name)}</b><small>${esc(p.brand)} · ID ${p.id}</small></td>
      <td>${esc(catName(p.cat))}</td>
      <td class="num"><input class="cell" type="number" min="0" step="1000" data-field="price" value="${p.price}" aria-label="Narx" /></td>
      <td class="num"><input class="cell" type="number" min="0" step="1000" data-field="old" value="${p.old || ""}" placeholder="—" aria-label="Eski narx" /></td>
      <td class="num"><input class="cell sm" type="number" min="0" data-field="stock" value="${p.stock}" aria-label="Ombor" /></td>
      <td>${stockChip(p.stock)}${p.old && p.old > p.price ? ` <span class="chip sale">−${Math.round((1 - p.price / p.old) * 100)}%</span>` : ""}</td>
      <td><select class="ad-status-select" data-field="badge" aria-label="Belgi">${["", "Yangi", "Xit"].map((b) => `<option value="${b}" ${(p.badge || "") === b ? "selected" : ""}>${b || "—"}</option>`).join("")}</select></td>
      <td><div class="ad-actions"><button data-act="edit">Tahrirlash</button><button data-act="dup" title="Nusxa olish">⧉</button></div></td>
    </tr>`).join("") : `<tr><td colspan="9" class="ad-empty">Hech narsa topilmadi</td></tr>`}</tbody>`;
}
["#pSearch", "#pCat", "#pStock"].forEach((s) => $(s).addEventListener("input", renderProducts));

// Jadvaldagi tezkor tahrir (narx, eski narx, ombor, belgi)
function onCellChange(e) {
  const f = e.target.dataset.field;
  const row = e.target.closest("[data-id]");
  if (!f || !row) return;
  const p = S.data.PRODUCTS.find((x) => x.id === +row.dataset.id);
  if (!p) return;
  if (f === "badge") { if (e.target.value) p.badge = e.target.value; else delete p.badge; }
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
  $("#specList").innerHTML = "";
  const specs = Object.entries(v.specs || {});
  (specs.length ? specs : [["", ""]]).forEach(([k, val]) => addSpecRow(k, val));
  showPreview();
  $("#deleteBtn").hidden = !p;
  resetDelete();
  drawer.classList.add("open"); overlay.classList.add("show"); document.body.classList.add("lock");
  setTimeout(() => form.elements.name.focus(), 300);
}
function closeEdit() { drawer.classList.remove("open"); overlay.classList.remove("show"); document.body.classList.remove("lock"); }
overlay.addEventListener("click", closeEdit);
$("[data-close]", drawer).addEventListener("click", closeEdit);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && drawer.classList.contains("open")) closeEdit(); });
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
$("#imgFile").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, 800 / Math.max(im.width, im.height));
      const c = document.createElement("canvas");
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      const g = c.getContext("2d");
      g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(im, 0, 0, c.width, c.height);
      const path = `img/u-${S.editing || "new"}-${Date.now()}.jpg`;
      S.uploads[path] = c.toDataURL("image/jpeg", 0.85);
      form.elements.img.value = path;
      showPreview();
      toast(`📷 Rasm tayyor (${c.width}×${c.height}) — "Saqlash" va "E'lon qilish" ni bosing`);
    };
    im.onerror = () => toast("❌ Bu faylni rasm sifatida ochib bo'lmadi");
    im.src = reader.result;
  };
  reader.readAsDataURL(file);
  e.target.value = "";
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
    img: f.img.value.trim(), desc: f.desc.value.trim(), specs,
  };
  if (!val.name || !val.brand) { toast("⚠️ Nomi va brendni kiriting"); return; }
  if (val.old && val.old <= val.price) { toast("⚠️ Eski narx yangi narxdan katta bo'lishi kerak (yoki bo'sh qoldiring)"); return; }
  // Maydonlar tartibi data.js dagidek: id, cat, brand, name, price, old, rating, reviews, stock, popular, badge, img, gallery, desc, specs
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

// ---------- Buyurtmalar ----------
function renderOrders() {
  const O = orders().slice().reverse();
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
    const blob = new Blob([serializeData(S.data)], { type: "text/javascript" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "data.js"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast("⬇️ data.js yuklab olindi. Uni loyiha papkasidagi eski fayl o'rniga qo'ying.");
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
    const used = new Set(S.data.PRODUCTS.map((p) => p.img));
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

// ---------- Avtomatik kirish (saqlangan token) ----------
(async () => {
  const saved = safe(() => sessionStorage.getItem("opus_admin_token") || localStorage.getItem("opus_admin_token"), null);
  if (!saved) return;
  $("#loginBtn").disabled = true; $("#loginBtn").textContent = "Ulanmoqda…";
  try { await login(saved, !!safe(() => localStorage.getItem("opus_admin_token"))); }
  catch (ex) {
    S.token = null;
    safe(() => { sessionStorage.removeItem("opus_admin_token"); localStorage.removeItem("opus_admin_token"); });
    $("#loginError").textContent = apiError(ex); $("#loginError").hidden = false;
  }
  $("#loginBtn").disabled = false; $("#loginBtn").textContent = "Kirish";
})();
