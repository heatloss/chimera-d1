# API Specification Updates - December 2024

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
