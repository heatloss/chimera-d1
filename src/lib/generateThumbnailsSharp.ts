/**
 * Sharp-based thumbnail generation for Node.js (dev mode)
 * Fast, high-quality image processing using native libvips bindings
 */

import sharp from 'sharp'
import type { GeneratedThumbnail, ThumbnailSize } from './thumbnailConfig'
import { THUMBNAIL_SIZES } from './thumbnailConfig'

export async function generateThumbnailsSharp(
  file: Buffer | Uint8Array,
  filename: string,
  mimeType: string,
): Promise<GeneratedThumbnail[]> {
  const thumbnails: GeneratedThumbnail[] = []

  console.log(`📸 [Sharp] Generating ${THUMBNAIL_SIZES.length} thumbnails for ${filename}`)

  for (const size of THUMBNAIL_SIZES) {
    try {
      const pipeline = sharp(file)

      // Apply resize based on fit strategy
      if (size.fit === 'cover' && size.height) {
        // Crop to exact dimensions
        pipeline.resize(size.width, size.height, {
          fit: 'cover',
          position: size.position || 'centre',
        })
      } else {
        // Fit inside dimensions (maintain aspect ratio)
        pipeline.resize(size.width, size.height, {
          fit: 'inside',
          withoutEnlargement: true,
        })
      }

      // Get metadata and buffer
      const metadata = await pipeline.metadata()
      const buffer = await pipeline.toBuffer()

      // Generate filename for this size
      const ext = filename.split('.').pop() || 'jpg'
      const baseName = filename.replace(`.${ext}`, '')
      const thumbnailFilename = `${baseName}-${size.name}.${ext}`

      thumbnails.push({
        name: size.name,
        width: metadata.width || size.width,
        height: metadata.height || size.height || size.width,
        url: `/api/media/thumbnail/${thumbnailFilename}`, // Served via custom thumbnail route
        mimeType,
        filesize: buffer.length,
        buffer, // Include buffer for R2 upload
        filename: thumbnailFilename,
      })

      console.log(`  ✓ ${size.name}: ${metadata.width}x${metadata.height} (${buffer.length} bytes)`)
    } catch (error) {
      console.error(`  ✗ Failed to generate ${size.name}:`, error)
    }
  }

  console.log(`✅ [Sharp] Generated ${thumbnails.length}/${THUMBNAIL_SIZES.length} thumbnails`)
  return thumbnails
}
