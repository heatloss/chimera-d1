import { getPlatformProxy } from 'wrangler';

async function main() {
  // Use remote bindings to connect to actual Cloudflare R2
  const { env } = await getPlatformProxy({
    persist: false,
    experimental: { remoteBindings: true }
  });
  const bucket = env.R2;

  console.log('\n=== Listing ALL objects in remote R2 (no prefix filter) ===\n');

  const listed = await bucket.list();
  console.log(`Found ${listed.objects.length} total objects:`);

  for (const obj of listed.objects.slice(0, 30)) {
    console.log(`  - ${obj.key} (${obj.size} bytes)`);
  }

  if (listed.objects.length > 30) {
    console.log(`  ... and ${listed.objects.length - 30} more`);
  }

  if (listed.objects.length === 0) {
    console.log('\n⚠️  Remote R2 bucket is EMPTY!\n');
  }
}

main();
