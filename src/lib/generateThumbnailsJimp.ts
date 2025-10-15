/**
 * Jimp-based thumbnail generation for Cloudflare Workers
 * Pure JavaScript implementation (slower but compatible with Workers runtime)
 */

import { Jimp } from 'jimp'
import type { GeneratedThumbnail, ThumbnailSize } from './thumbnailConfig'
import { THUMBNAIL_SIZES } from './thumbnailConfig'

export async function generateThumbnailsJimp(
  file: Buffer | Uint8Array,
  filename: string,
  mimeType: string,
): Promise<GeneratedThumbnail[]> {
  const thumbnails: GeneratedThumbnail[] = []

  console.log(`📸 [Jimp] Generating ${THUMBNAIL_SIZES.length} thumbnails for ${filename}`)

  try {
    // Load the original image
    const image = await Jimp.read(Buffer.from(file))
    const originalWidth = image.bitmap.width
    const originalHeight = image.bitmap.height

    console.log(`  Original: ${originalWidth}x${originalHeight}`)

    for (const size of THUMBNAIL_SIZES) {
      try {
        // Clone the image for this size
        const clone = image.clone()

        if (size.fit === 'cover' && size.height) {
          // Cover: crop to exact dimensions
          clone.cover(size.width, size.height, Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE)
        } else {
          // Inside: fit within dimensions (maintain aspect ratio)
          const targetHeight = size.height || (originalHeight * size.width) / originalWidth
          clone.scaleToFit(size.width, targetHeight)
        }

        // Get buffer for this size
        const buffer = await clone.getBufferAsync(mimeType)

        // Generate filename for this size
        const ext = filename.split('.').pop() || 'jpg'
        const baseName = filename.replace(`.${ext}`, '')
        const thumbnailFilename = `${baseName}-${size.name}.${ext}`

        thumbnails.push({
          name: size.name,
          width: clone.bitmap.width,
          height: clone.bitmap.height,
          url: `/api/media/file/${thumbnailFilename}`, // Will be updated after R2 upload
          mimeType,
          filesize: buffer.length,
          buffer, // Include buffer for R2 upload
          filename: thumbnailFilename,
        })

        console.log(`  ✓ ${size.name}: ${clone.bitmap.width}x${clone.bitmap.height} (${buffer.length} bytes)`)
      } catch (error) {
        console.error(`  ✗ Failed to generate ${size.name}:`, error)
      }
    }

    console.log(`✅ [Jimp] Generated ${thumbnails.length}/${THUMBNAIL_SIZES.length} thumbnails`)
    return thumbnails
  } catch (error) {
    console.error('❌ [Jimp] Failed to load image:', error)
    return []
  }
}
