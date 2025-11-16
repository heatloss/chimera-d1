import { getPayload } from 'payload'
import config from '@/payload.config'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Get all chapters for a comic by comic UUID
 *
 * Usage:
 *   GET /api/comic-chapters/cec38490-d12b-4653-9ef4-8b0d3d761a99
 *
 * Returns chapters sorted by order, without page data.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const { uuid } = await params

    if (!uuid) {
      return NextResponse.json(
        { error: 'Comic UUID is required' },
        { status: 400, headers: getCorsHeaders() }
      )
    }

    const payload = await getPayload({ config })

    // First, find the comic by UUID to get its numeric ID
    const comicResult = await payload.find({
      collection: 'comics',
      where: {
        uuid: {
          equals: uuid
        }
      },
      limit: 1,
      depth: 0
    })

    if (comicResult.docs.length === 0) {
      return NextResponse.json(
        { error: 'Comic not found' },
        { status: 404, headers: getCorsHeaders() }
      )
    }

    const comic = comicResult.docs[0]

    // Now fetch all chapters for this comic
    const chapters = await payload.find({
      collection: 'chapters',
      where: {
        comic: { equals: comic.id }
      },
      sort: 'order',
      limit: 1000,
      depth: 1
    })

    return NextResponse.json({
      chapters: chapters.docs,
      totalDocs: chapters.totalDocs
    }, {
      headers: getCorsHeaders()
    })

  } catch (error: any) {
    console.error('Error fetching chapters for comic:', error)
    return NextResponse.json(
      { error: 'Failed to fetch chapters' },
      { status: 500, headers: getCorsHeaders() }
    )
  }
}

// Handle OPTIONS request for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders()
  })
}

function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}
