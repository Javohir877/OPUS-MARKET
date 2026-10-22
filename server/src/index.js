// ================= OPUS MARKET API (Cloudflare Workers + D1) =================
//
// Ochiq:   GET  /api/catalog                     — katalog (sozlamalar, kategoriyalar, mahsulotlar, yangiliklar)
//          GET  /img/:name                       — admin yuklagan rasmlar
// Mijoz:   POST /api/auth/register | /api/auth/login | /api/auth/logout
//          GET  /api/me    PATCH /api/me    POST /api/me/password
//          GET  /api/orders    POST /api/orders
// Admin:   POST /api/admin/login | /api/admin/logout | /api/admin/password
//          GET  /api/admin/stats
//          GET  /api/admin/users   GET|PATCH|DELETE /api/admin/users/:id   POST /api/admin/users/:id/reset-password
//          GET  /api/admin/orders  PATCH /api/admin/orders/:id
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
const orderOut = (o) => ({ ...o, items: JSON.parse(o.items_json || "[]"), items_json: undefined });

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
      await env.DB.prepare(`INSERT INTO orders (id, user_id, status, delivery, region, address, note, payment, months, promo, subtotal, discount, ship, total, items_json, created_at, updated_at)
        VALUES (?, ?, 'Yangi', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(id, u.id, delivery, region, address, note, payment, months, pct ? promo : null, subtotal, discount, ship, total, JSON.stringify(lines), now, now).run();
      break;
    } catch (e) { if (tries === 4) throw e; }
  }
  // Keyingi safar uchun manzilni eslab qolamiz
  if (delivery === "courier") await env.DB.prepare("UPDATE users SET region = ?, address = ? WHERE id = ?").bind(region, address, u.id).run();
  return json({ order: orderOut(await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first()) }, 201);
});

// ---------- Admin ----------
const admin = (req, env) => session(req, env, "admin");

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
    q("SELECT COUNT(*) AS c FROM orders"),
    q("SELECT COUNT(*) AS c, COALESCE(SUM(total), 0) AS s FROM orders WHERE created_at > ? AND status != 'Bekor qilindi'", day),
    q("SELECT COALESCE(SUM(total), 0) AS s FROM orders WHERE status != 'Bekor qilindi'"),
    env.DB.prepare("SELECT status, COUNT(*) AS c FROM orders GROUP BY status").all(),
  ]);
  return json({ users: users.c, newUsers: newUsers.c, orders: orders.c, todayOrders: today.c, todayRevenue: today.s, revenue: revenue.s,
    byStatus: Object.fromEntries(byStatus.results.map((r) => [r.status, r.c])) });
});

route("GET", "/api/admin/users", async (req, env) => {
  await admin(req, env);
  const url = new URL(req.url), q = "%" + (url.searchParams.get("q") || "").trim() + "%";
  const r = await env.DB.prepare(`SELECT u.id, u.name, u.phone, u.email, u.region, u.address, u.blocked, u.created_at, u.last_login,
      COUNT(o.id) AS orders, COALESCE(SUM(CASE WHEN o.status != 'Bekor qilindi' THEN o.total END), 0) AS spent
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
  return json({ user: { ...publicUser(u), blocked: u.blocked, last_login: u.last_login }, orders: o.results.map(orderOut) });
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
  if (wasCancelled !== nowCancelled) {
    const cat = await getCatalog(env), byId = new Map(cat.PRODUCTS.map((x) => [x.id, x]));
    for (const l of JSON.parse(o.items_json)) { const prod = byId.get(l.id); if (prod) prod.stock = Math.max(0, (prod.stock || 0) + (nowCancelled ? l.qty : -l.qty)); }
    await saveCatalog(env, cat);
  }
  await env.DB.prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?").bind(b.status, Date.now(), o.id).run();
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
