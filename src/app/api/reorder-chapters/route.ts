import { getPayload } from 'payload'
import config from '@/payload.config'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Reorder chapters for a comic
 *
 * Usage:
 *   POST /api/reorder-chapters
 *   Body: { comicId: 123, chapterIds: [1, 2, 3] }
 *
 * Updates the order field for each chapter based on array position (1-indexed)
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
    const body = await request.json() as { comicId?: string | number; chapterIds?: (string | number)[] }
    const { comicId, chapterIds } = body

    if (!comicId || !Array.isArray(chapterIds)) {
      return NextResponse.json(
        { error: 'Comic ID and chapter IDs array required' },
        { status: 400, headers: getCorsHeaders() }
      )
    }

    if (chapterIds.length === 0) {
      return NextResponse.json(
        { error: 'Chapter IDs array cannot be empty' },
        { status: 400, headers: getCorsHeaders() }
      )
    }

    // Get comic to verify it exists and user has access
    const comic = await payload.findByID({
      collection: 'comics',
      id: comicId,
      depth: 0
    })

    if (!comic) {
      return NextResponse.json(
        { error: 'Comic not found' },
        { status: 404, headers: getCorsHeaders() }
      )
    }

    // Verify user has access to this comic (unless admin)
    if (user.role !== 'admin' && user.role !== 'editor') {
      if (comic.author !== user.id) {
        return NextResponse.json(
          { error: 'You do not have permission to reorder chapters for this comic' },
          { status: 403, headers: getCorsHeaders() }
        )
      }
    }

    // Verify all chapters exist and belong to this comic
    const chapters = await payload.find({
      collection: 'chapters',
      where: {
        id: { in: chapterIds },
        comic: { equals: comic.id }
      },
      limit: chapterIds.length,
      depth: 0
    })

    if (chapters.docs.length !== chapterIds.length) {
      return NextResponse.json(
        { error: 'Some chapters not found or do not belong to this comic' },
        { status: 400, headers: getCorsHeaders() }
      )
    }

    // Update order for each chapter (1-indexed)
    const updatePromises = chapterIds.map((chapterId, index) => {
      return payload.update({
        collection: 'chapters',
        id: chapterId,
        data: { order: index + 1 }
      })
    })

    await Promise.all(updatePromises)

    return NextResponse.json({
      message: 'Chapters reordered successfully',
      updatedChapters: chapterIds.length
    }, {
      headers: getCorsHeaders()
    })

  } catch (error: any) {
    console.error('Error reordering chapters:', error)
    return NextResponse.json(
      { error: 'Failed to reorder chapters' },
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
