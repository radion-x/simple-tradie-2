ALTER TABLE callback_requests ADD COLUMN IF NOT EXISTS event_id UUID;
ALTER TABLE callback_requests ADD COLUMN IF NOT EXISTS notification_status TEXT NOT NULL DEFAULT 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS idx_tradie_event ON callback_requests(event_id) WHERE event_id IS NOT NULL;
