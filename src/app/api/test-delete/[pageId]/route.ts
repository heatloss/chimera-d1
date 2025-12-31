import { getPayload } from 'payload'
import config from '@/payload.config'
import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

/**
 * Diagnostic endpoint to test D1 delete operations
 *
 * Usage: DELETE /api/test-delete/123
 *
 * Requires authentication (admin, editor, or creator role).
 * This endpoint tests both Payload delete and direct D1 query to diagnose
 * the issue where deletes return success but don't actually delete on remote.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    steps: []
  }

  try {
    const { pageId } = await params
    const pageIdNum = parseInt(pageId, 10)

    if (!pageIdNum || isNaN(pageIdNum)) {
      return NextResponse.json(
        { error: 'Valid page ID required', diagnostics },
        { status: 400 }
      )
    }

    diagnostics.pageId = pageIdNum

    // Step 1: Initialize Payload
    const payload = await getPayload({ config })
    diagnostics.steps.push({ step: 'payload_init', status: 'success' })

    // Step 2: Authenticate user
    const { user } = await payload.auth({ headers: request.headers })
    if (!user || !['admin', 'editor', 'creator'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Authentication required', diagnostics },
        { status: 401 }
      )
    }
    diagnostics.steps.push({ step: 'auth', status: 'success', userId: user.id, role: user.role })

    // Step 3: Check if page exists BEFORE delete
    const beforeCheck = await payload.find({
      collection: 'pages',
      where: { id: { equals: pageIdNum } },
      limit: 1
    })
    diagnostics.steps.push({
      step: 'before_delete_check',
      status: 'success',
      pageExists: beforeCheck.docs.length > 0,
      totalDocs: beforeCheck.totalDocs
    })

    if (beforeCheck.docs.length === 0) {
      return NextResponse.json(
        { error: 'Page not found', diagnostics },
        { status: 404 }
      )
    }

    // Step 4: Get D1 binding directly and check raw SQL
    let d1 = null
    try {
      const cfContext = await getCloudflareContext()
      d1 = cfContext?.env?.D1
      diagnostics.steps.push({ step: 'd1_context_method', method: 'opennext' })
    } catch {
      const cloudflare = (globalThis as any).__CLOUDFLARE_CONTEXT__
      d1 = cloudflare?.env?.D1
      diagnostics.steps.push({ step: 'd1_context_method', method: 'globalthis' })
    }

    if (d1) {
      const rawBefore = await d1.prepare('SELECT id, title FROM pages WHERE id = ?').bind(pageIdNum).first()
      diagnostics.steps.push({
        step: 'raw_d1_before',
        status: 'success',
        rawExists: !!rawBefore,
        rawData: rawBefore
      })
    } else {
      diagnostics.steps.push({
        step: 'raw_d1_before',
        status: 'skipped',
        reason: 'D1 binding not available'
      })
    }

    // Step 5: Delete using Payload API
    let deleteResult
    let deleteError
    try {
      deleteResult = await payload.delete({
        collection: 'pages',
        id: pageIdNum
      })
      diagnostics.steps.push({
        step: 'payload_delete',
        status: 'success',
        result: deleteResult ? { id: deleteResult.id } : null
      })
    } catch (err: any) {
      deleteError = err
      diagnostics.steps.push({
        step: 'payload_delete',
        status: 'error',
        error: err.message,
        stack: err.stack
      })
    }

    // Step 6: Check if page exists AFTER delete using Payload
    const afterCheck = await payload.find({
      collection: 'pages',
      where: { id: { equals: pageIdNum } },
      limit: 1
    })
    diagnostics.steps.push({
      step: 'after_delete_check',
      status: 'success',
      pageExists: afterCheck.docs.length > 0,
      totalDocs: afterCheck.totalDocs
    })

    // Step 7: Check raw D1 AFTER delete
    if (d1) {
      const rawAfter = await d1.prepare('SELECT id, title FROM pages WHERE id = ?').bind(pageIdNum).first()
      diagnostics.steps.push({
        step: 'raw_d1_after',
        status: 'success',
        rawExists: !!rawAfter,
        rawData: rawAfter
      })
    }

    // Step 8: Diagnose the issue
    const payloadSaysDeleted = afterCheck.docs.length === 0
    const d1SaysDeleted = diagnostics.steps.find((s: any) => s.step === 'raw_d1_after')?.rawExists === false

    diagnostics.diagnosis = {
      payloadDeleteReturned: deleteResult ? 'success' : 'error',
      payloadSaysDeleted,
      d1SaysDeleted,
      issue: !payloadSaysDeleted || !d1SaysDeleted ? 'DELETE_NOT_COMMITTED' : 'NONE'
    }

    // If there's an issue, try a direct D1 delete
    if (!d1SaysDeleted && d1) {
      diagnostics.steps.push({ step: 'attempting_direct_d1_delete', status: 'starting' })
      try {
        const directDelete = await d1.prepare('DELETE FROM pages WHERE id = ?').bind(pageIdNum).run()
        diagnostics.steps.push({
          step: 'direct_d1_delete',
          status: 'success',
          result: directDelete
        })

        // Verify direct delete worked
        const verifyAfterDirect = await d1.prepare('SELECT id FROM pages WHERE id = ?').bind(pageIdNum).first()
        diagnostics.steps.push({
          step: 'verify_direct_delete',
          status: 'success',
          stillExists: !!verifyAfterDirect
        })
      } catch (err: any) {
        diagnostics.steps.push({
          step: 'direct_d1_delete',
          status: 'error',
          error: err.message
        })
      }
    }

    return NextResponse.json({
      success: payloadSaysDeleted && d1SaysDeleted,
      message: payloadSaysDeleted && d1SaysDeleted
        ? 'Delete successful'
        : 'Delete may not have committed - see diagnostics',
      diagnostics
    })

  } catch (error: any) {
    diagnostics.steps.push({
      step: 'unhandled_error',
      status: 'error',
      error: error.message,
      stack: error.stack
    })
    return NextResponse.json(
      { error: 'Internal error', diagnostics },
      { status: 500 }
    )
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  })
}
