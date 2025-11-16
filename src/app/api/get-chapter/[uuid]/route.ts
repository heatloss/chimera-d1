import { getPayload } from 'payload'
import config from '@/payload.config'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Public API route to access chapters by UUID (not internal ID)
 *
 * Usage:
 *   GET /api/get-chapters/a7f3c2e1-4b5d-4c8a-9e2f-1d3b5c7a9f2e
 *
 * This prevents exposing sequential integer IDs to the frontend.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const { uuid } = await params
    const payload = await getPayload({ config })

    // Query by UUID, not by internal ID
    const result = await payload.find({
      collection: 'chapters',
      where: {
        uuid: {
          equals: uuid
        }
      },
      limit: 1
    })

    if (result.docs.length === 0) {
      return NextResponse.json(
        { error: 'Chapter not found' },
        {
          status: 404,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          }
        }
      )
    }

    const chapter = result.docs[0]

    // Return chapter data with UUID, not internal ID
    return NextResponse.json({
      uuid: chapter.uuid,
      title: chapter.title,
      chapterNumber: chapter.chapterNumber,
      slug: chapter.slug,
      description: chapter.description,
      comic: chapter.comic,
      publishedAt: chapter.publishedAt,
      createdAt: chapter.createdAt,
      updatedAt: chapter.updatedAt,
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    })
  } catch (error: any) {
    console.error('Error fetching chapter by UUID:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      }
    )
  }
}

// Handle OPTIONS request for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  })
}
