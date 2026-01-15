# Known Issues & Gotchas

This document captures critical issues, limitations, and workarounds for the Payload CMS + Cloudflare D1 stack. **Read this before making schema changes or attempting major refactors.**

---

## Database Schema & Migrations

### ⚠️ CRITICAL: Changing Default Values Breaks Migrations

**Issue:** Changing the `defaultValue` of any field in a Payload collection triggers a catastrophic migration failure.

**What happens:**
1. Payload/Drizzle detects a "schema change" (even though default values don't affect the database schema)
2. Attempts to DROP and recreate the entire table
3. Foreign key constraints from related tables prevent the drop (e.g., `pages.comic_id` → `comics.id`)
4. Migration fails with: `NOT NULL constraint failed: pages.comic_id: SQLITE_CONSTRAINT`
5. Creates a stuck `__new_comics` table and `dev` migration record
6. Dev server cannot start until manually cleaned up

**Example that will break:**
```typescript
{
  name: 'status',
  type: 'select',
  defaultValue: 'draft', // Changing this to 'hidden' = CATASTROPHIC FAILURE
  options: [
    { label: 'Draft', value: 'draft' },
    { label: 'Hidden', value: 'hidden' },
  ]
}
```

**Workaround:**
- **Never change default values** - Keep the original default in the schema
- Add new options to the list without removing the default
- Frontend can use `/api/metadata` which returns whatever values you want
- If you absolutely need a different runtime default, use a `beforeChange` hook

**Manual cleanup if triggered:**
```bash
# Drop leftover migration table
pnpm wrangler d1 execute chimera-d1 --local --command "DROP TABLE IF EXISTS __new_comics;"

# Remove stuck migration record
pnpm wrangler d1 execute chimera-d1 --local --command "DELETE FROM payload_migrations WHERE name = 'dev';"

# Restart dev server
pnpm run dev
```

---

### ✅ What Schema Changes ARE Safe

**Adding new fields:** ✅ Works perfectly
```typescript
{
  name: 'newField',
  type: 'text',
  // Adding fields triggers automatic migration - this is safe!
}
```

**Removing fields:** ✅ Works if field has no data or all NULL values
- Empty/new fields can be removed without warnings
- Fields with data may trigger warnings (but usually succeed)

**Adding select options:** ✅ Always safe
```typescript
{
  name: 'status',
  defaultValue: 'draft', // Keep original!
  options: [
    { label: 'Draft', value: 'draft' },
    { label: 'New Option', value: 'new' }, // Adding is fine
  ]
}
```

**Removing select options:** ✅ Safe if not the default value
```typescript
{
  name: 'status',
  defaultValue: 'draft', // MUST keep this option!
  options: [
    { label: 'Draft', value: 'draft' }, // Required - this is the default
    // Removed 'published' - this is fine as long as it's not the default
  ]
}
```

**What to avoid:**
- ❌ Changing `defaultValue`
- ⚠️ Changing field types (untested, likely risky)
- ⚠️ Renaming fields (probably safe but untested)

---

### ❌ UUID/String IDs Don't Work

**Issue:** Payload CMS v3 with the D1 adapter only supports integer IDs. Attempts to use UUIDs or string IDs cause widespread failures.

**What we tried:**
- Changed `id` fields from INTEGER to TEXT with UUID generation
- Added custom ID hooks and field overrides
- Used hybrid approach (integer PKs + UUID fields)

**Results:**
- Migrations failed to apply
- Relationships broke (foreign keys returned null)
- POST operations failed silently
- Queries returned empty results

**Resolution:**
- ✅ Reverted to integer IDs (SQLite AUTOINCREMENT)
- ✅ This is the **only** supported ID type for Payload + D1
- ✅ Public-facing sites can still use slugs or UUIDs in URLs (independent of CMS IDs)

**Historical context:** See `docs/archive/MIGRATION_PROGRESS.md` for full details on the UUID removal effort.

---

### SQLite/D1 ALTER TABLE Limitations

**Background:** SQLite has very limited ALTER TABLE support compared to PostgreSQL or MySQL. Many schema changes require recreating the entire table.

**Why this matters:**
- Payload/Drizzle's migration strategy prefers table recreation
- Foreign key constraints make recreation impossible without CASCADE DELETE
- Our constraints use `ON DELETE SET NULL`, but columns are NOT NULL (contradiction!)
- This is why changing default values triggers the DROP TABLE cascade failure

**Implications:**
- Plan your schema carefully upfront
- Avoid frequent schema changes in production
- Consider manual SQL migrations for complex changes
- Test schema changes locally first

**Alternatives:**
- Use `push: false` in `payload.config.ts` to disable auto-migrations
- Write manual migrations using Drizzle or raw SQL
- Use Postgres instead of D1 for more flexible migrations

---

## Build & Deployment

### ⚠️ Turbopack Only Works Locally

**Issue:** Payload CMS claims full Turbopack support, but it only works in local development. Production builds fail with Turbopack enabled.

**Symptoms:**
- `pnpm run dev --turbopack` works perfectly locally
- `pnpm run build --turbopack` fails with bundling errors
- Cloudflare deployments fail if Turbopack is used for build

**Resolution:**
```json
// package.json
{
  "scripts": {
    "dev": "next dev --turbopack --port 3333",  // Turbopack for dev
    "build": "next build",                       // Webpack for prod (no --turbopack)
    "deploy": "pnpm run build && pnpm wrangler deploy"
  }
}
```

**Why:** Next.js 16's Turbopack is still in beta for production builds. Local dev works, but production bundling isn't stable yet.

---

### Build Configuration for Cloudflare

**Important:** When building for Cloudflare deployment, the wrangler configuration affects the build process.

**Current approach:**
- `wrangler.jsonc` has `remote: true` by default
- Build process works correctly with remote D1 reference
- No need to toggle `remote` between build and deploy anymore

**Previously required workaround (no longer needed):**
~~Set `remote: false` during build, then `remote: true` for deploy~~

---

## API & HTTP Quirks

### ~~WHERE Clause Bug~~ (FALSE ALARM - RESOLVED)

**Previous belief:** Payload REST API `where` clause queries hung indefinitely.

**Actual cause:** `curl` commands were hanging, but browser/frontend requests worked fine. This was a client-side issue, not a Payload bug.

**Status:** ✅ Standard Payload endpoints work correctly
```bash
# These work fine from browsers/frontends:
GET /api/chapters?where[comic][equals]=1
GET /api/pages?where[comic][equals]=1&sort=-globalPageNumber&limit=5
```

**Backup endpoints:** We created custom endpoints as workarounds:
- `/api/chapters-by-comic/:comicId`
- `/api/pages-by-comic/:comicId`

These can stay as convenience endpoints, but aren't technically necessary.

---

## Solutions & Workarounds

### Dynamic Metadata Endpoint

**Problem:** Need to keep dropdown options in sync between Payload collections and frontend.

**Solution:** Created `/api/metadata` that dynamically reads from Payload collection configs.

**Implementation:** `src/app/api/metadata/route.ts`

**Benefits:**
- Single source of truth (edit only in `src/collections/*.ts`)
- Automatically stays in sync
- No hardcoded duplication
- Works around the "can't change defaults" limitation

**Usage:**
```bash
GET /api/metadata

{
  "creditRoles": [...],
  "publishSchedules": [...],
  "genres": [...],
  "comicStatuses": [...],
  "pageStatuses": [...]
}
```

---

### Database Backup Before Schema Changes

**Best practice:** Always backup before any schema change:

```bash
# Backup local D1 database
cp .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite \
   .wrangler/state/v3/d1/miniflare-D1DatabaseObject/backup-$(date +%Y%m%d-%H%M%S).sqlite
```

**When to backup:**
- Before adding/removing fields
- Before attempting any default value change
- Before field type changes
- Before testing migrations

**Restore if needed:**
```bash
# List backups
ls -lh .wrangler/state/v3/d1/miniflare-D1DatabaseObject/backup-*.sqlite

# Restore (replace the hash with your actual database file)
cp .wrangler/state/v3/d1/miniflare-D1DatabaseObject/backup-YYYYMMDD-HHMMSS.sqlite \
   .wrangler/state/v3/d1/miniflare-D1DatabaseObject/71ea17b93de1684d034c11957d24f940ab865936bf90542392bf0517b4af1470.sqlite
```

---

## Development Recommendations

1. **Test schema changes incrementally**
   - Add one field at a time
   - Verify migration succeeds before adding more
   - Keep backups between changes

2. **Never change default values**
   - Keep original defaults in schema
   - Use hooks if runtime override needed
   - Frontend can use different values via `/api/metadata`

3. **Use integer IDs only**
   - Don't attempt UUIDs or string IDs
   - Use slugs in public-facing URLs if needed

4. **Keep backups**
   - Backup before every schema change
   - Keep several historical backups
   - Test restore process periodically

5. **Use Turbopack only locally**
   - Enable for `pnpm run dev`
   - Disable for `pnpm run build`

6. **Document edge cases**
   - Update this file when discovering new issues
   - Include reproduction steps
   - Document workarounds

---

## When to Consider Alternatives

If your project needs:
- ✋ UUID/string primary keys
- ✋ Frequent schema changes with default value modifications
- ✋ Complex ALTER TABLE operations
- ✋ More mature migration tooling

Consider using **PostgreSQL on Neon or Supabase** instead of D1.

**Tradeoffs:**

| Feature | D1 | Postgres |
|---------|-----|----------|
| ALTER TABLE support | ❌ Limited | ✅ Full |
| Payload migration stability | ⚠️ Buggy | ✅ Mature |
| UUID primary keys | ❌ Broken | ✅ Works |
| Edge distribution | ✅ Global | ❌ Regional |
| Cost | ✅ Free tier generous | ⚠️ Paid hosting |
| Deployment complexity | ✅ Simple | ⚠️ More complex |

---

## Summary: Safe vs Unsafe Operations

### ✅ Safe Operations
- Adding new fields
- Removing empty fields
- Adding select options
- Removing non-default select options
- Using integer IDs
- Standard CRUD operations
- WHERE clause queries from browsers

### ❌ Unsafe Operations
- Changing default values
- Using UUID/string IDs
- Complex schema refactors
- Building with Turbopack for production

### ⚠️ Untested/Unknown
- Changing field types
- Renaming fields
- Adding/removing foreign keys
- Changing field validation rules

---

## Additional Resources

- [Payload CMS Documentation](https://payloadcms.com/docs)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [SQLite ALTER TABLE Limitations](https://www.sqlite.org/lang_altertable.html)
- [Drizzle ORM Migrations](https://orm.drizzle.team/docs/migrations)

## Array Fields Cause UNIQUE Constraint Failures on Concurrent Updates

**Issue:** When multiple requests concurrently update a document with array fields (like `credits` on Comics), the D1 adapter causes UNIQUE constraint failures.

**Root cause:** The adapter handles array fields by DELETE + INSERT with explicit IDs, rather than using UPSERT. When concurrent updates occur:
1. Update A deletes all array rows, then inserts with IDs 1, 2, 3
2. Update B (running in parallel) tries to insert with the same IDs
3. Update B fails: `UNIQUE constraint failed: comics_credits.id`

**Symptoms:**
- `UNIQUE constraint failed: comics_credits.id: SQLITE_CONSTRAINT`
- Happens when multiple pages are saved simultaneously (each triggers comic stats update)
- First update succeeds, subsequent concurrent updates fail

**Workaround (implemented 2026-01-13):**
`updateComicPageStatistics()` in `src/collections/Pages.ts` uses raw D1 SQL to update only the stats columns, bypassing Payload's update mechanism entirely.

```typescript
// Instead of payload.update() which re-saves the entire document:
await d1.prepare(`
  UPDATE comics
  SET stats_total_pages = ?, stats_last_page_published = ?
  WHERE id = ?
`).bind(totalPages, lastPublished, comicId).run()
```

**Related GitHub issues:** #14766, #14748

**TODO:** Periodically check if Payload fixes the D1 adapter's array handling. When fixed, revert `updateComicPageStatistics()` to use `payload.update()`.

---

## hasMany Fields Don't Work

**Issue:** Payload CMS's `hasMany: true` option for select and text fields is broken in the D1 adapter.

**Symptoms:**
- Duplicate values accumulate on every save
- API returns empty arrays even when data exists in database
- Database queries fail with schema mismatches

**Resolution:**
Use `type: 'array'` with nested fields instead of `hasMany: true`:

```typescript
// ❌ DON'T USE (broken)
{
  name: 'genres',
  type: 'select',
  hasMany: true,
  options: [...]
}

// ✅ USE THIS (works correctly)
{
  name: 'genres',
  type: 'array',
  fields: [
    { name: 'genre', type: 'select', required: true, options: [...] }
  ]
}
```

**Data structure difference:**
- hasMany format: `['value1', 'value2']`
- Array format: `[{genre: 'value1'}, {genre: 'value2'}]`

Frontend code needs to adjust accordingly: `comic.genres.map(g => g.genre)`

---

## Ambiguous Column Name Bug with Nested Access Control

**Issue:** When using dot-notation access control (like `'comic.author': { equals: user.id }`) that creates a JOIN, and Payload's DataLoader batch-loads records, the generated SQL has an unqualified `id IN (...)` clause that's ambiguous when both tables have an `id` column.

**Error message:**
```
D1_ERROR: ambiguous column name: id at offset 219: SQLITE_ERROR
```

**Root cause:** The Drizzle D1 adapter doesn't qualify the `id` column with a table name when generating batch-load queries that also have JOINs from access control.

**Workaround (implemented 2026-01-14):**
Denormalize the field used in access control. For Pages, we added an `author` field that mirrors `comic.author`, allowing access control to use a direct field check instead of a JOIN:

```typescript
// ❌ DON'T USE - causes ambiguous column bug
return { 'comic.author': { equals: user.id } }

// ✅ USE THIS - no JOIN needed
return { author: { equals: user.id } }
```

The `author` field is auto-populated from `comic.author` in the beforeChange hook.

**Backfill endpoint:** `/api/backfill-page-authors` (POST, requires Editor/Admin)

**TODO:** Monitor Payload/Drizzle releases for a fix. When fixed, the denormalized `author` field can remain (it's also more efficient), but the workaround documentation can be updated.

---

## Future Enhancements

### Slug Validation Endpoint (UX Improvement)

**Context:** As of 2026-01-10, slugs for chapters and pages are now top-level fields with uniqueness validation within their parent comic. The validation happens server-side in `beforeValidate` hooks.

**Problem:** When a user manually edits a slug, they won't know if it conflicts with an existing slug until they hit Save and receive a server error. This is poor UX.

**Proposed Solution:** Create a lightweight validation endpoint:

```
GET /api/validate-slug?collection=pages&comic=1&slug=my-new-slug

Response:
{ "available": true }
// or
{ "available": false, "suggestion": "my-new-slug-2" }
```

**Frontend Integration:**
- Call on blur of the slug input field, OR
- Debounced (300-500ms) as user types
- Display inline validation feedback before form submission

**Implementation Notes:**
- Single indexed query per call (efficient)
- Minimal data exposure (just availability boolean)
- Same pattern as username/email availability checks
- Collections to support: `chapters`, `pages`
- Required params: `collection`, `comic` (parent ID), `slug`

**Files that would need changes:**
- New endpoint: `src/app/api/validate-slug/route.ts`
- Frontend: slug input components for chapters/pages

**Priority:** Low (current server-side validation works, just not ideal UX)

---

**Last Updated:** 2026-01-14
**Status:** Production-ready with documented limitations
