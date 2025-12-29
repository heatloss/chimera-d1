#!/bin/bash
##
# Export local miniflare R2 objects and upload to remote R2
# Usage: ./scripts/sync-local-r2-to-remote.sh
##

set -e

R2_DB="/Users/mike/Sites/chimera-d1/.wrangler/state/v3/r2/miniflare-R2BucketObject/dc6d5a2f582aa33d398c91e4975b946933226294340f44f1351419b3d6dfd32c.sqlite"
BLOBS_DIR="/Users/mike/Sites/chimera-d1/.wrangler/state/v3/r2/chimera-d1/blobs"
DEST_BUCKET="chimera-d1"
TEMP_DIR="/tmp/r2-export"

# Create temp directory
mkdir -p "$TEMP_DIR"

echo "📦 Syncing local R2 to remote R2 bucket: $DEST_BUCKET"
echo ""

# Get total count
TOTAL=$(sqlite3 "$R2_DB" "SELECT COUNT(*) FROM _mf_objects;")
echo "Found $TOTAL objects to sync"
echo ""

# Export key -> blob_id mappings
CURRENT=0
UPLOADED=0
FAILED=0
SKIPPED=0

# Process each object
sqlite3 "$R2_DB" "SELECT key, blob_id, http_metadata FROM _mf_objects;" | while IFS='|' read -r key blob_id http_metadata; do
  CURRENT=$((CURRENT + 1))

  # Find the blob file (blob_id is the filename in the blobs directory)
  BLOB_FILE="$BLOBS_DIR/$blob_id"

  if [ ! -f "$BLOB_FILE" ]; then
    echo "[$CURRENT/$TOTAL] $key - SKIPPED (blob not found)"
    continue
  fi

  # Extract content type from http_metadata JSON if available
  CONTENT_TYPE=$(echo "$http_metadata" | grep -o '"contentType":"[^"]*"' | cut -d'"' -f4)
  if [ -z "$CONTENT_TYPE" ]; then
    # Guess from extension
    case "${key##*.}" in
      jpg|jpeg) CONTENT_TYPE="image/jpeg" ;;
      png) CONTENT_TYPE="image/png" ;;
      gif) CONTENT_TYPE="image/gif" ;;
      webp) CONTENT_TYPE="image/webp" ;;
      *) CONTENT_TYPE="application/octet-stream" ;;
    esac
  fi

  # Copy blob to temp with correct name (flatten any path)
  FLAT_KEY=$(basename "$key")
  TEMP_FILE="$TEMP_DIR/$FLAT_KEY"
  cp "$BLOB_FILE" "$TEMP_FILE"

  # Upload to remote R2
  # Ensure key has "media/" prefix for the route
  if [[ "$key" == media/* ]]; then
    R2_KEY="$key"
  else
    R2_KEY="media/$key"
  fi

  if pnpm wrangler r2 object put "$DEST_BUCKET/$R2_KEY" --file "$TEMP_FILE" --content-type "$CONTENT_TYPE" --remote 2>/dev/null; then
    echo "[$CURRENT/$TOTAL] $key ✓"
  else
    echo "[$CURRENT/$TOTAL] $key ✗ FAILED"
  fi

  # Clean up temp file
  rm -f "$TEMP_FILE"
done

echo ""
echo "✅ Sync complete!"
