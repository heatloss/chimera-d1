/**
 * Image size generation using Jimp (pure JavaScript)
 *
 * This is the pure JavaScript version that works in Cloudflare Workers runtime.
 * For local dev with Node.js, use generateImageSizes.ts with Sharp instead.
 */

import { Jimp } from 'jimp'
import type { ImageSizeConfig, GeneratedImageSize } from './generateImageSizes'
import { IMAGE_SIZE_CONFIGS } from './generateImageSizes'

/**
 * Generate image sizes using Jimp (pure JavaScript)
 */
export async function generateImageSizesJimp(
  imageBuffer: Buffer | ArrayBuffer,
  originalFilename: string,
  r2Bucket: R2Bucket,
  mimeType: string = 'image/jpeg'
): Promise<Record<string, GeneratedImageSize>> {
  console.log(`🎨 Generating image sizes for: ${originalFilename}`)
  console.log('  Using Jimp (pure JavaScript)')

  try {
    const sizes: Record<string, GeneratedImageSize> = {}

    // Read the image with Jimp (supports Buffer and ArrayBuffer)
    const image = await Jimp.read(imageBuffer)
    const originalWidth = image.width
    const originalHeight = image.height

    const baseFilename = originalFilename.replace(/\.[^.]+$/, '')
    const ext = mimeType.includes('png') ? 'png' : 'jpg'

    for (const config of IMAGE_SIZE_CONFIGS) {
      try {
        // Clone the image for each size variant
        const resizedImage = image.clone()
        let targetWidth: number
        let targetHeight: number

        if (config.fit === 'cover' && config.height) {
          // Cover fit: resize to fill dimensions (may crop)
          // Jimp's .cover() handles this automatically
          resizedImage.cover({ w: config.width, h: config.height })
          targetWidth = config.width
          targetHeight = config.height
        } else {
          // Inside fit: maintain aspect ratio, don't enlarge
          const aspectRatio = originalWidth / originalHeight

          if (config.height) {
            // Fixed dimensions with inside fit
            // Jimp's .contain() fits image within dimensions
            resizedImage.contain({ w: config.width, h: config.height })

            // Calculate actual dimensions after contain
            const targetAspect = config.width / config.height
            if (aspectRatio > targetAspect) {
              targetWidth = config.width
              targetHeight = Math.round(config.width / aspectRatio)
            } else {
              targetWidth = Math.round(config.height * aspectRatio)
              targetHeight = config.height
            }
          } else {
            // Width-only constraint - don't enlarge
            targetWidth = Math.min(config.width, originalWidth)
            targetHeight = Math.round(targetWidth / aspectRatio)
            resizedImage.resize({ w: targetWidth })
          }
        }

        const sizeFilename = `${baseFilename}-${config.name}.${ext}`

        // Get buffer with appropriate quality settings
        let outputBuffer: Buffer
        if (mimeType.includes('png')) {
          outputBuffer = await resizedImage.getBuffer('image/png')
        } else {
          // JPEG with quality 85
          outputBuffer = await resizedImage.getBuffer('image/jpeg', { quality: 85 })
        }

        // Upload to R2
        console.log(`    📤 Uploading ${sizeFilename}: ${targetWidth}×${targetHeight}`)

        await r2Bucket.put(sizeFilename, outputBuffer, {
          httpMetadata: {
            contentType: mimeType,
          },
        })

        sizes[config.name] = {
          url: `/api/media/file/${sizeFilename}`,
          width: targetWidth,
          height: targetHeight,
          mimeType: mimeType,
          fileSize: outputBuffer.length,
          filename: sizeFilename,
        }

        console.log(`  ✅ Generated ${config.name}: ${targetWidth}×${targetHeight}`)
      } catch (error: any) {
        console.error(`  ❌ Error generating ${config.name}:`, error.message)
        continue
      }
    }

    return sizes
  } catch (error: any) {
    console.error('❌ Error generating image sizes with Jimp:', error.message)
    return {}
  }
}
