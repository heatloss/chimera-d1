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
          clone.cover({ w: size.width, h: size.height })
        } else {
          // Inside: fit within dimensions (maintain aspect ratio)
          const targetHeight = size.height || (originalHeight * size.width) / originalWidth
          clone.scaleToFit({ w: size.width, h: targetHeight })
        }

        // Get buffer for this size
        // Map mimeType string to Jimp's expected literal type
        const jimpMimeType = mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/bmp' | 'image/tiff'
        const buffer = await clone.getBuffer(jimpMimeType)

        // Generate filename for this size
        const ext = filename.split('.').pop() || 'jpg'
        const baseName = filename.replace(`.${ext}`, '')
        const thumbnailFilename = `${baseName}-${size.name}.${ext}`

        thumbnails.push({
          name: size.name,
          width: clone.bitmap.width,
          height: clone.bitmap.height,
          url: `/api/media/thumbnail/${thumbnailFilename}`, // Served via custom thumbnail route
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
