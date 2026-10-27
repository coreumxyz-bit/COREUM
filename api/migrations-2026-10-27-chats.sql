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
