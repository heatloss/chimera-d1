/**
 * Migrate main media files from bucket root to media/ prefix
 * to match Payload's staticDir configuration
 */
import { getPlatformProxy } from 'wrangler';

async function main() {
  const { env } = await getPlatformProxy({ persist: false });
  const bucket = env.R2;

  console.log('\n=== Migrating R2 files to media/ prefix ===\n');

  // List all objects at bucket root (no prefix)
  const listed = await bucket.list();

  console.log(`Found ${listed.objects.length} total objects in bucket`);

  // Filter for objects NOT already under media/ prefix
  // These are the main files that need to be moved
  const rootFiles = listed.objects.filter(obj => !obj.key.startsWith('media/'));

  console.log(`\nFound ${rootFiles.length} files at bucket root that need migration:`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const obj of rootFiles) {
    console.log(`\n  Processing: ${obj.key}`);

    try {
      // Decode URL-encoded filename to get actual filename with spaces
      const decodedKey = decodeURIComponent(obj.key);
      const newKey = `media/${decodedKey}`;

      console.log(`    → Moving to: ${newKey}`);

      // Copy to new location
      const sourceObj = await bucket.get(obj.key);
      if (!sourceObj) {
        console.log(`    ✗ Source file not found, skipping`);
        skipped++;
        continue;
      }

      await bucket.put(newKey, sourceObj.body, {
        httpMetadata: sourceObj.httpMetadata,
        customMetadata: sourceObj.customMetadata,
      });

      // Delete old location
      await bucket.delete(obj.key);

      console.log(`    ✓ Migrated successfully`);
      migrated++;
    } catch (error) {
      console.error(`    ✗ Error: ${error.message}`);
      errors++;
    }
  }

  console.log(`\n=== Migration Complete ===`);
  console.log(`  Migrated: ${migrated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors: ${errors}`);
}

main();
