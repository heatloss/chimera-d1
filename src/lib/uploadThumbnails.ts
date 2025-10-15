/**
 * Upload thumbnail files to R2 storage
 * This function handles uploading generated thumbnail buffers to R2
 */

import type { GeneratedThumbnail } from './thumbnailConfig'
import type { Payload } from 'payload'

interface R2Bucket {
  put(key: string, value: ArrayBuffer | ReadableStream | Uint8Array | Buffer, options?: {
    httpMetadata?: {
      contentType?: string
    }
  }): Promise<any>
}

/**
 * Upload thumbnails to R2 storage
 * @param thumbnails - Array of generated thumbnails with buffers
 * @param bucket - R2 bucket instance
 * @param collectionSlug - Collection slug (e.g., 'media')
 * @returns Updated thumbnails array with R2 URLs
 */
export async function uploadThumbnailsToR2(
  thumbnails: GeneratedThumbnail[],
  bucket: R2Bucket,
  collectionSlug: string = 'media'
): Promise<GeneratedThumbnail[]> {
  const uploadedThumbnails: GeneratedThumbnail[] = []

  console.log(`📤 Uploading ${thumbnails.length} thumbnails to R2...`)

  for (const thumbnail of thumbnails) {
    if (!thumbnail.buffer || !thumbnail.filename) {
      console.warn(`⚠️  Skipping ${thumbnail.name} - missing buffer or filename`)
      uploadedThumbnails.push(thumbnail)
      continue
    }

    try {
      // Upload to R2
      const r2Key = `${collectionSlug}/${thumbnail.filename}`

      // Convert Buffer to Uint8Array for Miniflare compatibility
      // Node.js Buffers don't serialize properly through Wrangler's proxy
      const uint8Array = thumbnail.buffer instanceof Buffer
        ? new Uint8Array(thumbnail.buffer)
        : thumbnail.buffer

      // R2 put API call
      await bucket.put(r2Key, uint8Array, {
        httpMetadata: {
          contentType: thumbnail.mimeType,
        },
      })

      // Update URL to point to actual R2 file
      const updatedThumbnail: GeneratedThumbnail = {
        ...thumbnail,
        url: `/api/media/file/${thumbnail.filename}`,
      }

      // Remove buffer from final metadata (don't store in DB)
      delete updatedThumbnail.buffer

      uploadedThumbnails.push(updatedThumbnail)
      console.log(`  ✓ ${thumbnail.name}`)
    } catch (error) {
      console.error(`  ✗ Failed to upload ${thumbnail.name}:`, error instanceof Error ? error.message : error)
      // Include thumbnail without buffer even if upload fails
      const failedThumbnail = { ...thumbnail }
      delete failedThumbnail.buffer
      uploadedThumbnails.push(failedThumbnail)
    }
  }

  console.log(`✅ Uploaded ${uploadedThumbnails.length} thumbnails to R2`)
  return uploadedThumbnails
}

/**
 * Get R2 bucket from PayloadCMS request
 * Works in both Node.js (dev) and Workers (production)
 */
export function getR2BucketFromRequest(req: any): R2Bucket | null {
  try {
    // The R2 bucket binding is stored in the D1 adapter's binding
    // Since the sqliteD1Adapter receives the D1 binding, we need to get R2 from the same context

    // Path 1: Check if db.binding has an R2 property (unlikely but worth trying)
    if (req.payload?.db?.binding?.R2) {
      console.log('📦 Found R2 bucket via payload.db.binding.R2')
      return req.payload.db.binding.R2
    }

    // Path 2: Try to get from the D1 adapter's client context
    if (req.payload?.db?.client?.R2) {
      console.log('📦 Found R2 bucket via payload.db.client.R2')
      return req.payload.db.client.R2
    }

    // Path 3: Via req.context (Cloudflare Workers runtime)
    if (req.context?.env?.R2) {
      console.log('📦 Found R2 bucket via req.context.env.R2')
      return req.context.env.R2
    }

    // Path 4: Check the drizzle client (D1 adapter uses drizzle)
    if (req.payload?.db?.drizzle?.R2) {
      console.log('📦 Found R2 bucket via payload.db.drizzle.R2')
      return req.payload.db.drizzle.R2
    }

    console.warn('⚠️  Could not find R2 bucket in request context')
    console.warn('Checked paths:')
    console.warn('  - req.payload.db.binding.R2')
    console.warn('  - req.payload.db.client.R2')
    console.warn('  - req.context.env.R2')
    console.warn('  - req.payload.db.drizzle.R2')
    console.warn('')
    console.warn('Available on req.payload.db.binding:', req.payload?.db?.binding ? typeof req.payload.db.binding : 'N/A')
    return null
  } catch (error) {
    console.error('❌ Error getting R2 bucket:', error)
    return null
  }
}
