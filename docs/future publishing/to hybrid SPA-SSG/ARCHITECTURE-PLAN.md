# Chimera CMS - SPA Reader with Static JSON Manifest

## Overview

This document describes an architecture for serving webcomics via a Single Page Application (SPA) reader that provides a mobile-optimized, swipe-to-read experience. Despite the folder name, this approach uses **static JSON files as a pseudo-API**, not a live server API.

The key insight: an SSG can generate machine-readable JSON alongside human-readable HTML during the same build. This JSON manifest serves as the "API" for the SPA reader, with no server required at read time.

### Design Goals

1. **Mobile-first reading** - Swipe navigation, instant page transitions
2. **Offline capability** - Service worker caches manifest and images
3. **No runtime dependencies** - Everything is static files
4. **SEO preserved** - Static HTML pages exist for search engines
5. **Same build pipeline** - Uses the existing SSG infrastructure

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Static Site (R2 or any host)                        │
│                                                                         │
│   /comics/my-comic/                                                     │
│     index.html           ← Landing page (SEO, sharing)                  │
│     manifest.json        ← Page list, metadata (the "API")              │
│     archive/index.html   ← Static archive page (SEO)                    │
│     page/1/index.html    ← Individual page (SEO, direct links)          │
│     page/2/index.html                                                   │
│     reader/index.html    ← SPA reader shell                             │
│     assets/                                                             │
│       reader.js          ← Reader application                           │
│       sw.js              ← Service worker                               │
│                                                                         │
│   /media/                                                               │
│     abc123.jpg           ← Comic images (from R2)                       │
│     abc123-thumb.jpg                                                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ User visits
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SPA Reader Flow                                 │
│                                                                         │
│   1. Browser loads /comics/my-comic/reader/                             │
│   2. Service worker registers                                           │
│   3. Reader fetches manifest.json (cached by SW)                        │
│   4. Reader knows all pages, image URLs, navigation                     │
│   5. Reader prefetches next N images in background                      │
│   6. User swipes → instant transition from cache                        │
│   7. SW continues prefetching ahead of reader position                  │
└─────────────────────────────────────────────────────────────────────────┘
```

## The Manifest

The manifest is a JSON file generated during the SSG build containing everything the reader needs:

```json
{
  "version": "2025-01-02T12:00:00Z",
  "comic": {
    "id": 4,
    "slug": "my-comic",
    "title": "My Webcomic",
    "tagline": "A story about...",
    "author": "Jane Creator",
    "thumbnail": "/media/comic-thumb.jpg"
  },
  "chapters": [
    {
      "id": 1,
      "title": "Chapter 1: The Beginning",
      "number": 1,
      "startPage": 1,
      "endPage": 24
    },
    {
      "id": 2,
      "title": "Chapter 2: Rising Action",
      "number": 2,
      "startPage": 25,
      "endPage": 48
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
    },
    {
      "number": 2,
      "chapter": 1,
      "image": "/media/def456.jpg",
      "thumbnail": "/media/def456-thumb.jpg",
      "width": 800,
      "height": 1200,
      "title": null,
      "altText": null,
      "authorNote": null,
      "publishedDate": "2024-06-22"
    }
  ],
  "navigation": {
    "firstPage": 1,
    "lastPage": 156,
    "totalPages": 156
  }
}
```

### Manifest Size Estimate

| Comic Size | Approx Manifest Size |
|------------|---------------------|
| 100 pages  | ~15 KB              |
| 500 pages  | ~60 KB              |
| 1000 pages | ~120 KB             |

Compressed with gzip, these shrink to roughly 1/4 the size. A 500-page comic's manifest would be ~15 KB over the wire.

## Reading Experience

### Initial Load

1. User arrives at `/comics/my-comic/` (from search, social share, direct link)
2. Static landing page loads instantly (HTML from CDN)
3. "Start Reading" button links to `/comics/my-comic/reader/`
4. Or: individual page URLs (`/page/42/`) can redirect into reader at that position

### Reader Initialization

1. SPA shell loads (`reader/index.html` + `reader.js`)
2. Service worker registers and activates
3. Reader fetches `manifest.json` (SW caches it)
4. Reader renders current page from manifest data
5. Background prefetch begins for upcoming images

### Swipe Navigation

1. User swipes left → next page
2. Image already in SW cache → instant display
3. Reader updates URL (history.pushState) for bookmarking
4. Prefetch queue advances (fetch page N+5, N+6, etc.)

### Offline Reading

1. Service worker caches:
   - Reader shell (HTML, JS, CSS)
   - Manifest JSON
   - Viewed page images
   - Prefetched upcoming images
2. User goes offline
3. Reader continues working from cache
4. "You're offline" indicator if trying to access uncached pages

## Service Worker Strategy

### Cache Layers

```
┌─────────────────────────────────────────┐
│           Cache: reader-shell-v1        │
│  - reader/index.html                    │
│  - assets/reader.js                     │
│  - assets/reader.css                    │
│  Strategy: Cache first, update in bg    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│          Cache: manifest-v1             │
│  - manifest.json                        │
│  Strategy: Stale-while-revalidate       │
│  (Serve cached, fetch fresh in bg)      │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│          Cache: comic-images            │
│  - /media/*.jpg                         │
│  Strategy: Cache first (immutable)      │
│  Images don't change once published     │
└─────────────────────────────────────────┘
```

### Update Detection

The service worker checks for manifest updates:

```javascript
// On reader load or periodically
const cached = await caches.match('/manifest.json')
const fresh = await fetch('/manifest.json', { cache: 'no-store' })

if (fresh.headers.get('etag') !== cached?.headers.get('etag')) {
  // New content available
  // Option A: Auto-update and notify user
  // Option B: Show "New pages available" prompt
}
```

## Build Integration

This approach extends the existing SSG build (from the "to Node-based host" documentation):

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         11ty Build Process                              │
│                                                                         │
│   Input:                                                                │
│     - Comic data from CMS API                                           │
│     - 11ty templates                                                    │
│                                                                         │
│   Output:                                                               │
│     - index.html          (landing page)                                │
│     - manifest.json       (NEW: page data for reader)                   │
│     - archive/index.html  (archive listing)                             │
│     - page/*/index.html   (individual pages for SEO)                    │
│     - reader/index.html   (SPA reader shell)                            │
│     - assets/*            (reader JS, CSS, service worker)              │
└─────────────────────────────────────────────────────────────────────────┘
```

The manifest generation is a simple 11ty template that outputs JSON instead of HTML.

## URL Structure

| URL | Purpose |
|-----|---------|
| `/comics/my-comic/` | Landing page (SEO, social sharing) |
| `/comics/my-comic/reader/` | SPA reader entry point |
| `/comics/my-comic/reader/#/page/42` | Deep link to specific page (hash routing) |
| `/comics/my-comic/page/42/` | Static HTML page (SEO, fallback) |
| `/comics/my-comic/archive/` | Static archive listing |
| `/comics/my-comic/manifest.json` | Page data for reader |

### Deep Linking

The reader uses hash-based routing (`#/page/42`) so that:
- Direct links work without server configuration
- Browser back/forward buttons work
- Bookmarks preserve position
- Static hosting requires no URL rewriting

Alternative: If hosting supports SPA fallback routing, use clean URLs (`/reader/page/42`).

## Comparison with Live API Approach

| Aspect | Static Manifest | Live API |
|--------|-----------------|----------|
| Content freshness | Build delay (5-10 min) | Instant |
| Offline support | Full (cached manifest) | Limited (API unreachable) |
| Server dependency | None at read time | CMS must be up |
| Infrastructure | Same as SSG | Need public API endpoints |
| Consistency | Manifest matches HTML | Could diverge |
| Caching | Simple (immutable files) | Complex (invalidation) |

## SEO Considerations

The SPA reader is progressive enhancement over a fully-functional static site:

1. **Search engines see static HTML** - `/page/1/`, `/page/2/`, etc. are real HTML pages
2. **Social sharing works** - Landing page has OpenGraph tags, preview images
3. **JavaScript not required** - Static pages work without JS (just no swipe UX)
4. **Sitemap** - Can be generated during build listing all page URLs

## Files in This Directory

- `ARCHITECTURE-PLAN.md` - This document
- `SAMPLE-MANIFEST-TEMPLATE.js.example` - 11ty template for generating manifest.json
- `SAMPLE-SERVICE-WORKER.js.example` - Service worker for caching strategy
- `SAMPLE-READER-COMPONENT.tsx.example` - React/Preact reader component concept

## Relationship to Other Approaches

This architecture **builds on** the "to Node-based host" SSG approach:

- Same CMS → GitHub Actions → 11ty → R2 pipeline
- Same rebuild triggers (cron + afterChange hook)
- Adds: manifest.json generation
- Adds: reader SPA component
- Adds: service worker for offline support

The reader component could potentially be shared across all comics (loaded from a CDN) or bundled per-comic during build.

## Future Considerations

- **Reader customization** - Allow creators to choose themes, reading direction (LTR/RTL)
- **Reading progress sync** - Optional account system to sync position across devices
- **Comments integration** - Load comments via separate API (could be third-party like Disqus)
- **Analytics** - Track reading progress, popular pages (privacy-respecting)
