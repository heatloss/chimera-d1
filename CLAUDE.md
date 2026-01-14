# Chimera D1

Headless webcomic CMS built on Payload CMS v3, Next.js, Cloudflare D1 (SQLite), and Cloudflare R2 (object storage). Deployed to Cloudflare Workers.

## Content Hierarchy

```
Comic → Chapters → Pages
```

- **Comics**: Top-level series with metadata, genres, tags, credits
- **Chapters**: Organizational units within comics, ordered by `order` field
- **Pages**: Individual comic pages with `chapterPageNumber` (within chapter) and `globalPageNumber` (across comic, auto-calculated)

Slugs are unique per-comic, not globally.

## Key Locations

- `/src/collections/` - Payload collection definitions (Comics, Chapters, Pages, Media, Users, Genres, Tags)
- `/src/app/api/` - Custom API endpoints (reorder-chapters, reorder-pages, bulk-create-pages, etc.)
- `/src/lib/` - Utilities (thumbnail generation, R2 uploads)
- `/src/migrations/` - Drizzle ORM migrations for D1
- `/payload.config.ts` - Main Payload configuration
- `/wrangler.jsonc` - Cloudflare Workers config

## D1/Cloudflare Gotchas

### Lazy D1 Binding (Critical)
The database adapter uses a lazy binding pattern in `payload.config.ts`. This ensures fresh DB context per request in Workers. Without it, DELETE operations appear to succeed but don't actually delete. Don't simplify this pattern.

### hasMany Relationship Deduplication
D1 adapter has a bug where `hasMany` relationships accumulate duplicates on each save. Comics collection has an `afterChange` hook that deduplicates `genres`, `tags`, and `credits`. If adding new hasMany relationships or array fields, consider adding similar deduplication.

### Array Fields + Concurrent Updates (WORKAROUND IN PLACE)
The D1 adapter causes UNIQUE constraint failures when concurrent requests update a document with array fields. It does DELETE + INSERT with explicit IDs instead of UPSERT.

**Workaround:** `updateComicPageStatistics()` in `Pages.ts` uses raw D1 SQL to update only stats columns, bypassing Payload's update. See the detailed comment in the code and `docs/known-issues.md`.

**TODO:** Periodically check if Payload fixes this (issues #14766, #14748). When fixed, revert to `payload.update()`.

### Thumbnail Storage as JSON
Thumbnails are stored as JSON in the `thumbnails` field rather than as separate relationship records. This avoids D1's 100-parameter limit per query.

### Dual Thumbnail Runtime
- Development: Sharp (Node.js)
- Production: Photon WASM (Cloudflare Workers)

Both paths exist in `/src/lib/` and are selected based on environment.

## Common Tasks

### Adding a field to a collection
1. Add field to collection config in `/src/collections/`
2. Run `pnpm generate:types` to update TypeScript types
3. Create migration: `pnpm migrate:create`
4. Apply migration: `pnpm migrate`

### Running locally
```bash
pnpm dev          # Starts Next.js with Turbopack
```

### Deploying
```bash
pnpm build        # Build Next.js + OpenNext
pnpm deploy       # Deploy to Cloudflare Workers
```

## Access Control Model

Four roles: `admin`, `editor`, `creator`, `reader`
- Creators can only see/edit their own comics and related content
- Editors can see/edit all content
- Admins have full access including user management

## API Patterns

Custom endpoints use Next.js route handlers and access Payload via:
```typescript
const payload = await getPayload({ config: configPromise })
```

Authentication checked via `payload.auth({ headers })` for protected routes.
