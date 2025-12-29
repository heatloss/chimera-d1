/**
 * Custom API route to serve thumbnail files from R2
 * This bypasses the r2-storage plugin which only serves main upload files
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params

    // Dynamically import config to ensure Cloudflare context is initialized
    await import('@/payload.config')

    // Get R2 bucket from global context (set by payload.config.ts)
    const cloudflare = (globalThis as any).__CLOUDFLARE_CONTEXT__
    const bucket = cloudflare?.env?.R2

    if (!bucket) {
      console.error('R2 bucket not found in cloudflare context')
      return new NextResponse('R2 bucket not configured', { status: 500 })
    }

    // Fetch file from R2
    const r2Key = `media/${filename}`
    const object = await bucket.get(r2Key)

    if (!object) {
      return new NextResponse('Thumbnail not found', { status: 404 })
    }

    // Get content type from R2 metadata
    const contentType = object.httpMetadata?.contentType || 'image/jpeg'

    // Stream the file from R2
    return new NextResponse(object.body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Error serving thumbnail:', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}
