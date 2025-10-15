/**
 * Image size generation using Sharp (Node.js dev mode only)
 *
 * D1 Optimization: Stores all size metadata in a single JSON field to avoid
 * hitting D1's 100-parameter query limit (would be 42 columns for 7 sizes).
 *
 * NOTE: WASM solution for Workers preview/production is pending.
 * @cf-wasm/photon is incompatible with Next.js webpack bundling.
 */

export interface ImageSizeConfig {
  name: string
  width: number
  height?: number
  fit?: 'inside' | 'cover' | 'contain'
}

export interface GeneratedImageSize {
  url: string
  width: number
  height: number
  mimeType: string
  fileSize: number
  filename: string
}

export const IMAGE_SIZE_CONFIGS: ImageSizeConfig[] = [
  {
    name: 'thumbnail',
    width: 400,
    fit: 'inside',
  },
  {
    name: 'thumbnail_small',
    width: 200,
    fit: 'inside',
  },
  {
    name: 'webcomic_page',
    width: 800,
    fit: 'inside',
  },
  {
    name: 'webcomic_mobile',
    width: 400,
    fit: 'inside',
  },
  {
    name: 'cover_image',
    width: 600,
    height: 800,
    fit: 'cover',
  },
  {
    name: 'social_preview',
    width: 1200,
    height: 630,
    fit: 'cover',
  },
  {
    name: 'avatar',
    width: 200,
    height: 200,
    fit: 'cover',
  },
]

/**
 * Generate image sizes using Sharp (Node.js only)
 */
async function generateImageSizes(
  imageBuffer: Buffer | ArrayBuffer,
  originalFilename: string,
  r2Bucket: R2Bucket,
  mimeType: string = 'image/jpeg'
): Promise<Record<string, GeneratedImageSize>> {
  console.log(`🎨 Generating image sizes for: ${originalFilename}`)
  console.log('  Using Sharp (Node.js)')

  try {
  // Dynamic import to avoid bundling Sharp in Workers
  const sharp = (await import('sharp')).default

  const sizes: Record<string, GeneratedImageSize> = {}
  const buffer = imageBuffer instanceof Buffer
    ? imageBuffer
    : Buffer.from(new Uint8Array(imageBuffer))

  const baseFilename = originalFilename.replace(/\.[^.]+$/, '')
  const ext = mimeType.includes('png') ? 'png' : 'jpg'

  for (const config of IMAGE_SIZE_CONFIGS) {
    try {
      let transformer = sharp(buffer)

      // Apply resize based on config
      if (config.height) {
        // Cover fit: resize and crop
        transformer = transformer.resize(config.width, config.height, {
          fit: config.fit || 'cover',
          position: 'centre',
        })
      } else {
        // Inside fit: maintain aspect ratio
        transformer = transformer.resize(config.width, undefined, {
          fit: 'inside',
          withoutEnlargement: true,
        })
      }

      const resizedBuffer = await transformer.toBuffer()
      const metadata = await sharp(resizedBuffer).metadata()

      const sizeFilename = `${baseFilename}-${config.name}.${ext}`

      // Upload to R2
      console.log(`    📤 Uploading ${sizeFilename}: ${metadata.width}×${metadata.height}`)

      // Wrap Buffer in Blob for local R2 compatibility
      const uploadData = new Blob([new Uint8Array(resizedBuffer)])

      await r2Bucket.put(sizeFilename, uploadData, {
        httpMetadata: {
          contentType: mimeType,
        },
      })

      sizes[config.name] = {
        url: `/api/media/file/${sizeFilename}`,
        width: metadata.width || config.width,
        height: metadata.height || config.height || 0,
        mimeType: mimeType,
        fileSize: resizedBuffer.length,
        filename: sizeFilename,
      }

      console.log(`  ✅ Generated ${config.name}: ${metadata.width}×${metadata.height}`)
    } catch (error: any) {
      console.error(`  ❌ Error generating ${config.name}:`, error.message)
      continue
    }
  }

  return sizes
  } catch (error: any) {
    console.error('❌ Error generating image sizes:', error.message)
    return {}
  }
}

// Export for use in Media collection
export { generateImageSizes }
