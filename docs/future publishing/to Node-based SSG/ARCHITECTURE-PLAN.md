# Chimera CMS - Static Site Publishing to Cloudflare R2

## Overview

This document describes the architecture for publishing webcomic static sites from Chimera CMS. The approach uses:

- **11ty** as the static site generator
- **GitHub Actions** for build execution
- **Cloudflare R2** for static file storage
- **Cloudflare Workers** for serving and scheduled publishing triggers

### Design Goals

1. **Per-comic isolation** - Each comic's site can be built and deployed independently
2. **Portability** - Architecture can migrate to conventional VPS hosting with minimal changes
3. **Automation** - New comics require no manual infrastructure setup
4. **Scheduled publishing** - Pages with future publish dates go live automatically

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        app.chimeracomics.org                            │
│                         (Cloudflare Worker)                             │
│                                                                         │
│   /                    → Main site (comic directory, about, etc.)       │
│   /comics/my-comic/*   → R2: /sites/my-comic/*                          │
│   /comics/other-comic/* → R2: /sites/other-comic/*                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            R2 Bucket                                    │
│                                                                         │
│   /sites/my-comic/index.html                                            │
│   /sites/my-comic/archive/index.html                                    │
│   /sites/my-comic/page/1/index.html                                     │
│   /sites/other-comic/...                                                │
│   /sites/_main/index.html  (main site)                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │ Upload built files
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                         GitHub Actions                                  │
│                                                                         │
│   Triggered by: repository_dispatch webhook                             │
│   Payload: { comic_slug: "my-comic", comic_id: 4 }                      │
│                                                                         │
│   Steps:                                                                │
│   1. Checkout 11ty template repo                                        │
│   2. npm install                                                        │
│   3. COMIC_SLUG=my-comic npx @11ty/eleventy                             │
│      (11ty fetches content from CMS API during build)                   │
│   4. Upload _site/* to R2 at /sites/my-comic/                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │ Webhook trigger
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                    Chimera CMS (Cloudflare)                             │
│                                                                         │
│   Two rebuild triggers:                                                 │
│                                                                         │
│   1. Cron Worker (every 5 min) - Scheduled publishing                   │
│      - Finds pages where publishedDate just crossed threshold           │
│      - Uses comic.lastBuiltAt to avoid redundant builds                 │
│      - Query: WHERE status='published' AND publishedDate <= NOW()       │
│               AND publishedDate > comic.lastBuiltAt                     │
│      - Triggers GitHub Actions for affected comics                      │
│                                                                         │
│   2. afterChange Hook - Content edits                                   │
│      - Fires when creator edits a page that's already live              │
│      - Triggers immediate rebuild for that comic                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Reads/writes
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         CMS (existing)                                  │
│                                                                         │
│   Payload CMS + D1 + R2 (media)                                         │
│   api.chimeracomics.org                                                 │
│                                                                         │
│   Key endpoints for SSG:                                                │
│   - GET /api/comic-with-chapters/:id (full comic data)                  │
│   - GET /api/pages-with-media?comic=:id (pages with populated images)   │
│   - GET /api/media/file/:filename (images)                              │
└─────────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. CMS (Existing)

The existing Payload CMS requires no modifications. The SSG fetches content via existing API endpoints:

- `GET /api/comic-with-chapters/:id` - Complete comic with chapters and pages
- `GET /api/pages-with-media?comic=:id` - Pages with fully populated media objects
- `GET /api/metadata` - Genres, tags, and other options

### 2. Cron Worker (New)

**File:** `src/workers/publish-cron.ts`

A Cloudflare Worker with Cron Trigger that handles scheduled publishing:

1. Runs every 5 minutes
2. Finds pages where `status='published'`, `publishedDate <= NOW()`, and `publishedDate > comic.lastBuiltAt`
3. Triggers GitHub Actions build for each affected comic
4. Updates `comic.lastBuiltAt` after successful trigger

The `lastBuiltAt` field on Comics prevents redundant rebuilds. A page only triggers a build once—when its `publishedDate` first crosses the threshold.

**Required secrets:**
- `GITHUB_TOKEN` - Personal access token with `repo` scope

See: `SAMPLE-CRON-WORKER.ts.example`

### 2b. afterChange Hook (New)

**File:** Add to `src/collections/Pages.ts` hooks

Triggers a rebuild when a creator edits a page that's already live (`status='published'` and `publishedDate <= NOW()`). This handles:
- Typo fixes
- Image replacements
- Author notes updates
- Any edit to already-visible content

See: `SAMPLE-AFTERCHANGE-HOOK.ts.example`

### 3. GitHub Repository (New)

A single repository containing 11ty templates shared by all comics. The build is parameterized via environment variables.

**Structure:**
```
chimera-comic-ssg/
├── .github/
│   └── workflows/
│       └── build-comic.yml      # Triggered by repository_dispatch
├── src/
│   ├── _data/
│   │   └── comic.js             # Fetches from CMS API using COMIC_SLUG
│   ├── _includes/
│   │   └── layouts/
│   │       ├── base.njk
│   │       ├── page.njk
│   │       └── archive.njk
│   ├── index.njk                # Comic homepage
│   ├── archive.njk              # Archive listing
│   └── pages.njk                # Generates /page/1/, /page/2/, etc.
├── .eleventy.js
├── package.json
└── scripts/
    └── upload-to-r2.js          # Post-build upload script
```

See: `SAMPLE-WORKFLOW.yml`, `SAMPLE-11TY-DATA.js.example`

### 4. R2 Bucket

Static sites are stored in R2 with the following structure:

```
/sites/
  {comic-slug}/
    index.html              # Comic homepage
    archive/
      index.html            # Archive listing
    about/
      index.html            # About the comic/creator
    page/
      1/index.html          # Individual pages
      2/index.html
      ...
    assets/
      style.css
      scripts.js
  _main/
    index.html              # Main site homepage
    directory/
      index.html            # Comic directory listing
```

Can use existing R2 bucket with `/sites/` prefix, or a dedicated bucket.

### 5. Serving Worker (New)

**File:** `src/workers/static-site.ts`

A Cloudflare Worker that serves `app.chimeracomics.org`:

1. Routes `/comics/{slug}/*` requests to R2 at `/sites/{slug}/*`
2. Handles index.html resolution (e.g., `/archive/` → `/archive/index.html`)
3. Sets appropriate caching headers
4. Returns 404 page for missing content
5. Routes `/` to main site at `/sites/_main/`

See: `SAMPLE-SERVING-WORKER.ts.example`

## Workflows

### Trigger 1: Content Edits (Immediate)

When a creator edits a page that's already live:

1. Creator saves changes to a page where `status='published'` and `publishedDate <= NOW()`
2. `afterChange` hook detects the edit to a live page
3. Hook calls GitHub Actions webhook
4. GitHub Actions builds the comic's static site
5. Built files upload to R2
6. Site is live within 2-3 minutes

### Trigger 2: Scheduled Publishing (Cron)

When a page's `publishedDate` crosses from future to past:

1. Creator sets `status: 'published'` and `publishedDate: <future date>`
2. Page is saved but not yet visible (publishedDate is in the future)
3. Cron Worker runs every 5 minutes
4. When `publishedDate` passes, Cron Worker finds pages where:
   - `status = 'published'`
   - `publishedDate <= NOW()`
   - `publishedDate > comic.lastBuiltAt` (not already built)
5. Cron triggers GitHub Actions build
6. Updates `comic.lastBuiltAt` to prevent redundant rebuilds
7. Site updates within 5-10 minutes of scheduled time

### New Comic Created

No special infrastructure setup required:

1. Creator creates comic in CMS
2. First time they publish a page, build is triggered
3. R2 prefix is created automatically on first upload
4. Serving Worker handles any `/comics/*` path dynamically

## Environment Variables

### Cron Worker
| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub PAT with `repo` scope |
| `GITHUB_REPO` | Repository name, e.g., `you/chimera-comic-ssg` |
| `CMS_API_URL` | CMS base URL, e.g., `https://api.chimeracomics.org` |

### GitHub Actions
| Variable | Description |
|----------|-------------|
| `CMS_API_URL` | CMS base URL |
| `CMS_API_TOKEN` | Optional API token for authenticated endpoints |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 access key |
| `R2_SECRET_ACCESS_KEY` | R2 secret key |
| `R2_BUCKET_NAME` | R2 bucket name |

### Serving Worker
| Variable | Description |
|----------|-------------|
| `R2_BUCKET` | R2 bucket binding |

## Portability

This architecture is designed for easy migration to a conventional VPS:

| Component | Cloudflare | VPS Equivalent |
|-----------|------------|----------------|
| CMS | Payload + D1 | Payload + Postgres |
| Media storage | R2 | MinIO or filesystem |
| Build trigger | Cron Worker | System cron job |
| Build execution | GitHub Actions | GitHub Actions or local script |
| Static storage | R2 | Filesystem |
| Serving | Worker | nginx |

Key portability features:
- **S3-compatible storage interface** - R2 uses same API as MinIO, Backblaze B2, AWS S3
- **Platform-agnostic builds** - 11ty runs anywhere Node.js runs
- **Simple serving layer** - Worker logic maps directly to nginx config
- **Independent components** - Each piece can be swapped without affecting others

## Resource Limits

### GitHub Actions (Free Tier)
- 2,000 minutes/month
- A typical build takes 1-2 minutes
- Supports ~1,000+ builds/month

### Cloudflare Workers (Free Tier)
- 100,000 requests/day
- 10ms CPU time per request (serving is well under this)
- Cron Triggers: up to 3 per Worker

### Cloudflare R2 (Free Tier)
- 10 GB storage
- 10 million Class A operations/month (writes)
- 1 million Class B operations/month (reads) - but reads via Workers are free

## Files in This Directory

- `ARCHITECTURE-PLAN.md` - This document
- `SAMPLE-WORKFLOW.yml` - GitHub Actions workflow
- `SAMPLE-CRON-WORKER.ts.example` - Scheduled publishing Worker (with lastBuiltAt tracking)
- `SAMPLE-AFTERCHANGE-HOOK.ts.example` - Content edit trigger hook
- `SAMPLE-SERVING-WORKER.ts.example` - Static site serving Worker
- `SAMPLE-11TY-DATA.js.example` - 11ty data file for CMS fetching
- `SAMPLE-UPLOAD-TO-R2.js.example` - Post-build R2 upload script

## Future Considerations

- **Status field simplification**: Currently `draft`/`scheduled`/`published`, planned to simplify to `draft`/`public` with `publishedDate` alone determining visibility on the live site
- **Creator preview**: Allow creators to preview scheduled pages before they go live
- **Build notifications**: Webhook or email notification on build success/failure
- **`lastBuiltAt` field**: Needs to be added to Comics collection for rebuild tracking
