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
