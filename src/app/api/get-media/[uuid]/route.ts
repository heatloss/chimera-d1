import { getPayload } from 'payload'
import config from '@/payload.config'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Example API route that demonstrates how to access media by UUID (not internal ID)
 *
 * Usage:
 *   GET /api/get-media/a7f3c2e1-4b5d-4c8a-9e2f-1d3b5c7a9f2e
 *
 * This is what you'd use in your frontend/public-facing code to prevent
 * exposing sequential integer IDs.
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
      collection: 'media',
      where: {
        uuid: {
          equals: uuid
        }
      },
      limit: 1
    })

    if (result.docs.length === 0) {
      return NextResponse.json(
        { error: 'Media not found' },
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

    const media = result.docs[0]

    // Return media data
    // Notice: We return the UUID in the response, not the internal ID
    return NextResponse.json({
      uuid: media.uuid,        // ← Public UUID (secure)
      // id: media.id,         // ← Internal ID (DON'T expose this publicly)
      url: media.url,
      filename: media.filename,
      alt: media.alt,
      mimeType: media.mimeType,
      filesize: media.filesize,
      width: media.width,
      height: media.height,
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    })
  } catch (error: any) {
    console.error('Error fetching media by UUID:', error)
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
