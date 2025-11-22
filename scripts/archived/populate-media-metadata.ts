#!/usr/bin/env tsx
/**
 * Populate missing media metadata (filesize, width, height)
 * Reads files from local directory and updates database
 */

import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

const SOURCE_MEDIA_DIR = '/Users/mike/Sites/chimera-cms/media'
const TARGET_DB = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/71ea17b93de1684d034c11957d24f940ab865936bf90542392bf0517b4af1470.sqlite'

interface Media {
  id: number
  filename: string
  filesize: number | null
  width: number | null
  height: number | null
}

async function main() {
  console.log('📊 Populating media metadata...\n')

  const db = new Database(TARGET_DB)

  // Get all media records
  const mediaRecords = db.prepare('SELECT id, filename, filesize, width, height FROM media').all() as Media[]
  console.log(`Found ${mediaRecords.length} media records\n`)

  let updated = 0
  let skipped = 0
  let failed = 0

  const updateStmt = db.prepare(`
    UPDATE media
    SET filesize = ?, width = ?, height = ?
    WHERE id = ?
  `)

  const updateMany = db.transaction(async (records: Media[]) => {
    for (const record of records) {
      const filePath = path.join(SOURCE_MEDIA_DIR, record.filename)

      console.log(`[${updated + skipped + failed + 1}/${records.length}] ${record.filename}`)

      if (!fs.existsSync(filePath)) {
        console.log(`  ⚠️  File not found: ${filePath}`)
        failed++
        continue
      }

      try {
        // Get file stats
        const stats = fs.statSync(filePath)

        // Get image dimensions
        const metadata = await sharp(filePath).metadata()

        // Update database
        updateStmt.run(
          stats.size,
          metadata.width || null,
          metadata.height || null,
          record.id
        )

        console.log(`  ✓ ${formatBytes(stats.size)} - ${metadata.width}x${metadata.height}`)
        updated++
      } catch (error) {
        console.error(`  ✗ Failed:`, error instanceof Error ? error.message : error)
        failed++
      }
    }
  })

  await updateMany(mediaRecords)

  db.close()

  console.log(`\n✅ Update complete!`)
  console.log(`   Updated: ${updated}`)
  console.log(`   Skipped: ${skipped}`)
  console.log(`   Failed:  ${failed}`)
  console.log(`   Total:   ${mediaRecords.length}`)
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

main().catch(console.error)
