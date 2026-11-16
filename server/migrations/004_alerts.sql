-- "Kelganda xabar ber" / "Narxi tushsa xabar ber" obunalari (bir martalik: xabar yuborilgach o'chadi)
CREATE TABLE IF NOT EXISTS alerts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  product_id  INTEGER NOT NULL,
  kind        TEXT    NOT NULL,              -- 'stock' | 'price'
  base_price  INTEGER NOT NULL,              -- obuna paytidagi narx
  created_at  INTEGER NOT NULL,
  UNIQUE (user_id, product_id, kind)
);
CREATE INDEX IF NOT EXISTS idx_alerts_product ON alerts (product_id);
-- Mijozga ilova/sayt ichidagi xabarlar (ilova yopiq bo'lsa ham telefon bildirishnomasi bo'lib chiqadi)
CREATE TABLE IF NOT EXISTS notices (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  kind        TEXT    NOT NULL,
  product_id  INTEGER,
  title       TEXT    NOT NULL,
  body        TEXT    NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notices_user ON notices (user_id, created_at);
-- Sharhlar admin tasdig'idan keyin chiqadi
ALTER TABLE reviews ADD COLUMN pending INTEGER NOT NULL DEFAULT 0;
