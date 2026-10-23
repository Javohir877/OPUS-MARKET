// ================= OPUS MARKET API (Cloudflare Workers + D1) =================
//
// Ochiq:   GET  /api/catalog                     — katalog (sozlamalar, kategoriyalar, mahsulotlar, yangiliklar)
//          GET  /img/:name                       — admin yuklagan rasmlar
// Mijoz:   POST /api/auth/register | /api/auth/login | /api/auth/logout
//          GET  /api/me    PATCH /api/me    POST /api/me/password
//          GET  /api/orders    POST /api/orders    POST /api/orders/:id/cancel
//          GET  /api/products/:id/reviews (ochiq)   POST /api/products/:id/reviews
// Admin:   POST /api/admin/login | /api/admin/logout | /api/admin/password
//          GET  /api/admin/stats
//          GET  /api/admin/users   GET|PATCH|DELETE /api/admin/users/:id   POST /api/admin/users/:id/reset-password
//          GET  /api/admin/orders  PATCH /api/admin/orders/:id
//          GET  /api/admin/reviews PATCH|DELETE /api/admin/reviews/:id
//          PUT  /api/admin/catalog GET /api/admin/catalog/versions  GET /api/admin/catalog/versions/:id
//          POST /api/admin/images
//
// Xavfsizlik: parollar PBKDF2-SHA256 (100 000 takror) bilan xeshlanadi; seans tokenlarining faqat SHA-256 xeshi
// saqlanadi; kirish urinishlari cheklanadi; buyurtma summasi serverda katalog narxlaridan hisoblanadi.

const ITER = 100000;                       // Cloudflare Workers'dagi PBKDF2 maksimumi
const USER_SESSION_DAYS = 30;
const ADMIN_SESSION_HOURS = 12;
const STATUSES = ["Yangi", "Tasdiqlandi", "Yig'ilmoqda", "Yo'lda", "Yetkazildi", "Bekor qilindi"];
const PAYMENTS = ["click", "payme", "uzcard", "humo", "visa", "mastercard", "uzum", "cash"];
const enc = new TextEncoder();

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new HttpError(status, message); };

// ---------- Kriptografiya ----------
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const randHex = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));
const sha256 = async (s) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
async function pbkdf2(password, salt, iter = ITER) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: iter }, key, 256));
}
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function tempPassword() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return [...bytes].map((b) => abc[b % abc.length]).join("");
}

// ---------- Yordamchilar ----------
function corsHeaders(req, env) {
  const origin = req.headers.get("Origin");
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const ok = origin && (allowed.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
  const h = { Vary: "Origin" };
  if (ok) Object.assign(h, {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
  });
  return h;
}
const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...extra } });

async function body(req, maxBytes = 200000) {
  const len = +req.headers.get("Content-Length") || 0;
  if (len > maxBytes) fail(413, "So'rov juda katta");
  const text = await req.text();
  if (text.length > maxBytes) fail(413, "So'rov juda katta");
  try { return text ? JSON.parse(text) : {}; } catch { fail(400, "Noto'g'ri JSON"); }
}
const str = (v, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
function normPhone(p) {
  let d = String(p || "").replace(/\D/g, "");
  if (d.length === 9) d = "998" + d;
  return /^998\d{9}$/.test(d) ? d : null;
}
const normEmail = (e) => { const v = str(e, 120).toLowerCase(); return v && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? v : null; };
const ip = (req) => req.headers.get("CF-Connecting-IP") || "local";
const publicUser = (u) => ({ id: u.id, name: u.name, phone: u.phone, email: u.email, region: u.region, address: u.address, created_at: u.created_at });
const orderOut = (o) => ({ ...o, items: JSON.parse(o.items_json || "[]"), items_json: undefined, code_hash: undefined, code_exp: undefined, code_tries: undefined });

// Xato urinishlar: oynada (windowMs) max dan ortiq bo'lsa — 429
async function checkLimit(env, key, max, windowMs) {
  const now = Date.now();
  await env.DB.prepare("DELETE FROM attempts WHERE ts < ?").bind(now - windowMs).run();
  const r = await env.DB.prepare("SELECT COUNT(*) AS c FROM attempts WHERE key = ?").bind(key).first();
  if (r.c >= max) fail(429, "Juda ko'p urinish. 15 daqiqadan keyin qayta urinib ko'ring.");
}
const recordFail = (env, key) => env.DB.prepare("INSERT INTO attempts (key, ts) VALUES (?, ?)").bind(key, Date.now()).run();

// ---------- Seanslar ----------
async function createSession(env, userId, role, ms) {
  const token = randHex(32), now = Date.now();
  await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, role, created_at, expires_at) VALUES (?, ?, ?, ?, ?)")
    .bind(await sha256(token), userId, role, now, now + ms).run();
  // eskirgan seanslarni vaqti-vaqti bilan tozalaymiz
  if (Math.random() < 0.05) await env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(now).run();
  return token;
}
function bearer(req) {
  const m = (req.headers.get("Authorization") || "").match(/^Bearer ([a-f0-9]{64})$/);
  return m ? m[1] : null;
}
async function session(req, env, role) {
  const t = bearer(req);
  if (!t) fail(401, role === "admin" ? "Admin sifatida kiring" : "Avval akkauntingizga kiring");
  const s = await env.DB.prepare("SELECT * FROM sessions WHERE token_hash = ?").bind(await sha256(t)).first();
  if (!s || s.role !== role || s.expires_at < Date.now()) fail(401, "Seans muddati tugagan. Qaytadan kiring.");
  return s;
}
async function currentUser(req, env) {
  const s = await session(req, env, "user");
  const u = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(s.user_id).first();
  if (!u) fail(401, "Akkaunt topilmadi");
  if (u.blocked) fail(403, "Akkauntingiz bloklangan. Do'kon bilan bog'laning.");
  return u;
}

// ---------- Katalog ----------
async function getCatalog(env) {
  const row = await env.DB.prepare("SELECT json, updated_at FROM catalog WHERE id = 1").first();
  const c = row ? JSON.parse(row.json) : { SETTINGS: {}, CATEGORIES: [], PRODUCTS: [], NEWS: [] };
  c.updated_at = row ? row.updated_at : 0;
  return c;
}
async function saveCatalog(env, c, versionNote) {
  const { updated_at, ...data } = c;
  if (versionNote !== undefined) {
    const prev = await env.DB.prepare("SELECT json FROM catalog WHERE id = 1").first();
    if (prev) {
      await env.DB.prepare("INSERT INTO catalog_versions (json, saved_at, note) VALUES (?, ?, ?)").bind(prev.json, Date.now(), versionNote).run();
      await env.DB.prepare("DELETE FROM catalog_versions WHERE id NOT IN (SELECT id FROM catalog_versions ORDER BY id DESC LIMIT 30)").run();
    }
  }
  await env.DB.prepare("INSERT INTO catalog (id, json, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at")
    .bind(JSON.stringify(data), Date.now()).run();
}

// Buyurtma mahsulotlarini omborga qaytarish (sign = 1) yoki qayta ayirish (sign = -1)
async function restock(env, o, sign) {
  const cat = await getCatalog(env), byId = new Map(cat.PRODUCTS.map((x) => [x.id, x]));
  for (const l of JSON.parse(o.items_json)) { const prod = byId.get(l.id); if (prod) prod.stock = Math.max(0, (prod.stock || 0) + sign * l.qty); }
  await saveCatalog(env, cat);
}

// ---------- Marshrutlar ----------
const routes = [];
const route = (method, pattern, handler) => routes.push({ method, re: new RegExp("^" + pattern.replace(/:(\w+)/g, "(?<$1>[^/]+)") + "$"), handler });

// Ochiq
route("GET", "/api/health", async () => json({ ok: true, time: Date.now() }));
route("GET", "/api/catalog", async (req, env) => json(await getCatalog(env), 200, { "Cache-Control": "public, max-age=20" }));
route("GET", "/img/:name", async (req, env, p) => {
  const r = await env.DB.prepare("SELECT mime, data_b64 FROM images WHERE name = ?").bind(p.name).first();
  if (!r) return new Response("Topilmadi", { status: 404 });
  const bin = Uint8Array.from(atob(r.data_b64), (c) => c.charCodeAt(0));
  return new Response(bin, { headers: { "Content-Type": r.mime, "Cache-Control": "public, max-age=31536000, immutable" } });
});

// Mijoz: ro'yxatdan o'tish va kirish
route("POST", "/api/auth/register", async (req, env) => {
  const b = await body(req);
  await checkLimit(env, "reg:" + ip(req), 10, 3600e3);
  const name = str(b.name, 60), phone = normPhone(b.phone), email = b.email ? normEmail(b.email) : null, password = typeof b.password === "string" ? b.password : "";
  if (name.length < 2) fail(400, "Ism kamida 2 harfdan iborat bo'lsin");
  if (!phone) fail(400, "Telefon raqami noto'g'ri. Namuna: +998 90 123 45 67");
  if (b.email && !email) fail(400, "Email manzili noto'g'ri");
  if (password.length < 6 || password.length > 128) fail(400, "Parol kamida 6 belgidan iborat bo'lsin");
  if (await env.DB.prepare("SELECT id FROM users WHERE phone = ?").bind(phone).first()) fail(409, "Bu telefon raqami bilan akkaunt allaqachon bor. \"Kirish\" ni tanlang.");
  if (email && await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first()) fail(409, "Bu email bilan akkaunt allaqachon bor");
  await recordFail(env, "reg:" + ip(req)); // ro'yxatdan o'tishlar sonini ham cheklaymiz
  const salt = randHex(16), now = Date.now();
  const r = await env.DB.prepare("INSERT INTO users (name, phone, email, pass_hash, pass_salt, created_at, last_login) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(name, phone, email, await pbkdf2(password, salt), salt, now, now).run();
  const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(r.meta.last_row_id).first();
  const token = await createSession(env, user.id, "user", USER_SESSION_DAYS * 864e5);
  return json({ token, user: publicUser(user) }, 201);
});

route("POST", "/api/auth/login", async (req, env) => {
  const b = await body(req);
  const key = "login:" + ip(req);
  await checkLimit(env, key, 10, 15 * 60e3);
  const login = str(b.login, 120), password = typeof b.password === "string" ? b.password : "";
  const phone = normPhone(login), email = normEmail(login);
  const user = phone ? await env.DB.prepare("SELECT * FROM users WHERE phone = ?").bind(phone).first()
    : email ? await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first() : null;
  // Foydalanuvchi bo'lmasa ham xeshni hisoblaymiz — javob vaqti orqali akkaunt borligini bilib bo'lmasin
  const hash = await pbkdf2(password, user ? user.pass_salt : "no-user-salt");
  if (!user || !safeEqual(hash, user.pass_hash)) { await recordFail(env, key); fail(401, "Telefon/email yoki parol noto'g'ri"); }
  if (user.blocked) fail(403, "Akkauntingiz bloklangan. Do'kon bilan bog'laning.");
  await env.DB.prepare("UPDATE users SET last_login = ? WHERE id = ?").bind(Date.now(), user.id).run();
  const token = await createSession(env, user.id, "user", USER_SESSION_DAYS * 864e5);
  return json({ token, user: publicUser(user) });
});

route("POST", "/api/auth/logout", async (req, env) => {
  const t = bearer(req);
  if (t) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(t)).run();
  return json({ ok: true });
});

// Mijoz: profil
route("GET", "/api/me", async (req, env) => json({ user: publicUser(await currentUser(req, env)) }));
route("PATCH", "/api/me", async (req, env) => {
  const u = await currentUser(req, env), b = await body(req);
  const name = b.name !== undefined ? str(b.name, 60) : u.name;
  const email = b.email !== undefined ? (b.email ? normEmail(b.email) : null) : u.email;
  if (name.length < 2) fail(400, "Ism kamida 2 harfdan iborat bo'lsin");
  if (b.email && !email) fail(400, "Email manzili noto'g'ri");
  if (email && email !== u.email && await env.DB.prepare("SELECT id FROM users WHERE email = ? AND id != ?").bind(email, u.id).first()) fail(409, "Bu email boshqa akkauntda ishlatilgan");
  await env.DB.prepare("UPDATE users SET name = ?, email = ?, region = ?, address = ? WHERE id = ?")
    .bind(name, email, b.region !== undefined ? str(b.region, 60) : u.region, b.address !== undefined ? str(b.address, 200) : u.address, u.id).run();
  return json({ user: publicUser(await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(u.id).first()) });
});
route("POST", "/api/me/password", async (req, env) => {
  const u = await currentUser(req, env), b = await body(req);
  const key = "pw:" + u.id;
  await checkLimit(env, key, 5, 15 * 60e3);
  if (!safeEqual(await pbkdf2(String(b.old || ""), u.pass_salt), u.pass_hash)) { await recordFail(env, key); fail(400, "Joriy parol noto'g'ri"); }
  const next = String(b.new || "");
  if (next.length < 6 || next.length > 128) fail(400, "Yangi parol kamida 6 belgidan iborat bo'lsin");
  const salt = randHex(16);
  await env.DB.prepare("UPDATE users SET pass_hash = ?, pass_salt = ? WHERE id = ?").bind(await pbkdf2(next, salt), salt, u.id).run();
  // boshqa qurilmalardagi seanslarni yopamiz
  await env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND role = 'user' AND token_hash != ?").bind(u.id, await sha256(bearer(req))).run();
  return json({ ok: true });
});

// Mijoz: buyurtmalar
route("GET", "/api/orders", async (req, env) => {
  const u = await currentUser(req, env);
  const r = await env.DB.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 100").bind(u.id).all();
  return json({ orders: r.results.map(orderOut) });
});
route("POST", "/api/orders", async (req, env) => {
  const u = await currentUser(req, env), b = await body(req);
  const items = Array.isArray(b.items) ? b.items : [];
  if (!items.length || items.length > 50) fail(400, "Savat bo'sh");
  const delivery = b.delivery === "pickup" ? "pickup" : "courier";
  const address = str(b.address, 200), region = str(b.region, 60), note = str(b.note, 500);
  if (delivery === "courier" && address.length < 3) fail(400, "Yetkazib berish manzilini kiriting");
  const payment = PAYMENTS.includes(b.payment) ? b.payment : fail(400, "To'lov usulini tanlang");
  const months = payment === "uzum" && [3, 6, 12, 24].includes(+b.months) ? +b.months : null;

  const cat = await getCatalog(env);
  const byId = new Map(cat.PRODUCTS.map((p) => [p.id, p]));
  const lines = [];
  let subtotal = 0;
  for (const it of items) {
    const p = byId.get(+it.id), qty = Math.floor(+it.qty);
    if (!p) fail(400, "Mahsulot topilmadi (ID " + it.id + ")");
    if (!(qty >= 1 && qty <= 99)) fail(400, "Miqdor noto'g'ri");
    if ((p.stock ?? 0) < qty) fail(409, `"${p.name}" omborda ${p.stock || 0} dona qoldi`);
    lines.push({ id: p.id, name: p.name, price: p.price, qty, img: p.img });
    subtotal += p.price * qty;
  }
  const s = cat.SETTINGS || {};
  const promo = str(b.promo, 20).toUpperCase();
  const pct = promo && s.promos && s.promos[promo] ? +s.promos[promo] : 0;
  const discount = Math.round(subtotal * pct / 100);
  const ship = delivery === "pickup" || subtotal >= (s.freeShipFrom ?? 1000000) ? 0 : (s.shipPrice ?? 50000);
  const total = subtotal - discount + ship;

  // Omborni kamaytiramiz
  for (const l of lines) byId.get(l.id).stock -= l.qty;
  await saveCatalog(env, cat);

  const now = Date.now();
  let id;
  for (let tries = 0; tries < 5; tries++) {
    id = "OP" + String(now).slice(-7) + String(crypto.getRandomValues(new Uint16Array(1))[0] % 100).padStart(2, "0");
    try {
      // Telegram bot ulangan bo'lsa — buyurtma kod bilan tasdiqlanguncha "tasdiqlanmagan" (confirmed = 0) turadi
      await env.DB.prepare(`INSERT INTO orders (id, user_id, status, delivery, region, address, note, payment, months, promo, subtotal, discount, ship, total, items_json, created_at, updated_at, confirmed, confirmed_at)
        VALUES (?, ?, 'Yangi', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(id, u.id, delivery, region, address, note, payment, months, pct ? promo : null, subtotal, discount, ship, total, JSON.stringify(lines), now, now,
          env.TELEGRAM_TOKEN ? 0 : 1, env.TELEGRAM_TOKEN ? null : now).run();
      break;
    } catch (e) { if (tries === 4) throw e; }
  }
  // Keyingi safar uchun manzilni eslab qolamiz
  if (delivery === "courier") await env.DB.prepare("UPDATE users SET region = ?, address = ? WHERE id = ?").bind(region, address, u.id).run();
  const order = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first();
  return json({ order: orderOut(order), confirm: order.confirmed ? null : await startConfirm(env, u, order) }, 201);
});

// ---------- Admin ----------
const admin = (req, env) => session(req, env, "admin");

// ---------- Telegram bot ----------
// Token va webhook kaliti — Cloudflare maxfiy o'zgaruvchilari (wrangler secret): TELEGRAM_TOKEN, TG_WEBHOOK_SECRET, TG_ADMIN_CHAT.
// Bot odamga birinchi bo'lib yoza olmaydi, shuning uchun mijoz bir marta t.me/<bot>?start=<kalit> orqali botni ochib,
// kontaktini yuboradi; telefon akkauntdagi raqamga mos kelsa — chat akkauntga bog'lanadi va kodlar shu yerga keladi.
const CODE_TTL = 10 * 60e3, CODE_TRIES = 5, UNCONFIRMED_TTL = 2 * 3600e3;
async function tg(env, method, payload) {
  if (!env.TELEGRAM_TOKEN) return null;
  try {
    const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    return await r.json();
  } catch { return null; }
}
const tgSend = (env, chat, text, extra = {}) => tg(env, "sendMessage", { chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true, ...extra });
const hh = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const som = (n) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " so'm";
const phoneFmt = (p) => { const d = String(p || "").replace(/^998/, ""); return `+998 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`; };
const tashkent = (ms) => new Date(ms + 5 * 3600e3).toISOString().slice(0, 16).replace("T", " ");
const PAY_NAMES = { click: "Click", payme: "Payme", uzcard: "Uzcard", humo: "Humo", visa: "Visa", mastercard: "Mastercard", uzum: "Uzum Nasiya", cash: "Naqd pul" };
const kvGet = async (env, k) => (await env.DB.prepare("SELECT value FROM kv WHERE key = ?").bind(k).first())?.value ?? null;
const kvSet = (env, k, v) => env.DB.prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(k, v).run();
const adminChat = async (env) => (await kvGet(env, "tg_admin_chat")) || env.TG_ADMIN_CHAT || null;
const botLink = (env, payload) => `https://t.me/${env.TELEGRAM_BOT}?start=${payload}`;

// Buyurtma tarkibi (mijoz cheki va admin xabari uchun umumiy qism)
function orderLines(o) {
  const items = JSON.parse(o.items_json || "[]");
  return [
    ...items.map((i, n) => `${n + 1}. ${hh(i.name)} × ${i.qty} — <b>${som(i.price * i.qty)}</b>`),
    "",
    `Mahsulotlar: ${som(o.subtotal)}`,
    o.discount ? `Chegirma${o.promo ? ` (${hh(o.promo)})` : ""}: −${som(o.discount)}` : null,
    `Yetkazib berish: ${o.ship ? som(o.ship) : "bepul"}`,
    `💰 <b>Jami: ${som(o.total)}</b>`,
    `💳 To'lov: ${PAY_NAMES[o.payment] || hh(o.payment)}${o.months ? ` (${o.months} oy, oyiga ${som(o.total / o.months)})` : ""}`,
    o.delivery === "pickup" ? "🏬 Do'kondan olib ketish" : `🚚 Kuryer: ${hh([o.region, o.address].filter(Boolean).join(", "))}`,
  ].filter((x) => x !== null).join("\n");
}

async function sendCode(env, o, chat) {
  const code = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
  await env.DB.prepare("UPDATE orders SET code_hash = ?, code_exp = ?, code_tries = 0, code_sent = ? WHERE id = ?")
    .bind(await sha256(o.id + ":" + code), Date.now() + CODE_TTL, Date.now(), o.id).run();
  await tgSend(env, chat, `🔐 <b>OPUS MARKET</b>\n\nBuyurtma <b>#${o.id}</b> (${som(o.total)}) uchun tasdiqlash kodi:\n\n<code>${code}</code>\n\nKodni saytga kiriting. Kod 10 daqiqa amal qiladi.\n⚠️ Kodni hech kimga aytmang — do'kon xodimlari ham uni so'ramaydi.`);
}

// Buyurtma berilgach: chat bog'langan bo'lsa — kod yuboramiz, bo'lmasa — botni ochish havolasini qaytaramiz
async function startConfirm(env, u, o) {
  const fresh = await env.DB.prepare("SELECT tg_chat_id, tg_link_token FROM users WHERE id = ?").bind(u.id).first();
  if (fresh.tg_chat_id) { await sendCode(env, o, fresh.tg_chat_id); return { linked: true, bot: env.TELEGRAM_BOT }; }
  let token = fresh.tg_link_token;
  if (!token) { token = randHex(12); await env.DB.prepare("UPDATE users SET tg_link_token = ? WHERE id = ?").bind(token, u.id).run(); }
  return { linked: false, bot: env.TELEGRAM_BOT, link: botLink(env, token) };
}

async function notifyConfirmed(env, o) {
  const u = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(o.user_id).first();
  if (u && u.tg_chat_id) {
    await tgSend(env, u.tg_chat_id, `✅ <b>Buyurtma tasdiqlandi!</b>\n<b>#${o.id}</b> · ${tashkent(o.created_at)}\n\nSiz oldingiz:\n${orderLines(o)}\n\nOperatorimiz tez orada bog'lanadi. Holatini saytdagi "Buyurtmalarim" bo'limida kuzatishingiz mumkin. Xaridingiz uchun rahmat! ❤️`);
  }
  const chat = await adminChat(env);
  if (!chat) return;
  const st = u ? await env.DB.prepare("SELECT COUNT(*) AS c, COALESCE(SUM(total), 0) AS s FROM orders WHERE user_id = ? AND confirmed = 1 AND status != 'Bekor qilindi'").bind(u.id).first() : { c: 0, s: 0 };
  await tgSend(env, chat, [
    `🛒 <b>YANGI BUYURTMA #${o.id}</b> ✅ tasdiqlangan`,
    `🕒 ${tashkent(o.created_at)}`,
    "",
    `👤 <b>${hh(u ? u.name : "—")}</b>`,
    u ? `📞 ${phoneFmt(u.phone)}` : null,
    u && u.email ? `✉️ ${hh(u.email)}` : null,
    u && u.tg_chat_id ? `💬 Telegram: <a href="tg://user?id=${u.tg_chat_id}">yozish</a>` : null,
    o.note ? `📝 Izoh: ${hh(o.note)}` : null,
    "",
    orderLines(o),
    "",
    u ? `📊 Mijozning ${st.c}-buyurtmasi, jami xaridlari: ${som(st.s)}` : null,
  ].filter((x) => x !== null).join("\n"));
}

// Bot xabarlari ikki yo'l bilan keladi: webhook (agar Telegram serverimizga yeta olsa) yoki polling (getUpdates).
// Polling: mijoz tasdiqlash oynasida turganida sayt har 3 soniyada /api/tg/poll ni chaqiradi, qolgan paytda — har daqiqada cron.
route("POST", "/tg/webhook", async (req, env) => {
  if (!env.TG_WEBHOOK_SECRET || req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.TG_WEBHOOK_SECRET) return new Response("forbidden", { status: 403 });
  await handleUpdate(env, await body(req, 100000));
  return json({ ok: true });
});
async function pollUpdates(env) {
  if (!env.TELEGRAM_TOKEN) return 0;
  // Bir vaqtda faqat bitta so'rov o'qisin (aks holda bitta xabar ikki marta ishlanishi mumkin)
  const now = Date.now();
  const lock = await env.DB.prepare("INSERT INTO kv (key, value) VALUES ('tg_poll_lock', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value WHERE CAST(kv.value AS INTEGER) < ?")
    .bind(String(now), now - 8000).run();
  if (!lock.meta.changes) return 0;
  try {
    const offset = +(await kvGet(env, "tg_offset")) || 0;
    const r = await tg(env, "getUpdates", { offset: offset + 1, timeout: 0, limit: 30, allowed_updates: ["message"] });
    if (!r || !r.ok) return 0;
    for (const upd of r.result) {
      await kvSet(env, "tg_offset", String(upd.update_id)); // avval belgilaymiz — xato bo'lsa ham qayta ishlanmaydi
      try { await handleUpdate(env, upd); } catch (e) { console.error("tg update", e && e.stack || e); }
    }
    return r.result.length;
  } finally {
    await env.DB.prepare("UPDATE kv SET value = '0' WHERE key = 'tg_poll_lock'").run();
  }
}
// Sayt (mijoz yoki admin) tasdiqlash oynasida turganida chaqiradi
route("POST", "/api/tg/poll", async (req, env) => {
  const t = bearer(req);
  if (!t || !(await env.DB.prepare("SELECT 1 FROM sessions WHERE token_hash = ? AND expires_at > ?").bind(await sha256(t), Date.now()).first())) fail(401, "Avval akkauntingizga kiring");
  return json({ processed: await pollUpdates(env) });
});
async function handleUpdate(env, upd) {
  const m = upd.message;
  if (!m || !m.chat || m.chat.type !== "private") return;
  const chat = String(m.chat.id), text = (m.text || "").trim();
  const isAdmin = chat === String(await adminChat(env));

  if (text.startsWith("/start")) {
    const payload = text.split(/\s+/)[1] || "";
    if (payload.startsWith("adm_")) {
      const link = JSON.parse((await kvGet(env, "tg_admin_link")) || "null");
      if (link && link.token === payload.slice(4) && link.exp > Date.now()) {
        await kvSet(env, "tg_admin_chat", chat);
        await env.DB.prepare("DELETE FROM kv WHERE key = 'tg_admin_link'").run();
        await tgSend(env, chat, "✅ Siz <b>OPUS MARKET admini</b> sifatida ulandingiz. Tasdiqlangan har bir buyurtma mijozning to'liq ma'lumotlari bilan shu yerga keladi.");
      } else await tgSend(env, chat, "⛔ Havola eskirgan yoki noto'g'ri. Admin paneldan yangisini oling.");
      return;
    }
    if (payload) {
      const u = await env.DB.prepare("SELECT * FROM users WHERE tg_link_token = ?").bind(payload).first();
      if (!u) { await tgSend(env, chat, "⛔ Havola eskirgan. Saytdagi \"Telegram'da tasdiqlash\" tugmasini qayta bosing."); return; }
      await env.DB.prepare("UPDATE users SET tg_pending_chat = ? WHERE id = ?").bind(chat, u.id).run();
      await tgSend(env, chat, `Assalomu alaykum, <b>${hh(u.name)}</b>! 👋\n\nBuyurtmangizni tasdiqlash uchun telefon raqamingizni yuboring — u OPUS MARKET akkauntingizdagi raqamga mos kelishi kerak. Pastdagi tugmani bosing 👇`, {
        reply_markup: { keyboard: [[{ text: "📱 Raqamimni yuborish", request_contact: true }]], resize_keyboard: true, one_time_keyboard: true },
      });
      return;
    }
    const linked = await env.DB.prepare("SELECT name FROM users WHERE tg_chat_id = ?").bind(chat).first();
    await tgSend(env, chat, isAdmin ? "👑 Siz OPUS MARKET adminisiz. Yangi buyurtmalar shu yerga keladi."
      : linked ? `Salom, <b>${hh(linked.name)}</b>! Buyurtmalaringiz tasdiqlash kodlari va holati shu yerga keladi.`
      : "OPUS MARKET botiga xush kelibsiz! 🛒\nSaytda buyurtma berganingizdan keyin \"Telegram'da tasdiqlash\" tugmasini bosing — tasdiqlash kodi shu yerga keladi.");
    return;
  }

  if (m.contact) {
    if (String(m.contact.user_id) !== String(m.from.id)) { await tgSend(env, chat, "⚠️ Faqat o'zingizning raqamingizni yuboring (pastdagi tugma orqali)."); return; }
    const u = await env.DB.prepare("SELECT * FROM users WHERE tg_pending_chat = ?").bind(chat).first();
    if (!u) { await tgSend(env, chat, "Avval saytdagi \"Telegram'da tasdiqlash\" tugmasini bosing."); return; }
    if (normPhone(m.contact.phone_number) !== u.phone) {
      await tgSend(env, chat, `⛔ Bu raqam akkauntdagi raqamga (<b>+998 ** *** ** ${u.phone.slice(-2)}</b>) mos kelmadi.\nAkkauntingizdagi raqam bilan ro'yxatdan o'tgan Telegram'dan kiring.`, { reply_markup: { remove_keyboard: true } });
      return;
    }
    await env.DB.prepare("UPDATE users SET tg_chat_id = NULL WHERE tg_chat_id = ? AND id != ?").bind(chat, u.id).run();
    await env.DB.prepare("UPDATE users SET tg_chat_id = ?, tg_pending_chat = NULL, tg_link_token = NULL WHERE id = ?").bind(chat, u.id).run();
    await tgSend(env, chat, "✅ Telegram akkauntingizga ulandi! Endi tasdiqlash kodlari va buyurtma holati shu yerga keladi.", { reply_markup: { remove_keyboard: true } });
    const pending = await env.DB.prepare("SELECT * FROM orders WHERE user_id = ? AND confirmed = 0 AND status = 'Yangi' ORDER BY created_at DESC LIMIT 3").bind(u.id).all();
    for (const o of pending.results) await sendCode(env, o, chat);
    return;
  }

  await tgSend(env, chat, isAdmin ? "👑 Admin: yangi buyurtmalar avtomatik keladi. Batafsil — admin panelda." : "Tasdiqlash kodi saytda buyurtma berganingizda shu yerga keladi. Savollar bo'lsa — do'kon operatoriga murojaat qiling.");
}

// Mijoz: kodni qayta yuborish / bot havolasini olish
route("POST", "/api/orders/:id/code", async (req, env, p) => {
  const u = await currentUser(req, env);
  const o = await env.DB.prepare("SELECT * FROM orders WHERE id = ? AND user_id = ?").bind(p.id, u.id).first();
  if (!o) fail(404, "Buyurtma topilmadi");
  if (o.confirmed) return json({ confirmed: true });
  if (o.status === "Bekor qilindi") fail(409, "Buyurtma bekor qilingan");
  if (u.tg_chat_id && o.code_sent && Date.now() - o.code_sent < 60e3) fail(429, "Kod yaqinda yuborildi. 1 daqiqadan keyin qayta so'rang.");
  return json(await startConfirm(env, u, o));
});
// Mijoz: kodni kiritish
route("POST", "/api/orders/:id/confirm", async (req, env, p) => {
  const u = await currentUser(req, env), b = await body(req);
  const o = await env.DB.prepare("SELECT * FROM orders WHERE id = ? AND user_id = ?").bind(p.id, u.id).first();
  if (!o) fail(404, "Buyurtma topilmadi");
  if (o.confirmed) return json({ order: orderOut(o) });
  if (o.status === "Bekor qilindi") fail(409, "Buyurtma bekor qilingan");
  if (!o.code_hash) fail(400, "Avval Telegram orqali kod oling");
  if (o.code_tries >= CODE_TRIES) fail(429, "Juda ko'p xato urinish. \"Kodni qayta yuborish\" ni bosing.");
  if (o.code_exp < Date.now()) fail(400, "Kod muddati tugagan. \"Kodni qayta yuborish\" ni bosing.");
  const code = String(b.code || "").replace(/\D/g, "");
  if (!safeEqual(await sha256(o.id + ":" + code), o.code_hash)) {
    await env.DB.prepare("UPDATE orders SET code_tries = code_tries + 1 WHERE id = ?").bind(o.id).run();
    const left = CODE_TRIES - o.code_tries - 1;
    fail(400, left > 0 ? `Kod noto'g'ri. Yana ${left} marta urinish mumkin.` : "Kod noto'g'ri. \"Kodni qayta yuborish\" ni bosing.");
  }
  const now = Date.now();
  await env.DB.prepare("UPDATE orders SET confirmed = 1, confirmed_at = ?, code_hash = NULL, updated_at = ? WHERE id = ?").bind(now, now, o.id).run();
  const done = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(o.id).first();
  await notifyConfirmed(env, done);
  return json({ order: orderOut(done) });
});

// Admin: Telegram ulanishi
route("GET", "/api/admin/telegram", async (req, env) => {
  await admin(req, env);
  const linked = await env.DB.prepare("SELECT COUNT(*) AS c FROM users WHERE tg_chat_id IS NOT NULL").first();
  return json({ enabled: !!env.TELEGRAM_TOKEN, bot: env.TELEGRAM_BOT || null, adminConnected: !!(await adminChat(env)), linkedUsers: linked.c });
});
route("POST", "/api/admin/telegram/link", async (req, env) => {
  await admin(req, env);
  const token = randHex(12);
  await kvSet(env, "tg_admin_link", JSON.stringify({ token, exp: Date.now() + 15 * 60e3 }));
  return json({ link: botLink(env, "adm_" + token) });
});
route("POST", "/api/admin/telegram/test", async (req, env) => {
  await admin(req, env);
  const chat = await adminChat(env);
  if (!chat) fail(400, "Admin Telegram'i hali ulanmagan");
  const r = await tgSend(env, chat, "🔔 Sinov xabari: OPUS MARKET admin paneli bot bilan bog'langan. Yangi buyurtmalar shu yerga keladi.");
  if (!r || !r.ok) fail(502, "Telegram xabarni qabul qilmadi" + (r && r.description ? ": " + r.description : ""));
  return json({ ok: true });
});

// Tasdiqlanmagan eski buyurtmalarni bekor qilib, omborga qaytaramiz (cron va admin ro'yxatida chaqiriladi)
async function expireUnconfirmed(env) {
  const old = await env.DB.prepare("SELECT * FROM orders WHERE confirmed = 0 AND status = 'Yangi' AND created_at < ? LIMIT 50").bind(Date.now() - UNCONFIRMED_TTL).all();
  for (const o of old.results) {
    await restock(env, o, 1);
    await env.DB.prepare("UPDATE orders SET status = 'Bekor qilindi', updated_at = ? WHERE id = ?").bind(Date.now(), o.id).run();
  }
  return old.results.length;
}

route("POST", "/api/admin/login", async (req, env) => {
  const b = await body(req);
  const key = "admin:" + ip(req);
  await checkLimit(env, key, 8, 15 * 60e3);
  const a = await env.DB.prepare("SELECT * FROM admin WHERE id = 1").first();
  if (!a) fail(503, "Admin paroli hali o'rnatilmagan");
  if (!safeEqual(await pbkdf2(String(b.password || ""), a.pass_salt, a.iter), a.pass_hash)) { await recordFail(env, key); fail(401, "Parol noto'g'ri"); }
  return json({ token: await createSession(env, null, "admin", ADMIN_SESSION_HOURS * 3600e3) });
});
route("POST", "/api/admin/logout", async (req, env) => {
  const t = bearer(req);
  if (t) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ? AND role = 'admin'").bind(await sha256(t)).run();
  return json({ ok: true });
});
route("POST", "/api/admin/password", async (req, env) => {
  await admin(req, env);
  const b = await body(req);
  const a = await env.DB.prepare("SELECT * FROM admin WHERE id = 1").first();
  if (!safeEqual(await pbkdf2(String(b.old || ""), a.pass_salt, a.iter), a.pass_hash)) fail(400, "Joriy parol noto'g'ri");
  const next = String(b.new || "");
  if (next.length < 8) fail(400, "Yangi parol kamida 8 belgidan iborat bo'lsin");
  const salt = randHex(16);
  await env.DB.prepare("UPDATE admin SET pass_hash = ?, pass_salt = ?, iter = ? WHERE id = 1").bind(await pbkdf2(next, salt), salt, ITER).run();
  await env.DB.prepare("DELETE FROM sessions WHERE role = 'admin' AND token_hash != ?").bind(await sha256(bearer(req))).run();
  return json({ ok: true });
});

route("GET", "/api/admin/stats", async (req, env) => {
  await admin(req, env);
  const day = Date.now() - 864e5, week = Date.now() - 7 * 864e5;
  const q = (sql, ...a) => env.DB.prepare(sql).bind(...a).first();
  const [users, newUsers, orders, today, revenue, byStatus] = await Promise.all([
    q("SELECT COUNT(*) AS c FROM users"),
    q("SELECT COUNT(*) AS c FROM users WHERE created_at > ?", week),
    q("SELECT COUNT(*) AS c FROM orders WHERE confirmed = 1"),
    q("SELECT COUNT(*) AS c, COALESCE(SUM(total), 0) AS s FROM orders WHERE created_at > ? AND status != 'Bekor qilindi' AND confirmed = 1", day),
    q("SELECT COALESCE(SUM(total), 0) AS s FROM orders WHERE status != 'Bekor qilindi' AND confirmed = 1"),
    env.DB.prepare("SELECT status, COUNT(*) AS c FROM orders WHERE confirmed = 1 GROUP BY status").all(),
  ]);
  // Oxirgi 14 kunlik savdo (Toshkent vaqti, UTC+5) va 30 kunda eng ko'p sotilganlar
  const TZ = 5 * 3600e3, dayKey = (ms) => new Date(ms + TZ).toISOString().slice(0, 10);
  const since = Date.now() - 30 * 864e5;
  const recent = (await env.DB.prepare("SELECT total, items_json, created_at FROM orders WHERE created_at > ? AND status != 'Bekor qilindi' AND confirmed = 1").bind(since).all()).results;
  const series = [];
  for (let i = 13; i >= 0; i--) series.push({ day: dayKey(Date.now() - i * 864e5), orders: 0, revenue: 0 });
  const byDay = new Map(series.map((d) => [d.day, d])), top = new Map();
  for (const o of recent) {
    const d = byDay.get(dayKey(o.created_at));
    if (d) { d.orders++; d.revenue += o.total; }
    for (const i of JSON.parse(o.items_json)) {
      const t = top.get(i.id) || { id: i.id, name: i.name, qty: 0, revenue: 0 };
      t.qty += i.qty; t.revenue += i.price * i.qty; top.set(i.id, t);
    }
  }
  const reviews = await q("SELECT COUNT(*) AS c, SUM(CASE WHEN created_at > ? THEN 1 ELSE 0 END) AS w FROM reviews", week);
  return json({ users: users.c, newUsers: newUsers.c, orders: orders.c, todayOrders: today.c, todayRevenue: today.s, revenue: revenue.s,
    byStatus: Object.fromEntries(byStatus.results.map((r) => [r.status, r.c])),
    series, top: [...top.values()].sort((a, b) => b.qty - a.qty).slice(0, 5),
    reviews: reviews.c, newReviews: reviews.w || 0, lastOrderAt: (await q("SELECT MAX(COALESCE(confirmed_at, created_at)) AS m FROM orders WHERE confirmed = 1")).m || 0,
    unconfirmed: (await q("SELECT COUNT(*) AS c FROM orders WHERE confirmed = 0 AND status = 'Yangi'")).c });
});

route("GET", "/api/admin/users", async (req, env) => {
  await admin(req, env);
  const url = new URL(req.url), q = "%" + (url.searchParams.get("q") || "").trim() + "%";
  const r = await env.DB.prepare(`SELECT u.id, u.name, u.phone, u.email, u.region, u.address, u.blocked, u.created_at, u.last_login, (u.tg_chat_id IS NOT NULL) AS tg,
      COUNT(CASE WHEN o.confirmed = 1 THEN o.id END) AS orders, COALESCE(SUM(CASE WHEN o.status != 'Bekor qilindi' AND o.confirmed = 1 THEN o.total END), 0) AS spent
    FROM users u LEFT JOIN orders o ON o.user_id = u.id
    WHERE u.name LIKE ?1 OR u.phone LIKE ?1 OR COALESCE(u.email, '') LIKE ?1
    GROUP BY u.id ORDER BY u.created_at DESC LIMIT 500`).bind(q).all();
  return json({ users: r.results });
});
route("GET", "/api/admin/users/:id", async (req, env, p) => {
  await admin(req, env);
  const u = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(+p.id).first();
  if (!u) fail(404, "Mijoz topilmadi");
  const o = await env.DB.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC").bind(u.id).all();
  return json({ user: { ...publicUser(u), blocked: u.blocked, last_login: u.last_login, tg: !!u.tg_chat_id }, orders: o.results.map(orderOut) });
});
route("PATCH", "/api/admin/users/:id", async (req, env, p) => {
  await admin(req, env);
  const b = await body(req);
  const u = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(+p.id).first();
  if (!u) fail(404, "Mijoz topilmadi");
  if (b.blocked !== undefined) {
    await env.DB.prepare("UPDATE users SET blocked = ? WHERE id = ?").bind(b.blocked ? 1 : 0, u.id).run();
    if (b.blocked) await env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND role = 'user'").bind(u.id).run();
  }
  return json({ ok: true });
});
route("DELETE", "/api/admin/users/:id", async (req, env, p) => {
  await admin(req, env);
  await env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND role = 'user'").bind(+p.id).run();
  await env.DB.prepare("UPDATE orders SET user_id = NULL WHERE user_id = ?").bind(+p.id).run();
  await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(+p.id).run();
  return json({ ok: true });
});
route("POST", "/api/admin/users/:id/reset-password", async (req, env, p) => {
  await admin(req, env);
  const u = await env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(+p.id).first();
  if (!u) fail(404, "Mijoz topilmadi");
  const pw = tempPassword(), salt = randHex(16);
  await env.DB.prepare("UPDATE users SET pass_hash = ?, pass_salt = ? WHERE id = ?").bind(await pbkdf2(pw, salt), salt, u.id).run();
  await env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND role = 'user'").bind(u.id).run();
  return json({ password: pw }); // admin buni mijozga aytadi; mijoz kirgach o'zgartiradi
});

route("GET", "/api/admin/orders", async (req, env) => {
  await admin(req, env);
  await expireUnconfirmed(env);
  const url = new URL(req.url), status = url.searchParams.get("status"), q = "%" + (url.searchParams.get("q") || "").trim() + "%";
  const r = await env.DB.prepare(`SELECT o.*, u.name AS user_name, u.phone AS user_phone, u.email AS user_email
    FROM orders o LEFT JOIN users u ON u.id = o.user_id
    WHERE (?1 IS NULL OR o.status = ?1) AND (o.id LIKE ?2 OR COALESCE(u.name, '') LIKE ?2 OR COALESCE(u.phone, '') LIKE ?2)
    ORDER BY o.created_at DESC LIMIT 500`).bind(status || null, q).all();
  return json({ orders: r.results.map(orderOut) });
});
route("PATCH", "/api/admin/orders/:id", async (req, env, p) => {
  await admin(req, env);
  const b = await body(req);
  if (!STATUSES.includes(b.status)) fail(400, "Noma'lum holat");
  const o = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(p.id).first();
  if (!o) fail(404, "Buyurtma topilmadi");
  // Bekor qilinganda mahsulotlar omborga qaytadi (va aksincha)
  const wasCancelled = o.status === "Bekor qilindi", nowCancelled = b.status === "Bekor qilindi";
  if (wasCancelled !== nowCancelled) await restock(env, o, nowCancelled ? 1 : -1);
  await env.DB.prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?").bind(b.status, Date.now(), o.id).run();
  if (b.status !== o.status) {
    const u = o.user_id && await env.DB.prepare("SELECT tg_chat_id FROM users WHERE id = ?").bind(o.user_id).first();
    const icon = { "Tasdiqlandi": "✅", "Yig'ilmoqda": "📦", "Yo'lda": "🚚", "Yetkazildi": "🎉", "Bekor qilindi": "❌" }[b.status] || "ℹ️";
    if (u && u.tg_chat_id) await tgSend(env, u.tg_chat_id, `${icon} Buyurtma <b>#${o.id}</b> holati: <b>${b.status}</b>${b.status === "Yetkazildi" ? "\n\nXaridingiz uchun rahmat! Mahsulot haqida saytda sharh qoldirsangiz, xursand bo'lamiz ⭐" : ""}`);
  }
  return json({ ok: true });
});

// ---------- Sharhlar ----------
const reviewOut = (r) => ({ id: r.id, product_id: r.product_id, rating: r.rating, text: r.text, reply: r.reply, verified: !!r.verified,
  created_at: r.created_at, author: String(r.user_name || "Mijoz").split(/\s+/)[0] });
route("GET", "/api/products/:id/reviews", async (req, env, p) => {
  const r = await env.DB.prepare(`SELECT r.*, u.name AS user_name FROM reviews r LEFT JOIN users u ON u.id = r.user_id
    WHERE r.product_id = ? AND r.hidden = 0 ORDER BY r.created_at DESC LIMIT 100`).bind(+p.id).all();
  const list = r.results.map(reviewOut);
  const avg = list.length ? Math.round(list.reduce((s, x) => s + x.rating, 0) / list.length * 10) / 10 : 0;
  return json({ reviews: list, count: list.length, avg }, 200, { "Cache-Control": "public, max-age=20" });
});
route("POST", "/api/products/:id/reviews", async (req, env, p) => {
  const u = await currentUser(req, env), b = await body(req);
  const pid = +p.id, rating = Math.round(+b.rating), text = str(b.text, 1000);
  if (!(await getCatalog(env)).PRODUCTS.some((x) => x.id === pid)) fail(404, "Mahsulot topilmadi");
  if (!(rating >= 1 && rating <= 5)) fail(400, "Bahoni tanlang (1–5 yulduz)");
  if (text.length < 3) fail(400, "Fikringizni bir necha so'z bilan yozing");
  // Shu mahsulotni sotib olgan (bekor qilinmagan buyurtmasi bor) mijozga "Xarid qilgan" belgisi
  const own = await env.DB.prepare("SELECT items_json FROM orders WHERE user_id = ? AND status != 'Bekor qilindi' AND confirmed = 1").bind(u.id).all();
  const verified = own.results.some((o) => JSON.parse(o.items_json).some((i) => i.id === pid)) ? 1 : 0;
  await env.DB.prepare(`INSERT INTO reviews (product_id, user_id, rating, text, verified, hidden, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)
    ON CONFLICT(product_id, user_id) DO UPDATE SET rating = excluded.rating, text = excluded.text, verified = excluded.verified, created_at = excluded.created_at`)
    .bind(pid, u.id, rating, text, verified, Date.now()).run();
  return json({ ok: true }, 201);
});

// Mijoz o'z buyurtmasini faqat "Yangi" holatida bekor qila oladi
route("POST", "/api/orders/:id/cancel", async (req, env, p) => {
  const u = await currentUser(req, env);
  const o = await env.DB.prepare("SELECT * FROM orders WHERE id = ? AND user_id = ?").bind(p.id, u.id).first();
  if (!o) fail(404, "Buyurtma topilmadi");
  if (o.status !== "Yangi") fail(409, "Buyurtma allaqachon tasdiqlangan — bekor qilish uchun operatorga qo'ng'iroq qiling");
  await restock(env, o, 1);
  await env.DB.prepare("UPDATE orders SET status = 'Bekor qilindi', updated_at = ? WHERE id = ?").bind(Date.now(), o.id).run();
  return json({ order: orderOut(await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(o.id).first()) });
});

route("GET", "/api/admin/reviews", async (req, env) => {
  await admin(req, env);
  const r = await env.DB.prepare(`SELECT r.*, u.name AS user_name, u.phone AS user_phone FROM reviews r LEFT JOIN users u ON u.id = r.user_id
    ORDER BY r.created_at DESC LIMIT 500`).all();
  return json({ reviews: r.results.map((x) => ({ ...reviewOut(x), hidden: !!x.hidden, user_id: x.user_id, user_name: x.user_name, user_phone: x.user_phone })) });
});
route("PATCH", "/api/admin/reviews/:id", async (req, env, p) => {
  await admin(req, env);
  const b = await body(req);
  const r = await env.DB.prepare("SELECT * FROM reviews WHERE id = ?").bind(+p.id).first();
  if (!r) fail(404, "Sharh topilmadi");
  await env.DB.prepare("UPDATE reviews SET hidden = ?, reply = ? WHERE id = ?")
    .bind(b.hidden !== undefined ? (b.hidden ? 1 : 0) : r.hidden, b.reply !== undefined ? (str(b.reply, 1000) || null) : r.reply, r.id).run();
  return json({ ok: true });
});
route("DELETE", "/api/admin/reviews/:id", async (req, env, p) => {
  await admin(req, env);
  await env.DB.prepare("DELETE FROM reviews WHERE id = ?").bind(+p.id).run();
  return json({ ok: true });
});

route("PUT", "/api/admin/catalog", async (req, env) => {
  await admin(req, env);
  const b = await body(req, 3_000_000);
  if (!b || typeof b.SETTINGS !== "object" || !Array.isArray(b.CATEGORIES) || !Array.isArray(b.PRODUCTS) || !Array.isArray(b.NEWS)) fail(400, "Katalog formati noto'g'ri");
  const ids = new Set();
  for (const p of b.PRODUCTS) {
    if (!Number.isInteger(p.id) || ids.has(p.id)) fail(400, "Mahsulot ID'lari takrorlanmas butun son bo'lishi kerak");
    ids.add(p.id);
    if (typeof p.name !== "string" || !p.name.trim() || !(p.price >= 0)) fail(400, `Mahsulot #${p.id}: nomi yoki narxi noto'g'ri`);
  }
  const { adminPass, ...settings } = b.SETTINGS; // eski panel versiyasidan qolgan maydon saqlanmaydi
  await saveCatalog(env, { SETTINGS: settings, CATEGORIES: b.CATEGORIES, PRODUCTS: b.PRODUCTS, NEWS: b.NEWS }, str(b.note, 120) || "Admin panel");
  return json({ ok: true, updated_at: Date.now() });
});
route("GET", "/api/admin/catalog/versions", async (req, env) => {
  await admin(req, env);
  const r = await env.DB.prepare("SELECT id, saved_at, note, LENGTH(json) AS size FROM catalog_versions ORDER BY id DESC").all();
  return json({ versions: r.results });
});
route("GET", "/api/admin/catalog/versions/:id", async (req, env, p) => {
  await admin(req, env);
  const r = await env.DB.prepare("SELECT json FROM catalog_versions WHERE id = ?").bind(+p.id).first();
  if (!r) fail(404, "Versiya topilmadi");
  return json(JSON.parse(r.json));
});
route("POST", "/api/admin/images", async (req, env) => {
  await admin(req, env);
  const b = await body(req, 1_500_000);
  const m = String(b.data || "").match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) fail(400, "Faqat JPEG, PNG yoki WebP rasm yuklash mumkin");
  if (m[2].length > 1_200_000) fail(413, "Rasm juda katta (900 KB gacha)");
  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[m[1]];
  const name = `u-${Date.now()}-${randHex(3)}.${ext}`;
  await env.DB.prepare("INSERT INTO images (name, mime, data_b64, created_at) VALUES (?, ?, ?, ?)").bind(name, m[1], m[2], Date.now()).run();
  return json({ path: "srv:" + name }, 201);
});

// ---------- Kirish nuqtasi ----------
export default {
  async scheduled(event, env) { await pollUpdates(env); await expireUnconfirmed(env); },
  async fetch(req, env) {
    const cors = corsHeaders(req, env);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const url = new URL(req.url);
    try {
      for (const r of routes) {
        if (r.method !== req.method) continue;
        const m = url.pathname.match(r.re);
        if (!m) continue;
        const res = await r.handler(req, env, m.groups || {});
        for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
        return res;
      }
      return json({ error: "Topilmadi" }, 404, cors);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status, cors);
      console.error(e && e.stack || e);
      return json({ error: "Server xatosi. Birozdan keyin qayta urinib ko'ring." }, 500, cors);
    }
  },
};
