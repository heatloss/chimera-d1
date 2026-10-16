/**
 * API endpoint to generate and publish JSON manifests to R2
 *
 * POST /api/generate-manifests
 *   - Generates index.json (all published comics)
 *   - Generates {slug}/manifest.json for each comic
 *   - Writes files to R2 under pub/v1/
 *   - Deletes manifests in R2 that should no longer be published
 *
 * POST /api/generate-manifests?comic=4
 *   - Regenerates (or retracts) the manifest for a single comic
 *   - `comic` is the NUMERIC DATABASE ID, not a slug. A non-numeric value is a
 *     400, not a silent no-match — see the validation below.
 *
 * Requires admin or editor role.
 *
 * PUBLISHING IS A RECONCILIATION, NOT AN APPEND.
 * R2 is a mirror of what should be public, so this endpoint must delete as well
 * as write. Writing only is what caused a hidden comic's manifest to stay
 * readable at its direct URL after it dropped out of index.json — the
 * `pub/[...path]` route serves any key it finds, with no visibility check, so a
 * stale key IS a live public page. See docs/visibility-model.md.
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

    // Single-comic mode. `?comic=` is a NUMERIC DATABASE ID, never a slug —
    // reject anything else rather than coercing.
    //
    // This is deliberately strict because the failure was silent: parseInt on a
    // slug yields NaN, `{ id: { equals: NaN } }` matches nothing, and the caller
    // got a 404 reading "comic not found" — indistinguishable from a genuinely
    // missing comic, when the real problem was passing the wrong identifier
    // type. The admin client called the parameter `comicSlug` for seven months
    // while correctly passing an id, so that mistake was one edit away.
    //
    // It matters more now that an unmatched lookup feeds a retraction decision:
    // wrong-type input should stop here, not proceed toward delete logic.
    const { searchParams } = new URL(request.url)
    const singleComicParam = searchParams.get('comic')

    if (singleComicParam !== null && !/^\d+$/.test(singleComicParam)) {
      return NextResponse.json(
        {
          error:
            `Invalid 'comic' parameter: expected a numeric comic id, got "${singleComicParam}". ` +
            `This endpoint takes a database id, not a slug.`,
        },
        { status: 400, headers: corsHeaders }
      )
    }

    const singleComicId = singleComicParam === null ? null : Number(singleComicParam)

    const now = new Date().toISOString()
    const results: {
      comics: string[]
      unpublished: string[]
      errors: string[]
      failed: string[]
    } = { comics: [], unpublished: [], errors: [], failed: [] }

    // In single-comic mode, look the comic up WITHOUT the visibility filter.
    // Otherwise a comic that was just made private is indistinguishable from one
    // that does not exist, and the endpoint 404s instead of retracting the
    // manifest — leaving it readable at its direct URL forever.
    const targetComic =
      singleComicId !== null
        ? (
            await payload.find({
              collection: 'comics',
              where: { id: { equals: singleComicId } },
              limit: 1,
              depth: 2,
            })
          ).docs[0]
        : undefined

    if (singleComicId !== null && !targetComic) {
      return NextResponse.json(
        { error: `Comic not found: ${singleComicId}` },
        { status: 404, headers: corsHeaders }
      )
    }

    // Fetch public comics. Lifecycle (ongoing/hiatus/completed) is deliberately
    // NOT consulted — a paused or finished comic is still a readable archive.
    // Note: a public comic with zero live pages still produces no manifest;
    // generateComicManifest() returns null for it.
    const comicsQuery = await payload.find({
      collection: 'comics',
      where: {
        visibility: { equals: 'public' },
        ...(singleComicId !== null ? { id: { equals: singleComicId } } : {}),
      },
      limit: 1000,
      depth: 2, // Populate relationships like coverImage, genres
    })

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
        // Generation failing is not evidence the comic should be unpublished.
        // Record it so the retraction pass below leaves its manifest in place.
        if (comic.slug) results.failed.push(comic.slug)
      }
    }

    // -------------------------------------------------------------------------
    // Retract manifests that should no longer be public.
    //
    // The keep-set is the slugs actually written above, plus any whose
    // generation threw. Everything else under the prefix is stale: a comic
    // turned private, a comic whose last live page went away, a deleted comic,
    // or a manifest orphaned by a slug change.
    // -------------------------------------------------------------------------
    try {
      const keep = new Set([...results.comics, ...results.failed])

      // Compare against null, not truthiness: singleComicId is now a number, so
      // a `!singleComicId` test would treat id 0 as "full run" and reconcile the
      // whole bucket. D1 autoincrement starts at 1 so that id shouldn't exist,
      // but the failure mode is mass deletion — not worth leaving to convention.
      if (singleComicId !== null) {
        // Single-comic mode only knows about one comic, so it must not touch
        // any other slug's key. It cannot detect an orphan from a slug change
        // either — only a full run reconciles those.
        const slug = targetComic?.slug
        if (slug && !keep.has(slug)) {
          const key = `pub/v1/comics/${slug}/manifest.json`
          // Check first purely so `unpublished` stays truthful. The common case
          // is a public comic with zero live pages, which has no manifest to
          // begin with — deleting is harmless but reporting it as a retraction
          // would be a lie. The full-run branch gets this for free by only
          // deleting keys it listed.
          if (await bucket.head(key)) {
            await deleteFromR2(bucket, key)
            results.unpublished.push(slug)
          }
        }
      } else {
        for (const slug of await listPublishedSlugs(bucket)) {
          if (keep.has(slug)) continue
          await deleteFromR2(bucket, `pub/v1/comics/${slug}/manifest.json`)
          results.unpublished.push(slug)
        }
      }
    } catch (error: any) {
      console.error('Error retracting stale manifests:', error)
      results.errors.push(`retract: ${error.message}`)
    }

    // Always regenerate the master index to keep it in sync
    try {
      // When publishing a single comic, we still need ALL published comics for the index
      const allComics =
        singleComicId !== null
          ? (
              await payload.find({
                collection: 'comics',
                where: { visibility: { equals: 'public' } },
                limit: 1000,
                depth: 2,
              })
            ).docs
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
        unpublished: results.unpublished.length > 0 ? results.unpublished : undefined,
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
    // Count LIVE pages only — public AND due. Queued pages must not appear.
    const pagesQuery = await payload.find({
      collection: 'pages',
      where: {
        comic: { equals: comic.id },
        visibility: { equals: 'public' },
        publishedDate: { less_than_equal: new Date().toISOString() },
      },
      limit: 1,
      sort: '-publishedDate',
    })

    // Skip comics with no live pages
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

  // Fetch LIVE pages only — public AND due.
  // This is the single predicate that keeps queued pages off the public site:
  // a page that is public with a future date is excluded here, and the manifest
  // is what readers actually consume.
  const pagesQuery = await payload.find({
    collection: 'pages',
    where: {
      comic: { equals: comic.id },
      visibility: { equals: 'public' },
      publishedDate: { less_than_equal: now },
    },
    limit: 10000,
    sort: 'globalPageNumber',
    depth: 1, // Populate pageImage, thumbnailImage
  })

  // Skip if no live pages
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

/**
 * Delete a published file from R2. R2 deletes are idempotent — removing a key
 * that isn't there is not an error — so callers don't need to check first.
 */
async function deleteFromR2(bucket: R2Bucket, key: string): Promise<void> {
  await bucket.delete(key)
  console.log(`🗑️  Deleted ${key}`)
}

/**
 * List the comic slugs that currently have a manifest published in R2.
 *
 * This reads what IS published, so the caller can diff it against what SHOULD
 * be. It's the only way to catch manifests with no corresponding public comic
 * at all — a deleted comic, or a key orphaned when a slug changed.
 *
 * Paginates: R2 list() caps at 1000 keys per call and signals more with
 * `truncated`, so a single call would silently under-report past that and leave
 * stale manifests live.
 */
async function listPublishedSlugs(bucket: R2Bucket): Promise<string[]> {
  const prefix = 'pub/v1/comics/'
  const slugs: string[] = []
  let cursor: string | undefined

  do {
    const listing = await bucket.list({ prefix, cursor })
    for (const object of listing.objects) {
      // pub/v1/comics/{slug}/manifest.json → {slug}
      const rest = object.key.slice(prefix.length)
      const [slug, ...tail] = rest.split('/')
      if (slug && tail.join('/') === 'manifest.json') slugs.push(slug)
    }
    cursor = listing.truncated ? listing.cursor : undefined
  } while (cursor)

  return slugs
}
