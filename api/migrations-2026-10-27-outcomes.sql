-- What became of a checked token 24h and 7d after its first check: labelled
-- training data for a rug-risk model, and the scorecard of the grades.
CREATE TABLE IF NOT EXISTS outcomes (
  address TEXT NOT NULL,
  horizon TEXT NOT NULL,      -- 24h | 7d
  job INTEGER,                -- the first check (baseline)
  ts INTEGER NOT NULL,        -- when the outcome was measured
  verdict TEXT,               -- the network's verdict at the check
  agree REAL,
  fdv0 REAL, fdv1 REAL,       -- value at the check, value at the mark (USD)
  liq0 REAL, liq1 REAL,       -- liquidity at the check, at the mark (USD)
  grad0 INTEGER, grad1 INTEGER,
  change_pct REAL,            -- value change, %
  label TEXT NOT NULL,        -- dead | dumped | flat | up | graduated | no_data
  facts TEXT,                 -- the check's facts (features for the model)
  PRIMARY KEY (address, horizon)
);
