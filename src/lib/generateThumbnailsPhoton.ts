/**
 * Photon WASM-based thumbnail generation via service binding
 * Uses the chimera-image-processor worker for fast, native image processing
 * Outputs WebP format for optimal web delivery
 */

import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { GeneratedThumbnail, ThumbnailSize } from './thumbnailConfig'
import { THUMBNAIL_SIZES } from './thumbnailConfig'

export async function generateThumbnailsPhoton(
  file: Buffer | Uint8Array,
  filename: string,
  _mimeType: string, // Original mimeType ignored - we output WebP
): Promise<GeneratedThumbnail[]> {
  const thumbnails: GeneratedThumbnail[] = []

  console.log(`📸 [Photon] Generating ${THUMBNAIL_SIZES.length} thumbnails for ${filename}`)

  try {
    // Get the IMAGE_WORKER service binding
    const { env } = await getCloudflareContext()

    if (!env.IMAGE_WORKER) {
      console.error('❌ [Photon] IMAGE_WORKER service binding not available')
      return []
    }

    // Convert file to ArrayBuffer for fetch body compatibility
    const inputBuffer = file instanceof Buffer
      ? file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength)
      : file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength)

    for (const size of THUMBNAIL_SIZES) {
      try {
        // Call the image worker via service binding
        const response = await env.IMAGE_WORKER.fetch(
          new Request('https://internal/resize', {
            method: 'POST',
            headers: {
              'X-Width': size.width.toString(),
              'X-Height': (size.height || 0).toString(),
              'X-Quality': (size.quality || 75).toString(),
            },
            body: inputBuffer,
          })
        )

        if (!response.ok) {
          const errorData = await response.json() as { error?: string }
          throw new Error(errorData.error || `HTTP ${response.status}`)
        }

        // Get output dimensions from response headers
        const outputWidth = parseInt(response.headers.get('X-Output-Width') || '0', 10)
        const outputHeight = parseInt(response.headers.get('X-Output-Height') || '0', 10)

        // Get WebP bytes
        const webpBuffer = new Uint8Array(await response.arrayBuffer())

        // Generate WebP filename for this size
        const baseName = filename.replace(/\.[^.]+$/, '') // Remove original extension
        const thumbnailFilename = `${baseName}-${size.name}.webp`

        thumbnails.push({
          name: size.name,
          width: outputWidth,
          height: outputHeight,
          url: `/api/media/thumbnail/${thumbnailFilename}`,
          mimeType: 'image/webp',
          filesize: webpBuffer.length,
          buffer: webpBuffer,
          filename: thumbnailFilename,
        })

        console.log(`  ✓ ${size.name}: ${outputWidth}x${outputHeight} (${webpBuffer.length} bytes, WebP q${size.quality || 75})`)
      } catch (error) {
        console.error(`  ✗ Failed to generate ${size.name}:`, error)
      }
    }

    console.log(`✅ [Photon] Generated ${thumbnails.length}/${THUMBNAIL_SIZES.length} thumbnails`)
    return thumbnails
  } catch (error) {
    console.error('❌ [Photon] Failed to process image:', error)
    return []
  }
}
