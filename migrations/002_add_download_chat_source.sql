-- Migration: Add download_chat to source column options
-- Date: 2025-11-22
-- Description: Update CHECK constraint to allow 'download_chat' as a source type for chat transcript downloads

-- Drop the existing CHECK constraint
ALTER TABLE callback_requests 
DROP CONSTRAINT IF EXISTS callback_requests_source_check;

-- Add new CHECK constraint with download_chat included
ALTER TABLE callback_requests 
ADD CONSTRAINT callback_requests_source_check 
CHECK (source IN ('chatbot', 'contact_form', 'footer_form', 'download_chat'));

-- Verify the constraint was updated
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'callback_requests'::regclass 
  AND conname = 'callback_requests_source_check';
