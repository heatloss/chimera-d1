import { getPayload } from 'payload'
import config from '@/payload.config'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Get comic with all chapters and pages nested
 *
 * Usage:
 *   GET /api/comic-with-chapters/cec38490-d12b-4653-9ef4-8b0d3d761a99
 *
 * This endpoint accepts either numeric ID or UUID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ comicId: string }> }
) {
  try {
    const { comicId } = await params

    if (!comicId) {
      return NextResponse.json(
        { error: 'Comic ID is required' },
        { status: 400, headers: getCorsHeaders() }
      )
    }

    const payload = await getPayload({ config })

    // Determine if comicId is a UUID or numeric ID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(comicId)

    let comic
    if (isUUID) {
      // Query by UUID
      const result = await payload.find({
        collection: 'comics',
        where: {
          uuid: {
            equals: comicId
          }
        },
        limit: 1,
        depth: 1
      })

      if (result.docs.length === 0) {
        return NextResponse.json(
          { error: 'Comic not found' },
          { status: 404, headers: getCorsHeaders() }
        )
      }

      comic = result.docs[0]
    } else {
      // Query by numeric ID
      comic = await payload.findByID({
        collection: 'comics',
        id: comicId,
        depth: 1
      })

      if (!comic) {
        return NextResponse.json(
          { error: 'Comic not found' },
          { status: 404, headers: getCorsHeaders() }
        )
      }
    }

    // Get all chapters for this comic, ordered by chapter order
    const chapters = await payload.find({
      collection: 'chapters',
      where: {
        comic: { equals: comic.id }
      },
      sort: 'order',
      limit: 1000,
      depth: 1
    })

    // For each chapter, get all its pages
    const chaptersWithPages = await Promise.all(
      chapters.docs.map(async (chapter) => {
        const pages = await payload.find({
          collection: 'pages',
          where: {
            chapter: { equals: chapter.id }
          },
          sort: 'chapterPageNumber',
          limit: 1000,
          depth: 1 // Populate page relationships (pageImage, etc)
        })

        return {
          ...chapter,
          pages: pages.docs
        }
      })
    )

    return NextResponse.json({
      ...comic,
      chapters: chaptersWithPages
    }, {
      headers: getCorsHeaders()
    })

  } catch (error: any) {
    console.error('Error fetching comic with chapters:', error)
    return NextResponse.json(
      { error: 'Failed to fetch comic data' },
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
