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

# Export table counts
echo "📊 Exporting table counts..."
pnpm wrangler d1 execute chimera-d1 --local --command "
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL SELECT 'comics', COUNT(*) FROM comics
UNION ALL SELECT 'chapters', COUNT(*) FROM chapters
UNION ALL SELECT 'pages', COUNT(*) FROM pages
UNION ALL SELECT 'media', COUNT(*) FROM media
UNION ALL SELECT 'payload_migrations', COUNT(*) FROM payload_migrations;
" --json > "${DATA_FILE}"

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
pnpm wrangler d1 execute chimera-d1 --local --command "
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL SELECT 'comics', COUNT(*) FROM comics
UNION ALL SELECT 'chapters', COUNT(*) FROM chapters
UNION ALL SELECT 'pages', COUNT(*) FROM pages
UNION ALL SELECT 'media', COUNT(*) FROM media
UNION ALL SELECT 'payload_migrations', COUNT(*) FROM payload_migrations;
" --json >> "${COMBINED_FILE}"

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
