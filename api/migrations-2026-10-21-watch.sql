-- Watchlist: tokens the network re-checks every hour, and what it noticed.
CREATE TABLE IF NOT EXISTS watches (
  address TEXT PRIMARY KEY,      -- token contract, lowercase
  name TEXT,
  symbol TEXT,
  image TEXT,
  added INTEGER NOT NULL,
  watchers INTEGER NOT NULL DEFAULT 1,
  snap TEXT,                     -- last facts snapshot (JSON)
  snap_at INTEGER,               -- when the snapshot was taken
  last_job INTEGER               -- newest Token Check job for this token
);
CREATE TABLE IF NOT EXISTS watch_ips (
  address TEXT NOT NULL,
  who TEXT NOT NULL,             -- sha256 of the visitor IP: one watch per visitor
  PRIMARY KEY (address, who)
);
CREATE TABLE IF NOT EXISTS watch_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  address TEXT NOT NULL,
  ts INTEGER NOT NULL,
  kind TEXT NOT NULL,            -- liquidity_drop | price_crash | dev_sold | owner_active | honeypot | top10_jump | graduated
  severity TEXT NOT NULL,        -- danger | warn | good
  detail TEXT NOT NULL,
  job INTEGER                    -- re-check job the alert triggered, if any
);
CREATE INDEX IF NOT EXISTS watch_alerts_ts ON watch_alerts(ts);
