-- Migration: Add source and service columns to callback_requests
-- Date: 2025-11-21
-- Description: Add source tracking (chatbot/contact_form/footer_form) and service field

-- Add source column with default 'chatbot'
ALTER TABLE callback_requests 
ADD COLUMN IF NOT EXISTS source VARCHAR(20) 
DEFAULT 'chatbot' 
CHECK (source IN ('chatbot', 'contact_form', 'footer_form'));

-- Add service column to track which service the customer is interested in
ALTER TABLE callback_requests 
ADD COLUMN IF NOT EXISTS service VARCHAR(255);

-- Create index on source column for better filtering performance
CREATE INDEX IF NOT EXISTS idx_callback_source ON callback_requests(source);

-- Verify columns were added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'callback_requests' 
  AND column_name IN ('source', 'service')
ORDER BY column_name;
