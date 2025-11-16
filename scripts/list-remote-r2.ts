import { getPlatformProxy } from 'wrangler';

async function main() {
  // Use remote bindings to connect to actual Cloudflare R2
  const { env } = await getPlatformProxy({
    persist: false,
    experimental: { remoteBindings: true }
  });
  const bucket = env.R2;

  console.log('\n=== Listing REMOTE R2 objects ===\n');

  const listed = await bucket.list({ prefix: 'media/' });
  console.log(`Found ${listed.objects.length} objects in media/:`);

  for (const obj of listed.objects.slice(0, 20)) {
    console.log(`  - ${obj.key} (${obj.size} bytes)`);
  }

  if (listed.objects.length > 20) {
    console.log(`  ... and ${listed.objects.length - 20} more`);
  }

  // Check for the specific file
  console.log('\n=== Looking for "2025 promo art square.jpg" ===\n');
  const testKeys = [
    'media/2025 promo art square.jpg',
    'media/2025%20promo%20art%20square.jpg',
  ];

  for (const key of testKeys) {
    const obj = await bucket.get(key);
    if (obj) {
      console.log(`✓ Found: ${key}`);
    }
  }
}

main();
