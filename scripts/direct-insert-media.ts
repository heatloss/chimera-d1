#!/usr/bin/env tsx
/**
 * Directly insert media records into database
 * This bypasses Payload's upload mechanism to avoid miniflare bugs
 * Files must already exist in R2
 */

import 'dotenv/config'
import Database from 'better-sqlite3'
import crypto from 'crypto'

const SOURCE_DB = '/Users/mike/Sites/chimera-cms/chimera-cms.db'
const TARGET_DB = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/71ea17b93de1684d034c11957d24f940ab865936bf90542392bf0517b4af1470.sqlite'

interface OldMedia {
  id: string
  filename: string
  alt: string | null
  caption: string | null
  media_type: string
  uploaded_by_id: string
  is_public: number
  comic_meta_related_comic_id: string | null
  comic_meta_is_n_s_f_w: number
}

async function main() {
  console.log('🖼️  Directly inserting media records...\n')

  // Open both databases
  const sourceDb = new Database(SOURCE_DB, { readonly: true })
  const targetDb = new Database(TARGET_DB)

  // Get old media records
  const oldMedia = sourceDb.prepare('SELECT * FROM media WHERE filename IS NOT NULL').all() as OldMedia[]
  console.log(`Found ${oldMedia.length} media files to insert\n`)

  // Get user ID mapping (we need to know which new user IDs to use)
  const users = targetDb.prepare('SELECT id, email FROM users').all() as Array<{ id: number; email: string }>
  console.log(`Found ${users.length} users in target database`)
  const defaultUserId = users[0]?.id || 1

  let inserted = 0
  let failed = 0

  // Start transaction
  const insert = targetDb.prepare(`
    INSERT INTO media (
      uuid,
      filename,
      url,
      mime_type,
      alt,
      caption,
      media_type,
      uploaded_by_id,
      is_public,
      comic_meta_is_n_s_f_w,
      image_sizes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertMany = targetDb.transaction((mediaItems: OldMedia[]) => {
    for (const media of mediaItems) {
      try {
        const uuid = crypto.randomUUID()
        const url = `media/${media.filename}`
        const mimeType = `image/${media.filename.split('.').pop()}`

        insert.run(
          uuid,
          media.filename,
          url,
          mimeType,
          media.alt || null,
          media.caption || null,
          media.media_type,
          defaultUserId,
          media.is_public,
          media.comic_meta_is_n_s_f_w,
          null // image_sizes - no thumbnails yet
        )

        console.log(`✓ Inserted: ${media.filename}`)
        inserted++
      } catch (error) {
        console.error(`✗ Failed to insert ${media.filename}:`, error instanceof Error ? error.message : error)
        failed++
      }
    }
  })

  insertMany(oldMedia)

  sourceDb.close()
  targetDb.close()

  console.log(`\n✅ Insert complete!`)
  console.log(`   Inserted: ${inserted}`)
  console.log(`   Failed:   ${failed}`)
  console.log(`   Total:    ${oldMedia.length}`)
  console.log(`\n⚠️  Note: No thumbnails generated. You may need to regenerate them later.`)
}

main().catch(console.error)
