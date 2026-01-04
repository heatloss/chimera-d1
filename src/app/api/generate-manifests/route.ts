/**
 * API endpoint to generate and publish JSON manifests to R2
 *
 * POST /api/generate-manifests
 *   - Generates index.json (all published comics)
 *   - Generates {slug}/manifest.json for each comic
 *   - Writes files to R2 under pub/v1/
 *
 * POST /api/generate-manifests?comic=4
 *   - Regenerates manifest for a single comic by ID
 *
 * Requires admin or editor role.
 */

import { getPayload } from 'payload'
import config from '@/payload.config'
import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

// Types for manifest structures
interface ComicIndexEntry {
  id: number
  slug: string
  title: string
  tagline: string | null
  thumbnail: string | null
  pageCount: number
  latestPageDate: string | null
  route: string
}

interface ComicsIndex {
  version: string
  generatedAt: string
  comics: ComicIndexEntry[]
}

interface ManifestChapter {
  id: number
  title: string
  number: number
  startPage: number | null
  endPage: number | null
  pageCount: number
}

interface ManifestPage {
  number: number
  chapter: number | null
  image: string
  thumbnail: string | null
  width: number | null
  height: number | null
  title: string | null
  altText: string | null
  authorNote: string | null
  publishedDate: string | null
}

interface ComicManifest {
  version: string
  generatedAt: string
  comic: {
    id: number
    slug: string
    title: string
    tagline: string | null
    description: string | null
    thumbnail: string | null
    credits: Array<{ role: string; name: string; url?: string }> | null
    genres: string[] | null
  }
  chapters: ManifestChapter[]
  pages: ManifestPage[]
  navigation: {
    firstPage: number | null
    lastPage: number | null
    totalPages: number
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })

    // Authenticate user
    const { user } = await payload.auth({ headers: request.headers })
    if (!user || !['admin', 'editor'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Admin or editor access required' },
        { status: 403, headers: corsHeaders }
      )
    }

    // Get R2 bucket
    const { env } = await getCloudflareContext({ async: true })
    const bucket = env?.R2
    if (!bucket) {
      return NextResponse.json(
        { error: 'R2 bucket not configured' },
        { status: 500, headers: corsHeaders }
      )
    }

    // Check for single-comic mode (by ID)
    const { searchParams } = new URL(request.url)
    const singleComicId = searchParams.get('comic')

    const now = new Date().toISOString()
    const results: { comics: string[]; errors: string[] } = { comics: [], errors: [] }

    // Fetch comics that should be published (live, hiatus, or completed)
    const comicsQuery = await payload.find({
      collection: 'comics',
      where: {
        status: { in: ['live', 'hiatus', 'completed'] },
        ...(singleComicId ? { id: { equals: parseInt(singleComicId, 10) } } : {}),
      },
      limit: 1000,
      depth: 2, // Populate relationships like coverImage, genres
    })

    if (singleComicId && comicsQuery.docs.length === 0) {
      return NextResponse.json(
        { error: `Comic not found or not published: ${singleComicId}` },
        { status: 404, headers: corsHeaders }
      )
    }

    // Generate manifest for each comic
    for (const comic of comicsQuery.docs) {
      try {
        const manifest = await generateComicManifest(payload, comic, now)
        if (manifest) {
          const key = `pub/v1/comics/${comic.slug}/manifest.json`
          await writeToR2(bucket, key, manifest)
          results.comics.push(comic.slug)
        }
      } catch (error: any) {
        console.error(`Error generating manifest for ${comic.slug}:`, error)
        results.errors.push(`${comic.slug}: ${error.message}`)
      }
    }

    // Always regenerate the master index to keep it in sync
    try {
      // When publishing a single comic, we still need ALL published comics for the index
      const allComics = singleComicId
        ? (await payload.find({
            collection: 'comics',
            where: { status: { in: ['live', 'hiatus', 'completed'] } },
            limit: 1000,
            depth: 2,
          })).docs
        : comicsQuery.docs

      const index = await generateComicsIndex(payload, allComics, now)
      await writeToR2(bucket, 'pub/v1/index.json', index)
    } catch (error: any) {
      console.error('Error generating index:', error)
      results.errors.push(`index: ${error.message}`)
    }

    return NextResponse.json(
      {
        success: true,
        generated: results.comics.length,
        comics: results.comics,
        errors: results.errors.length > 0 ? results.errors : undefined,
      },
      { headers: corsHeaders }
    )
  } catch (error: any) {
    console.error('Error in generate-manifests:', error)
    return NextResponse.json(
      { error: 'Failed to generate manifests', details: error.message },
      { status: 500, headers: corsHeaders }
    )
  }
}

/**
 * Generate the master comics index
 */
async function generateComicsIndex(
  payload: any,
  comics: any[],
  generatedAt: string
): Promise<ComicsIndex> {
  const entries: ComicIndexEntry[] = []

  for (const comic of comics) {
    // Get published page count and latest date
    const pagesQuery = await payload.find({
      collection: 'pages',
      where: {
        comic: { equals: comic.id },
        status: { equals: 'published' },
        publishedDate: { less_than_equal: new Date().toISOString() },
      },
      limit: 1,
      sort: '-publishedDate',
    })

    // Skip comics with no published pages
    if (pagesQuery.totalDocs === 0) continue

    const coverImage = typeof comic.coverImage === 'object' ? comic.coverImage : null

    entries.push({
      id: comic.id,
      slug: comic.slug,
      title: comic.title,
      tagline: comic.description?.substring(0, 200) || null,
      thumbnail: coverImage?.filename ? `/media/${coverImage.filename}` : null,
      pageCount: pagesQuery.totalDocs,
      latestPageDate: pagesQuery.docs[0]?.publishedDate || null,
      route: `/${comic.slug}/`,
    })
  }

  // Sort by latest page date (most recent first)
  entries.sort((a, b) => {
    if (!a.latestPageDate) return 1
    if (!b.latestPageDate) return -1
    return b.latestPageDate.localeCompare(a.latestPageDate)
  })

  return {
    version: '1.0',
    generatedAt,
    comics: entries,
  }
}

/**
 * Generate manifest for a single comic
 */
async function generateComicManifest(
  payload: any,
  comic: any,
  generatedAt: string
): Promise<ComicManifest | null> {
  const now = new Date().toISOString()

  // Fetch published pages
  const pagesQuery = await payload.find({
    collection: 'pages',
    where: {
      comic: { equals: comic.id },
      status: { equals: 'published' },
      publishedDate: { less_than_equal: now },
    },
    limit: 10000,
    sort: 'globalPageNumber',
    depth: 1, // Populate pageImage, thumbnailImage
  })

  // Skip if no published pages
  if (pagesQuery.docs.length === 0) {
    return null
  }

  // Fetch chapters
  const chaptersQuery = await payload.find({
    collection: 'chapters',
    where: { comic: { equals: comic.id } },
    limit: 1000,
    sort: 'order',
  })

  // Build chapter data with page ranges
  const chapters: ManifestChapter[] = chaptersQuery.docs.map((chapter: any) => {
    const chapterPages = pagesQuery.docs.filter((p: any) => {
      const chapterId = typeof p.chapter === 'object' ? p.chapter?.id : p.chapter
      return chapterId === chapter.id
    })
    const pageNumbers = chapterPages.map((p: any) => p.globalPageNumber)

    return {
      id: chapter.id,
      title: chapter.title,
      number: chapter.chapterNumber,
      startPage: pageNumbers.length > 0 ? Math.min(...pageNumbers) : null,
      endPage: pageNumbers.length > 0 ? Math.max(...pageNumbers) : null,
      pageCount: chapterPages.length,
    }
  }).filter((ch: ManifestChapter) => ch.pageCount > 0)

  // Build page data
  const pages: ManifestPage[] = pagesQuery.docs.map((page: any) => {
    const pageImage = typeof page.pageImage === 'object' ? page.pageImage : null
    const thumbnailImage = typeof page.thumbnailImage === 'object' ? page.thumbnailImage : null
    const chapter = typeof page.chapter === 'object' ? page.chapter : null

    return {
      number: page.globalPageNumber,
      chapter: chapter?.chapterNumber || null,
      image: pageImage?.filename ? `/media/${pageImage.filename}` : '',
      thumbnail: thumbnailImage?.filename ? `/media/${thumbnailImage.filename}` : null,
      width: pageImage?.width || null,
      height: pageImage?.height || null,
      title: page.title || null,
      altText: page.altText || null,
      authorNote: page.authorNotes || null,
      publishedDate: page.publishedDate || null,
    }
  })

  const pageNumbers = pages.map((p) => p.number).filter((n) => n != null)
  const coverImage = typeof comic.coverImage === 'object' ? comic.coverImage : null

  // Extract genres if populated
  const genres = Array.isArray(comic.genres)
    ? comic.genres.map((g: any) => (typeof g === 'object' ? g.name : g)).filter(Boolean)
    : null

  // Extract credits
  const credits = Array.isArray(comic.credits)
    ? comic.credits.map((c: any) => ({
        role: c.role === 'other' ? c.customRole || 'Other' : c.role,
        name: c.name,
        url: c.url || undefined,
      }))
    : null

  return {
    version: '1.0',
    generatedAt,
    comic: {
      id: comic.id,
      slug: comic.slug,
      title: comic.title,
      tagline: comic.description?.substring(0, 200) || null,
      description: comic.description || null,
      thumbnail: coverImage?.filename ? `/media/${coverImage.filename}` : null,
      credits,
      genres,
    },
    chapters,
    pages,
    navigation: {
      firstPage: pageNumbers.length > 0 ? Math.min(...pageNumbers) : null,
      lastPage: pageNumbers.length > 0 ? Math.max(...pageNumbers) : null,
      totalPages: pages.length,
    },
  }
}

/**
 * Write JSON to R2
 */
async function writeToR2(bucket: R2Bucket, key: string, data: object): Promise<void> {
  const json = JSON.stringify(data, null, 2)
  await bucket.put(key, json, {
    httpMetadata: {
      contentType: 'application/json',
    },
  })
  console.log(`📤 Wrote ${key} (${json.length} bytes)`)
}
