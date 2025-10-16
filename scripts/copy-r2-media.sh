#!/bin/bash
##
# Copy media files from chimera-cms R2 bucket to chimera-d1 R2 bucket
# Usage: ./scripts/copy-r2-media.sh
##

set -e

SOURCE_BUCKET="chimera-cms"
DEST_BUCKET="chimera-d1"
TEMP_DIR="/tmp/r2-media-copy"

echo "📦 Copying media files from $SOURCE_BUCKET to $DEST_BUCKET"
echo ""

# Create temp directory
mkdir -p "$TEMP_DIR"

# Read filenames from database
FILENAMES=$(sqlite3 /Users/mike/Sites/chimera-cms/chimera-cms.db "SELECT filename FROM media WHERE filename IS NOT NULL ORDER BY filename;")

TOTAL=$(echo "$FILENAMES" | wc -l | tr -d ' ')
CURRENT=0
COPIED=0
FAILED=0

echo "Found $TOTAL files to copy"
echo ""

# Copy each file
while IFS= read -r filename; do
  CURRENT=$((CURRENT + 1))
  echo "[$CURRENT/$TOTAL] $filename"

  # Download from source bucket (remote)
  if pnpm wrangler r2 object get "$SOURCE_BUCKET/$filename" --file "$TEMP_DIR/$filename" --remote 2>/dev/null; then
    # Upload to destination bucket (remote)
    if pnpm wrangler r2 object put "$DEST_BUCKET/$filename" --file "$TEMP_DIR/$filename" --remote 2>/dev/null; then
      echo "  ✓ Copied"
      COPIED=$((COPIED + 1))
      rm -f "$TEMP_DIR/$filename"
    else
      echo "  ✗ Failed to upload"
      FAILED=$((FAILED + 1))
    fi
  else
    echo "  ✗ Failed to download"
    FAILED=$((FAILED + 1))
  fi
done <<< "$FILENAMES"

# Cleanup
rm -rf "$TEMP_DIR"

echo ""
echo "✅ Copy complete!"
echo "   Copied: $COPIED"
echo "   Failed: $FAILED"
echo "   Total:  $TOTAL"
