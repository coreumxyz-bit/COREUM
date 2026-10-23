-- Robinhood Chain tx that wrote the job's verdict into CoreumVerdicts.
ALTER TABLE jobs ADD COLUMN chain_tx TEXT;
