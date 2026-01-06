/**
 * API route to serve SPA-optimized images with lazy generation
 *
 * Serves WebP images optimized for different device sizes:
 *   GET /api/pub/media/mobile/abc123.webp  → 960px width, q75 (480px @2x)
 *   GET /api/pub/media/desktop/abc123.webp → 1440px width, q80
 *
 * Images are generated on first request and cached in R2 for subsequent requests.
 * Original files are read from R2 media/ prefix.
 * Generated files are stored in R2 pub/media/{size}/ prefix.
 *
 * Note: Thumbnails (400px, 800px) are generated at upload time and served
 * via /api/media/thumbnail/ - no lazy generation needed for those.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

// Check if we're running on Cloudflare Workers (not local dev)
const isWorkersRuntime = typeof (globalThis as any).caches !== 'undefined'
  && typeof (globalThis as any).caches.default !== 'undefined'

// Size configurations for SPA-optimized images
// Note: Thumbnails (400px, 800px) are generated at upload time and served via /api/media/thumbnail/
const SIZE_CONFIGS: Record<string, { width: number; quality: number }> = {
  mobile: { width: 960, quality: 75 },   // 480px @2x, with pinch-zoom headroom
  desktop: { width: 1440, quality: 80 },
}

// CORS headers for cross-origin SPA access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ size: string; filename: string }> }
) {
  try {
    const { size, filename } = await params

    // Validate size parameter
    const sizeConfig = SIZE_CONFIGS[size]
    if (!sizeConfig) {
      return new NextResponse(
        `Invalid size. Valid sizes: ${Object.keys(SIZE_CONFIGS).join(', ')}`,
        { status: 400, headers: corsHeaders }
      )
    }

    // Security: prevent path traversal
    if (filename.includes('..') || filename.includes('/')) {
      return new NextResponse('Invalid filename', {
        status: 400,
        headers: corsHeaders,
      })
    }

    // Get Cloudflare context (R2 bucket and IMAGE_WORKER)
    const { env } = await getCloudflareContext({ async: true })
    const bucket = env?.R2
    const imageWorker = env?.IMAGE_WORKER

    if (!bucket) {
      console.error('R2 bucket not found in cloudflare context')
      return new NextResponse('R2 bucket not configured', {
        status: 500,
        headers: corsHeaders,
      })
    }

    // Determine the cache key for this size/filename combination
    // Output is always WebP, so normalize the filename
    const baseName = filename.replace(/\.[^.]+$/, '') // Remove extension
    const cacheKey = `pub/media/${size}/${baseName}.webp`

    // Check if cached version exists in R2
    const cachedObject = await bucket.get(cacheKey)

    if (cachedObject) {
      // Serve from cache
      return new NextResponse(cachedObject.body, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'image/webp',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-Cache': 'HIT',
        },
      })
    }

    // Cache miss - need to generate the image

    // Find the original file in R2 media/ prefix
    // Try common extensions if the requested filename doesn't have one
    const originalKey = await findOriginalFile(bucket, baseName)

    if (!originalKey) {
      return new NextResponse('Original image not found', {
        status: 404,
        headers: corsHeaders,
      })
    }

    // Fetch the original file from R2
    const originalObject = await bucket.get(originalKey)
    if (!originalObject) {
      return new NextResponse('Original image not found', {
        status: 404,
        headers: corsHeaders,
      })
    }

    console.log(`🖼️ Generating ${size} image for ${baseName} (${sizeConfig.width}px, q${sizeConfig.quality})`)

    // Get the original image data
    const originalBuffer = await originalObject.arrayBuffer()

    let webpBuffer: ArrayBuffer

    if (isWorkersRuntime && imageWorker) {
      // Cloudflare Workers: Use IMAGE_WORKER service binding
      const response = await imageWorker.fetch(
        new Request('https://internal/resize', {
          method: 'POST',
          headers: {
            'X-Width': sizeConfig.width.toString(),
            'X-Height': '0', // Maintain aspect ratio
            'X-Quality': sizeConfig.quality.toString(),
          },
          body: originalBuffer,
        })
      )

      if (!response.ok) {
        const errorData = await response.json() as { error?: string }
        console.error('IMAGE_WORKER error:', errorData.error)
        return new NextResponse('Image processing failed', {
          status: 500,
          headers: corsHeaders,
        })
      }

      webpBuffer = await response.arrayBuffer()
    } else {
      // Local development: Use Sharp
      const sharp = (await import('sharp')).default
      const resizedBuffer = await sharp(Buffer.from(originalBuffer))
        .resize(sizeConfig.width, null, { withoutEnlargement: true })
        .webp({ quality: sizeConfig.quality })
        .toBuffer()
      // Convert Node.js Buffer to ArrayBuffer
      webpBuffer = new Uint8Array(resizedBuffer).buffer
    }

    console.log(`✅ Generated ${size} image: ${webpBuffer.byteLength} bytes`)

    // Store in R2 cache for future requests
    await bucket.put(cacheKey, webpBuffer, {
      httpMetadata: {
        contentType: 'image/webp',
      },
    })

    console.log(`💾 Cached ${size} image at ${cacheKey}`)

    // Return the generated image
    return new NextResponse(webpBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Cache': 'MISS',
      },
    })
  } catch (error) {
    console.error('Error serving pub media:', error)
    return new NextResponse('Internal server error', {
      status: 500,
      headers: corsHeaders,
    })
  }
}

/**
 * Find the original file in R2 by trying common image extensions
 */
async function findOriginalFile(
  bucket: R2Bucket,
  baseName: string
): Promise<string | null> {
  const extensions = ['jpg', 'jpeg', 'png', 'webp', 'gif']

  for (const ext of extensions) {
    const key = `media/${baseName}.${ext}`
    const head = await bucket.head(key)
    if (head) {
      return key
    }
  }

  // Also try the exact baseName in case it already has an extension
  const exactKey = `media/${baseName}`
  const exactHead = await bucket.head(exactKey)
  if (exactHead) {
    return exactKey
  }

  return null
}
