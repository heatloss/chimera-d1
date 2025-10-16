#!/usr/bin/env tsx
/**
 * Link pages to their media (cover and page images)
 * Matches by filename between old and new databases
 */

import 'dotenv/config'
import Database from 'better-sqlite3'

const SOURCE_DB = '/Users/mike/Sites/chimera-cms/chimera-cms.db'
const TARGET_DB = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/71ea17b93de1684d034c11957d24f940ab865936bf90542392bf0517b4af1470.sqlite'

interface OldPage {
  id: string
  title: string
  page_image_id: string | null
  thumbnail_image_id: string | null
}

interface OldMedia {
  id: string
  filename: string
}

async function main() {
  console.log('🔗 Linking pages to media...\n')

  const sourceDb = new Database(SOURCE_DB, { readonly: true })
  const targetDb = new Database(TARGET_DB)

  // Build filename -> new media ID mapping
  const mediaFilenameToId = new Map<string, number>()
  const newMedia = targetDb.prepare('SELECT id, filename FROM media').all() as Array<{ id: number; filename: string }>

  for (const media of newMedia) {
    mediaFilenameToId.set(media.filename, media.id)
  }
  console.log(`Found ${mediaFilenameToId.size} media files in target database\n`)

  // Build old media ID -> filename mapping
  const oldMediaIdToFilename = new Map<string, string>()
  const oldMedia = sourceDb.prepare('SELECT id, filename FROM media').all() as OldMedia[]

  for (const media of oldMedia) {
    oldMediaIdToFilename.set(media.id, media.filename)
  }
  console.log(`Found ${oldMediaIdToFilename.size} media files in source database\n`)

  // Get all pages from source
  const oldPages = sourceDb.prepare('SELECT id, title, page_image_id, thumbnail_image_id FROM pages').all() as OldPage[]
  console.log(`Found ${oldPages.length} pages to update\n`)

  let updated = 0
  let skipped = 0

  const updateStmt = targetDb.prepare(`
    UPDATE pages
    SET page_image_id = ?, thumbnail_image_id = ?
    WHERE title = ?
  `)

  const updateMany = targetDb.transaction((pages: OldPage[]) => {
    for (const page of pages) {
      try {
        // Get filenames from old media IDs
        const pageImageFilename = page.page_image_id ? oldMediaIdToFilename.get(page.page_image_id) : null
        const thumbnailImageFilename = page.thumbnail_image_id ? oldMediaIdToFilename.get(page.thumbnail_image_id) : null

        // Get new media IDs from filenames
        const newPageImageId = pageImageFilename ? mediaFilenameToId.get(pageImageFilename) : null
        const newThumbnailImageId = thumbnailImageFilename ? mediaFilenameToId.get(thumbnailImageFilename) : null

        // Update page
        updateStmt.run(
          newPageImageId || null,
          newThumbnailImageId || null,
          page.title
        )

        if (newPageImageId || newThumbnailImageId) {
          console.log(`✓ ${page.title}`)
          if (newPageImageId) console.log(`  └─ Page image: ${pageImageFilename} (ID ${newPageImageId})`)
          if (newThumbnailImageId) console.log(`  └─ Thumbnail: ${thumbnailImageFilename} (ID ${newThumbnailImageId})`)
          updated++
        } else {
          console.log(`⊘ ${page.title} (no media)`)
          skipped++
        }
      } catch (error) {
        console.error(`✗ Failed to update ${page.title}:`, error instanceof Error ? error.message : error)
      }
    }
  })

  updateMany(oldPages)

  sourceDb.close()
  targetDb.close()

  console.log(`\n✅ Update complete!`)
  console.log(`   Updated:  ${updated}`)
  console.log(`   Skipped:  ${skipped}`)
  console.log(`   Total:    ${oldPages.length}`)
}

main().catch(console.error)
