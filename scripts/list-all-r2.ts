import { getPlatformProxy } from 'wrangler';

async function main() {
  const { env } = await getPlatformProxy({ persist: false });
  const bucket = env.R2;

  console.log('\n=== Listing ALL R2 objects ===\n');
  const listed = await bucket.list();
  console.log(`Found ${listed.objects.length} objects total:`);

  for (const obj of listed.objects) {
    console.log(`  - ${obj.key} (${obj.size} bytes)`);
  }

  if (listed.objects.length === 0) {
    console.log('\n⚠️  R2 bucket is EMPTY!\n');
  }
}

main();
