import { getPayload } from 'payload'
import config from '@/payload.config'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Get comic with all chapters and pages nested
 *
 * Usage:
 *   GET /api/comic-with-chapters/123
 *
 * This endpoint accepts integer IDs only
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

    // Get authenticated user
    const { user } = await payload.auth({ headers: request.headers })

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers: getCorsHeaders() }
      )
    }

    // Query by integer ID
    const comic = await payload.findByID({
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

    // Verify user has access to this comic (unless admin/editor)
    if (user.role !== 'admin' && user.role !== 'editor') {
      const authorId = typeof comic.author === 'object' ? comic.author?.id : comic.author
      if (authorId !== user.id) {
        return NextResponse.json(
          { error: 'You do not have permission to access this comic' },
          { status: 403, headers: getCorsHeaders() }
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
