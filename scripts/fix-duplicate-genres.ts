/**
 * Fix duplicate genres in comics
 *
 * Issue: hasMany select fields accumulate duplicates on each save
 * This script removes duplicates while preserving unique genre values
 */

import { getPayload } from 'payload'
import config from '../src/payload.config.js'

async function fixDuplicateGenres() {
  console.log('🔧 Fixing duplicate genres in comics\n')

  const payload = await getPayload({ config })

  try {
    // Get all comics
    const comics = await payload.find({
      collection: 'comics',
      limit: 1000,
      depth: 0
    })

    console.log(`Found ${comics.docs.length} comics\n`)

    for (const comic of comics.docs) {
      // Get raw genre data from database
      const db = payload.db
      const genresResult = await db.drizzle.run(
        `SELECT value FROM comics_genres WHERE parent_id = ${comic.id}`
      )

      const genres = genresResult.results as Array<{ value: string }>

      if (genres.length === 0) {
        console.log(`  ${comic.title}: No genres`)
        continue
      }

      // Check for duplicates
      const uniqueGenres = [...new Set(genres.map(g => g.value))]
      const duplicateCount = genres.length - uniqueGenres.length

      if (duplicateCount > 0) {
        console.log(`  ${comic.title}: ${genres.length} total, ${uniqueGenres.length} unique (${duplicateCount} duplicates)`)
        console.log(`    Removing duplicates...`)

        // Delete all genres for this comic
        await db.drizzle.run(
          `DELETE FROM comics_genres WHERE parent_id = ${comic.id}`
        )

        // Re-insert only unique values
        for (const genre of uniqueGenres) {
          const order = uniqueGenres.indexOf(genre) + 1
          await db.drizzle.run(
            `INSERT INTO comics_genres (parent_id, value, "order") VALUES (${comic.id}, '${genre}', ${order})`
          )
        }

        console.log(`    ✅ Fixed! Now has ${uniqueGenres.length} unique genres`)
      } else {
        console.log(`  ${comic.title}: ✅ No duplicates (${genres.length} genres)`)
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('✅ Duplicate genre cleanup complete!')
    console.log('='.repeat(60))

    process.exit(0)

  } catch (error) {
    console.error('\n❌ Error fixing duplicates:', error)
    process.exit(1)
  }
}

fixDuplicateGenres()
