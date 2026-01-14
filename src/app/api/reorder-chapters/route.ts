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

    // Reordering chapters changes globalPageNumber for all pages
    // Recalculate globalPageNumber for all pages, then update navigation
    await recalculateGlobalPageNumbersAndNavigation(payload, comicId)

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

/**
 * Recalculate globalPageNumber for all pages in a comic after chapter reorder,
 * then update navigation links.
 *
 * This is needed because globalPageNumber depends on chapter order.
 */
async function recalculateGlobalPageNumbersAndNavigation(payload: any, comicId: string | number) {
  const guardedReq = {
    skipNavigationCalculation: true,
    skipGlobalPageCalculation: true,
    skipComicStatsCalculation: true,
    skipChapterStatsCalculation: true,
  } as any

  // Get all chapters in order
  const chaptersResult = await payload.find({
    collection: 'chapters',
    where: { comic: { equals: comicId } },
    sort: 'order',
    limit: 1000,
    depth: 0,
    req: guardedReq,
  })

  // Build a map of chapter order for quick lookup
  const chapterOrderMap = new Map<number, number>()
  chaptersResult.docs.forEach((ch: any, idx: number) => {
    chapterOrderMap.set(ch.id, idx)
  })

  // Get all pages in the comic
  const pagesResult = await payload.find({
    collection: 'pages',
    where: { comic: { equals: comicId } },
    limit: 10000,
    depth: 0,
    req: guardedReq,
  })

  // Sort pages by chapter order, then by chapterPageNumber
  const sortedPages = pagesResult.docs.sort((a: any, b: any) => {
    const aChapterOrder = chapterOrderMap.get(a.chapter) ?? 999999
    const bChapterOrder = chapterOrderMap.get(b.chapter) ?? 999999
    if (aChapterOrder !== bChapterOrder) {
      return aChapterOrder - bChapterOrder
    }
    return (a.chapterPageNumber || 0) - (b.chapterPageNumber || 0)
  })

  // Update globalPageNumber and navigation for each page
  for (let i = 0; i < sortedPages.length; i++) {
    const page = sortedPages[i]
    const globalPageNumber = i + 1
    const prevPage = i > 0 ? sortedPages[i - 1] : null
    const nextPage = i < sortedPages.length - 1 ? sortedPages[i + 1] : null

    await payload.update({
      collection: 'pages',
      id: page.id,
      data: {
        globalPageNumber,
        navigation: {
          previousPage: prevPage?.id || null,
          nextPage: nextPage?.id || null,
          isFirstPage: i === 0,
          isLastPage: i === sortedPages.length - 1,
        },
      },
      req: guardedReq,
    })
  }

  console.log(`🔗 Recalculated globalPageNumber and navigation for ${sortedPages.length} pages in comic ${comicId}`)
}
