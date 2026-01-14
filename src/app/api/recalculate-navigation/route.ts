import { getPayload } from 'payload'
import config from '@/payload.config'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Recalculate navigation for all pages in a comic
 *
 * Usage:
 *   POST /api/recalculate-navigation
 *   Body: { comicId: 123 }
 *
 * This endpoint can be used to backfill navigation for existing pages
 * or fix navigation after manual database changes.
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })

    // Get authenticated user
    const { user } = await payload.auth({ headers: request.headers })

    // Check authentication and permissions (admin/editor only for bulk operations)
    if (!user || !['editor', 'admin'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Editor or admin permissions required' },
        { status: 403, headers: getCorsHeaders() }
      )
    }

    // Parse request body
    const body = await request.json() as { comicId?: string | number }
    const { comicId } = body

    if (!comicId) {
      return NextResponse.json(
        { error: 'Comic ID required' },
        { status: 400, headers: getCorsHeaders() }
      )
    }

    // Verify comic exists
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

    // Recalculate navigation
    const updatedCount = await recalculateComicNavigation(payload, comicId)

    return NextResponse.json({
      message: 'Navigation recalculated successfully',
      updatedPages: updatedCount
    }, {
      headers: getCorsHeaders()
    })

  } catch (error: any) {
    console.error('Error recalculating navigation:', error)
    return NextResponse.json(
      { error: 'Failed to recalculate navigation', details: error.message },
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
 * Returns the number of pages updated
 */
async function recalculateComicNavigation(payload: any, comicId: string | number): Promise<number> {
  const guardedReq = {
    skipNavigationCalculation: true,
    skipGlobalPageCalculation: true,
    skipComicStatsCalculation: true,
    skipChapterStatsCalculation: true,
  } as any

  // Get all pages in the comic sorted by globalPageNumber
  const allPages = await payload.find({
    collection: 'pages',
    where: {
      comic: { equals: comicId },
    },
    sort: 'globalPageNumber',
    limit: 10000,
    depth: 0,
    req: guardedReq,
  })

  const pages = allPages.docs

  if (pages.length === 0) {
    return 0
  }

  // Update each page's navigation based on its position in the sorted array
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
      req: guardedReq,
    })
  }

  console.log(`🔗 Recalculated navigation for ${pages.length} pages in comic ${comicId}`)
  return pages.length
}
