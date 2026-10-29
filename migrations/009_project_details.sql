ALTER TABLE callback_requests ADD COLUMN IF NOT EXISTS quote_details JSONB;
ALTER TABLE callback_requests ADD COLUMN IF NOT EXISTS notification_status VARCHAR(20) DEFAULT 'pending';
CREATE TABLE IF NOT EXISTS lead_attachments (
 id BIGSERIAL PRIMARY KEY,
 callback_id INTEGER NOT NULL REFERENCES callback_requests(id) ON DELETE CASCADE,
 filename VARCHAR(100) NOT NULL,
 content_type VARCHAR(30) NOT NULL CHECK (content_type IN ('image/jpeg','image/png','image/webp')),
 data BYTEA NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_attachment_callback ON lead_attachments(callback_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_msr_quote_event ON callback_requests(event_id) WHERE source='assessment' AND event_id IS NOT NULL;
