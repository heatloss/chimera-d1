#!/bin/bash
##
# Upload original media files to LOCAL R2 (miniflare)
# Usage: ./scripts/upload-media-to-local-r2.sh
##

set -e

SOURCE_DIR="/Users/mike/Sites/chimera-cms/media"
DEST_BUCKET="chimera-d1"

echo "📦 Uploading media files to LOCAL R2 bucket (miniflare)"
echo ""

# Read original filenames from database
FILENAMES=$(sqlite3 /Users/mike/Sites/chimera-cms/chimera-cms.db "SELECT filename FROM media WHERE filename IS NOT NULL ORDER BY filename;")

TOTAL=$(echo "$FILENAMES" | wc -l | tr -d ' ')
CURRENT=0
UPLOADED=0
FAILED=0
MISSING=0

echo "Found $TOTAL files to upload"
echo ""

# Upload each file to LOCAL R2 (no --remote flag)
while IFS= read -r filename; do
  CURRENT=$((CURRENT + 1))
  echo "[$CURRENT/$TOTAL] $filename"

  LOCAL_FILE="$SOURCE_DIR/$filename"

  # Check if file exists locally
  if [ ! -f "$LOCAL_FILE" ]; then
    echo "  ⚠ File not found locally"
    MISSING=$((MISSING + 1))
    continue
  fi

  # Upload to LOCAL R2 bucket (no --remote flag = miniflare)
  if pnpm wrangler r2 object put "$DEST_BUCKET/$filename" --file "$LOCAL_FILE" 2>/dev/null; then
    echo "  ✓ Uploaded"
    UPLOADED=$((UPLOADED + 1))
  else
    echo "  ✗ Failed to upload"
    FAILED=$((FAILED + 1))
  fi
done <<< "$FILENAMES"

echo ""
echo "✅ Upload complete!"
echo "   Uploaded: $UPLOADED"
echo "   Missing:  $MISSING"
echo "   Failed:   $FAILED"
echo "   Total:    $TOTAL"
