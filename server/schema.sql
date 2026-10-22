-- OPUS MARKET — ma'lumotlar bazasi (Cloudflare D1 / SQLite)

-- Mijozlar. Parol hech qachon ochiq saqlanmaydi: faqat PBKDF2-SHA256 xeshi va tuzi (salt).
CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  phone       TEXT    NOT NULL UNIQUE,        -- 998XXXXXXXXX
  email       TEXT    UNIQUE,
  pass_hash   TEXT    NOT NULL,
  pass_salt   TEXT    NOT NULL,
  region      TEXT,
  address     TEXT,
  blocked     INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  last_login  INTEGER
);

-- Kirish seanslari (mijoz va admin). Tokenning o'zi emas, SHA-256 xeshi saqlanadi.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT    PRIMARY KEY,
  user_id     INTEGER,
  role        TEXT    NOT NULL,                -- 'user' | 'admin'
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);

-- Buyurtmalar. Narxlar server tomonidan katalogdan hisoblanadi (mijoz yuborgan narxga ishonilmaydi).
CREATE TABLE IF NOT EXISTS orders (
  id          TEXT    PRIMARY KEY,             -- OP1234567xx
  user_id     INTEGER,
  status      TEXT    NOT NULL DEFAULT 'Yangi',
  delivery    TEXT    NOT NULL,
  region      TEXT,
  address     TEXT,
  note        TEXT,
  payment     TEXT    NOT NULL,
  months      INTEGER,
  promo       TEXT,
  subtotal    INTEGER NOT NULL,
  discount    INTEGER NOT NULL DEFAULT 0,
  ship        INTEGER NOT NULL DEFAULT 0,
  total       INTEGER NOT NULL,
  items_json  TEXT    NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders (created_at);

-- Katalog (sozlamalar, kategoriyalar, mahsulotlar, yangiliklar) — bitta JSON hujjat
CREATE TABLE IF NOT EXISTS catalog (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  json        TEXT    NOT NULL,
  updated_at  INTEGER NOT NULL
);
-- Har bir saqlashdan oldingi holat (admin → Tarix → tiklash)
CREATE TABLE IF NOT EXISTS catalog_versions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  json        TEXT    NOT NULL,
  saved_at    INTEGER NOT NULL,
  note        TEXT
);

-- Admin yuklagan rasmlar
CREATE TABLE IF NOT EXISTS images (
  name        TEXT    PRIMARY KEY,
  mime        TEXT    NOT NULL,
  data_b64    TEXT    NOT NULL,
  created_at  INTEGER NOT NULL
);

-- Admin paroli (xesh)
CREATE TABLE IF NOT EXISTS admin (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  pass_hash   TEXT    NOT NULL,
  pass_salt   TEXT    NOT NULL,
  iter        INTEGER NOT NULL
);

-- Xato kirish urinishlari (parolni taxmin qilishdan himoya)
CREATE TABLE IF NOT EXISTS attempts (
  key         TEXT    NOT NULL,
  ts          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attempts_key ON attempts (key, ts);
