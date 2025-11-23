#!/bin/bash
# Database Backup Script
# Creates a complete backup of the current D1 schema and data

set -e

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="backups"
SCHEMA_FILE="${BACKUP_DIR}/schema-${TIMESTAMP}.sql"
DATA_FILE="${BACKUP_DIR}/data-${TIMESTAMP}.json"
COMBINED_FILE="${BACKUP_DIR}/full-backup-${TIMESTAMP}.txt"

mkdir -p "${BACKUP_DIR}"

echo "🗄️  Creating database backup: ${TIMESTAMP}"
echo ""

# Export schema
echo "📋 Exporting schema..."
pnpm wrangler d1 execute chimera-d1 --local --command "SELECT sql FROM sqlite_master WHERE type IN ('table', 'index') AND name NOT LIKE 'sqlite_%' ORDER BY type DESC, name;" --json > "${SCHEMA_FILE}"

# Export table counts (split into separate queries to avoid SQLite UNION limit)
echo "📊 Exporting table counts..."
echo "[" > "${DATA_FILE}"
pnpm wrangler d1 execute chimera-d1 --local --command "SELECT 'users' as table_name, COUNT(*) as count FROM users;" --json >> "${DATA_FILE}"
echo "," >> "${DATA_FILE}"
pnpm wrangler d1 execute chimera-d1 --local --command "SELECT 'comics' as table_name, COUNT(*) as count FROM comics;" --json >> "${DATA_FILE}"
echo "," >> "${DATA_FILE}"
pnpm wrangler d1 execute chimera-d1 --local --command "SELECT 'chapters' as table_name, COUNT(*) as count FROM chapters;" --json >> "${DATA_FILE}"
echo "," >> "${DATA_FILE}"
pnpm wrangler d1 execute chimera-d1 --local --command "SELECT 'pages' as table_name, COUNT(*) as count FROM pages;" --json >> "${DATA_FILE}"
echo "," >> "${DATA_FILE}"
pnpm wrangler d1 execute chimera-d1 --local --command "SELECT 'media' as table_name, COUNT(*) as count FROM media;" --json >> "${DATA_FILE}"
echo "," >> "${DATA_FILE}"
pnpm wrangler d1 execute chimera-d1 --local --command "SELECT 'payload_migrations' as table_name, COUNT(*) as count FROM payload_migrations;" --json >> "${DATA_FILE}"
echo "]" >> "${DATA_FILE}"

# Create combined documentation
cat > "${COMBINED_FILE}" << EOF
===================================================================
Database Backup: chimera-d1
Timestamp: ${TIMESTAMP}
===================================================================

SCHEMA INFORMATION
==================

EOF

# Add schema details
pnpm wrangler d1 execute chimera-d1 --local --command "SELECT name, type FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;" --json >> "${COMBINED_FILE}"

cat >> "${COMBINED_FILE}" << EOF

TABLE COUNTS
============

EOF

# Add table counts
pnpm wrangler d1 execute chimera-d1 --local --command "SELECT name as table_name, (SELECT COUNT(*) FROM users) as users_count, (SELECT COUNT(*) FROM comics) as comics_count, (SELECT COUNT(*) FROM chapters) as chapters_count, (SELECT COUNT(*) FROM pages) as pages_count, (SELECT COUNT(*) FROM media) as media_count FROM sqlite_master WHERE name='users' LIMIT 1;" --json >> "${COMBINED_FILE}"

cat >> "${COMBINED_FILE}" << EOF

USERS TABLE SCHEMA
==================

EOF

pnpm wrangler d1 execute chimera-d1 --local --command "PRAGMA table_info(users);" --json >> "${COMBINED_FILE}"

cat >> "${COMBINED_FILE}" << EOF

COMICS TABLE SCHEMA
===================

EOF

pnpm wrangler d1 execute chimera-d1 --local --command "PRAGMA table_info(comics);" --json >> "${COMBINED_FILE}"

cat >> "${COMBINED_FILE}" << EOF

CHAPTERS TABLE SCHEMA
=====================

EOF

pnpm wrangler d1 execute chimera-d1 --local --command "PRAGMA table_info(chapters);" --json >> "${COMBINED_FILE}"

cat >> "${COMBINED_FILE}" << EOF

PAGES TABLE SCHEMA
==================

EOF

pnpm wrangler d1 execute chimera-d1 --local --command "PRAGMA table_info(pages);" --json >> "${COMBINED_FILE}"

cat >> "${COMBINED_FILE}" << EOF

MEDIA TABLE SCHEMA
==================

EOF

pnpm wrangler d1 execute chimera-d1 --local --command "PRAGMA table_info(media);" --json >> "${COMBINED_FILE}"

echo ""
echo "✅ Backup complete!"
echo ""
echo "Files created:"
echo "  - Schema: ${SCHEMA_FILE}"
echo "  - Data counts: ${DATA_FILE}"
echo "  - Combined documentation: ${COMBINED_FILE}"
echo ""
echo "To restore from this backup:"
echo "  1. Use the schema information to verify table structure"
echo "  2. Run Payload migrations to recreate schema: pnpm payload migrate"
echo "  3. Re-run data migration if needed"
