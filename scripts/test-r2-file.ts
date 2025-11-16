import { getPlatformProxy } from 'wrangler';

async function main() {
  const { env } = await getPlatformProxy({ persist: false });
  const bucket = env.R2;

  console.log('\n=== Testing R2 key variations for "2025 promo art square.jpg" ===\n');

  const testKeys = [
    'media/2025 promo art square.jpg',  // with spaces
    'media/2025%20promo%20art%20square.jpg',  // with %20
    '2025 promo art square.jpg',  // without prefix, with spaces
    '2025%20promo%20art%20square.jpg',  // without prefix, with %20
  ];

  for (const key of testKeys) {
    console.log(`Testing key: "${key}"`);
    const obj = await bucket.get(key);
    if (obj) {
      console.log(`  ✓ FOUND! Size: ${obj.size} bytes`);
    } else {
      console.log(`  ✗ Not found`);
    }
  }

  // List all keys to see what actually exists
  console.log('\n=== Listing all media/ keys ===\n');
  const listed = await bucket.list({ prefix: 'media/' });
  console.log(`Found ${listed.objects.length} objects:`);
  for (const obj of listed.objects.slice(0, 10)) {
    console.log(`  - ${obj.key}`);
  }
}

main();
