-- Jobs that check an X post remember which post (url, author, text) they checked.
ALTER TABLE jobs ADD COLUMN src TEXT;
