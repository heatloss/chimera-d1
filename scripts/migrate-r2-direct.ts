/**
 * Migrate R2 files by directly accessing the correct wrangler state
 * The issue is getPlatformProxy connects to the wrong R2 bucket
 */
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

const R2_STATE_DIR = '.wrangler/state/v3/r2';
const BUCKET_DB = `${R2_STATE_DIR}/miniflare-R2BucketObject/dc6d5a2f582aa33d398c91e4975b946933226294340f44f1351419b3d6dfd32c.sqlite`;
const BLOBS_DIR = `${R2_STATE_DIR}/chimera-d1/blobs`;

async function main() {
  console.log('\n=== Migrating R2 files via direct SQLite access ===\n');

  const db = new Database(BUCKET_DB);

  // Find all files at bucket root (not under media/)
  const rootFiles = db.prepare(`
    SELECT key, blob_id, size, etag, uploaded, version
    FROM _mf_objects
    WHERE key NOT LIKE 'media/%'
  `).all();

  console.log(`Found ${rootFiles.length} files at bucket root`);

  if (rootFiles.length === 0) {
    console.log('\n✓ No files to migrate!');
    db.close();
    return;
  }

  console.log('\nFiles to migrate:');
  rootFiles.slice(0, 10).forEach((file: any) => {
    console.log(`  - ${file.key}`);
  });
  if (rootFiles.length > 10) {
    console.log(`  ... and ${rootFiles.length - 10} more`);
  }

  // For each file, create a new record with media/ prefix
  const insertStmt = db.prepare(`
    INSERT INTO _mf_objects (key, blob_id, version, size, etag, uploaded, checksums, http_metadata, custom_metadata)
    SELECT ?, blob_id, version, size, etag, uploaded, checksums, http_metadata, custom_metadata
    FROM _mf_objects
    WHERE key = ?
  `);

  const deleteStmt = db.prepare(`DELETE FROM _mf_objects WHERE key = ?`);

  let migrated = 0;
  let errors = 0;

  db.prepare('BEGIN').run();

  for (const file of rootFiles as any[]) {
    try {
      // Decode URL-encoded key
      const decodedKey = decodeURIComponent(file.key);
      const newKey = `media/${decodedKey}`;

      console.log(`\n  ${file.key}`);
      console.log(`    → ${newKey}`);

      // Insert with new key
      insertStmt.run(newKey, file.key);

      // Delete old key
      deleteStmt.run(file.key);

      console.log(`    ✓ Migrated`);
      migrated++;
    } catch (error) {
      console.error(`    ✗ Error: ${error.message}`);
      errors++;
    }
  }

  db.prepare('COMMIT').run();
  db.close();

  console.log(`\n=== Migration Complete ===`);
  console.log(`  Migrated: ${migrated}`);
  console.log(`  Errors: ${errors}`);
}

main();
