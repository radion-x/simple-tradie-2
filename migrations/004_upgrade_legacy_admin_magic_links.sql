-- Upgrade the earlier prototype magic-link table without deleting records.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'admin_magic_links' AND column_name = 'token'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'admin_magic_links' AND column_name = 'token_hash'
    ) THEN
        ALTER TABLE admin_magic_links RENAME COLUMN token TO token_hash;
    END IF;
END $$;

ALTER TABLE admin_magic_links
    ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_magic_links_token_hash
    ON admin_magic_links (token_hash);

CREATE INDEX IF NOT EXISTS idx_admin_magic_links_expiry
    ON admin_magic_links (expires_at);
