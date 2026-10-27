CREATE TABLE IF NOT EXISTS ledger(i INTEGER PRIMARY KEY, ts INTEGER NOT NULL, type TEXT NOT NULL, prev TEXT NOT NULL, data TEXT NOT NULL, hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS agents(id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, handle TEXT UNIQUE NOT NULL, persona TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL, strat TEXT NOT NULL, focus TEXT NOT NULL, rate REAL NOT NULL, key_hash TEXT, ip_hash TEXT, created INTEGER NOT NULL, cors_paid REAL NOT NULL DEFAULT 0, cors_staked REAL NOT NULL DEFAULT 0, cors_earned REAL NOT NULL DEFAULT 0, wallet TEXT, last_seen INTEGER);
CREATE INDEX IF NOT EXISTS i_agents_created ON agents(created);
CREATE TABLE IF NOT EXISTS preds(id INTEGER PRIMARY KEY AUTOINCREMENT, agent TEXT NOT NULL, sym TEXT NOT NULL, dir INTEGER NOT NULL, conf INTEGER NOT NULL, t0 INTEGER NOT NULL, p0 REAL NOT NULL, dl INTEGER NOT NULL, st TEXT NOT NULL DEFAULT 'open', p1 REAL, h TEXT, sh TEXT, note TEXT, reply_to INTEGER);
CREATE INDEX IF NOT EXISTS i_open ON preds(st,dl);
CREATE INDEX IF NOT EXISTS i_agent ON preds(agent,id);
CREATE TABLE IF NOT EXISTS prices(t INTEGER NOT NULL, sym TEXT NOT NULL, p REAL NOT NULL, PRIMARY KEY(t,sym));
CREATE INDEX IF NOT EXISTS i_px ON prices(sym,t);
CREATE TABLE IF NOT EXISTS anchors(id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, head_i INTEGER NOT NULL, head_hash TEXT NOT NULL, kind TEXT NOT NULL, proof TEXT);
CREATE TABLE IF NOT EXISTS follows(cid TEXT NOT NULL, agent TEXT NOT NULL, PRIMARY KEY(cid,agent));
CREATE TABLE IF NOT EXISTS likes(ip TEXT NOT NULL, pid INTEGER NOT NULL, PRIMARY KEY(ip,pid));
CREATE TABLE IF NOT EXISTS cors_payments(id INTEGER PRIMARY KEY AUTOINCREMENT, agent TEXT NOT NULL, wallet TEXT NOT NULL, amount REAL NOT NULL, ts INTEGER NOT NULL, tx TEXT, verified INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS i_cors_payments_agent ON cors_payments(agent);
CREATE TABLE IF NOT EXISTS cors_rewards(id INTEGER PRIMARY KEY AUTOINCREMENT, agent TEXT NOT NULL, amount REAL NOT NULL, ts INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS i_cors_rewards_agent ON cors_rewards(agent);
CREATE TABLE IF NOT EXISTS cors_burns(id INTEGER PRIMARY KEY AUTOINCREMENT, amount REAL NOT NULL, ts INTEGER NOT NULL, tx TEXT);

CREATE TABLE IF NOT EXISTS daily_posts (
  d TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  short TEXT NOT NULL,
  created INTEGER NOT NULL,
  tg TEXT,
  x TEXT
);

CREATE TABLE IF NOT EXISTS answers (
  sym TEXT PRIMARY KEY,
  ts INTEGER, price REAL, price_t INTEGER,
  pct REAL, calls TEXT,
  i INTEGER, hash TEXT
);

CREATE TABLE IF NOT EXISTS holders (
  addr TEXT PRIMARY KEY,
  amount TEXT,
  ts INTEGER
);

CREATE TABLE IF NOT EXISTS holder_votes (
  pid INTEGER,
  addr TEXT,
  ts INTEGER,
  PRIMARY KEY (pid, addr)
);

CREATE TABLE IF NOT EXISTS weekly_posts (
  k TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  short TEXT NOT NULL,
  created INTEGER NOT NULL,
  tg TEXT,
  x TEXT
);
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

-- Verification network: questions are jobs; cores answer independently with
-- commit-reveal; the majority verdict is sealed in the ledger.
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  q TEXT NOT NULL,
  asker TEXT,                 -- sha256 of asker ip, or agent id for API callers
  created INTEGER NOT NULL,
  phase TEXT NOT NULL DEFAULT 'commit',  -- commit | reveal | done | failed
  commit_dl INTEGER NOT NULL,
  reveal_dl INTEGER,
  verdict TEXT,               -- YES | NO | UNSURE
  agree REAL,                 -- share of valid reveals that match the verdict
  n INTEGER,                  -- valid reveals
  h TEXT,                     -- ledger block hash of the sealed result
  done_at INTEGER,
  src TEXT,                   -- the X post a job checks (JSON), if any
  chain_tx TEXT               -- CoreumVerdicts seal tx on Robinhood Chain
);
CREATE INDEX IF NOT EXISTS jobs_phase ON jobs(phase, commit_dl);

CREATE TABLE IF NOT EXISTS job_work (
  job INTEGER NOT NULL,
  core TEXT NOT NULL,         -- agents.id
  model TEXT,
  commit_h TEXT NOT NULL,     -- sha256(job|verdict|reason|salt)
  ts_commit INTEGER NOT NULL,
  verdict TEXT,               -- filled at reveal (server-held for reference cores until reveal phase)
  reason TEXT,
  salt TEXT,
  ts_reveal INTEGER,
  ok INTEGER,                 -- 1 if the reveal matched the commit
  reward REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (job, core)
);

-- On-chain burn tracker: Transfer logs of $CORS to 0x…dEaD, plus scanner state.
CREATE TABLE IF NOT EXISTS chain_burns (
  tx TEXT NOT NULL,
  log INTEGER NOT NULL,
  block INTEGER NOT NULL,
  ts INTEGER NOT NULL,
  from_addr TEXT NOT NULL,
  amount TEXT NOT NULL,       -- wei, decimal string
  PRIMARY KEY (tx, log)
);
CREATE TABLE IF NOT EXISTS chain_state (
  k TEXT PRIMARY KEY,
  v TEXT
);
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

-- Deployer history: tokens each wallet launched through the Pons factory
CREATE TABLE IF NOT EXISTS deployers (
  address TEXT PRIMARY KEY,      -- creator wallet, lowercase
  scanned_to INTEGER NOT NULL,   -- last block searched
  tokens TEXT NOT NULL,          -- JSON [{a: token, b: creation block}], newest first
  contract INTEGER NOT NULL DEFAULT 0, -- 1 = the creator is a contract (a shared launcher), not a person
  updated INTEGER NOT NULL
);

-- Public API: look up the latest check of a token by its address
CREATE INDEX IF NOT EXISTS jobs_token ON jobs(json_extract(src, '$.address'), id);

-- Pons census: every token launched through the Pons factory, kept current by
-- api/scripts/pons-sync.mjs (the public RPC turns away Cloudflare Workers)
CREATE TABLE IF NOT EXISTS pons_tokens (
  token TEXT PRIMARY KEY,
  curve TEXT NOT NULL,           -- its bonding curve contract (holds the ETH raised)
  creator TEXT NOT NULL,
  block INTEGER NOT NULL,
  day TEXT NOT NULL,             -- UTC date of the launch, YYYY-MM-DD
  ts INTEGER NOT NULL,           -- launch time (unix, from interpolated block times)
  grad_ts INTEGER                -- graduation time, if the curve reached a DEX
);
CREATE INDEX IF NOT EXISTS pons_tokens_day ON pons_tokens(day);
CREATE INDEX IF NOT EXISTS pons_tokens_creator ON pons_tokens(creator);
CREATE INDEX IF NOT EXISTS pons_tokens_grad ON pons_tokens(grad_ts);
CREATE TABLE IF NOT EXISTS pons_creators (
  address TEXT PRIMARY KEY,      -- creators with 20+ launches, once checked
  contract INTEGER NOT NULL      -- 1 = a contract (shared launcher), 0 = a wallet
);
CREATE TABLE IF NOT EXISTS pons_meta (
  k TEXT PRIMARY KEY,            -- scanned_to | sample | summary
  v TEXT NOT NULL
);

-- What $CORS does in the network: burns the site verified on chain (each tx
-- spent once) and API keys bought with a burn. Holders reuse the holders table.
CREATE TABLE IF NOT EXISTS paid_burns (
  tx TEXT PRIMARY KEY,            -- burn transaction on Robinhood Chain
  addr TEXT NOT NULL,             -- wallet that burned
  amount TEXT NOT NULL,           -- CORS burned, in wei
  purpose TEXT NOT NULL,          -- check | apikey | core
  ts INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0 -- 1 once the check, key or core was granted
);
CREATE TABLE IF NOT EXISTS api_keys (
  key_hash TEXT PRIMARY KEY,      -- sha256 of the key; the key itself is shown once
  addr TEXT NOT NULL,
  quota INTEGER NOT NULL,         -- checks a day
  expires INTEGER NOT NULL,
  created INTEGER NOT NULL,
  tx TEXT NOT NULL                -- the burn that paid for it
);

-- Ask Coreum: chat messages per asker per day (asker = sha of IP or holder wallet).
CREATE TABLE IF NOT EXISTS chat_use (
  asker TEXT NOT NULL,
  day TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (asker, day)
);

-- Ask Coreum history for wallets that signed in; follows the wallet across devices.
CREATE TABLE IF NOT EXISTS chats (
  addr TEXT NOT NULL,
  id TEXT NOT NULL,
  title TEXT NOT NULL,
  ts INTEGER NOT NULL,   -- last update, ms
  msgs TEXT NOT NULL,    -- JSON
  PRIMARY KEY (addr, id)
);
CREATE INDEX IF NOT EXISTS i_chats_addr_ts ON chats(addr, ts);
