-- Migration: repair lead source values for rebuilt Simple Page flows
-- A previous deployment recorded migration 005 before its final constraint update.

ALTER TABLE callback_requests
DROP CONSTRAINT IF EXISTS callback_requests_source_check;

ALTER TABLE callback_requests
ADD CONSTRAINT callback_requests_source_check
CHECK (source IN ('chatbot', 'contact_form', 'footer_form', 'download_chat', 'chat_booking', 'assessment'));
