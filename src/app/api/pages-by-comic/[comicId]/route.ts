import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Workaround endpoint for fetching pages by comic ID
 *
 * This bypasses the broken where clause parsing in @payloadcms/next REST_GET handler.
 * Once Payload fixes the bug, this can be removed in favor of:
 * GET /api/pages?where[comic][equals]={comicId}
 */

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function GET(
  request: NextRequest,
  { params }: { params: { comicId: string } }
) {
  try {
    const comicId = parseInt(params.comicId, 10)

    if (isNaN(comicId)) {
      return NextResponse.json(
        { error: 'Invalid comic ID' },
        { status: 400, headers: corsHeaders }
      )
    }

    // Get optional query parameters
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100', 10)
    const page = parseInt(searchParams.get('page') || '1', 10)

    const payload = await getPayload({ config })

    const pages = await payload.find({
      collection: 'pages',
      where: {
        comic: {
          equals: comicId,
        },
      },
      sort: 'globalPageNumber',
      limit,
      page,
    })

    return NextResponse.json(pages, { headers: corsHeaders })
  } catch (error) {
    console.error('Error fetching pages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pages' },
      { status: 500, headers: corsHeaders }
    )
  }
}
