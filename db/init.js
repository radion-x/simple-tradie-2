const fs = require('fs');
const path = require('path');
const pool = require('./pool');

const schemaPath = path.join(__dirname, 'schema.sql');
const migrationsDirectory = path.join(__dirname, '..', 'migrations');

function getMigrationFiles() {
    if (!fs.existsSync(migrationsDirectory)) {
        return [];
    }

    return fs.readdirSync(migrationsDirectory)
        .filter((fileName) => /^\d+_.+\.sql$/.test(fileName))
        .sort((left, right) => left.localeCompare(right));
}

async function applyMigration(client, fileName) {
    const migrationPath = path.join(migrationsDirectory, fileName);
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    await client.query('BEGIN');
    try {
        await client.query(migrationSql);
        await client.query(
            'INSERT INTO schema_migrations (name) VALUES ($1)',
            [fileName]
        );
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
}

async function initDatabase() {
    const client = await pool.connect();

    try {
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await client.query(schemaSql);

        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                name TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        const appliedResult = await client.query('SELECT name FROM schema_migrations');
        const appliedMigrations = new Set(appliedResult.rows.map((row) => row.name));
        const migrationFiles = getMigrationFiles();
        const newlyApplied = [];

        for (const fileName of migrationFiles) {
            if (appliedMigrations.has(fileName)) {
                continue;
            }

            await applyMigration(client, fileName);
            newlyApplied.push(fileName);
        }

        const tablesResult = await client.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name IN (
                  'admin_magic_links',
                  'admin_sessions',
                  'callback_requests',
                  'search_queries',
                  'schema_migrations'
              )
            ORDER BY table_name
        `);

        return {
            appliedMigrations: newlyApplied,
            tables: tablesResult.rows.map((row) => row.table_name)
        };
    } finally {
        client.release();
    }
}

module.exports = initDatabase;
module.exports.getMigrationFiles = getMigrationFiles;
