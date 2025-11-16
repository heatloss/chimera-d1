/**
 * Test R2 file access using the same logic as the r2Storage plugin
 */
import { getPlatformProxy } from 'wrangler';
import * as path from 'path';

async function main() {
  // Use persist: true (default) to match Payload's configuration
  const { env } = await getPlatformProxy();
  const bucket = env.R2;

  console.log('\n=== Testing R2 access with plugin logic ===\n');

  const filename = 'issue-2-page-14.jpg';
  const prefix = 'media';

  // This is exactly what the plugin does (staticHandler.js:7)
  const r2Key = path.posix.join(prefix, filename);

  console.log(`Looking for R2 key: ${r2Key}`);

  const obj = await bucket.get(r2Key);

  if (obj) {
    console.log(`✓ File found!`);
    console.log(`  Size: ${obj.size} bytes`);
    console.log(`  Content-Type: ${obj.httpMetadata?.contentType}`);
  } else {
    console.log(`✗ File NOT found`);

    // Try listing to see what's actually there
    console.log('\n=== Checking what files exist ===\n');
    const listed = await bucket.list({ prefix: 'media/' });
    console.log(`Found ${listed.objects.length} files under media/`);

    // Find files matching our name
    const matches = listed.objects.filter(o =>
      o.key.includes('issue-2-page-14')
    );

    console.log(`\nFiles matching "issue-2-page-14":`);
    matches.forEach(o => console.log(`  - ${o.key}`));
  }
}

main();
