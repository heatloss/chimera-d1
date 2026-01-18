import { getPayload } from 'payload'
import config from '@/payload.config'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Comprehensive recalculation of all page-related data for a comic.
 *
 * Runs three recalculations in the correct dependency order:
 * 1. Global page numbers (based on chapter order + chapterPageNumber)
 * 2. Chapter stats (pageCount, firstPageNumber, lastPageNumber)
 * 3. Navigation (previousPage, nextPage, isFirstPage, isLastPage)
 *
 * Usage:
 *   POST /api/recalculate-comic-pages
 *   Body: { "comicId": 4 }
 *
 * Requires: Editor or Admin authentication
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })

    // Get authenticated user
    const { user } = await payload.auth({ headers: request.headers })

    if (!user || !['admin', 'editor'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Admin or editor role required' },
        { status: 403, headers: corsHeaders }
      )
    }

    const body = await request.json() as { comicId?: number | string }
    const { comicId } = body

    if (!comicId) {
      return NextResponse.json(
        { error: 'comicId is required' },
        { status: 400, headers: corsHeaders }
      )
    }

    // Verify comic exists
    const comic = await payload.findByID({
      collection: 'comics',
      id: comicId,
      depth: 0,
    })

    if (!comic) {
      return NextResponse.json(
        { error: 'Comic not found' },
        { status: 404, headers: corsHeaders }
      )
    }

    console.log(`📊 Starting comprehensive page recalculation for comic ${comicId}: "${comic.title}"`)

    const results = {
      globalPageNumbers: { updated: 0, total: 0 },
      chapterStats: { updated: 0, chapters: [] as any[] },
      navigation: { updated: 0 },
    }

    // Step 1: Recalculate global page numbers
    console.log('Step 1/3: Recalculating global page numbers...')
    const globalResult = await recalculateGlobalPageNumbers(payload, comicId)
    results.globalPageNumbers = globalResult

    // Step 2: Recalculate chapter stats
    console.log('Step 2/3: Recalculating chapter stats...')
    const chapterResult = await recalculateChapterStats(payload, comicId)
    results.chapterStats = chapterResult

    // Step 3: Recalculate navigation
    console.log('Step 3/3: Recalculating navigation...')
    const navResult = await recalculateNavigation(payload, comicId)
    results.navigation = navResult

    console.log(`✅ Comprehensive recalculation complete for comic ${comicId}`)

    return NextResponse.json({
      success: true,
      message: `Recalculated all page data for "${comic.title}"`,
      results,
    }, { headers: corsHeaders })

  } catch (error: any) {
    console.error('Error in comprehensive page recalculation:', error)
    return NextResponse.json(
      { error: 'Failed to recalculate comic pages', details: error.message },
      { status: 500, headers: corsHeaders }
    )
  }
}

/**
 * Recalculate global page numbers for all pages in a comic.
 * Iterates through chapters in order, then pages within each chapter in order.
 */
async function recalculateGlobalPageNumbers(
  payload: any,
  comicId: number | string
): Promise<{ updated: number; total: number }> {
  const guardedReq = {
    skipGlobalPageCalculation: true,
    skipComicStatsCalculation: true,
    skipChapterStatsCalculation: true,
    skipNavigationCalculation: true,
  } as any

  // Get all chapters for this comic, ordered by chapter order
  const chapters = await payload.find({
    collection: 'chapters',
    where: {
      comic: { equals: comicId },
    },
    sort: 'order',
    limit: 100,
    req: guardedReq,
  })

  let globalPageNumber = 1
  let updated = 0
  let total = 0

  // Process each chapter in order
  for (const chapter of chapters.docs) {
    // Get all pages in this chapter, ordered by chapter page number
    const pages = await payload.find({
      collection: 'pages',
      where: {
        chapter: { equals: chapter.id },
      },
      sort: 'chapterPageNumber',
      limit: 1000,
      req: guardedReq,
    })

    // Update global page number for each page
    for (const page of pages.docs) {
      total++
      if (page.globalPageNumber !== globalPageNumber) {
        await payload.update({
          collection: 'pages',
          id: page.id,
          data: {
            globalPageNumber: globalPageNumber,
          },
          req: guardedReq,
        })
        updated++
      }
      globalPageNumber++
    }
  }

  console.log(`  ✓ Global page numbers: ${updated} updated out of ${total} total pages`)
  return { updated, total }
}

/**
 * Recalculate chapter statistics (pageCount, firstPageNumber, lastPageNumber)
 * for all chapters in a comic.
 */
async function recalculateChapterStats(
  payload: any,
  comicId: number | string
): Promise<{ updated: number; chapters: any[] }> {
  const guardedReq = {
    skipGlobalPageCalculation: true,
    skipComicStatsCalculation: true,
    skipChapterStatsCalculation: true,
    skipNavigationCalculation: true,
  } as any

  const chapters = await payload.find({
    collection: 'chapters',
    where: { comic: { equals: comicId } },
    sort: 'order',
    limit: 100,
    req: guardedReq,
  })

  const results: any[] = []
  let updated = 0

  for (const chapter of chapters.docs) {
    // Get all pages in this chapter
    const pagesInChapter = await payload.find({
      collection: 'pages',
      where: { chapter: { equals: chapter.id } },
      sort: 'chapterPageNumber',
      limit: 1000,
      req: guardedReq,
    })

    const pageCount = pagesInChapter.totalDocs
    let firstPageNumber = null
    let lastPageNumber = null

    if (pagesInChapter.docs.length > 0) {
      // Find min and max globalPageNumber
      const sortedByGlobal = pagesInChapter.docs
        .filter((p: any) => p.globalPageNumber !== null && p.globalPageNumber !== undefined)
        .sort((a: any, b: any) => a.globalPageNumber - b.globalPageNumber)

      if (sortedByGlobal.length > 0) {
        firstPageNumber = sortedByGlobal[0].globalPageNumber
        lastPageNumber = sortedByGlobal[sortedByGlobal.length - 1].globalPageNumber
      }
    }

    // Check if update is needed
    const needsUpdate =
      chapter.stats?.pageCount !== pageCount ||
      chapter.stats?.firstPageNumber !== firstPageNumber ||
      chapter.stats?.lastPageNumber !== lastPageNumber

    if (needsUpdate) {
      await payload.update({
        collection: 'chapters',
        id: chapter.id,
        data: {
          stats: {
            pageCount,
            firstPageNumber,
            lastPageNumber,
          },
        },
        req: guardedReq,
      })
      updated++
    }

    results.push({
      chapterId: chapter.id,
      title: chapter.title,
      pageCount,
      firstPageNumber,
      lastPageNumber,
      updated: needsUpdate,
    })
  }

  console.log(`  ✓ Chapter stats: ${updated} chapters updated`)
  return { updated, chapters: results }
}

/**
 * Recalculate navigation (previousPage, nextPage, isFirstPage, isLastPage)
 * for all pages in a comic based on globalPageNumber order.
 */
async function recalculateNavigation(
  payload: any,
  comicId: number | string
): Promise<{ updated: number }> {
  const guardedReq = {
    skipGlobalPageCalculation: true,
    skipComicStatsCalculation: true,
    skipChapterStatsCalculation: true,
    skipNavigationCalculation: true,
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
  let updated = 0

  if (pages.length === 0) {
    return { updated: 0 }
  }

  // Update each page's navigation based on its position in the sorted array
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    const prevPage = i > 0 ? pages[i - 1] : null
    const nextPage = i < pages.length - 1 ? pages[i + 1] : null

    const expectedNav = {
      previousPage: prevPage?.id || null,
      nextPage: nextPage?.id || null,
      isFirstPage: i === 0,
      isLastPage: i === pages.length - 1,
    }

    // Check if update is needed
    const currentNav = page.navigation || {}
    const needsUpdate =
      currentNav.previousPage !== expectedNav.previousPage ||
      currentNav.nextPage !== expectedNav.nextPage ||
      currentNav.isFirstPage !== expectedNav.isFirstPage ||
      currentNav.isLastPage !== expectedNav.isLastPage

    if (needsUpdate) {
      await payload.update({
        collection: 'pages',
        id: page.id,
        data: {
          navigation: expectedNav,
        },
        req: guardedReq,
      })
      updated++
    }
  }

  console.log(`  ✓ Navigation: ${updated} pages updated`)
  return { updated }
}
