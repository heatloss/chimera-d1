/**
 * API route to serve published manifest files from R2
 *
 * Serves files from the /pub/ prefix in R2:
 *   GET /api/pub/v1/index.json → R2: pub/v1/index.json
 *   GET /api/pub/v1/comics/my-comic/manifest.json → R2: pub/v1/comics/my-comic/manifest.json
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

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
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params
    const filePath = path.join('/')

    // Security: prevent path traversal
    if (filePath.includes('..') || filePath.startsWith('/')) {
      return new NextResponse('Invalid path', {
        status: 400,
        headers: corsHeaders,
      })
    }

    // Get R2 bucket from Cloudflare context
    const { env } = await getCloudflareContext({ async: true })
    const bucket = env?.R2

    if (!bucket) {
      console.error('R2 bucket not found in cloudflare context')
      return new NextResponse('R2 bucket not configured', {
        status: 500,
        headers: corsHeaders,
      })
    }

    // Fetch file from R2 with pub/ prefix
    const r2Key = `pub/${filePath}`
    const object = await bucket.get(r2Key)

    if (!object) {
      return new NextResponse('Not found', {
        status: 404,
        headers: corsHeaders,
      })
    }

    // Determine content type
    const contentType = object.httpMetadata?.contentType || 'application/json'

    // Return the file with appropriate caching
    // Short cache for manifests (they can change when content is published)
    return new NextResponse(object.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
    })
  } catch (error) {
    console.error('Error serving pub file:', error)
    return new NextResponse('Internal server error', {
      status: 500,
      headers: corsHeaders,
    })
  }
}
