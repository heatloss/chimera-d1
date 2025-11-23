import { getPayload } from 'payload'
import config from '@/payload.config'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Request creator role upgrade
 *
 * Usage:
 *   POST /api/request-creator-role
 *   Authorization: Bearer jwt_token
 *
 * Upgrades authenticated user from 'reader' to 'creator' role
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })

    // Get authenticated user
    const { user } = await payload.auth({ headers: request.headers })

    // Check authentication
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers: getCorsHeaders() }
      )
    }

    // Check if user is already a creator or higher
    if (user.role === 'creator' || user.role === 'editor' || user.role === 'admin') {
      return NextResponse.json(
        {
          message: 'User already has creator privileges',
          user: {
            id: user.id,
            email: user.email,
            role: user.role
          }
        },
        { status: 200, headers: getCorsHeaders() }
      )
    }

    // Upgrade user to creator role
    const updatedUser = await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        role: 'creator'
      }
    })

    // Remove sensitive data from response
    const userResponse = {
      id: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      updatedAt: updatedUser.updatedAt
    }

    return NextResponse.json({
      message: 'Creator role granted successfully',
      user: userResponse
    }, {
      status: 200,
      headers: getCorsHeaders()
    })

  } catch (error: any) {
    console.error('Error upgrading user role:', error)

    // Handle Payload validation errors
    if (error.name === 'ValidationError' || error.errors) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          errors: error.errors || [{ message: error.message }]
        },
        { status: 400, headers: getCorsHeaders() }
      )
    }

    return NextResponse.json(
      { error: 'Failed to upgrade user role' },
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
