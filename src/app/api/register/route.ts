import { getPayload } from 'payload'
import config from '@/payload.config'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Public user registration endpoint
 *
 * Usage:
 *   POST /api/register
 *   Body: { "email": "user@example.com", "password": "securepassword" }
 *
 * Creates a new user account with 'reader' role by default
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })

    // Parse request body
    const body = await request.json() as { email?: string; password?: string }
    const { email, password } = body

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        {
          error: 'Email and password are required',
          errors: [
            { message: 'Email and password are required', field: 'email' }
          ]
        },
        { status: 400, headers: getCorsHeaders() }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {
          error: 'Invalid email format',
          errors: [
            { message: 'Invalid email format', field: 'email' }
          ]
        },
        { status: 400, headers: getCorsHeaders() }
      )
    }

    // Validate password length
    if (password.length < 8) {
      return NextResponse.json(
        {
          error: 'Password must be at least 8 characters long',
          errors: [
            { message: 'Password must be at least 8 characters long', field: 'password' }
          ]
        },
        { status: 400, headers: getCorsHeaders() }
      )
    }

    // Check if user already exists
    const existingUsers = await payload.find({
      collection: 'users',
      where: {
        email: {
          equals: email.toLowerCase()
        }
      },
      limit: 1
    })

    if (existingUsers.docs.length > 0) {
      return NextResponse.json(
        {
          error: 'User with this email already exists',
          errors: [
            { message: 'User with this email already exists', field: 'email' }
          ]
        },
        { status: 409, headers: getCorsHeaders() }
      )
    }

    // Create new user with 'reader' role
    const newUser = await payload.create({
      collection: 'users',
      data: {
        email: email.toLowerCase(),
        password: password,
        role: 'reader'
      }
    })

    // Remove sensitive data from response
    const userResponse = {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      createdAt: newUser.createdAt,
      updatedAt: newUser.updatedAt
    }

    return NextResponse.json({
      message: 'User created successfully',
      user: userResponse
    }, {
      status: 201,
      headers: getCorsHeaders()
    })

  } catch (error: any) {
    console.error('Error creating user:', error)

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
      { error: 'Failed to create user account' },
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
