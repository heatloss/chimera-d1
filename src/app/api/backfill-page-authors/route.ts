import { getPayload } from 'payload'
import config from '@/payload.config'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Backfill author field on all pages from their comic's author
 *
 * This is a one-time migration endpoint to populate the denormalized author field
 * that was added to fix the "ambiguous column name: id" bug in Drizzle D1 adapter.
 *
 * Usage:
 *   POST /api/backfill-page-authors
 *
 * Requires: Editor or Admin authentication
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })

    // Get authenticated user
    const { user } = await payload.auth({ headers: request.headers })

    // Check authentication and permissions
    if (!user || !['editor', 'admin'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Editor or admin permissions required' },
        { status: 403, headers: { 'Access-Control-Allow-Origin': '*' } }
      )
    }

    console.log('📝 Starting page author backfill...')

    // Get all pages without an author set
    const pagesWithoutAuthor = await payload.find({
      collection: 'pages',
      where: {
        author: { exists: false },
      },
      limit: 10000,
      depth: 0,
    })

    console.log(`Found ${pagesWithoutAuthor.docs.length} pages without author`)

    let updated = 0
    let errors = 0

    // Process each page
    for (const page of pagesWithoutAuthor.docs) {
      try {
        if (!page.comic) {
          console.log(`  ⚠️ Page ${page.id} has no comic, skipping`)
          continue
        }

        const comicId = typeof page.comic === 'object' ? page.comic.id : page.comic

        // Get the comic to find its author
        const comic = await payload.findByID({
          collection: 'comics',
          id: comicId,
          depth: 0,
        })

        if (!comic?.author) {
          console.log(`  ⚠️ Comic ${comicId} has no author, skipping page ${page.id}`)
          continue
        }

        const authorId = typeof comic.author === 'object' ? comic.author.id : comic.author

        // Update the page with the author
        await payload.update({
          collection: 'pages',
          id: page.id,
          data: {
            author: authorId,
          },
          // Skip all the heavy hooks - we just want to set the author field
          req: {
            skipGlobalPageCalculation: true,
            skipNavigationCalculation: true,
            skipComicStatsCalculation: true,
            skipChapterStatsCalculation: true,
          } as any,
        })

        updated++
        if (updated % 50 === 0) {
          console.log(`  ✓ Updated ${updated} pages...`)
        }
      } catch (error: any) {
        console.error(`  ❌ Error updating page ${page.id}:`, error.message)
        errors++
      }
    }

    console.log(`✅ Backfill complete: ${updated} pages updated, ${errors} errors`)

    return NextResponse.json({
      message: 'Page author backfill complete',
      updated,
      errors,
      total: pagesWithoutAuthor.docs.length,
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    })

  } catch (error: any) {
    console.error('Error in page author backfill:', error)
    return NextResponse.json(
      { error: 'Failed to backfill page authors', details: error.message },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  }
}

// Handle OPTIONS request for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
