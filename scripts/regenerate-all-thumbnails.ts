#!/usr/bin/env tsx
/**
 * Regenerate thumbnails for all existing media items
 * This ensures all media have the new 2-thumbnail structure (thumbnail + thumbnail_large)
 * instead of the old 7-thumbnail structure
 */

import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'

async function main() {
  console.log('🚀 Starting thumbnail regeneration for all media items...\n')

  const payload = await getPayload({ config })

  try {
    // Get all media items
    const { docs: mediaItems } = await payload.find({
      collection: 'media',
      limit: 1000, // Adjust if you have more than 1000 media items
    })

    console.log(`📦 Found ${mediaItems.length} media items\n`)

    let successCount = 0
    let errorCount = 0

    for (const media of mediaItems) {
      try {
        console.log(`\n🔄 Processing media ${media.id}: ${media.filename}`)

        // Get cloudflare context to access R2
        const cloudflare = (globalThis as any).__CLOUDFLARE_CONTEXT__
        const bucket = cloudflare?.env?.R2

        if (!bucket) {
          throw new Error('R2 bucket not found')
        }

        // Fetch original file from R2
        const r2Key = `media/${media.filename}`
        const object = await bucket.get(r2Key)

        if (!object) {
          console.log(`  ⚠️  Original file not found in R2: ${r2Key}`)
          errorCount++
          continue
        }

        // Get file as buffer
        const arrayBuffer = await object.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        console.log(`  📥 Downloaded ${buffer.length} bytes from R2`)

        // Determine if we're in Workers or Node.js runtime
        const isWorkersRuntime = typeof process === 'undefined' ||
          (typeof globalThis !== 'undefined' && 'caches' in globalThis)

        // Generate new thumbnails
        let thumbnails
        if (isWorkersRuntime) {
          console.log('  🌐 Using Jimp (Workers runtime)')
          const { generateThumbnailsJimp } = await import('../src/lib/generateThumbnailsJimp')
          thumbnails = await generateThumbnailsJimp(
            buffer,
            media.filename!,
            media.mimeType!
          )
        } else {
          console.log('  🖥️  Using Sharp (Node.js runtime)')
          const { generateThumbnailsSharp } = await import('../src/lib/generateThumbnailsSharp')
          thumbnails = await generateThumbnailsSharp(
            buffer,
            media.filename!,
            media.mimeType!
          )
        }

        console.log(`  ✅ Generated ${thumbnails.length} thumbnails`)

        // Upload thumbnails to R2
        const { uploadThumbnailsToR2 } = await import('../src/lib/uploadThumbnails')
        thumbnails = await uploadThumbnailsToR2(thumbnails, bucket, 'media')

        console.log(`  📤 Uploaded thumbnails to R2`)

        // Update media item with new imageSizes
        await payload.update({
          collection: 'media',
          id: media.id,
          data: {
            imageSizes: thumbnails,
          },
        })

        console.log(`  💾 Updated database with new thumbnail metadata`)
        successCount++

      } catch (error) {
        console.error(`  ❌ Failed to regenerate thumbnails for media ${media.id}:`, error)
        errorCount++
      }
    }

    console.log('\n\n📊 Summary:')
    console.log(`  ✅ Success: ${successCount}`)
    console.log(`  ❌ Errors: ${errorCount}`)
    console.log(`  📦 Total: ${mediaItems.length}`)

    if (successCount === mediaItems.length) {
      console.log('\n🎉 All thumbnails regenerated successfully!')
    } else {
      console.log('\n⚠️  Some thumbnails failed to regenerate. Check the errors above.')
    }

  } catch (error) {
    console.error('❌ Script failed:', error)
    throw error
  } finally {
    await payload.db.drizzle.$client.close()
  }
}

main()
