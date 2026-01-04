/**
 * Image Processor Worker
 *
 * Handles image resize and WebP conversion using a hybrid approach:
 * - Photon WASM for fast Lanczos3 resizing
 * - jSquash WebP encoder for quality-controlled compression
 *
 * POST /resize
 *   Headers:
 *     X-Width: target width (required)
 *     X-Height: target height (optional, 0 = maintain aspect ratio)
 *     X-Quality: WebP quality 1-100 (optional, default 75)
 *   Body: image bytes (JPEG or PNG)
 *   Response: WebP bytes
 *
 * GET /health
 *   Response: { ok: true }
 */

import { PhotonImage, resize, SamplingFilter } from '@cf-wasm/photon'
import { encode } from '@jsquash/webp'
import { init as initWebpEncoder } from '@jsquash/webp/encode'
// @ts-ignore - WASM import
import WEBP_ENC_WASM from '@jsquash/webp/codec/enc/webp_enc.wasm'

// Initialize jSquash with explicit WASM module
let webpInitialized = false
async function ensureWebpInit() {
  if (!webpInitialized) {
    await initWebpEncoder(WEBP_ENC_WASM)
    webpInitialized = true
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // Health check endpoint
    if (url.pathname === '/health' || url.pathname === '/') {
      return Response.json({
        ok: true,
        service: 'chimera-image-processor',
        encoder: 'photon+jsquash',
      })
    }

    // Resize endpoint
    if (url.pathname === '/resize' && request.method === 'POST') {
      return handleResize(request)
    }

    return Response.json({ error: 'Not found' }, { status: 404 })
  },
}

async function handleResize(request: Request): Promise<Response> {
  try {
    // Parse options from headers
    const targetWidth = parseInt(request.headers.get('X-Width') || '0', 10)
    const targetHeight = parseInt(request.headers.get('X-Height') || '0', 10)
    const quality = parseInt(request.headers.get('X-Quality') || '75', 10)

    if (!targetWidth || targetWidth <= 0) {
      return Response.json({ error: 'X-Width header required (positive integer)' }, { status: 400 })
    }

    // Clamp quality to valid range
    const clampedQuality = Math.max(1, Math.min(100, quality))

    // Get image data from request body
    const inputBytes = new Uint8Array(await request.arrayBuffer())

    if (inputBytes.length === 0) {
      return Response.json({ error: 'No image data provided' }, { status: 400 })
    }

    console.log(`📸 Processing image: ${inputBytes.length} bytes -> ${targetWidth}x${targetHeight || 'auto'} @ q${clampedQuality}`)

    // Create PhotonImage from input bytes
    const inputImage = PhotonImage.new_from_byteslice(inputBytes)

    const originalWidth = inputImage.get_width()
    const originalHeight = inputImage.get_height()

    // Calculate target dimensions maintaining aspect ratio if height is 0
    let finalWidth = targetWidth
    let finalHeight = targetHeight

    if (finalHeight === 0) {
      const aspectRatio = originalHeight / originalWidth
      finalHeight = Math.round(targetWidth * aspectRatio)
    }

    console.log(`  Original: ${originalWidth}x${originalHeight}`)
    console.log(`  Target: ${finalWidth}x${finalHeight}`)

    // Resize using Lanczos3 for high quality (Photon - fast WASM)
    const outputImage = resize(inputImage, finalWidth, finalHeight, SamplingFilter.Lanczos3)

    // Free input image immediately - no longer needed
    inputImage.free()

    // Extract raw pixels as ImageData
    const imageData = outputImage.get_image_data()

    // Free output image immediately after extracting pixels
    // This keeps memory footprint low during WebP encoding
    outputImage.free()

    // Initialize jSquash WebP encoder with explicit WASM module
    await ensureWebpInit()

    // Encode with jSquash (WebP with quality control)
    const webpBuffer = await encode(imageData, {
      quality: clampedQuality,
      method: 4, // CPU effort (0-6), 4 is a good balance for Workers
    })

    console.log(`  Output: ${webpBuffer.byteLength} bytes (WebP q${clampedQuality})`)

    // Return WebP image
    return new Response(webpBuffer, {
      headers: {
        'Content-Type': 'image/webp',
        'X-Original-Width': originalWidth.toString(),
        'X-Original-Height': originalHeight.toString(),
        'X-Output-Width': finalWidth.toString(),
        'X-Output-Height': finalHeight.toString(),
        'X-Quality': clampedQuality.toString(),
      },
    })
  } catch (error: any) {
    console.error('Image processing error:', error)
    return Response.json(
      { error: error.message || 'Image processing failed' },
      { status: 500 }
    )
  }
}
