/**
 * Test route to verify wasm-image-optimization bundles correctly with OpenNext
 */

import { NextRequest, NextResponse } from 'next/server'
import { optimizeImage } from 'wasm-image-optimization'

export async function GET(request: NextRequest) {
  try {
    // Just verify the import works - we're testing bundling, not functionality
    const hasOptimize = typeof optimizeImage === 'function'

    return NextResponse.json({
      success: true,
      wasmLoaded: hasOptimize,
      message: 'wasm-image-optimization imported successfully',
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
    }, { status: 500 })
  }
}
