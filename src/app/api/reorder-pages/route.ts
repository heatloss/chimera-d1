import { getPayload } from 'payload'
import config from '@/payload.config'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Reorder pages within a chapter
 *
 * Usage:
 *   POST /api/reorder-pages
 *   Body: { chapterId: 123, pageIds: [5, 3, 7, 2] }
 *
 * Updates the chapterPageNumber field for each page based on array position (1-indexed)
 * Also triggers recalculation of globalPageNumber for all affected pages
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })

    // Get authenticated user
    const { user } = await payload.auth({ headers: request.headers })

    // Check authentication and permissions
    if (!user || !['creator', 'editor', 'admin'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Creator, editor, or admin permissions required' },
        { status: 403, headers: getCorsHeaders() }
      )
    }

    // Parse request body
    const body = await request.json() as { chapterId?: string | number; pageIds?: (string | number)[] }
    const { chapterId, pageIds } = body

    if (!chapterId || !Array.isArray(pageIds)) {
      return NextResponse.json(
        { error: 'Chapter ID and page IDs array required' },
        { status: 400, headers: getCorsHeaders() }
      )
    }

    if (pageIds.length === 0) {
      return NextResponse.json(
        { error: 'Page IDs array cannot be empty' },
        { status: 400, headers: getCorsHeaders() }
      )
    }

    // Get chapter to verify it exists
    const chapter = await payload.findByID({
      collection: 'chapters',
      id: chapterId,
      depth: 1 // Get comic relationship
    })

    if (!chapter) {
      return NextResponse.json(
        { error: 'Chapter not found' },
        { status: 404, headers: getCorsHeaders() }
      )
    }

    // Verify user has access to this chapter's comic (unless admin/editor)
    if (user.role !== 'admin' && user.role !== 'editor') {
      const comicAuthorId = typeof chapter.comic === 'object' ? chapter.comic.author : null
      if (comicAuthorId !== user.id) {
        return NextResponse.json(
          { error: 'You do not have permission to reorder pages for this chapter' },
          { status: 403, headers: getCorsHeaders() }
        )
      }
    }

    // Verify all pages exist and belong to this chapter
    const pages = await payload.find({
      collection: 'pages',
      where: {
        id: { in: pageIds },
        chapter: { equals: chapter.id }
      },
      limit: pageIds.length,
      depth: 0
    })

    if (pages.docs.length !== pageIds.length) {
      return NextResponse.json(
        { error: 'Some pages not found or do not belong to this chapter' },
        { status: 400, headers: getCorsHeaders() }
      )
    }

    // Update chapterPageNumber for each page (1-indexed)
    // The beforeChange hook will automatically recalculate globalPageNumber
    const updatePromises = pageIds.map((pageId, index) => {
      return payload.update({
        collection: 'pages',
        id: pageId,
        data: {
          chapterPageNumber: index + 1
        }
      })
    })

    await Promise.all(updatePromises)

    return NextResponse.json({
      message: 'Pages reordered successfully',
      updatedPages: pageIds.length
    }, {
      headers: getCorsHeaders()
    })

  } catch (error: any) {
    console.error('Error reordering pages:', error)
    return NextResponse.json(
      { error: 'Failed to reorder pages', details: error.message },
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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}
