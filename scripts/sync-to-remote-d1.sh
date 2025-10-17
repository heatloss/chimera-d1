#!/bin/bash
##
# Sync local D1 database to remote D1
# This exports the complete local database and imports it to remote D1
#
# Usage: ./scripts/sync-to-remote-d1.sh
##

set -e

LOCAL_DB=".wrangler/state/v3/d1/miniflare-D1DatabaseObject/71ea17b93de1684d034c11957d24f940ab865936bf90542392bf0517b4af1470.sqlite"
EXPORT_FILE=".temp-d1-export.sql"
D1_DATABASE="chimera-d1"

echo "📦 Syncing local D1 database to remote..."
echo ""

# Step 1: Export local database
echo "1️⃣  Exporting local database..."
sqlite3 "$LOCAL_DB" ".dump" > "$EXPORT_FILE"
echo "   ✓ Exported to $EXPORT_FILE"
echo ""

# Step 2: Get file size
FILE_SIZE=$(wc -c < "$EXPORT_FILE" | tr -d ' ')
echo "   📊 Export file size: $FILE_SIZE bytes"
echo ""

# Step 3: Check if file is too large for single execution (D1 has a 1MB limit per request)
if [ "$FILE_SIZE" -gt 900000 ]; then
  echo "⚠️  File is large ($FILE_SIZE bytes). Splitting into chunks..."
  echo ""

  # Split into schema and data
  echo "2️⃣  Splitting export into schema and data..."

  # Export schema only
  sqlite3 "$LOCAL_DB" ".schema" > ".temp-schema.sql"
  echo "   ✓ Schema exported to .temp-schema.sql"

  # Export data only (INSERT statements)
  sqlite3 "$LOCAL_DB" <<'EOF' > ".temp-data.sql"
.mode insert
SELECT 'INSERT INTO users VALUES(' || quote(id) || ',' || quote(email) || ',' || quote(hash) || ',' || quote(salt) || ',' || quote(reset_password_token) || ',' || quote(reset_password_expiration) || ',' || quote(name) || ',' || quote(role) || ',' || quote(updated_at) || ',' || quote(created_at) || ');' FROM users;
SELECT 'INSERT INTO comics VALUES(' || quote(id) || ',' || quote(uuid) || ',' || quote(title) || ',' || quote(slug) || ',' || quote(synopsis) || ',' || quote(rating) || ',' || quote(status) || ',' || quote(cover_image_id) || ',' || quote(is_featured) || ',' || quote(is_active) || ',' || quote(banner_heading) || ',' || quote(banner_text) || ',' || quote(banner_display) || ',' || quote(banner_theme) || ',' || quote(thumbnail_image_id) || ',' || quote(updated_at) || ',' || quote(created_at) || ');' FROM comics;
SELECT 'INSERT INTO chapters VALUES(' || quote(id) || ',' || quote(uuid) || ',' || quote(title) || ',' || quote(slug) || ',' || quote(volume) || ',' || quote(number) || ',' || quote(synopsis) || ',' || quote(publish_date) || ',' || quote(is_active) || ',' || quote(comic_id) || ',' || quote(cover_image_id) || ',' || quote(updated_at) || ',' || quote(created_at) || ');' FROM chapters;
SELECT 'INSERT INTO pages VALUES(' || quote(id) || ',' || quote(uuid) || ',' || quote(number) || ',' || quote(transcript) || ',' || quote(commentary) || ',' || quote(is_active) || ',' || quote(chapter_id) || ',' || quote(page_image_id) || ',' || quote(thumbnail_image_id) || ',' || quote(prev_page_id) || ',' || quote(next_page_id) || ',' || quote(alt_text) || ',' || quote(updated_at) || ',' || quote(created_at) || ');' FROM pages;
SELECT 'INSERT INTO media VALUES(' || quote(id) || ',' || quote(uuid) || ',' || quote(alt) || ',' || quote(caption) || ',' || quote(image_sizes) || ',' || quote(media_type) || ',' || quote(uploaded_by_id) || ',' || quote(is_public) || ',' || quote(comic_meta_related_comic_id) || ',' || quote(comic_meta_is_n_s_f_w) || ',' || quote(updated_at) || ',' || quote(created_at) || ',' || quote(url) || ',' || quote(thumbnail_u_r_l) || ',' || quote(filename) || ',' || quote(mime_type) || ',' || quote(filesize) || ',' || quote(width) || ',' || quote(height) || ');' FROM media;
EOF
  echo "   ✓ Data exported to .temp-data.sql"
  echo ""

  echo "3️⃣  Uploading schema to remote D1..."
  pnpm wrangler d1 execute "$D1_DATABASE" --remote --file=".temp-schema.sql"
  echo "   ✓ Schema uploaded"
  echo ""

  echo "4️⃣  Uploading data to remote D1..."
  pnpm wrangler d1 execute "$D1_DATABASE" --remote --file=".temp-data.sql"
  echo "   ✓ Data uploaded"
  echo ""

  # Cleanup
  rm -f ".temp-schema.sql" ".temp-data.sql"
else
  echo "2️⃣  Uploading to remote D1..."
  pnpm wrangler d1 execute "$D1_DATABASE" --remote --file="$EXPORT_FILE"
  echo "   ✓ Uploaded successfully"
  echo ""
fi

# Cleanup
rm -f "$EXPORT_FILE"

echo "✅ Sync complete!"
echo ""
echo "Verifying remote database..."
pnpm wrangler d1 execute "$D1_DATABASE" --remote --command "SELECT
  (SELECT COUNT(*) FROM users) as users,
  (SELECT COUNT(*) FROM comics) as comics,
  (SELECT COUNT(*) FROM chapters) as chapters,
  (SELECT COUNT(*) FROM pages) as pages,
  (SELECT COUNT(*) FROM media) as media;"
