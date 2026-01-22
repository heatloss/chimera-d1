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
  credits: Array<{ role: string; name: string; url?: string }> | null
  links: Array<{ type: string; label?: string; url: string }> | null
  genres: string[] | null
  tags: string[] | null
}

interface ComicsIndex {
  version: string
  generatedAt: string
  comics: ComicIndexEntry[]
}

interface ManifestPage {
  slug: string | null
  globalPageNumber: number
  chapterPageNumber: number
  image: {
    original: string   // /api/media/file/filename.jpg (fallback)
    mobile: string     // /api/pub/media/mobile/baseName.webp (960w)
    desktop: string    // /api/pub/media/desktop/baseName.webp (1440w)
  }
  thumbnail: string | null       // 400px pre-generated WebP
  thumbnailLarge: string | null  // 800px pre-generated WebP
  width: number | null
  height: number | null
  title: string | null
  altText: string | null
  authorNote: string | null
  contentWarning: string | null
  publishedDate: string | null
}

interface ManifestChapter {
  id: number
  slug: string | null
  title: string
  order: number
  pages: ManifestPage[]
}

interface ComicManifest {
  version: string
  generatedAt: string
  meta: {
    id: number
    slug: string
    title: string
    tagline: string | null
    description: string | null
    thumbnail: string | null
    credits: Array<{ role: string; name: string; url?: string }> | null
    links: Array<{ type: string; label?: string; url: string }> | null
    genres: string[] | null
    tags: string[] | null
  }
  chapters: ManifestChapter[]
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

    // Extract credits
    const credits = Array.isArray(comic.credits)
      ? comic.credits.map((c: any) => ({
          role: c.role === 'other' ? c.customRole || 'Other' : c.role,
          name: c.name,
          url: c.url || undefined,
        }))
      : null

    // Extract links
    const links = Array.isArray(comic.links)
      ? comic.links.map((l: any) => ({
          type: l.type,
          label: l.label || undefined,
          url: l.url,
        }))
      : null

    // Extract genres
    const genres = Array.isArray(comic.genres)
      ? comic.genres.map((g: any) => (typeof g === 'object' ? g.name : g)).filter(Boolean)
      : null

    // Extract tags
    const tags = Array.isArray(comic.tags)
      ? comic.tags.map((t: any) => (typeof t === 'object' ? t.name : t)).filter(Boolean)
      : null

    // Get thumbnail URL from imageSizes (400px pre-generated thumbnail)
    let thumbnailUrl: string | null = null
    if (coverImage?.imageSizes && Array.isArray(coverImage.imageSizes)) {
      const thumb = coverImage.imageSizes.find((s: any) => s.name === 'thumbnail')
      thumbnailUrl = thumb?.url || null
    }

    entries.push({
      id: comic.id,
      slug: comic.slug,
      title: comic.title,
      tagline: comic.description?.substring(0, 200) || null,
      thumbnail: thumbnailUrl,
      pageCount: pagesQuery.totalDocs,
      latestPageDate: pagesQuery.docs[0]?.publishedDate || null,
      route: `/${comic.slug}/`,
      credits,
      links,
      genres,
      tags,
    })
  }

  // Sort by latest page date (most recent first)
  entries.sort((a, b) => {
    if (!a.latestPageDate) return 1
    if (!b.latestPageDate) return -1
    return b.latestPageDate.localeCompare(a.latestPageDate)
  })

  return {
    version: '1.1',
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

  // Helper to build a ManifestPage from a page document
  const buildManifestPage = (page: any): ManifestPage => {
    const pageImage = typeof page.pageImage === 'object' ? page.pageImage : null

    // Generate srcset-ready image URLs
    // baseName is the filename without extension (e.g., "abc123" from "abc123.jpg")
    const filename = pageImage?.filename || ''
    const baseName = filename.replace(/\.[^.]+$/, '')

    // Get thumbnail URLs from pageImage.imageSizes (400px and 800px pre-generated thumbnails)
    // Using pageImage instead of thumbnailImage since they should reference the same Media
    // and pageImage is the source of truth (thumbnailImage auto-populates from it)
    let thumbnailUrl: string | null = null
    let thumbnailLargeUrl: string | null = null
    if (pageImage?.imageSizes && Array.isArray(pageImage.imageSizes)) {
      const thumb = pageImage.imageSizes.find((s: any) => s.name === 'thumbnail')
      const thumbLarge = pageImage.imageSizes.find((s: any) => s.name === 'thumbnail_large')
      thumbnailUrl = thumb?.url || null
      thumbnailLargeUrl = thumbLarge?.url || null
    }

    return {
      slug: page.slug || null,
      globalPageNumber: page.globalPageNumber,
      chapterPageNumber: page.chapterPageNumber,
      image: {
        original: filename ? `/api/media/file/${filename}` : '',
        mobile: baseName ? `/api/pub/media/mobile/${baseName}.webp` : '',
        desktop: baseName ? `/api/pub/media/desktop/${baseName}.webp` : '',
      },
      thumbnail: thumbnailUrl,
      thumbnailLarge: thumbnailLargeUrl,
      width: pageImage?.width || null,
      height: pageImage?.height || null,
      title: page.title || null,
      altText: page.altText || null,
      authorNote: page.authorNotes || null,
      contentWarning: page.contentWarning || null,
      publishedDate: page.publishedDate || null,
    }
  }

  // Build chapters with nested pages
  const chapters: ManifestChapter[] = chaptersQuery.docs
    .map((chapter: any) => {
      // Find pages belonging to this chapter
      const chapterPages = pagesQuery.docs.filter((p: any) => {
        const chapterId = typeof p.chapter === 'object' ? p.chapter?.id : p.chapter
        return chapterId === chapter.id
      })

      // Sort by chapterPageNumber within the chapter
      chapterPages.sort((a: any, b: any) => a.chapterPageNumber - b.chapterPageNumber)

      return {
        id: chapter.id,
        slug: chapter.slug || null,
        title: chapter.title,
        order: chapter.order,
        pages: chapterPages.map(buildManifestPage),
      }
    })
    .filter((ch: ManifestChapter) => ch.pages.length > 0) // Only include chapters with pages

  // Calculate total pages and page range from all chapters
  const allPageNumbers = chapters.flatMap(ch => ch.pages.map(p => p.globalPageNumber))
  const coverImage = typeof comic.coverImage === 'object' ? comic.coverImage : null

  // Get thumbnail URL from imageSizes (400px pre-generated thumbnail)
  let coverThumbnailUrl: string | null = null
  if (coverImage?.imageSizes && Array.isArray(coverImage.imageSizes)) {
    const thumb = coverImage.imageSizes.find((s: any) => s.name === 'thumbnail')
    coverThumbnailUrl = thumb?.url || null
  }

  // Extract genres if populated
  const genres = Array.isArray(comic.genres)
    ? comic.genres.map((g: any) => (typeof g === 'object' ? g.name : g)).filter(Boolean)
    : null

  // Extract tags
  const tags = Array.isArray(comic.tags)
    ? comic.tags.map((t: any) => (typeof t === 'object' ? t.name : t)).filter(Boolean)
    : null

  // Extract credits
  const credits = Array.isArray(comic.credits)
    ? comic.credits.map((c: any) => ({
        role: c.role === 'other' ? c.customRole || 'Other' : c.role,
        name: c.name,
        url: c.url || undefined,
      }))
    : null

  // Extract links
  const links = Array.isArray(comic.links)
    ? comic.links.map((l: any) => ({
        type: l.type,
        label: l.label || undefined,
        url: l.url,
      }))
    : null

  return {
    version: '1.1',
    generatedAt,
    meta: {
      id: comic.id,
      slug: comic.slug,
      title: comic.title,
      tagline: comic.description?.substring(0, 200) || null,
      description: comic.description || null,
      thumbnail: coverThumbnailUrl,
      credits,
      links,
      genres,
      tags,
    },
    chapters,
    navigation: {
      firstPage: allPageNumbers.length > 0 ? Math.min(...allPageNumbers) : null,
      lastPage: allPageNumbers.length > 0 ? Math.max(...allPageNumbers) : null,
      totalPages: allPageNumbers.length,
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
