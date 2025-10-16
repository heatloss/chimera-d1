#!/usr/bin/env tsx
/**
 * Batch generate thumbnails for all existing media
 *
 * This script:
 * 1. Reads all media records from the database
 * 2. For each media file, generates 7 thumbnail sizes using Sharp
 * 3. Uploads thumbnails to local R2 (miniflare)
 * 4. Optionally uploads to remote R2 (with --remote flag)
 * 5. Updates database with imageSizes JSON metadata
 *
 * Usage:
 *   pnpm tsx scripts/batch-generate-thumbnails.ts           # Local R2 only
 *   pnpm tsx scripts/batch-generate-thumbnails.ts --remote  # Both local and remote R2
 */

import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { generateThumbnailsSharp } from '../src/lib/generateThumbnailsSharp'
import type { GeneratedThumbnail } from '../src/lib/thumbnailConfig'
import { execa } from 'execa'

const SOURCE_MEDIA_DIR = '/Users/mike/Sites/chimera-cms/media'
const TARGET_DB = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/71ea17b93de1684d034c11957d24f940ab865936bf90542392bf0517b4af1470.sqlite'
const R2_BUCKET = 'chimera-d1'
const UPLOAD_REMOTE = process.argv.includes('--remote')

interface Media {
  id: number
  filename: string
  mime_type: string
  image_sizes: string | null
}

async function uploadThumbnailToR2(
  thumbnailPath: string,
  r2Key: string,
  mimeType: string,
  remote: boolean = false
): Promise<boolean> {
  try {
    const args = ['wrangler', 'r2', 'object', 'put', `${R2_BUCKET}/${r2Key}`, '--file', thumbnailPath]
    if (remote) {
      args.push('--remote')
    }

    await execa('pnpm', args, { stdio: 'pipe' })
    return true
  } catch (error) {
    console.error(`  ✗ Upload failed:`, error instanceof Error ? error.message : error)
    return false
  }
}

async function main() {
  console.log('🎨 Batch generating thumbnails for all media...\n')
  console.log(`📍 Source directory: ${SOURCE_MEDIA_DIR}`)
  console.log(`📦 R2 bucket: ${R2_BUCKET}`)
  console.log(`🌐 Upload to remote R2: ${UPLOAD_REMOTE ? 'YES' : 'NO'}\n`)

  const db = new Database(TARGET_DB)

  // Get all media records that don't have thumbnails yet
  const mediaRecords = db.prepare('SELECT id, filename, mime_type FROM media WHERE filename IS NOT NULL AND (image_sizes IS NULL OR image_sizes = \'\')').all() as Media[]
  console.log(`Found ${mediaRecords.length} media records without thumbnails\n`)

  let processed = 0
  let failed = 0
  let skipped = 0
  let totalThumbnails = 0
  let totalUploaded = 0

  // Create temp directory for thumbnails
  const TEMP_DIR = path.join(process.cwd(), '.temp-thumbnails')
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true })
  }

  const updateStmt = db.prepare(`
    UPDATE media
    SET image_sizes = ?
    WHERE id = ?
  `)

  for (const record of mediaRecords) {
    const index = processed + failed + skipped + 1
    console.log(`[${index}/${mediaRecords.length}] ${record.filename}`)

    const filePath = path.join(SOURCE_MEDIA_DIR, record.filename)

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log(`  ⚠️  File not found: ${filePath}`)
      failed++
      continue
    }

    try {
      // Read file into buffer
      const fileBuffer = fs.readFileSync(filePath)

      // Generate thumbnails
      const thumbnails = await generateThumbnailsSharp(
        fileBuffer,
        record.filename,
        record.mime_type
      )

      if (thumbnails.length === 0) {
        console.log(`  ⚠️  No thumbnails generated`)
        skipped++
        continue
      }

      console.log(`  📸 Generated ${thumbnails.length} thumbnails`)

      // Upload each thumbnail to R2
      const uploadedThumbnails: GeneratedThumbnail[] = []

      for (const thumbnail of thumbnails) {
        if (!thumbnail.buffer || !thumbnail.filename) {
          console.log(`    ⚠️  Skipping ${thumbnail.name} - missing buffer or filename`)
          continue
        }

        // Write thumbnail to temp file
        const tempFilePath = path.join(TEMP_DIR, thumbnail.filename)
        fs.writeFileSync(tempFilePath, thumbnail.buffer)

        // Upload to local R2
        const uploadSuccess = await uploadThumbnailToR2(
          tempFilePath,
          `media/${thumbnail.filename}`,
          thumbnail.mimeType,
          false
        )

        if (!uploadSuccess) {
          console.log(`    ✗ ${thumbnail.name} - local upload failed`)
          // Delete temp file
          fs.unlinkSync(tempFilePath)
          continue
        }

        console.log(`    ✓ ${thumbnail.name} - uploaded to local R2`)
        totalUploaded++

        // Upload to remote R2 if requested
        if (UPLOAD_REMOTE) {
          const remoteSuccess = await uploadThumbnailToR2(
            tempFilePath,
            `media/${thumbnail.filename}`,
            thumbnail.mimeType,
            true
          )

          if (remoteSuccess) {
            console.log(`    ✓ ${thumbnail.name} - uploaded to remote R2`)
            totalUploaded++
          } else {
            console.log(`    ✗ ${thumbnail.name} - remote upload failed`)
          }
        }

        // Remove buffer from metadata (don't store in DB)
        const { buffer, ...thumbnailMeta } = thumbnail
        uploadedThumbnails.push(thumbnailMeta)

        // Delete temp file
        fs.unlinkSync(tempFilePath)
      }

      // Update database with thumbnail metadata
      updateStmt.run(JSON.stringify(uploadedThumbnails), record.id)

      console.log(`  ✅ Processed ${uploadedThumbnails.length} thumbnails`)
      totalThumbnails += uploadedThumbnails.length
      processed++
    } catch (error) {
      console.error(`  ✗ Failed:`, error instanceof Error ? error.message : error)
      failed++
    }
  }

  // Cleanup temp directory
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true })
  }

  db.close()

  console.log(`\n✅ Batch generation complete!`)
  console.log(`   Processed:           ${processed}`)
  console.log(`   Skipped:             ${skipped}`)
  console.log(`   Failed:              ${failed}`)
  console.log(`   Total media:         ${mediaRecords.length}`)
  console.log(`   Total thumbnails:    ${totalThumbnails}`)
  console.log(`   Total uploads:       ${totalUploaded}`)
}

main().catch(console.error)
