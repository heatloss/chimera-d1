#!/usr/bin/env tsx
/**
 * Import media files from chimera-cms by uploading through Payload
 * This will:
 * - Upload files to R2
 * - Create media records in database
 * - Generate thumbnails automatically
 */

import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

const SOURCE_DB = '/Users/mike/Sites/chimera-cms/chimera-cms.db'
const SOURCE_MEDIA_DIR = '/Users/mike/Sites/chimera-cms/media'

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
  console.log('🖼️  Importing media through Payload...\n')

  // Open source database
  const sourceDb = new Database(SOURCE_DB, { readonly: true })

  // Initialize Payload
  const payload = await getPayload({ config })

  // Get old media records
  const oldMedia = sourceDb.prepare('SELECT * FROM media WHERE filename IS NOT NULL').all() as OldMedia[]
  console.log(`Found ${oldMedia.length} media files to import\n`)

  let imported = 0
  let failed = 0

  for (const media of oldMedia) {
    const filePath = path.join(SOURCE_MEDIA_DIR, media.filename)

    console.log(`[${imported + failed + 1}/${oldMedia.length}] ${media.filename}`)

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log(`  ⚠️  File not found: ${filePath}`)
      failed++
      continue
    }

    try {
      // Read file
      const fileBuffer = fs.readFileSync(filePath)
      const fileStats = fs.statSync(filePath)

      // Determine uploader (default to first user if not found)
      const users = await payload.find({ collection: 'users', limit: 1 })
      const uploaderId = users.docs[0]?.id || 1

      // Upload through Payload (this will upload to R2 and generate thumbnails)
      await payload.create({
        collection: 'media',
        data: {
          alt: media.alt || undefined,
          caption: media.caption || undefined,
          mediaType: media.media_type,
          uploadedBy: uploaderId,
          isPublic: Boolean(media.is_public),
          comicMeta: {
            isNSFW: Boolean(media.comic_meta_is_n_s_f_w),
          },
        },
        file: {
          data: fileBuffer,
          mimetype: `image/${path.extname(media.filename).slice(1)}`,
          name: media.filename,
          size: fileStats.size,
        },
      })

      console.log(`  ✓ Imported`)
      imported++
    } catch (error) {
      console.error(`  ✗ Failed:`, error instanceof Error ? error.message : error)
      failed++
    }
  }

  sourceDb.close()

  console.log(`\n✅ Import complete!`)
  console.log(`   Imported: ${imported}`)
  console.log(`   Failed:   ${failed}`)
  console.log(`   Total:    ${oldMedia.length}`)
}

main().catch(console.error)
