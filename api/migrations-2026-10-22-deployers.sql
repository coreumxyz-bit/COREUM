-- Deployer history: tokens each wallet launched through the Pons factory
CREATE TABLE IF NOT EXISTS deployers (
  address TEXT PRIMARY KEY,      -- creator wallet, lowercase
  scanned_to INTEGER NOT NULL,   -- last block searched
  tokens TEXT NOT NULL,          -- JSON [{a: token, b: creation block}], newest first
  contract INTEGER NOT NULL DEFAULT 0, -- 1 = the creator is a contract (a shared launcher), not a person
  updated INTEGER NOT NULL
);
