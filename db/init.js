const pool = require('./pool');
const fs = require('fs');
const path = require('path');

/**
 * Initialize database by running schema migrations
 */
async function initDatabase() {
    try {
        console.log('🔄 Initializing database schema...');
        
        // First, try to run migrations on existing tables
        console.log('🔄 Running migrations (if table exists)...');
        try {
            await pool.query(`
                ALTER TABLE IF EXISTS callback_requests 
                ADD COLUMN IF NOT EXISTS source VARCHAR(20) 
                DEFAULT 'chatbot';
            `);
            
            await pool.query(`
                ALTER TABLE IF EXISTS callback_requests 
                ADD COLUMN IF NOT EXISTS service VARCHAR(255);
            `);
            
            await pool.query(`
                DO $$ 
                BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'callback_requests') THEN
                        -- Drop old constraint if exists
                        ALTER TABLE callback_requests DROP CONSTRAINT IF EXISTS callback_requests_source_check;
                        
                        -- Add updated constraint with download_chat included
                        ALTER TABLE callback_requests 
                        ADD CONSTRAINT callback_requests_source_check 
                        CHECK (source IN ('chatbot', 'contact_form', 'footer_form', 'download_chat'));
                    END IF;
                END $$;
            `);
            
            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_callback_source ON callback_requests(source);
            `);
            
            console.log('✅ Migrations completed successfully');
        } catch (migrationError) {
            console.warn('⚠️ Migration warning:', migrationError.message);
        }
        
        // Read schema file
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        // Execute schema (will skip if tables exist)
        await pool.query(schema);
        
        console.log('✅ Database schema initialized successfully');
        
        // Check if tables exist
        const tablesCheck = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('callback_requests', 'search_queries')
            ORDER BY table_name
        `);
        
        console.log(`📊 Active tables: ${tablesCheck.rows.map(r => r.table_name).join(', ')}`);
        
    } catch (error) {
        console.error('❌ Database initialization failed:', error.message);
        if (error.message.includes('does not exist')) {
            console.error('💡 Hint: Run "npm run db:setup" to create the database first');
        }
        // Don't throw - allow server to start even if DB init fails
    }
}

module.exports = initDatabase;
