import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Workaround endpoint for fetching chapters by comic ID
 *
 * This bypasses the broken where clause parsing in @payloadcms/next REST_GET handler.
 * Once Payload fixes the bug, this can be removed in favor of:
 * GET /api/chapters?where[comic][equals]={comicId}
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

    const payload = await getPayload({ config })

    const chapters = await payload.find({
      collection: 'chapters',
      where: {
        comic: {
          equals: comicId,
        },
      },
      sort: 'order',
      limit: 100,
    })

    return NextResponse.json(chapters, { headers: corsHeaders })
  } catch (error) {
    console.error('Error fetching chapters:', error)
    return NextResponse.json(
      { error: 'Failed to fetch chapters' },
      { status: 500, headers: corsHeaders }
    )
  }
}
