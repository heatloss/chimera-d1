#!/usr/bin/env tsx
/**
 * Thumbnail Regeneration Script
 *
 * Regenerates thumbnails for all media items that:
 * 1. Have a valid file uploaded (filename exists)
 * 2. Don't have thumbnails yet (imageSizes is empty/null)
 * 3. Are image files (mimetype starts with 'image/')
 *
 * This script reads the original image from R2, generates thumbnails using Sharp,
 * and uploads them back to R2.
 *
 * Usage:
 *   pnpm tsx scripts/regenerate-thumbnails.ts          # Only regenerate missing thumbnails
 *   pnpm tsx scripts/regenerate-thumbnails.ts --force  # Regenerate ALL thumbnails
 */

import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'

async function main() {
  const forceRegenerate = process.argv.includes('--force')

  console.log('🎨 Starting thumbnail regeneration\n')
  if (forceRegenerate) {
    console.log('⚠️  FORCE MODE: Will regenerate ALL thumbnails\n')
  }

  // Initialize Payload
  console.log('⚙️  Initializing Payload...')
  const payload = await getPayload({ config })

  // Get cloudflare context for R2 access
  const cloudflare = (globalThis as any).__CLOUDFLARE_CONTEXT__
  const bucket = cloudflare?.env?.R2

  if (!bucket) {
    throw new Error('R2 bucket not available. Make sure Cloudflare context is initialized.')
  }

  try {
    // Find media items - either all images or only those without thumbnails
    const whereCondition = forceRegenerate
      ? {
          and: [
            { filename: { exists: true } },
            { mimeType: { like: 'image/%' } },
          ]
        }
      : {
          and: [
            { filename: { exists: true } },
            { mimeType: { like: 'image/%' } },
            {
              or: [
                { imageSizes: { equals: null } },
                { imageSizes: { equals: '[]' } },
                { imageSizes: { equals: 'null' } },
              ]
            }
          ]
        }

    const mediaItems = await payload.find({
      collection: 'media',
      limit: 1000,
      where: whereCondition,
    })

    console.log(`\n📊 Found ${mediaItems.docs.length} media items ${forceRegenerate ? 'to process' : 'needing thumbnails'}\n`)

    if (mediaItems.docs.length === 0) {
      console.log('✅ No media items need thumbnail regeneration')
      return
    }

    let successCount = 0
    let failCount = 0

    for (const media of mediaItems.docs) {
      try {
        console.log(`\n🖼️  Processing: ${media.filename}`)

        // Fetch original file from R2 (files are stored at root, not in media/ subdirectory)
        const r2Key = media.filename
        const object = await bucket.get(r2Key)

        if (!object) {
          console.log(`   ⚠️  File not found in R2: ${r2Key}`)
          failCount++
          continue
        }

        // Get file data as buffer
        const arrayBuffer = await object.arrayBuffer()
        const fileData = Buffer.from(arrayBuffer)

        console.log(`   📥 Downloaded ${(fileData.length / 1024).toFixed(1)} KB from R2`)

        // Generate thumbnails using Sharp (dev mode only - this script runs in Node.js)
        const { generateThumbnailsSharp } = await import('../src/lib/generateThumbnailsSharp')
        let thumbnails = await generateThumbnailsSharp(
          fileData,
          media.filename,
          media.mimeType
        )

        console.log(`   ✓ Generated ${thumbnails.length} thumbnails`)

        // Upload thumbnails to R2
        const { uploadThumbnailsToR2 } = await import('../src/lib/uploadThumbnails')
        thumbnails = await uploadThumbnailsToR2(thumbnails, bucket, 'media')

        console.log(`   ✓ Uploaded ${thumbnails.length} thumbnails to R2`)

        // Update media record with thumbnail metadata
        await payload.update({
          collection: 'media',
          id: media.id,
          data: {
            imageSizes: thumbnails,
          },
        })

        console.log(`   ✅ Updated media record ${media.id}`)
        successCount++

      } catch (error) {
        console.error(`   ❌ Failed to process ${media.filename}:`, error)
        failCount++
      }
    }

    console.log(`\n\n📊 Regeneration Summary:`)
    console.log(`   ✅ Success: ${successCount}`)
    console.log(`   ❌ Failed: ${failCount}`)
    console.log(`   📊 Total: ${mediaItems.docs.length}`)

  } catch (error) {
    console.error('\n❌ Thumbnail regeneration failed:', error)
    throw error
  }
}

// Run regeneration
main().catch(console.error)
