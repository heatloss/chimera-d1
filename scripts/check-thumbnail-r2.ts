import { getPlatformProxy } from 'wrangler';

async function main() {
  const { env } = await getPlatformProxy({ persist: false });
  const bucket = env.R2;

  console.log('\n=== Checking for thumbnail files in R2 ===\n');

  const testKeys = [
    'media/2025 promo art square-thumbnail.jpg',
    'media/2025 promo art square-webcomic_mobile.jpg',
    'media/2025%20promo%20art%20square-thumbnail.jpg',
  ];

  for (const key of testKeys) {
    console.log(`Testing: ${key}`);
    const obj = await bucket.get(key);
    if (obj) {
      console.log(`  ✓ FOUND! Size: ${obj.size} bytes\n`);
    } else {
      console.log(`  ✗ Not found\n`);
    }
  }
}

main();
