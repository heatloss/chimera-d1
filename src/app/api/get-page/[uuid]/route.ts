import { getPayload } from 'payload'
import config from '@/payload.config'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Public API route to access pages by UUID (not internal ID)
 *
 * Usage:
 *   GET /api/get-pages/a7f3c2e1-4b5d-4c8a-9e2f-1d3b5c7a9f2e
 *
 * This prevents exposing sequential integer IDs to the frontend.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const { uuid } = await params
    const payload = await getPayload({ config })

    // Query by UUID, not by internal ID
    const result = await payload.find({
      collection: 'pages',
      where: {
        uuid: {
          equals: uuid
        }
      },
      limit: 1,
      depth: 2 // Populate relationships (pageImage, thumbnailImage, comic, chapter)
    })

    if (result.docs.length === 0) {
      return NextResponse.json(
        { error: 'Page not found' },
        {
          status: 404,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          }
        }
      )
    }

    const page = result.docs[0]

    // Return page data with UUID, not internal ID
    return NextResponse.json({
      uuid: page.uuid,
      comic: page.comic,
      chapter: page.chapter,
      chapterPageNumber: page.chapterPageNumber,
      globalPageNumber: page.globalPageNumber,
      title: page.title,
      displayTitle: page.displayTitle,
      pageImage: page.pageImage,
      pageExtraImages: page.pageExtraImages,
      thumbnailImage: page.thumbnailImage,
      altText: page.altText,
      authorNotes: page.authorNotes,
      status: page.status,
      publishedDate: page.publishedDate,
      seoMeta: page.seoMeta,
      navigation: page.navigation,
      stats: page.stats,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    })
  } catch (error: any) {
    console.error('Error fetching page by UUID:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      }
    )
  }
}

// Handle OPTIONS request for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  })
}
