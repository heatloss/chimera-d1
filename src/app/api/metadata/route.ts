import { NextResponse } from 'next/server'
import { Comics } from '@/collections/Comics'
import { Pages } from '@/collections/Pages'
import type { Field, Option } from 'payload'

export const dynamic = 'force-dynamic'

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  })
}

/**
 * Helper to extract options from a select field
 */
function getFieldOptions(fields: Field[], fieldName: string): Option[] {
  const field = fields.find((f) => 'name' in f && f.name === fieldName)
  if (field && field.type === 'select' && 'options' in field) {
    return field.options as Option[]
  }
  return []
}

/**
 * Helper to extract options from nested array fields (like credits)
 */
function getNestedFieldOptions(fields: Field[], arrayFieldName: string, nestedFieldName: string): Option[] {
  const arrayField = fields.find((f) => 'name' in f && f.name === arrayFieldName)
  if (arrayField && arrayField.type === 'array' && 'fields' in arrayField) {
    return getFieldOptions(arrayField.fields, nestedFieldName)
  }
  return []
}

/**
 * GET /api/metadata
 * Returns all metadata options for comics, pages, and related entities.
 * Dynamically reads options from Payload collection configs.
 * This is used by the frontend to populate dropdown menus and selectors.
 * No authentication required - these are static configuration values.
 */
export async function GET() {
  const metadata = {
    creditRoles: getNestedFieldOptions(Comics.fields, 'credits', 'role'),
    publishSchedules: getFieldOptions(Comics.fields, 'publishSchedule'),
    genres: getFieldOptions(Comics.fields, 'genres'),
    comicStatuses: getFieldOptions(Comics.fields, 'status'),
    pageStatuses: getFieldOptions(Pages.fields, 'status'),
  }

  return NextResponse.json(metadata, { headers: corsHeaders })
}
