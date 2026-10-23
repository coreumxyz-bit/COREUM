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
