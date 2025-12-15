# API Specification Updates - December 2024

## Update: 2025-12-15 - Genres and Tags Collections Migration

**Updated for:** Genres and tags promoted to full collections

### Summary

Genres and tags have been migrated from embedded array fields to their own dedicated collections. The `/api/metadata` endpoint now returns dynamic data from these collections with **integer IDs** instead of static string values.

### Breaking Changes

**1. Comics data structure changed:**

**Before:**
```json
{
  "genres": [
    { "genre": "adventure" },
    { "genre": "comedy" }
  ],
  "tags": [
    { "tag": "webcomic" },
    { "tag": "lgbtq" }
  ]
}
```

**After:**
```json
{
  "genres": [1, 2],  // Integer IDs (or full objects with depth > 0)
  "tags": [3, 4]     // Integer IDs (or full objects with depth > 0)
}
```

**2. Metadata endpoint values changed:**

**Before:**
```json
{
  "genres": [
    { "label": "Action-Adventure", "value": "action-adventure" }
  ]
}
```

**After:**
```json
{
  "genres": [
    { "label": "Action", "value": 1 }
  ],
  "tags": [
    { "label": "LGBTQ+", "value": 1 }
  ]
}
```

### New Collections

Two new collections are now available via the API:

- `GET /api/genres` - List all genres
- `GET /api/tags` - List all tags

Both collections support CRUD operations with the following permissions:
- **Read**: Public (everyone can read)
- **Create/Update**: Admin and Editor only
- **Delete**: Admin only

### Frontend Impact

**Reading comics:**
```javascript
// Old - embedded arrays
const genreNames = comic.genres.map(g => g.genre)

// New - use depth parameter to get full objects
const comic = await fetch('/api/comics/1?depth=1')
const genreNames = comic.genres.map(g => g.name)
```

**Writing comics:**
```javascript
// Old - embedded arrays
await updateComic({
  genres: [{ genre: 'adventure' }, { genre: 'comedy' }]
})

// New - pass integer IDs
await updateComic({
  genres: [1, 2]  // Genre IDs from /api/metadata or /api/genres
})
```

**Using metadata for dropdowns:**
```javascript
// Old - string values
const genreOptions = metadata.genres  // [{ label: "Action", value: "action" }]
const selectedGenres = ['action', 'comedy']

// New - integer IDs
const genreOptions = metadata.genres  // [{ label: "Action", value: 1 }]
const selectedGenres = [1, 2]  // Integer IDs
```

### Documentation Updated

1. **Comics Data Structure** - Updated to show `hasMany` relationship format with integer IDs
2. **Metadata Endpoint** - Updated to show dynamic genres/tags with integer IDs
3. **New Sections** - Added Genres and Tags collection documentation

---

## Update: 2025-12-04 - Genres/Tags Array Field Migration

**Updated for:** hasMany field conversion to array fields

### Summary

Converted `genres` and `tags` fields from broken `hasMany: true` format to working `type: 'array'` format with nested fields.

### Breaking Change

**Data structure changed:**

**Before (hasMany):**
```json
{
  "genres": ["adventure", "comedy"],
  "tags": ["webcomic", "lgbtq"]
}
```

**After (array):**
```json
{
  "genres": [
    { "genre": "adventure" },
    { "genre": "comedy" }
  ],
  "tags": [
    { "tag": "webcomic" },
    { "tag": "lgbtq" }
  ]
}
```

### Frontend Impact

**Reading:**
```javascript
// Old
const genreList = comic.genres  // ['adventure', 'comedy']

// New
const genreList = comic.genres.map(g => g.genre)  // ['adventure', 'comedy']
```

**Writing:**
```javascript
// Old
await updateComic({ genres: ['adventure', 'comedy'] })

// New
await updateComic({
  genres: ['adventure', 'comedy'].map(g => ({ genre: g }))
})
```

### Reason for Change

The `hasMany: true` option is broken in the D1 adapter:
- Causes duplicate values on every save
- Returns empty arrays via API even when data exists
- Database schema mismatches

Array fields work correctly and use the same storage pattern as other working fields (like `credits`).

---

## Update: 2025-12-02 - DELETE Bug Resolution

**Updated for:** Payload v3.65.0

### Summary

Updated `docs/api-specification.md` to reflect the resolution of the DELETE bug and removal of workaround endpoints.

## Major Changes

### 1. DELETE Operations Now Work ✅

**Before:**
- `DELETE /api/pages/:id` - ❌ BROKEN
- `DELETE /api/delete-page/:id` - Required workaround endpoint

**After:**
- `DELETE /api/pages/:id` - ✅ Works correctly
- `/api/delete-page/:id` - Removed (no longer needed)

### 2. Updated Version Info

**Before:**
```
Current Version: December 2024 (D1 Adapter with Workarounds)
```

**After:**
```
Current Version: December 2024 (Payload v3.65.0)
```

### 3. Removed Workaround Endpoint Documentation

**Removed section:** "Page Deletion" custom endpoint
- No longer needed with Drizzle ORM v0.44.7
- Standard Payload DELETE endpoints work properly

### 4. Updated Known Issues Section

**Before:**
- Listed DELETE as broken
- Required custom workaround endpoints

**After:**
- Marked DELETE as ✅ FIXED in v3.65.0
- Confirmed all DELETE endpoints now working
- Updated impact statements

### 5. Updated Migration Notes

**Added:**
- v3.65.0 upgrade information
- DELETE bug resolution
- Removed reference to custom delete endpoint

### 6. Corrected Comic Status Values

**Fixed:**
- Changed `"draft|published|hiatus|completed"` to `"draft|live|hiatus|completed"`
- Updated metadata example to match actual implementation

## Sections Updated

1. **Line 7:** Version header
2. **Lines 155-157:** Pages endpoints (removed broken DELETE references)
3. **Lines 319-354:** Removed "Page Deletion" workaround section
4. **Lines 731-741:** Updated "Known Issues" with resolution
5. **Lines 805-815:** Updated migration notes with v3.65.0 info
6. **Lines 787-801:** Updated "Alternative Endpoints" section
7. **Line 137:** Fixed comic status values
8. **Lines 418-423:** Fixed comic status metadata example

## What's Still Documented

### Remaining D1 Limitations

The following limitations are still active and documented:

1. **R2 Storage Plugin Limitations**
   - Manual R2 uploads required for programmatic operations
   - Storage plugin only works with admin UI

2. **String ID Normalization**
   - `normalizeRelationshipId` hooks still required
   - D1 adapter requires integer IDs

3. **Access Control Query Limitations**
   - Nested queries don't work
   - Workarounds using manual fetching still needed

4. **Schema Migration Risks**
   - `push: false` still required
   - Manual migrations only
   - Default value changes still dangerous

### Working Workarounds

These custom endpoints remain useful but are optional:

- `GET /api/comic-with-chapters/:id` - Convenience aggregation
- `GET /api/chapters-by-comic/:comicId` - Convenience wrapper
- `GET /api/pages-by-comic/:comicId` - Convenience wrapper
- `POST /api/bulk-create-pages` - Batch processing
- `POST /api/reorder-chapters` - Bulk reordering
- `GET /api/metadata` - Static configuration

## Impact on Frontend

### Breaking Changes: None

The upgrade is backward compatible. If your frontend was using the workaround endpoint:

**Before:**
```javascript
await fetch(`/api/delete-page/${pageId}`, { method: 'DELETE' })
```

**After (both work):**
```javascript
// Standard Payload endpoint now works
await fetch(`/api/pages/${pageId}`, { method: 'DELETE' })

// Or continue using old endpoint pattern (will 404, need to update)
```

### Recommended Action

Update frontend delete calls to use standard Payload endpoints:
- `DELETE /api/pages/:id`
- `DELETE /api/comics/:id`
- `DELETE /api/chapters/:id`
- `DELETE /api/media/:id`

## Testing Checklist

- [x] DELETE operations verified working (test script confirms)
- [x] Documentation updated
- [x] Workaround endpoint removed
- [x] Code comments updated
- [ ] Frontend updated to use standard endpoints
- [ ] Integration tests updated
- [ ] Production deployment tested

## References

- Upgrade document: `docs/UPGRADE-TO-v3.65.0.md`
- DELETE bug analysis: `docs/d1-delete-bug-analysis.md`
- API specification: `docs/api-specification.md`

---

**Updated:** 2025-12-02
**Status:** ✅ Complete
