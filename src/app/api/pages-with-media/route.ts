import { getPayload } from 'payload'
import config from '@/payload.config'
import { NextRequest, NextResponse } from 'next/server'

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:8888',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  })
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config })

    // Get authenticated user
    const { user } = await payload.auth({ headers: request.headers })

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers: corsHeaders }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const chapterId = searchParams.get('chapter')
    const comicId = searchParams.get('comic')
    const pageId = searchParams.get('page')
    const limit = parseInt(searchParams.get('limit') || '500', 10)
    const sort = searchParams.get('sort') || 'globalPageNumber'

    // Build where clause based on provided parameters
    const where: any = {}

    if (chapterId) {
      where.chapter = { equals: parseInt(chapterId, 10) }
    }

    if (comicId) {
      where.comic = { equals: parseInt(comicId, 10) }
    }

    if (pageId) {
      where.id = { equals: parseInt(pageId, 10) }
    }

    if (!chapterId && !comicId && !pageId) {
      return NextResponse.json(
        { error: 'At least one filter parameter is required (chapter, comic, or page)' },
        { status: 400, headers: corsHeaders }
      )
    }

    // Fetch pages
    const pagesResult = await payload.find({
      collection: 'pages',
      where,
      limit,
      sort,
    })

    // Manually populate pageImage and thumbnailImage for each page
    const populatedPages = await Promise.all(
      pagesResult.docs.map(async (page: any) => {
        // Populate pageImage
        if (page.pageImage && typeof page.pageImage === 'number') {
          try {
            const media = await payload.findByID({
              collection: 'media',
              id: page.pageImage,
            })
            page.pageImage = media
          } catch (error) {
            console.error(`Failed to populate pageImage ${page.pageImage}:`, error)
          }
        }

        // Populate thumbnailImage
        if (page.thumbnailImage && typeof page.thumbnailImage === 'number') {
          try {
            const media = await payload.findByID({
              collection: 'media',
              id: page.thumbnailImage,
            })
            page.thumbnailImage = media
          } catch (error) {
            console.error(`Failed to populate thumbnailImage ${page.thumbnailImage}:`, error)
          }
        }

        return page
      })
    )

    return NextResponse.json(
      {
        docs: populatedPages,
        totalDocs: pagesResult.totalDocs,
        limit: pagesResult.limit,
        totalPages: pagesResult.totalPages,
        page: pagesResult.page,
        pagingCounter: pagesResult.pagingCounter,
        hasPrevPage: pagesResult.hasPrevPage,
        hasNextPage: pagesResult.hasNextPage,
        prevPage: pagesResult.prevPage,
        nextPage: pagesResult.nextPage,
      },
      { headers: corsHeaders }
    )
  } catch (error: any) {
    console.error('Error fetching pages with media:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch pages',
        details: error.message,
      },
      { status: 500, headers: corsHeaders }
    )
  }
}
