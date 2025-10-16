# chimera-d1 Database Schema Documentation

**Created:** 2025-10-15
**Purpose:** Preserve knowledge of current working schema before data migration

## Overview

This database schema uses:
- **INTEGER primary keys** for internal Payload relationships
- **UUID text fields** for public-facing APIs
- **JSON fields** for complex nested data (thumbnails, etc.)
- **SQLite/D1** as the database engine

## Core Collections

### users
**Purpose:** User authentication and authorization

**Key Fields:**
- `id` (INTEGER, PK) - Internal ID
- `uuid` (TEXT, UNIQUE) - Public identifier
- `email` (TEXT, UNIQUE) - Login email
- `role` (TEXT) - 'admin' | 'editor' | 'creator' | 'reader'
- `hash`, `salt` - Password authentication
- `login_attempts`, `lock_until` - Security

**Why This Design:**
- INTEGER PK for Payload's internal relationship handling
- UUID for frontend API access (stable across migrations)
- Simplified schema (no creator_profile/reader_profile groups)

### comics
**Purpose:** Comic series metadata

**Key Fields:**
- `id` (INTEGER, PK)
- `uuid` (TEXT, UNIQUE)
- `title`, `slug` - Identification
- `author_id` (INTEGER, FK → users)
- `cover_image_id` (INTEGER, FK → media)
- `status` - 'draft' | 'published' | 'hiatus' | 'completed'
- `publish_schedule` - Publication frequency
- `is_n_s_f_w` (INTEGER/BOOLEAN)

**Related Tables:**
- `comics_credits` - Array of creator credits
- `comics_genres` - Array of genre tags
- `comics_texts` - Localization (if enabled)

**Why This Design:**
- Simple flat structure for core fields
- Array tables for complex nested data (credits, genres)
- Direct foreign keys for relationships

### chapters
**Purpose:** Organize pages into chapters

**Key Fields:**
- `id` (INTEGER, PK)
- `uuid` (TEXT, UNIQUE)
- `comic_id` (INTEGER, FK → comics)
- `title` - Chapter name
- `order` (INTEGER) - Sequential ordering
- `description` - Optional summary

**Nested Groups:**
- `seoMeta` - slug, metaTitle, metaDescription
- `stats` - pageCount, firstPageNumber, lastPageNumber

**Why This Design:**
- Order field for manual sequencing
- Stats calculated and cached for performance
- SEO fields grouped for organization

### pages
**Purpose:** Individual comic pages

**Key Fields:**
- `id` (INTEGER, PK)
- `uuid` (TEXT, UNIQUE)
- `comic_id` (INTEGER, FK → comics)
- `chapter_id` (INTEGER, FK → chapters, nullable)
- `chapter_page_number` (INTEGER) - Page within chapter
- `global_page_number` (INTEGER) - Page within entire comic
- `page_image_id` (INTEGER, FK → media)
- `thumbnail_image_id` (INTEGER, FK → media)
- `alt_text` - Accessibility
- `status` - 'draft' | 'scheduled' | 'published'

**Related Tables:**
- `pages_page_extra_images` - Additional images for multi-image pages

**Nested Groups:**
- `navigation` - previousPage, nextPage, isFirstPage, isLastPage
- `seoMeta` - slug, metaTitle, metaDescription
- `stats` - viewCount, firstViewed, lastViewed

**Why This Design:**
- Dual numbering (chapter + global) for flexibility
- Navigation fields for quick traversal
- Optional chapter (allows chapter-less pages)

### media
**Purpose:** Image storage and metadata

**Key Fields:**
- `id` (INTEGER, PK)
- `uuid` (TEXT, UNIQUE)
- `filename`, `mime_type`, `filesize` - File info
- `url`, `thumbnail_u_r_l` - R2 URLs
- `width`, `height` - Dimensions
- `image_sizes` (TEXT/JSON) - Generated thumbnails metadata
- `media_type` - 'general' | 'comic_page' | 'comic_cover' | etc.
- `uploaded_by_id` (INTEGER, FK → users)
- `is_public` (INTEGER/BOOLEAN)

**Nested Groups:**
- `comicMeta` - relatedComic, isNSFW

**Why This Design:**
- `image_sizes` as JSON to avoid D1's 100-parameter limit
- Stores metadata only; actual files in R2
- `media_type` for filtering/organizing

## Thumbnail System

### Storage Structure
**R2 Bucket:** `chimera-d1`
**Original files:** `media/{filename}`
**Thumbnails:** `media/{filename}-{size_name}.{ext}`

### Thumbnail Sizes
Defined in `src/lib/thumbnailConfig.ts`:
1. **thumbnail** - 400px wide (general use)
2. **thumbnail_small** - 200px wide (list views)
3. **webcomic_page** - 800px wide (desktop reading)
4. **webcomic_mobile** - 400px wide (mobile reading)
5. **cover_image** - 600x800 (comic covers)
6. **social_preview** - 1200x630 (social media)
7. **avatar** - 200x200 crop (user avatars)

### Thumbnail Metadata Format
Stored in `media.image_sizes` as JSON:
```json
[
  {
    "name": "thumbnail",
    "width": 400,
    "height": 657,
    "url": "/api/media/thumbnail/issue-3-page-10-thumbnail.jpg",
    "mimeType": "image/jpeg",
    "filesize": 322852,
    "filename": "issue-3-page-10-thumbnail.jpg"
  },
  ...
]
```

### Thumbnail Serving
**Custom API Route:** `/api/media/thumbnail/[filename]/route.ts`
- Fetches from R2 using global Cloudflare context
- Sets proper content-type and cache headers
- Returns 404 if thumbnail not found

## Supporting Tables

### payload_migrations
Tracks applied database migrations

### payload_locked_documents
Document locking for concurrent editing

### payload_preferences
User-specific UI preferences

### payload_locked_documents_rels
Relationships for locked documents

### payload_preferences_rels
Relationships for preferences

## Key Design Decisions

### 1. Hybrid ID System
- **INTEGER primary keys**: Required by Payload's relationship system
- **UUID fields**: Stable public identifiers for APIs
- **Why:** Allows flexibility in API design without breaking internal relationships

### 2. JSON for Complex Data
- **Where used:** `media.image_sizes`, nested array fields
- **Why:** Avoids D1's 100-parameter limit, simplifies queries

### 3. Flat vs. Nested Structure
- **Flat:** Core fields (id, title, etc.)
- **Nested groups:** Related fields (seoMeta, stats, navigation)
- **Why:** Balance between organization and query simplicity

### 4. Direct Foreign Keys
- All relationships use INTEGER foreign keys
- No polymorphic relationships (simpler queries)
- **Why:** Better performance, easier to understand

### 5. Timestamps
- All tables have `updated_at`, `created_at`
- Automatic via SQLite `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`
- **Why:** Audit trail, sorting, change tracking

## Migration Considerations

### Safe to Change:
- Field defaults
- Index additions
- New optional fields
- Group/nested field structure (cosmetic)

### Dangerous to Change:
- Primary key types (INTEGER required)
- Foreign key field names
- Removing fields with data
- UUID field (breaks public APIs)

### If Migration Fails:
1. Schema can be recreated by running: `pnpm payload migrate`
2. Collections are defined in: `src/collections/*.ts`
3. This documentation preserves the "why" behind design decisions

## Restoration Steps

If you need to recreate this schema:

```bash
# 1. Reset database (caution: destructive!)
pnpm wrangler d1 execute chimera-d1 --local --command "DROP TABLE IF EXISTS users; DROP TABLE IF EXISTS comics; ..."

# 2. Run Payload migrations
pnpm payload migrate

# 3. Verify schema
pnpm wrangler d1 execute chimera-d1 --local --command "PRAGMA table_info(users);"

# 4. Re-import data if needed
pnpm tsx scripts/migrate-from-chimera-cms.ts
```

## Schema Export Commands

```bash
# Export full schema
pnpm wrangler d1 execute chimera-d1 --local --command "SELECT sql FROM sqlite_master WHERE type='table' ORDER BY name;" --json

# Export specific table schema
pnpm wrangler d1 execute chimera-d1 --local --command "PRAGMA table_info(users);" --json

# Export data counts
pnpm wrangler d1 execute chimera-d1 --local --command "SELECT 'users', COUNT(*) FROM users UNION ALL SELECT 'comics', COUNT(*) FROM comics;" --json
```

## Related Documentation

- **Thumbnail Implementation:** `src/collections/Media.ts:176-239`
- **Thumbnail Config:** `src/lib/thumbnailConfig.ts`
- **Thumbnail Serving:** `src/app/(payload)/api/media/thumbnail/[filename]/route.ts`
- **Collection Definitions:** `src/collections/*.ts`
- **Payload Config:** `src/payload.config.ts`

## Version History

- **2025-10-15:** Initial schema after successful Sharp+Jimp thumbnail implementation
- **2025-10-04:** UUID hybrid approach implemented
- **2025-10-01:** Initial D1 migration from PostgreSQL

---

**Purpose of This Document:**
If data migration fails and corrupts the database, this document preserves:
1. The exact schema structure that worked
2. The reasoning behind each design decision
3. Steps to recreate the schema
4. Knowledge of how all parts connect

This allows you to start fresh without losing months of architectural knowledge.
