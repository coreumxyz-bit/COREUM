-- Ask Coreum: chat messages per asker per day (asker = sha of IP or holder wallet).
CREATE TABLE IF NOT EXISTS chat_use (
  asker TEXT NOT NULL,
  day TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (asker, day)
);
