/**
 * Custom API route to serve main media files from R2
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params

    // Get R2 bucket from Cloudflare context
    const { env } = await getCloudflareContext()
    const bucket = env?.R2

    if (!bucket) {
      console.error('R2 bucket not found in cloudflare context')
      return new NextResponse('R2 bucket not configured', { status: 500 })
    }

    // Fetch file from R2
    const r2Key = `media/${filename}`
    const object = await bucket.get(r2Key)

    if (!object) {
      return new NextResponse('File not found', { status: 404 })
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
    console.error('Error serving file:', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}
