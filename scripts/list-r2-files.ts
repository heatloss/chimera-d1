import { getCloudflareContext } from '@opennextjs/cloudflare'

async function listR2Files() {
  const cloudflare = await getCloudflareContext({ async: true })
  const bucket = cloudflare.env.R2

  if (!bucket) {
    console.error('R2 bucket not found')
    return
  }

  console.log('Listing files in R2 bucket...\n')

  // List objects with prefix 'media/'
  const listed = await bucket.list({ prefix: 'media/', limit: 20 })

  console.log(`Found ${listed.objects.length} objects:\n`)

  for (const object of listed.objects) {
    console.log(`- ${object.key} (${object.size} bytes)`)
  }

  if (listed.truncated) {
    console.log('\n... (more files available)')
  }
}

listR2Files().catch(console.error)
