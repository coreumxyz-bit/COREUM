-- Public API: look up the latest check of a token by its address
CREATE INDEX IF NOT EXISTS jobs_token ON jobs(json_extract(src, '$.address'), id);
