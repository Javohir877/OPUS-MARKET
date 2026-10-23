-- Telegram orqali buyurtmani tasdiqlash (bir marta ishga tushiriladi:
--   wrangler d1 execute opus-market --remote --file migrations/002_telegram.sql)

-- Mijozning Telegram chati (kontakt orqali telefon tasdiqlangandan keyin)
ALTER TABLE users ADD COLUMN tg_chat_id TEXT;
ALTER TABLE users ADD COLUMN tg_link_token TEXT;      -- t.me/bot?start=<token> uchun bir martalik kalit
ALTER TABLE users ADD COLUMN tg_pending_chat TEXT;    -- /start bosilgan, kontakt kutilayotgan chat

-- Buyurtma tasdiqlash kodi. Avvalgi buyurtmalar tasdiqlangan hisoblanadi (DEFAULT 1), yangilari 0 bilan yoziladi.
ALTER TABLE orders ADD COLUMN confirmed INTEGER NOT NULL DEFAULT 1;
ALTER TABLE orders ADD COLUMN code_hash TEXT;
ALTER TABLE orders ADD COLUMN code_exp INTEGER;
ALTER TABLE orders ADD COLUMN code_tries INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN code_sent INTEGER;
ALTER TABLE orders ADD COLUMN confirmed_at INTEGER;

CREATE INDEX IF NOT EXISTS idx_users_tg ON users (tg_chat_id);
CREATE INDEX IF NOT EXISTS idx_users_tglink ON users (tg_link_token);

-- Oddiy kalit-qiymat sozlamalar (admin Telegram chati va h.k.)
CREATE TABLE IF NOT EXISTS kv (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
