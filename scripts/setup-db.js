#!/usr/bin/env node
require('dotenv').config();
const { Client } = require('pg');

/**
 * Database setup script
 * Creates the database if it doesn't exist
 */
async function setupDatabase() {
    // Parse DATABASE_URL to extract database name
    const databaseUrl = process.env.DATABASE_URL || 'postgresql://localhost:5432/websited_dev';
    const match = databaseUrl.match(/\/([^/?]+)(\?|$)/);
    const dbName = match ? match[1] : 'websited_dev';
    
    // Connect to postgres database (default) to create our database
    const defaultUrl = databaseUrl.replace(`/${dbName}`, '/postgres');
    
    const client = new Client({
        connectionString: defaultUrl
    });
    
    try {
        await client.connect();
        console.log('📡 Connected to PostgreSQL server');
        
        // Check if database exists
        const checkDb = await client.query(
            `SELECT 1 FROM pg_database WHERE datname = $1`,
            [dbName]
        );
        
        if (checkDb.rows.length > 0) {
            console.log(`✅ Database "${dbName}" already exists`);
        } else {
            // Create database
            await client.query(`CREATE DATABASE ${dbName}`);
            console.log(`✅ Database "${dbName}" created successfully`);
        }
        
        console.log('\n🎉 Database setup complete!');
        console.log(`📝 Run "npm start" or "npm run dev" to initialize tables\n`);
        
    } catch (error) {
        console.error('❌ Database setup failed:', error.message);
        console.error('\n💡 Troubleshooting:');
        console.error('   - Ensure PostgreSQL is running: brew services list');
        console.error('   - Start PostgreSQL: brew services start postgresql@15');
        console.error('   - Check DATABASE_URL in .env file\n');
        process.exit(1);
    } finally {
        await client.end();
    }
}

// Run setup
setupDatabase();
