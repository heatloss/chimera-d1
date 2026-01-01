import { getPayload } from 'payload'
import config from '@/payload.config'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Utility endpoint to recalculate chapter statistics for all chapters in a comic.
 *
 * Usage:
 *   POST /api/recalculate-chapter-stats
 *   Body: { "comicId": 4 }
 *
 * Or recalculate ALL chapters:
 *   POST /api/recalculate-chapter-stats
 *   Body: { "all": true }
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
        { status: 401, headers: corsHeaders }
      )
    }

    const body = await request.json() as { comicId?: number; all?: boolean }
    const { comicId, all } = body

    let chapters: any[] = []

    if (all) {
      // Get ALL chapters
      const result = await payload.find({
        collection: 'chapters',
        limit: 1000,
      })
      chapters = result.docs
    } else if (comicId) {
      // Get chapters for specific comic
      const result = await payload.find({
        collection: 'chapters',
        where: { comic: { equals: comicId } },
        sort: 'order',
        limit: 100,
      })
      chapters = result.docs
    } else {
      return NextResponse.json(
        { error: 'Either comicId or all:true is required' },
        { status: 400, headers: corsHeaders }
      )
    }

    console.log(`📊 Recalculating stats for ${chapters.length} chapters...`)

    const results: any[] = []

    for (const chapter of chapters) {
      try {
        // Get all pages in this chapter
        const pagesInChapter = await payload.find({
          collection: 'pages',
          where: { chapter: { equals: chapter.id } },
          sort: 'chapterPageNumber',
          limit: 1000,
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

        // Update chapter stats
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
        })

        results.push({
          chapterId: chapter.id,
          title: chapter.title,
          pageCount,
          firstPageNumber,
          lastPageNumber,
          success: true,
        })

        console.log(`✅ Chapter ${chapter.id} "${chapter.title}": ${pageCount} pages (${firstPageNumber || 'n/a'}-${lastPageNumber || 'n/a'})`)
      } catch (error: any) {
        console.error(`❌ Failed to update chapter ${chapter.id}:`, error.message)
        results.push({
          chapterId: chapter.id,
          title: chapter.title,
          success: false,
          error: error.message,
        })
      }
    }

    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    return NextResponse.json({
      success: true,
      message: `Recalculated stats for ${successful} chapters (${failed} failed)`,
      results,
    }, { headers: corsHeaders })

  } catch (error: any) {
    console.error('Error recalculating chapter stats:', error)
    return NextResponse.json(
      { error: 'Failed to recalculate chapter stats', details: error.message },
      { status: 500, headers: corsHeaders }
    )
  }
}
