-- Esquema de la feature 001-padel-court-booking (ver specs/001-padel-court-booking/data-model.md).
-- Idempotente: se aplica en cada arranque del backend.

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash   TEXT    PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS login_attempts (
  email        TEXT    PRIMARY KEY,
  failed_count INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NULL
);

CREATE TABLE IF NOT EXISTS courts (
  id   INTEGER PRIMARY KEY,
  name TEXT    NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS reservations (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  court_id     INTEGER NOT NULL REFERENCES courts(id),
  date         TEXT    NOT NULL,
  start_hour   INTEGER NOT NULL CHECK (start_hour BETWEEN 0 AND 23),
  start_at     INTEGER NOT NULL,
  end_at       INTEGER NOT NULL,
  created_at   INTEGER NOT NULL,
  cancelled_at INTEGER NULL
);
-- Principio I: a lo sumo una reserva no cancelada por bloque.
CREATE UNIQUE INDEX IF NOT EXISTS ux_reservations_slot
  ON reservations(court_id, date, start_hour) WHERE cancelled_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reservations_user ON reservations(user_id, cancelled_at, end_at);

-- Seed inmutable de las 5 canchas (Principio II).
INSERT OR IGNORE INTO courts(id, name) VALUES
  (1, 'Cancha Laureles'),
  (2, 'Cancha El Poblado'),
  (3, 'Cancha Belén'),
  (4, 'Cancha Robledo'),
  (5, 'Cancha Envigado');
