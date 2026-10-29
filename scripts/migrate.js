#!/usr/bin/env node
require('dotenv').config();
const initDatabase = require('../db/init');
const pool = require('../db/pool');

async function migrate() {
    try {
        const result = await initDatabase();

        if (result.appliedMigrations.length) {
            console.log(`Applied migrations: ${result.appliedMigrations.join(', ')}`);
        } else {
            console.log('Database schema is already current');
        }

        console.log(`Available tables: ${result.tables.join(', ')}`);
    } catch (error) {
        console.error(`Database migration failed: ${error.message}`);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

migrate();
