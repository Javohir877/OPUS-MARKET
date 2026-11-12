-- Bir nechta admin akkaunti: Owner (do'kon egasi) va Adminlar
CREATE TABLE IF NOT EXISTS admins (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  login       TEXT    NOT NULL UNIQUE,
  name        TEXT    NOT NULL,
  role        TEXT    NOT NULL,              -- 'owner' | 'admin'
  pass_hash   TEXT    NOT NULL,
  pass_salt   TEXT    NOT NULL,
  iter        INTEGER NOT NULL,
  disabled    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  last_login  INTEGER
);
-- Mavjud admin paroli Owner akkauntiga ko'chiriladi (parol o'zgarmaydi)
INSERT OR IGNORE INTO admins (id, login, name, role, pass_hash, pass_salt, iter, created_at)
  SELECT 1, 'owner', 'Owner', 'owner', pass_hash, pass_salt, iter, CAST(strftime('%s','now') AS INTEGER) * 1000 FROM admin WHERE id = 1;
