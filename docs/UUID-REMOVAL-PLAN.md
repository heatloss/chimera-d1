# UUID Removal Plan

**Date**: 2025-11-16
**Status**: Planning
**Branch**: Currently on `uuids-layer`
**Target**: Return to integer-only IDs across all collections

---

## Background

After extensive testing, we've determined that:

1. **UUID Primary Keys Don't Work**: The authentication bug from October 2025 where POST operations fail with UUID user IDs in Cloudflare Workers is NOT fixed in the current stack (Payload 3.59.1 + Next.js 15.4.4)

2. **Cannot Mix ID Types**: The D1 adapter's `idType` configuration is global and applies to ALL collections. You cannot have some collections with integer IDs and others with UUID IDs.

3. **Hybrid Approach Has No Value**: The current "hybrid" approach (integer primary keys + secondary UUID fields) creates frontend complexity without providing security benefits, since integer IDs remain exposed for native Payload endpoints.

## Decision

Return to pure integer IDs across all collections and remove the UUID secondary fields.

---

## Custom API Endpoints Analysis

### Endpoints to DELETE (4)

These endpoints ONLY provide UUID-based lookup and have no other value:

#### 1. `/api/get-comic/[uuid]`
- **Purpose**: Queries comics by UUID instead of integer ID
- **Replacement**: Use native Payload API `/api/comics/:id`
- **File**: `src/app/api/get-comic/[uuid]/route.ts`

#### 2. `/api/get-chapter/[uuid]`
- **Purpose**: Queries chapters by UUID instead of integer ID
- **Replacement**: Use native Payload API `/api/chapters/:id`
- **File**: `src/app/api/get-chapter/[uuid]/route.ts`

#### 3. `/api/get-page/[uuid]`
- **Purpose**: Queries pages by UUID instead of integer ID
- **Replacement**: Use native Payload API `/api/pages/:id`
- **File**: `src/app/api/get-page/[uuid]/route.ts`

#### 4. `/api/get-media/[uuid]`
- **Purpose**: Queries media by UUID instead of integer ID
- **Replacement**: Use native Payload API `/api/media/:id`
- **File**: `src/app/api/get-media/[uuid]/route.ts`

### Endpoints to KEEP & MODIFY (2)

These endpoints provide genuine performance and functionality benefits beyond UUID lookup:

#### 5. `/api/comic-with-chapters/[comicId]` - KEEP
- **Value**: Aggregates comic + chapters + pages in ONE request (reduces round trips)
- **Performance benefit**: Saves multiple API calls from frontend
- **Why keep**: **HIGH VALUE** - Data aggregation provides significant performance improvement
- **Modifications needed**:
  - Remove UUID detection logic (lines 29-68)
  - Accept only integer IDs
  - Simplify to always use `payload.findByID()`
- **Usage**: `GET /api/comic-with-chapters/123` (integer ID)
- **File**: `src/app/api/comic-with-chapters/[comicId]/route.ts`

#### 6. `/api/reorder-chapters` - KEEP
- **Value**: Custom business logic for reordering with permission checks
- **Not available** in native Payload API
- **Why keep**: **HIGH VALUE** - Atomic updates, custom authorization, business logic encapsulation
- **Modifications needed**:
  - Remove UUID detection logic (lines 47-67)
  - Accept only integer IDs
  - Use `payload.findByID()` directly
- **Usage**: `POST /api/reorder-chapters { comicId: 123, chapterIds: [1, 2, 3] }`
- **File**: `src/app/api/reorder-chapters/route.ts`

### Endpoint to NOT Create

#### ~~`/api/comic-chapters/[comicId]`~~ - DO NOT CREATE
- **Original purpose**: Gets all chapters for a comic
- **Why not needed**: **LOW VALUE** - Native filtered endpoint works fine and is more flexible
- **Use instead**: `GET /api/chapters?where[comic][equals]=123&sort=order`
- **Analysis**:
  - The custom endpoint only provides cleaner URLs and guaranteed sort order
  - Native endpoint is more flexible (can add pagination, depth, additional filters)
  - Less code to maintain
  - The performance difference is negligible (same underlying query)

---

## Implementation Strategy

### Recommended Approach: Clean Branch from Main

Start with a clean branch off `main` and add only the 2 high-value endpoints, rather than pruning the `uuids-layer` branch.

**Why this approach?**

1. **Main branch is cleaner** - Only has UUID fields in collection schemas, no custom endpoints to untangle
2. **Simpler mental model** - Build up from working production code with targeted additions, rather than tearing down 7 endpoints
3. **Easier to review** - Git diff clearly shows "2 new endpoints added" rather than "4 deleted, 2 modified, 1 not created"
4. **Less risk** - Building up from known-good code rather than hoping you caught all UUID dependencies during deletion
5. **UUID fields exist on main** - The hybrid approach UUID fields are already there, so removal is the same either way

**Why not prune uuids-layer?**

The `uuids-layer` branch has:
- 7 endpoints (need to delete 4, modify 2, skip 1)
- UUID logic scattered throughout all endpoints
- Higher risk of "did I catch everything?" errors
- Harder to verify complete removal of UUID dependencies

**Better approach**: Copy the aggregation logic from the 2 high-value endpoints to a clean branch, stripping UUID support as you go.

### Quick Start

```bash
# Start from main
git checkout main
git pull origin main
git checkout -b remove-uuids

# Now follow the implementation steps below
```

---

## Implementation Steps

### 1. Collection Schema Changes

Remove UUID fields from all collections:

#### Users Collection (`src/collections/Users.ts`)
- Remove the `uuid` field (currently at lines where it appears)
- Keep integer `id` as primary key

#### Media Collection (`src/collections/Media.ts`)
- Remove the `uuid` field
- Keep integer `id` as primary key

#### Comics Collection (`src/collections/Comics.ts`)
- Remove the `uuid` field
- Keep integer `id` as primary key

#### Chapters Collection (`src/collections/Chapters.ts`)
- Remove the `uuid` field
- Keep integer `id` as primary key

#### Pages Collection (`src/collections/Pages.ts`)
- Remove the `uuid` field
- Keep integer `id` as primary key

### 2. Configuration Changes

#### `payload.config.ts`
- Verify `idType` is NOT set to `'text'` (or remove the setting entirely to use default integer)
- Keep `allowIDOnCreate: false` (default)
- Update/remove any comments referencing UUID workarounds

### 3. API Endpoint Changes

Since you're starting from `main` (which has no custom endpoints), you'll copy the 2 high-value endpoints from `uuids-layer` and strip out UUID logic.

**Tip**: To copy files from another branch without switching:
```bash
# Or checkout the entire directory structure
mkdir -p src/app/api
git checkout uuids-layer -- src/app/api/comic-with-chapters
git checkout uuids-layer -- src/app/api/reorder-chapters

# Then modify the files as described below
```

#### Create `/api/comic-with-chapters/[comicId]/route.ts`:

Copy from `uuids-layer` branch and modify:
```typescript
// REMOVE lines 29-68 (UUID detection and query logic)
// REPLACE with:
const comic = await payload.findByID({
  collection: 'comics',
  id: comicId,
  depth: 1
})

if (!comic) {
  return NextResponse.json(
    { error: 'Comic not found' },
    { status: 404, headers: getCorsHeaders() }
  )
}
```

#### Create `/api/reorder-chapters/route.ts`:

Copy from `uuids-layer` branch and modify:
```typescript
// REMOVE lines 47-67 (UUID detection logic)
// REPLACE with:
const comic = await payload.findByID({
  collection: 'comics',
  id: comicId,
  depth: 0
})

if (!comic) {
  return NextResponse.json(
    { error: 'Comic not found' },
    { status: 404, headers: getCorsHeaders() }
  )
}
```

### 4. Database Migration

Generate a new migration to remove UUID columns:

```bash
# Generate migration
pnpm payload migrate:create

# Review the generated migration in src/migrations/
# It should contain:
# - ALTER TABLE statements to DROP uuid columns from all collections
# - DROP INDEX statements for uuid indexes

# Apply migration to production
pnpm run deploy:database
```

### 5. Frontend Updates

Update any frontend code that references UUIDs:

- Search for UUID field references
- Replace with integer ID references
- Update API calls from custom endpoints to either:
  - Native Payload endpoints (`/api/comics/:id`)
  - Simplified custom endpoints (`/api/comic-with-chapters/:id`)

### 6. Documentation Cleanup

- Remove or update `WORKAROUND-UUID.md` if it exists
- Update any API documentation
- Update README if it references UUID approach

---

## Testing Checklist

After implementation:

- [ ] Admin panel loads successfully
- [ ] Can create new records in all collections
- [ ] Can edit existing records
- [ ] Can delete records
- [ ] Authentication works (login/logout)
- [ ] Media upload works
- [ ] Custom endpoints work:
  - [ ] `/api/comic-with-chapters/:id` (aggregation)
  - [ ] `/api/reorder-chapters` (POST with authorization)
- [ ] Native filtered queries work:
  - [ ] `/api/chapters?where[comic][equals]=123&sort=order`
- [ ] Build succeeds without TypeScript errors
- [ ] Deployment to Cloudflare Workers succeeds
- [ ] Remote site functions correctly

---

## Rollback Plan

If issues arise:

1. **Database**: Keep a backup of the current production database before applying the migration
2. **Code**: The `uuids-layer` branch contains the hybrid UUID approach and can be restored if needed
3. **Migration**: Create a rollback migration that re-adds UUID columns and populates them

---

## Notes

- The two kept endpoints (`comic-with-chapters`, `reorder-chapters`) provide legitimate performance and functionality benefits unrelated to UUID hiding:
  - `comic-with-chapters`: Data aggregation reduces multiple API calls to one
  - `reorder-chapters`: Custom authorization and atomic updates
- The `comic-chapters` endpoint was NOT created because native filtered queries (`/api/chapters?where[comic][equals]=123&sort=order`) provide the same functionality with more flexibility
- Integer IDs will be exposed on the frontend, but this is acceptable for this use case
- This change simplifies the codebase significantly and removes the frontend overhead of tracking both ID types
