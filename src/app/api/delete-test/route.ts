import { getPayload } from 'payload'
import config from '@/payload.config'
import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

/**
 * Bug reproduction endpoint for Payload D1 DELETE issue
 *
 * This endpoint demonstrates that DELETE operations via Payload return success
 * but do not actually delete records from D1 when deployed to Cloudflare Workers.
 *
 * GET /api/delete-test - Runs the full test cycle
 */
export async function GET(request: NextRequest) {
  const results: any = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    steps: [],
    conclusion: null
  }

  try {
    // Step 1: Initialize Payload
    const payload = await getPayload({ config })
    results.steps.push({ step: 'payload_init', status: 'success' })

    // Step 2: Get D1 binding directly for verification
    const cfContext = await getCloudflareContext()
    const d1 = cfContext?.env?.D1

    if (!d1) {
      results.steps.push({ step: 'd1_binding', status: 'error', error: 'D1 not available' })
      return NextResponse.json(results, { status: 500 })
    }
    results.steps.push({ step: 'd1_binding', status: 'success' })

    // Step 3: Create a test genre (simple collection with no relations)
    const testName = `test-delete-${Date.now()}`
    const created = await payload.create({
      collection: 'genres',
      data: {
        name: testName,
        slug: testName
      },
      overrideAccess: true
    })
    results.steps.push({
      step: 'create_record',
      status: 'success',
      id: created.id,
      name: created.name
    })

    // Step 4: Verify record exists via direct D1 query
    const beforeDelete = await d1.prepare('SELECT id, name FROM genres WHERE id = ?')
      .bind(created.id)
      .first()
    results.steps.push({
      step: 'verify_created',
      status: 'success',
      existsInD1: !!beforeDelete,
      record: beforeDelete
    })

    // Step 5: Delete via Payload API
    const deleted = await payload.delete({
      collection: 'genres',
      id: created.id,
      overrideAccess: true
    })
    results.steps.push({
      step: 'payload_delete',
      status: 'success',
      returnedId: deleted?.id,
      payloadSaysDeleted: true
    })

    // Step 6: Check via Payload if it's gone
    const payloadCheck = await payload.find({
      collection: 'genres',
      where: { id: { equals: created.id } },
      overrideAccess: true
    })
    results.steps.push({
      step: 'payload_verify',
      status: 'success',
      payloadFindsRecord: payloadCheck.docs.length > 0
    })

    // Step 7: Check via direct D1 query if it's actually gone
    const afterDelete = await d1.prepare('SELECT id, name FROM genres WHERE id = ?')
      .bind(created.id)
      .first()
    results.steps.push({
      step: 'd1_verify',
      status: 'success',
      d1FindsRecord: !!afterDelete,
      record: afterDelete
    })

    // Conclusion
    const payloadSaysGone = payloadCheck.docs.length === 0
    const d1SaysGone = !afterDelete

    if (payloadSaysGone && d1SaysGone) {
      results.conclusion = {
        bugPresent: false,
        message: 'DELETE worked correctly - record was actually deleted'
      }
    } else if (payloadSaysGone && !d1SaysGone) {
      results.conclusion = {
        bugPresent: true,
        message: 'BUG CONFIRMED: Payload says deleted, but record still exists in D1!'
      }
      // Clean up the orphaned record
      await d1.prepare('DELETE FROM genres WHERE id = ?').bind(created.id).run()
      results.steps.push({ step: 'cleanup', status: 'success', message: 'Orphaned record cleaned up via direct D1' })
    } else {
      results.conclusion = {
        bugPresent: false,
        message: 'Unexpected state',
        payloadSaysGone,
        d1SaysGone
      }
    }

    return NextResponse.json(results)

  } catch (error: any) {
    results.steps.push({
      step: 'error',
      status: 'error',
      error: error.message,
      stack: error.stack
    })
    return NextResponse.json(results, { status: 500 })
  }
}
