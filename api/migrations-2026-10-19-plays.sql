-- Beat the AI: one-tap human calls, sealed in the same ledger as node calls
CREATE TABLE IF NOT EXISTS plays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player TEXT NOT NULL,      -- sha256 of the browser's secret
  name TEXT NOT NULL,
  sym TEXT NOT NULL,
  dir INTEGER NOT NULL,
  t0 INTEGER NOT NULL,
  p0 REAL NOT NULL,
  dl INTEGER NOT NULL,
  ai INTEGER NOT NULL,       -- swarm direction at t0: 1, -1, or 0 (no open calls)
  ai_pct REAL,               -- swarm bullish share at t0
  st TEXT NOT NULL DEFAULT 'open',
  p1 REAL,
  h TEXT,
  sh TEXT,
  ip_hash TEXT
);
CREATE INDEX IF NOT EXISTS plays_player ON plays(player, t0);
CREATE INDEX IF NOT EXISTS plays_open ON plays(st, dl);
