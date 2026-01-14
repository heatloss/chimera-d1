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
    // Skip navigation calculation during parallel updates to avoid race conditions
    // The beforeChange hook will automatically recalculate globalPageNumber
    console.log(`📝 Reordering ${pageIds.length} pages in chapter ${chapterId}:`, pageIds)

    const updatePromises = pageIds.map((pageId, index) => {
      const newPageNumber = index + 1
      console.log(`  → Page ${pageId} will become chapterPageNumber ${newPageNumber}`)
      return payload.update({
        collection: 'pages',
        id: pageId,
        data: {
          chapterPageNumber: newPageNumber
        },
        req: {
          skipNavigationCalculation: true,
          skipComicStatsCalculation: true,
          skipChapterStatsCalculation: true,
        } as any
      })
    })

    const results = await Promise.all(updatePromises)

    // Log the results to verify updates succeeded
    results.forEach((result, index) => {
      console.log(`  ✓ Page ${result.id} now has chapterPageNumber ${result.chapterPageNumber}`)
    })

    // Now recalculate navigation for all pages in the comic in one pass
    // This ensures correct navigation after all globalPageNumbers are updated
    const comicId = typeof chapter.comic === 'object' ? chapter.comic.id : chapter.comic
    await recalculateComicNavigation(payload, comicId)

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

/**
 * Recalculate navigation for all pages in a comic
 * This does a single pass through all pages sorted by globalPageNumber
 * and sets previousPage/nextPage based on array position
 */
async function recalculateComicNavigation(payload: any, comicId: string | number) {
  // Get all pages in the comic sorted by globalPageNumber
  const allPages = await payload.find({
    collection: 'pages',
    where: {
      comic: { equals: comicId },
    },
    sort: 'globalPageNumber',
    limit: 10000, // Should be enough for any comic
    depth: 0,
    req: {
      skipNavigationCalculation: true,
      skipGlobalPageCalculation: true,
      skipComicStatsCalculation: true,
      skipChapterStatsCalculation: true,
    } as any
  })

  const pages = allPages.docs

  if (pages.length === 0) {
    return
  }

  // Update each page's navigation based on its position in the sorted array
  // Run sequentially to avoid any potential issues, but this is fast since
  // we're just updating navigation fields with guard flags
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    const prevPage = i > 0 ? pages[i - 1] : null
    const nextPage = i < pages.length - 1 ? pages[i + 1] : null

    await payload.update({
      collection: 'pages',
      id: page.id,
      data: {
        navigation: {
          previousPage: prevPage?.id || null,
          nextPage: nextPage?.id || null,
          isFirstPage: i === 0,
          isLastPage: i === pages.length - 1,
        },
      },
      req: {
        skipNavigationCalculation: true, // Prevent hook from running
        skipGlobalPageCalculation: true,
        skipComicStatsCalculation: true,
        skipChapterStatsCalculation: true,
      } as any
    })
  }

  console.log(`🔗 Recalculated navigation for ${pages.length} pages in comic ${comicId}`)
}
