# Chimera CMS - SPA Reader with Static JSON Manifests

## Overview

This architecture serves webcomics via a Single Page Application (SPA) reader that provides a mobile-optimized, swipe-to-read experience. The SPA is a **passive consumer** of static JSON manifests - it never contacts the CMS directly.

### Key Principle

```
CMS publishes TO the SPA's origin
SPA reads FROM its own origin
SPA never knows the CMS exists
```

### Design Goals

1. **Mobile-first reading** - Swipe navigation, instant page transitions
2. **Offline capability** - Service worker caches manifests and images
3. **No runtime CMS dependency** - SPA reads only static files
4. **Clean separation** - CMS is authoring; SPA is consumption
5. **No SSG layer needed** - CMS generates JSON directly (no 11ty)

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Chimera CMS                                     │
│                    (api.chimeracomics.org)                              │
│                                                                         │
│   D1 Database                                                           │
│   ├── comics table                                                      │
│   ├── chapters table                                                    │
│   └── pages table                                                       │
│                                                                         │
│   Manifest Generator (scripts/generate-manifests.ts)                    │
│   ├── Queries published content from D1                                 │
│   ├── Generates comics.json (master index)                              │
│   └── Generates {slug}/manifest.json (per-comic)                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Publishes JSON + images
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    R2 Bucket / Static Host                              │
│                   (app.chimeracomics.org)                               │
│                                                                         │
│   /sites/                                                               │
│     comics.json              ← Master index of all comics               │
│     my-comic/                                                           │
│       manifest.json          ← Pages, chapters, metadata                │
│     other-comic/                                                        │
│       manifest.json                                                     │
│                                                                         │
│   /media/                                                               │
│     abc123.jpg               ← Comic page images                        │
│     def456.jpg               ← (already uploaded during authoring)      │
│     abc123-thumb.jpg         ← Thumbnails                               │
│                                                                         │
│   /reader/                                                              │
│     index.html               ← SPA shell                                │
│     reader.js                ← Reader application                       │
│     sw.js                    ← Service worker                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ User visits
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SPA Reader                                      │
│                                                                         │
│   1. Load /sites/comics.json    → Show comic directory                  │
│   2. User picks a comic                                                 │
│   3. Load /sites/{slug}/manifest.json                                   │
│   4. Service worker caches manifest                                     │
│   5. Reader prefetches upcoming images from /media/                     │
│   6. User swipes through pages (instant from cache)                     │
│                                                                         │
│   The SPA only reads from its own origin.                               │
│   It has no knowledge of the CMS or its API.                            │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Publishing Flow (CMS → Static Host)

```
1. Creator publishes/edits a page in CMS
2. Manifest generator runs (manually, via hook, or cron)
3. Generator queries CMS for published content:
   - Comics with status='published'
   - Pages with status='published' AND publishedDate <= NOW
4. Generator creates:
   - comics.json (all published comics)
   - {slug}/manifest.json (for each comic with published pages)
5. Generator uploads JSON files to R2 /sites/ prefix
6. Images are already in R2 /media/ (uploaded during authoring)
```

### Reading Flow (User → SPA)

```
1. User visits app.chimeracomics.org
2. SPA loads and registers service worker
3. SPA fetches /sites/comics.json (cached by SW)
4. User selects a comic
5. SPA fetches /sites/{slug}/manifest.json (cached by SW)
6. SPA now knows all page URLs, chapter structure, metadata
7. SPA prefetches next N images into SW cache
8. User swipes → instant display from cache
9. SW continues prefetching ahead of reading position
```

### Cache Invalidation (Optional)

When new content is published, the CMS could optionally notify the SPA:

```
Option A: Version in manifest
- Manifest includes "version" timestamp
- SW checks for new version periodically
- If version changed, SW refetches and notifies reader

Option B: Push notification
- CMS sends push notification via Web Push API
- SW receives notification, refetches manifests
- Shows "New pages available" toast

Option C: Polling
- SW periodically fetches manifest with cache-bust
- Compares page count with cached version
- Notifies if new content detected
```

For MVP, Option A (version polling) is simplest.

## File Structures

### comics.json (Master Index)

```json
{
  "version": "1.0",
  "generatedAt": "2025-01-02T12:00:00Z",
  "comics": [
    {
      "id": 4,
      "slug": "my-comic",
      "title": "My Webcomic",
      "tagline": "A story about adventure",
      "thumbnail": "/media/comic-thumb.jpg",
      "pageCount": 156,
      "latestPageDate": "2025-01-01",
      "route": "/my-comic/"
    },
    {
      "id": 7,
      "slug": "other-comic",
      "title": "Other Comic",
      "tagline": null,
      "thumbnail": "/media/other-thumb.jpg",
      "pageCount": 42,
      "latestPageDate": "2024-12-15",
      "route": "/other-comic/"
    }
  ]
}
```

### {slug}/manifest.json (Per-Comic)

```json
{
  "version": "1.0",
  "generatedAt": "2025-01-02T12:00:00Z",
  "comic": {
    "id": 4,
    "slug": "my-comic",
    "title": "My Webcomic",
    "tagline": "A story about adventure",
    "description": "Full description here...",
    "thumbnail": "/media/comic-thumb.jpg"
  },
  "chapters": [
    {
      "id": 1,
      "title": "Chapter 1: The Beginning",
      "number": 1,
      "startPage": 1,
      "endPage": 24,
      "pageCount": 24
    }
  ],
  "pages": [
    {
      "number": 1,
      "chapter": 1,
      "image": "/media/abc123.jpg",
      "thumbnail": "/media/abc123-thumb.jpg",
      "width": 800,
      "height": 1200,
      "title": "Page 1",
      "altText": "Our hero stands at the crossroads",
      "authorNote": "This is where it all begins!",
      "publishedDate": "2024-06-15"
    }
  ],
  "navigation": {
    "firstPage": 1,
    "lastPage": 156,
    "totalPages": 156
  }
}
```

## Why No 11ty?

The SSG (11ty) layer documented in the "to Node-based host" folder is for generating **static HTML pages** - useful for SEO, direct linking, and non-JavaScript fallback.

For a **pure SPA reader**, we don't need HTML generation:

| Need | SSG Approach | SPA Approach |
|------|--------------|--------------|
| Page data | HTML templates → HTML files | CMS query → JSON files |
| Navigation | Links between HTML pages | JS reads manifest |
| Images | Referenced in HTML | Referenced in manifest |
| SEO | Full HTML pages | Separate concern (see below) |

The SPA approach is simpler: just generate JSON, upload it, done.

### SEO Considerations

For search engine visibility, consider:

1. **Static landing pages** - Simple HTML pages per comic (can be hand-written or generated) that link to the SPA reader
2. **Server-side rendering** - If using a framework like Next.js for the SPA
3. **Prerendering** - Generate HTML snapshots for crawlers
4. **Accept reduced SEO** - If discovery happens through social sharing rather than search

For MVP/testing, SEO can be deferred.

## Triggering Manifest Generation

### Manual (Testing)

```bash
pnpm tsx scripts/generate-manifests.ts
pnpm tsx scripts/generate-manifests.ts --comic=my-comic
```

### On Publish (Hook)

```typescript
// In Pages collection afterChange hook
if (pageIsNowLive(doc, previousDoc)) {
  await generateManifestForComic(doc.comic)
  await regenerateComicsIndex()
}
```

### Scheduled (Cron)

For scheduled publishing (publishedDate in future):

```typescript
// Cron runs every 5 minutes
// Finds comics with pages where publishedDate just passed
// Regenerates affected manifests
```

See "to Node-based host" folder for cron implementation details.

## Service Worker Strategy

```
┌─────────────────────────────────────┐
│      Cache: reader-shell-v1         │
│  - /reader/index.html               │
│  - /reader/reader.js                │
│  Strategy: Cache first              │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│      Cache: manifests               │
│  - /sites/comics.json               │
│  - /sites/*/manifest.json           │
│  Strategy: Stale-while-revalidate   │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│      Cache: comic-images            │
│  - /media/*.jpg                     │
│  Strategy: Cache first (immutable)  │
└─────────────────────────────────────┘
```

## Files in This Directory

- `ARCHITECTURE-PLAN.md` - This document
- `SAMPLE-MANIFEST-GENERATOR.ts.example` - Script to generate and upload manifests
- `SAMPLE-SERVICE-WORKER.js.example` - Service worker for caching (to be created)
- `SAMPLE-READER-COMPONENT.tsx.example` - React reader component (to be created)

## Relationship to Other Approaches

| Approach | Use Case |
|----------|----------|
| **to Node-based host** (SSG) | Full static site with HTML pages for SEO |
| **to PHP-based host** (SSG) | Deploy to creator-owned shared hosting |
| **to SPA via API** (this) | Mobile-optimized reader, no HTML generation |

These can be combined:
- Generate HTML for SEO + JSON for SPA reader
- Use 11ty for both (HTML templates + JSON output)
- Or keep them separate (HTML from 11ty, JSON from generator script)

## Future Considerations

- **Incremental generation** - Only regenerate changed comics
- **Diff detection** - Skip upload if manifest unchanged
- **Push notifications** - Notify readers of new pages
- **Reading progress sync** - Optional account system
- **Comments** - Could load from separate service
