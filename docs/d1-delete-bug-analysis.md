# D1 Adapter DELETE Bug Analysis

**Date:** 2025-12-02
**Status:** ✅ RESOLVED - Fixed in Payload v3.65.0 (drizzle-orm@0.44.7)

## Summary

~~The Payload CMS D1 adapter has a critical bug where DELETE operations return success but **do not actually remove records from the database**. This is not a soft-delete feature - it's a data integrity bug.~~

**UPDATE:** This bug was caused by Drizzle ORM v0.44.6 and is **fixed in v0.44.7**. Payload v3.65.0 includes this fix.

## Resolution

**Root Cause:** Drizzle ORM v0.44.6 had a bug with "durable sqlite transaction return value" that caused DELETE operations to appear successful but not actually commit.

**Fix:** Upgrade to:
- **Payload v3.65.0 or later** (includes drizzle-orm@0.44.7)
- Or manually override to `drizzle-orm@0.44.7` in package.json

**Verified:** DELETE operations now correctly remove records from D1 database.

## What We Know

### 1. No Soft Delete Implementation

**Evidence:**
- Examined database schema - no `_deleted`, `deleted_at`, or similar columns exist
- Checked all tables: `pages`, `comics`, `chapters`, `media`, `users`
- Ran: `PRAGMA table_info(pages)` - no delete tracking columns found

```sql
-- pages table has NO soft delete columns
CREATE TABLE `pages` (
  `id` integer PRIMARY KEY NOT NULL,
  `comic_id` integer NOT NULL,
  -- ... other columns ...
  `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  -- NO deleted_at, _deleted, or similar columns
)
```

### 2. DELETE API Calls Succeed But Don't Delete

**Observed behavior:**
1. Call `DELETE /api/pages/:id` via Payload REST API
2. API returns `200 OK` with success message
3. Record remains in database unchanged
4. Subsequent GET requests still return the "deleted" record

**Workaround created:** `src/app/api/delete-page/[id]/route.ts`
- Uses raw SQL: `DELETE FROM pages WHERE id = ?`
- This successfully removes records
- Proves that D1 itself supports DELETE operations correctly

### 3. Code Path Analysis

**Payload's delete flow:**
```
REST API DELETE
  ↓
deleteOne() - @payloadcms/drizzle/dist/deleteOne.js:8
  ↓
deleteWhere() - @payloadcms/drizzle/dist/sqlite/deleteWhere.js:1
  ↓
db.delete(table).where(where) - Drizzle ORM
  ↓
??? (Something fails here)
```

**From `deleteOne.js` (lines 56-60):**
```javascript
await this.deleteWhere({
  db,
  tableName,
  where: eq(this.tables[tableName].id, docToDelete.id)
});
```

**From `deleteWhere.js` (lines 1-4):**
```javascript
export const deleteWhere = async function({ db, tableName, where }) {
  const table = this.tables[tableName];
  await db.delete(table).where(where);
};
```

This code looks correct - it calls Drizzle's standard `delete()` method.

### 4. Ruling Out Soft Delete Theory

**Original hypothesis in code comments (Pages.ts:590-592):**
```typescript
// DISABLED: afterOperation hook causes issues with D1 adapter's soft delete implementation
// The D1 adapter converts DELETE operations to UPDATE operations (soft delete),
// which triggers this hook and causes UNIQUE constraint errors when updating comic stats
```

**Why this is likely incorrect:**
1. No soft delete columns exist in schema
2. No UPDATE queries are visible (would need query logging to confirm)
3. D1 adapter source code shows standard `db.delete()` calls
4. Payload CMS documentation doesn't mention soft deletes for SQLite/D1

**More likely explanation:**
The afterOperation hook was causing issues, but not because of soft deletes. More likely:
- The hook was running on DELETE operations
- It tried to update related records (comic stats)
- This caused some kind of race condition or constraint error
- Disabling the hook was the right fix, but the "soft delete" explanation was speculative

## What We Don't Know

### Missing Information

1. **What SQL is actually executed?**
   - Need query logging enabled
   - Drizzle may be generating invalid SQL for D1
   - Or D1 may be silently failing to execute DELETE

2. **Are there any error messages?**
   - Check browser console when deleting via admin UI
   - Check server logs during DELETE operations
   - D1 may be returning errors that are being swallowed

3. **Does this affect all collections or just some?**
   - Test with simpler collections (users, media)
   - Pages collection has complex relationships - might be related

4. **Is this a D1 limitation or a Drizzle ORM bug?**
   - Drizzle ORM may not be compatible with D1's DELETE syntax
   - D1 may have restrictions on DELETE with foreign keys
   - Need to test raw Drizzle ORM operations outside Payload

## Possible Root Causes

### Theory 1: Drizzle ORM + D1 Incompatibility
Drizzle ORM may generate DELETE SQL that doesn't work with Cloudflare D1's SQLite implementation.

**How to test:**
```typescript
import { drizzle } from 'drizzle-orm/d1'
const db = drizzle(env.D1)
const result = await db.delete(pagesTable).where(eq(pagesTable.id, testId))
console.log('Drizzle delete result:', result)
// Then check if record actually deleted
```

### Theory 2: D1 Transaction Issues
DELETE operations may be inside transactions that aren't being committed properly.

**Evidence needed:**
- Check if `commitTransaction` is being called
- Look for transaction rollbacks in logs
- Test DELETE operations with autocommit

### Theory 3: Foreign Key Constraint Behavior
D1 may be silently failing DELETE operations due to foreign key constraints.

**But this doesn't fully explain it because:**
- Pages have `ON DELETE SET NULL` constraints
- This should allow deletion with cascade behavior
- Raw SQL DELETE works fine (proves constraints aren't blocking)

### Theory 4: Drizzle Batch/Prepared Statement Bug
The D1 binding may have issues with how Drizzle sends DELETE queries.

**Supporting evidence:**
- Raw SQL works: `db.drizzle.run('DELETE FROM pages WHERE id = ?', [id])`
- Drizzle ORM doesn't: `db.delete(table).where(eq(table.id, id))`
- This suggests the issue is in how Drizzle formats the query

## Reproduction Steps

### Using Payload Admin UI
1. Navigate to Pages collection
2. Click "Delete" on any page
3. Confirm deletion
4. Page disappears from UI
5. Refresh page - deleted page reappears
6. Check D1 database - record still exists

### Using REST API
```bash
# Create test page
curl -X POST http://localhost:3333/api/pages \
  -H "Content-Type: application/json" \
  -d '{"comic": 1, "chapter": 1, "chapterPageNumber": 999, "title": "TEST", "status": "draft"}'

# Returns: {"doc": {"id": 123, ...}}

# Delete page
curl -X DELETE http://localhost:3333/api/pages/123

# Returns: {"message": "Deleted successfully"}

# Check if still exists
curl http://localhost:3333/api/pages/123

# Returns: {"doc": {"id": 123, ...}} <-- Still there!

# Verify in database
pnpm wrangler d1 execute chimera-d1 --local \
  --command "SELECT id, title FROM pages WHERE id = 123"

# Result: Record still exists
```

## Current Workaround

**File:** `src/app/api/delete-page/[id]/route.ts`

**Implementation:**
```typescript
// Execute raw SQL DELETE
const result = await db.drizzle.run(
  `DELETE FROM pages WHERE id = ?`,
  [pageId]
)

// Also delete from related tables
await db.drizzle.run(
  `DELETE FROM pages_page_extra_images WHERE parent_id = ?`,
  [pageId]
)
```

**Limitations:**
- Bypasses Payload's hooks and access control
- Must manually delete from related tables
- Need separate endpoint for each collection
- Doesn't trigger cascade deletes properly

## Recommendations

### Immediate Actions

1. **Enable query logging**
   - Add Drizzle logger to see actual SQL
   - Check D1 execution results
   - Look for error messages being swallowed

2. **Test with simpler collections**
   - Try deleting from `media` or `users`
   - Determine if issue is relationship-specific

3. **Compare with PostgreSQL adapter**
   - Same Drizzle codebase
   - Does it work correctly with Postgres?
   - Isolates whether issue is D1-specific

### Long-term Solutions

1. **Report to Payload CMS**
   - File GitHub issue with reproduction steps
   - Include query logs and database schema
   - Reference this analysis document

2. **Consider alternative adapters**
   - PostgreSQL (Neon/Supabase) is more mature
   - Better ALTER TABLE support
   - More reliable for production

3. **Expand custom endpoints**
   - Create delete endpoints for all collections
   - Add proper access control and hooks
   - Ensure cascade deletes work correctly

## Related Issues

- **Changing default values breaks migrations** - Different bug, but shows D1 adapter immaturity
- **afterOperation hook disabled** - Was causing errors, possibly related to failed deletes
- **UUID/string IDs don't work** - Another D1 adapter limitation

## Testing Checklist

- [ ] Enable Drizzle query logging
- [ ] Capture actual SQL being executed
- [ ] Test DELETE on each collection type
- [ ] Check browser console for errors
- [ ] Review server logs during delete operations
- [ ] Test raw Drizzle operations outside Payload
- [ ] Compare behavior with PostgreSQL adapter
- [ ] Check D1 documentation for known limitations

## Upstream Issues Investigation

### Payload CMS Release Notes Review

**Current version:** `@payloadcms/db-d1-sqlite@3.64.0`

**Relevant findings:**
- v3.64.0: Fixed "turbopack error when using db-d1-sqlite package"
- v3.59.1: Reverted drizzle-orm to 0.44.2 due to "odd flakiness to the CI"
- v3.56.0: SQLite adapter fix for "convert Date to ISO 8601 string in queries"
- **No specific fixes for DELETE operations found in recent releases**

### Drizzle ORM Version & Issues

**Current version:** `drizzle-orm@0.44.6`

**Relevant findings:**
- v0.44.7 (one version ahead): "fix durable sqlite transaction return value" - **Potentially relevant!**
- v0.44.5: Fixed SQLite blob column issues

**Known D1-related issues:**
1. **[Issue #4089](https://github.com/drizzle-team/drizzle-orm/issues/4089)**: "Cloudflare D1 FOREIGN KEY constraint failed"
   - **Status:** Open (Priority label)
   - **Impact:** Foreign key constraints causing migration failures
   - **Quote:** "If tables have data and we generate new migrations they fail to execute"
   - **Workaround:** Use `PRAGMA defer_foreign_keys=ON`
   - **Note:** Drizzle team acknowledged, working on v1.0.0 fixes

2. Issue #3728: "drizzle-kit push not working" (Closed)
3. Issue #1617: ESLint confusion between KV delete and D1 delete (Closed)

### Potential Connection

The foreign key constraint issue (#4089) combined with the transaction return value fix in 0.44.7 suggests:

1. **Drizzle may be silently failing DELETE operations** when foreign keys are involved
2. **Transaction handling in 0.44.6 might not properly commit** DELETE operations
3. **Upgrading to drizzle-orm@0.44.7 or later could potentially fix the issue**

However, Payload v3.59.1 reverted Drizzle to 0.44.2 for stability, so Payload may be pinning to an older version intentionally.

## Next Steps to Confirm Root Cause

### 1. Test with Drizzle ORM 0.44.7+

Try upgrading Drizzle (if Payload allows):
```bash
# Check if possible without breaking Payload
pnpm why drizzle-orm
# Consider testing in isolated environment
```

### 2. Enable Foreign Key Debugging

Add to migration or connection setup:
```typescript
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=ON;
```

### 3. Report to Payload CMS

File issue with:
- Reference to Drizzle issue #4089
- Note about 0.44.7 transaction fix
- Request testing with newer Drizzle versions
- Include reproduction from this document

## References

- Payload CMS D1 adapter: `@payloadcms/db-d1-sqlite@3.64.0`
- Drizzle ORM version: `drizzle-orm@0.44.6`
- Drizzle D1 FK issue: https://github.com/drizzle-team/drizzle-orm/issues/4089
- Drizzle 0.44.7 release: https://github.com/drizzle-team/drizzle-orm/releases/tag/0.44.7
- Payload v3.59.1 revert: https://github.com/payloadcms/payload/issues/14108
- Cloudflare D1 docs: https://developers.cloudflare.com/d1/
- Custom delete endpoint: `src/app/api/delete-page/[id]/route.ts`

---

**Last Updated:** 2025-12-02
**Severity:** Critical - Data integrity issue
**Priority:** High - Blocks proper CRUD operations
**Likely Cause:** Drizzle ORM 0.44.6 transaction handling + D1 foreign key constraints
