-- ============================================
-- WEBSITED DATABASE SCHEMA
-- ============================================

-- Callback Requests Table (unified for chatbot and form submissions)
CREATE TABLE IF NOT EXISTS callback_requests (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    preferred_contact_method VARCHAR(20) CHECK (preferred_contact_method IN ('phone', 'email', 'sms', 'any')),
    preferred_time VARCHAR(255),
    message TEXT,
    conversation_context TEXT,
    source VARCHAR(20) DEFAULT 'chatbot' CHECK (source IN ('chatbot', 'contact_form', 'footer_form', 'download_chat')),
    service VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'completed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Search Queries Table (for usage tracking)
CREATE TABLE IF NOT EXISTS search_queries (
    id SERIAL PRIMARY KEY,
    query TEXT NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    results_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_callback_status ON callback_requests(status);
CREATE INDEX IF NOT EXISTS idx_callback_source ON callback_requests(source);
CREATE INDEX IF NOT EXISTS idx_callback_created ON callback_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_session ON search_queries(session_id);
CREATE INDEX IF NOT EXISTS idx_search_created ON search_queries(created_at DESC);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to callback_requests
DROP TRIGGER IF EXISTS update_callback_requests_updated_at ON callback_requests;
CREATE TRIGGER update_callback_requests_updated_at
    BEFORE UPDATE ON callback_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
