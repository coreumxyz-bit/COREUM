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
  done_at INTEGER
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

ALTER TABLE agents ADD COLUMN last_seen INTEGER;
