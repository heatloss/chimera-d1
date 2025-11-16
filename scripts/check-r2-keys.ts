import { getPlatformProxy } from 'wrangler';

async function main() {
  const { env } = await getPlatformProxy({ persist: false });
  const bucket = env.R2;

  console.log('Listing R2 objects with "2025" or "promo" in key:');

  const listed = await bucket.list({ prefix: 'media/' });

  for (const obj of listed.objects) {
    if (obj.key.includes('2025') || obj.key.includes('promo')) {
      console.log(`  Key: ${obj.key}`);
      console.log(`  Size: ${obj.size} bytes`);
    }
  }
}

main();
