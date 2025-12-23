#!/bin/bash
# Run database migration for adding source and service columns

echo "🔄 Running database migration: Add source and service columns"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL environment variable is not set"
    echo "💡 Set it with: export DATABASE_URL='your_database_url'"
    exit 1
fi

echo "📡 Connecting to database..."
echo ""

# Run the migration
psql "$DATABASE_URL" -f migrations/001_add_source_and_service_columns.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration completed successfully!"
    echo "🎉 Your database now supports source tracking for contact forms and chatbot"
else
    echo ""
    echo "❌ Migration failed. Please check the error messages above."
    exit 1
fi
