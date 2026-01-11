import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

/**
 * Pure D1 diagnostic endpoint - bypasses Payload entirely
 * Tests D1 binding and CRUD operations directly
 *
 * GET /api/d1-diagnostic - List pages with count
 * POST /api/d1-diagnostic - Create a test page
 * DELETE /api/d1-diagnostic?id=123 - Delete a page by ID
 */
export async function GET(request: NextRequest) {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    steps: []
  }

  try {
    // Get D1 bindings from BOTH methods to compare
    let d1OpenNext = null
    let d1GlobalThis = null

    // Method 1: OpenNext getCloudflareContext (request-scoped)
    try {
      const cfContext = await getCloudflareContext()
      d1OpenNext = cfContext?.env?.D1
      diagnostics.steps.push({
        step: 'opennext_context',
        status: d1OpenNext ? 'success' : 'no_d1',
        hasContext: !!cfContext,
        hasEnv: !!cfContext?.env,
        envKeys: cfContext?.env ? Object.keys(cfContext.env) : []
      })
    } catch (e: any) {
      diagnostics.steps.push({
        step: 'opennext_context',
        status: 'error',
        error: e.message
      })
    }

    // Method 2: globalThis (module-level, used by Payload)
    const cloudflare = (globalThis as any).__CLOUDFLARE_CONTEXT__
    d1GlobalThis = cloudflare?.env?.D1
    diagnostics.steps.push({
      step: 'globalthis_context',
      status: d1GlobalThis ? 'success' : 'no_d1',
      hasContext: !!cloudflare,
      hasEnv: !!cloudflare?.env
    })

    // Compare bindings
    const d1 = d1OpenNext || d1GlobalThis
    diagnostics.steps.push({
      step: 'binding_comparison',
      openNextHasD1: !!d1OpenNext,
      globalThisHasD1: !!d1GlobalThis,
      sameBinding: d1OpenNext === d1GlobalThis,
      // Check if both can execute a query
    })

    if (!d1) {
      return NextResponse.json({
        error: 'D1 binding not available',
        diagnostics
      }, { status: 500 })
    }
    diagnostics.steps.push({ step: 'd1_binding', status: 'success' })

    // Count pages
    const countResult = await d1.prepare('SELECT COUNT(*) as count FROM pages').first()
    diagnostics.steps.push({
      step: 'count_pages',
      status: 'success',
      count: countResult?.count
    })

    // List last 5 pages
    const pagesResult = await d1.prepare('SELECT id, title FROM pages ORDER BY id DESC LIMIT 5').all()
    diagnostics.steps.push({
      step: 'list_pages',
      status: 'success',
      pages: pagesResult?.results
    })

    // Check for duplicate genres/tags in comics_rels
    const comicsRelsResult = await d1.prepare(`
      SELECT
        parent_id,
        path,
        genres_id,
        tags_id,
        COUNT(*) as count
      FROM comics_rels
      GROUP BY parent_id, path, genres_id, tags_id
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 20
    `).all()
    diagnostics.steps.push({
      step: 'duplicate_rels_check',
      status: 'success',
      duplicates: comicsRelsResult?.results
    })

    // Get raw comics_rels for comic 1 (or first comic with data)
    const rawRelsResult = await d1.prepare(`
      SELECT id, "order", parent_id, path, genres_id, tags_id
      FROM comics_rels
      WHERE parent_id = 1
      ORDER BY path, "order"
    `).all()
    diagnostics.steps.push({
      step: 'raw_rels_comic_1',
      status: 'success',
      relationships: rawRelsResult?.results
    })

    // Check page slugs - look for integer-only slugs
    const pageSlugsResult = await d1.prepare(`
      SELECT id, slug, title, chapter_page_number
      FROM pages
      WHERE slug GLOB '[0-9]' OR slug GLOB '[0-9][0-9]' OR slug GLOB '[0-9][0-9][0-9]'
      LIMIT 20
    `).all()
    diagnostics.steps.push({
      step: 'integer_only_slugs',
      status: 'success',
      count: pageSlugsResult?.results?.length || 0,
      samples: pageSlugsResult?.results
    })

    return NextResponse.json({
      success: true,
      totalPages: countResult?.count,
      recentPages: pagesResult?.results,
      duplicateRelationships: comicsRelsResult?.results,
      comic1Relationships: rawRelsResult?.results,
      integerOnlySlugs: pageSlugsResult?.results,
      diagnostics
    })

  } catch (error: any) {
    diagnostics.steps.push({
      step: 'error',
      status: 'error',
      error: error.message,
      stack: error.stack
    })
    return NextResponse.json({
      error: 'D1 diagnostic failed',
      diagnostics
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    steps: []
  }

  try {
    // Get D1 binding
    let d1 = null
    try {
      const cfContext = await getCloudflareContext()
      d1 = cfContext?.env?.D1
    } catch {
      const cloudflare = (globalThis as any).__CLOUDFLARE_CONTEXT__
      d1 = cloudflare?.env?.D1
    }

    if (!d1) {
      return NextResponse.json({
        error: 'D1 binding not available',
        diagnostics
      }, { status: 500 })
    }

    // Create a test page
    const now = new Date().toISOString()
    const result = await d1.prepare(`
      INSERT INTO pages (comic, chapter, chapter_page_number, global_page_number, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      4, // comic ID - assuming comic 4 exists
      10, // chapter ID - assuming chapter 10 exists
      999, // chapter_page_number - high number to avoid conflicts
      999, // global_page_number
      'draft',
      now,
      now
    ).run()

    diagnostics.steps.push({
      step: 'insert',
      status: 'success',
      result: {
        success: result.success,
        lastRowId: result.meta?.last_row_id,
        changes: result.meta?.changes
      }
    })

    // Verify the insert
    const verifyResult = await d1.prepare('SELECT id, status FROM pages WHERE id = ?')
      .bind(result.meta?.last_row_id)
      .first()

    diagnostics.steps.push({
      step: 'verify_insert',
      status: 'success',
      exists: !!verifyResult,
      data: verifyResult
    })

    return NextResponse.json({
      success: true,
      insertedId: result.meta?.last_row_id,
      verified: !!verifyResult,
      diagnostics
    })

  } catch (error: any) {
    diagnostics.steps.push({
      step: 'error',
      status: 'error',
      error: error.message
    })
    return NextResponse.json({
      error: 'D1 insert failed',
      diagnostics
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    steps: []
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({
        error: 'id query parameter required',
        diagnostics
      }, { status: 400 })
    }

    const pageId = parseInt(id, 10)
    diagnostics.pageId = pageId

    // Get D1 binding
    let d1 = null
    try {
      const cfContext = await getCloudflareContext()
      d1 = cfContext?.env?.D1
      diagnostics.steps.push({ step: 'opennext_context', status: d1 ? 'success' : 'no_d1' })
    } catch {
      const cloudflare = (globalThis as any).__CLOUDFLARE_CONTEXT__
      d1 = cloudflare?.env?.D1
      diagnostics.steps.push({ step: 'globalthis_context', status: d1 ? 'success' : 'no_d1' })
    }

    if (!d1) {
      return NextResponse.json({
        error: 'D1 binding not available',
        diagnostics
      }, { status: 500 })
    }
    diagnostics.steps.push({ step: 'd1_binding', status: 'success' })

    // Check if page exists BEFORE delete
    const beforeCheck = await d1.prepare('SELECT id, title FROM pages WHERE id = ?')
      .bind(pageId)
      .first()

    diagnostics.steps.push({
      step: 'before_delete_check',
      status: 'success',
      exists: !!beforeCheck,
      data: beforeCheck
    })

    if (!beforeCheck) {
      return NextResponse.json({
        success: false,
        error: 'Page not found',
        diagnostics
      }, { status: 404 })
    }

    // Delete the page
    const deleteResult = await d1.prepare('DELETE FROM pages WHERE id = ?')
      .bind(pageId)
      .run()

    diagnostics.steps.push({
      step: 'delete',
      status: 'success',
      result: {
        success: deleteResult.success,
        changes: deleteResult.meta?.changes,
        rowsWritten: deleteResult.meta?.rows_written,
        rowsRead: deleteResult.meta?.rows_read,
        changedDb: deleteResult.meta?.changed_db
      }
    })

    // Wait a tiny bit to ensure write is committed
    await new Promise(resolve => setTimeout(resolve, 100))

    // Check if page exists AFTER delete
    const afterCheck = await d1.prepare('SELECT id, title FROM pages WHERE id = ?')
      .bind(pageId)
      .first()

    diagnostics.steps.push({
      step: 'after_delete_check',
      status: 'success',
      exists: !!afterCheck,
      data: afterCheck
    })

    const actuallyDeleted = !afterCheck

    return NextResponse.json({
      success: actuallyDeleted,
      message: actuallyDeleted
        ? 'Page successfully deleted'
        : 'WARNING: Page still exists after delete!',
      diagnostics
    })

  } catch (error: any) {
    diagnostics.steps.push({
      step: 'error',
      status: 'error',
      error: error.message,
      stack: error.stack
    })
    return NextResponse.json({
      error: 'D1 delete failed',
      diagnostics
    }, { status: 500 })
  }
}

/**
 * PUT /api/d1-diagnostic - Clean up duplicate relationships in comics_rels
 *
 * This is a one-time cleanup for the D1 adapter bug where hasMany relationships
 * accumulate duplicates on each save.
 */
export async function PUT(request: NextRequest) {
  const results: any = {
    timestamp: new Date().toISOString(),
    cleaned: [],
    errors: []
  }

  try {
    // Get D1 binding
    let d1 = null
    try {
      const cfContext = await getCloudflareContext()
      d1 = cfContext?.env?.D1
    } catch {
      const cloudflare = (globalThis as any).__CLOUDFLARE_CONTEXT__
      d1 = cloudflare?.env?.D1
    }

    if (!d1) {
      return NextResponse.json({
        error: 'D1 binding not available'
      }, { status: 500, headers: corsHeaders })
    }

    // Find all comics with duplicate relationships
    const duplicatesResult = await d1.prepare(`
      SELECT DISTINCT parent_id
      FROM comics_rels
      GROUP BY parent_id, path, genres_id, tags_id
      HAVING COUNT(*) > 1
    `).all()

    const affectedComicIds = [...new Set((duplicatesResult.results || []).map((r: any) => r.parent_id))]
    results.affectedComics = affectedComicIds.length

    // Clean up each affected comic
    for (const comicId of affectedComicIds) {
      try {
        // Count before
        const beforeCount = await d1.prepare(`
          SELECT COUNT(*) as count FROM comics_rels WHERE parent_id = ?
        `).bind(comicId).first()

        // Delete duplicate genre relationships, keeping only the row with lowest id
        await d1.prepare(`
          DELETE FROM comics_rels
          WHERE id NOT IN (
            SELECT MIN(id)
            FROM comics_rels
            WHERE parent_id = ? AND path = 'genres' AND genres_id IS NOT NULL
            GROUP BY parent_id, path, genres_id
          )
          AND parent_id = ?
          AND path = 'genres'
        `).bind(comicId, comicId).run()

        // Delete duplicate tag relationships
        await d1.prepare(`
          DELETE FROM comics_rels
          WHERE id NOT IN (
            SELECT MIN(id)
            FROM comics_rels
            WHERE parent_id = ? AND path = 'tags' AND tags_id IS NOT NULL
            GROUP BY parent_id, path, tags_id
          )
          AND parent_id = ?
          AND path = 'tags'
        `).bind(comicId, comicId).run()

        // Re-sequence genre order values
        const genreRows = await d1.prepare(`
          SELECT id FROM comics_rels
          WHERE parent_id = ? AND path = 'genres'
          ORDER BY id
        `).bind(comicId).all()

        for (let i = 0; i < (genreRows.results?.length || 0); i++) {
          await d1.prepare(`
            UPDATE comics_rels SET "order" = ? WHERE id = ?
          `).bind(i + 1, genreRows.results![i].id).run()
        }

        // Re-sequence tag order values
        const tagRows = await d1.prepare(`
          SELECT id FROM comics_rels
          WHERE parent_id = ? AND path = 'tags'
          ORDER BY id
        `).bind(comicId).all()

        for (let i = 0; i < (tagRows.results?.length || 0); i++) {
          await d1.prepare(`
            UPDATE comics_rels SET "order" = ? WHERE id = ?
          `).bind(i + 1, tagRows.results![i].id).run()
        }

        // Count after
        const afterCount = await d1.prepare(`
          SELECT COUNT(*) as count FROM comics_rels WHERE parent_id = ?
        `).bind(comicId).first()

        results.cleaned.push({
          comicId,
          before: beforeCount?.count,
          after: afterCount?.count,
          removed: (beforeCount?.count || 0) - (afterCount?.count || 0)
        })

      } catch (error: any) {
        results.errors.push({
          comicId,
          error: error.message
        })
      }
    }

    const totalRemoved = results.cleaned.reduce((sum: number, c: any) => sum + c.removed, 0)

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${totalRemoved} duplicate relationships from ${affectedComicIds.length} comics`,
      totalRemoved,
      ...results
    }, { headers: corsHeaders })

  } catch (error: any) {
    return NextResponse.json({
      error: 'Cleanup failed',
      details: error.message,
      ...results
    }, { status: 500, headers: corsHeaders })
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders
  })
}
