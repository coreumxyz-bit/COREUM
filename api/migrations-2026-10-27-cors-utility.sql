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
