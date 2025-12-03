/**
 * Fix duplicate genres using Payload API
 * Simply re-save the comic with deduplicated genres
 */

import { getPayload } from 'payload'
import config from '../src/payload.config.js'

async function fixDuplicates() {
  console.log('🔧 Fixing duplicate genres\n')

  const payload = await getPayload({ config })

  try {
    // Get the problematic comic
    const comic = await payload.findByID({
      collection: 'comics',
      id: 3
    })

    console.log(`Comic: ${comic.title}`)
    console.log(`Current genres (may have duplicates):`, comic.genres)

    // Deduplicate genres
    const uniqueGenres = [...new Set(comic.genres || [])]

    console.log(`\nUnique genres:`, uniqueGenres)
    console.log(`Removed ${(comic.genres?.length || 0) - uniqueGenres.length} duplicates\n`)

    // Update with unique genres only
    await payload.update({
      collection: 'comics',
      id: 3,
      data: {
        genres: uniqueGenres
      }
    })

    console.log('✅ Comic updated successfully!\n')

    // Verify the fix
    const updated = await payload.findByID({
      collection: 'comics',
      id: 3
    })

    console.log(`Verified genres count: ${updated.genres?.length}`)
    console.log(`Genres:`, updated.genres)

    process.exit(0)

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

fixDuplicates()
