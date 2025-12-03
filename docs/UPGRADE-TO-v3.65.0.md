# Upgrade to Payload v3.65.0

**Date:** 2025-12-02
**Upgrade:** v3.64.0 → v3.65.0

## Summary

Upgraded to Payload v3.65.0, which includes **Drizzle ORM v0.44.7** that fixes the critical DELETE bug.

## What Was Fixed

### DELETE Bug (Critical)

**Problem:** DELETE operations appeared successful but records remained in the database.

**Root Cause:** Drizzle ORM v0.44.6 had a bug with "durable sqlite transaction return value" causing DELETEs to not commit properly.

**Resolution:** Drizzle ORM v0.44.7 fixes the transaction handling. Payload v3.65.0 includes this fix.

**Verified:** Tested DELETE operations - records are now properly removed from D1.

## Changes Made

### Updated Packages

```json
{
  "@payloadcms/db-d1-sqlite": "3.64.0" → "3.65.0",
  "@payloadcms/next": "3.64.0" → "3.65.0",
  "@payloadcms/richtext-lexical": "3.64.0" → "3.65.0",
  "@payloadcms/storage-r2": "3.64.0" → "3.65.0",
  "@payloadcms/ui": "3.64.0" → "3.65.0",
  "payload": "3.64.0" → "3.65.0"
}
```

### Removed Override

Removed manual Drizzle ORM override from `package.json` since v3.65.0 includes 0.44.7 by default:

```json
// Removed:
"pnpm": {
  "overrides": {
    "drizzle-orm": "0.44.7" // ← No longer needed
  }
}
```

### Code Comments Updated

Updated incorrect "soft delete" comments in `src/collections/Pages.ts` to reflect actual cause.

## Additional Benefits

From Payload v3.65.0 release notes:

- **Up to 5000% faster permissions calculation**
- Improved error handling and transaction management
- Type-safe custom properties for collections
- Various UI and localization improvements

## Next Steps

### 1. Consider Re-enabling afterOperation Hook

The disabled `afterOperation` hook in `Pages.ts` (lines 593-614) was disabled due to DELETE issues. Now that DELETE works properly, you could:

**Option A:** Re-enable and test
- Uncomment the afterOperation hook
- Test DELETE operations thoroughly
- Verify comic stats update correctly

**Option B:** Leave disabled (safer)
- Keep it disabled for now
- Current workaround of manual stats updates is working
- Can re-enable later after more testing

### 2. Custom Delete Endpoint

The custom DELETE endpoint at `src/app/api/delete-page/[id]/route.ts` is **no longer necessary** but can be kept as a backup or removed:

**Keep it if:**
- You want additional validation logic
- You prefer explicit control over DELETE operations
- You want a backup in case the bug resurfaces

**Remove it if:**
- You trust Payload's built-in DELETE now
- You want cleaner codebase
- Standard CRUD operations are sufficient

### 3. Testing Checklist

Before deploying, test:

- [ ] Delete pages via admin UI
- [ ] Delete pages via REST API
- [ ] Verify records actually removed from D1
- [ ] Test cascade deletes (if any)
- [ ] Check relationship integrity after deletes
- [ ] Verify no regression in other CRUD operations

## References

- Payload v3.65.0 release: https://github.com/payloadcms/payload/releases/tag/v3.65.0
- Drizzle ORM v0.44.7 release: https://github.com/drizzle-team/drizzle-orm/releases/tag/0.44.7
- Analysis document: `docs/d1-delete-bug-analysis.md`
- Test script: `scripts/test-drizzle-delete.ts`

---

**Upgrade completed:** 2025-12-02
**Status:** ✅ Successful - DELETE bug resolved
