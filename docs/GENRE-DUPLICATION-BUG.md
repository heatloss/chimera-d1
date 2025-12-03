# Genre Duplication Bug

**Date:** 2025-12-02
**Status:** Confirmed bug in Payload v3.65.0 with D1 adapter
**Affected Field:** `comics.genres` (hasMany select field)

## Summary

The `genres` field on comics accumulates duplicate values on every save operation. This appears to be a bug in how Payload's D1 adapter handles `hasMany` select fields.

## Observed Behavior

### Symptom
Comic "A Second Test Comic" (ID: 3) has **63 duplicate entries** of "dystopian" in the database, suggesting the genre was added once per save operation without removing old values.

### Database Evidence

```sql
SELECT value, COUNT(*) as count
FROM comics_genres
WHERE parent_id = 3
GROUP BY value;

-- Result: 63 copies of "dystopian"
```

### API Behavior
When reading via Payload API, the `genres` field returns `[]` (empty array), even though 63 rows exist in `comics_genres` table.

This suggests **two separate bugs**:
1. **Write bug:** Duplicates are inserted instead of replaced
2. **Read bug:** Values aren't being read back correctly

## Root Cause Analysis

### hasMany Select Fields vs Array Fields

**Genres (BROKEN)** - Comics.ts:214-251:
```typescript
{
  name: 'genres',
  type: 'select',
  hasMany: true,  // ← Bug affects this type
  options: [
    { label: 'Dystopian', value: 'dystopian' },
    // ... 27 total options
  ]
}
```

**Credits (WORKS CORRECTLY)** - Comics.ts:132-179:
```typescript
{
  name: 'credits',
  type: 'array',  // ← This type works fine
  fields: [
    { name: 'role', type: 'select', ... },
    { name: 'name', type: 'text', ... },
    // ... complex nested fields
  ]
}
```

**Key Difference:** `array` fields use a different code path than `select` with `hasMany: true`.

### Database Storage Comparison

**Genres table (hasMany select):**
```sql
CREATE TABLE comics_genres (
  order INTEGER NOT NULL,          -- No underscore
  parent_id INTEGER NOT NULL,      -- No underscore
  value TEXT,
  id INTEGER PRIMARY KEY           -- Auto-increment integer
);
```

**Credits table (array):**
```sql
CREATE TABLE comics_credits (
  _order INTEGER NOT NULL,         -- With underscore
  _parent_id INTEGER NOT NULL,     -- With underscore
  id TEXT PRIMARY KEY,             -- UUID/string
  role TEXT,
  name TEXT,
  url TEXT,
  custom_role TEXT
);
```

The different naming conventions (`order` vs `_order`, `parent_id` vs `_parent_id`) and ID types suggest **different Drizzle code paths** are handling these field types.

### Expected Update Behavior

On update, Payload should:
1. DELETE all rows where `parent_id = comicId`
2. INSERT new rows for current genre selection

### Actual Behavior

On update, Payload appears to:
1. ❌ Skip the DELETE step
2. ✅ INSERT new rows
3. Result: Old values accumulate

## How This Likely Happened

Given that there are **exactly 63 duplicates** and this is a test comic, the user probably:
1. Created the comic with "dystopian" genre
2. Saved/updated the comic ~62 additional times
3. Each save added another "dystopian" entry

This matches the pattern of testing functionality repeatedly during development.

## Attempted Fixes

### Approach 1: Raw SQL Cleanup
**Problem:** D1's `.run()` method with template strings doesn't return results properly

### Approach 2: Payload API Update
**Problem:** Payload reads `genres` as `[]` (empty), so deduplication has nothing to work with

### Approach 3: Manual Deletion
```sql
DELETE FROM comics_genres WHERE parent_id = 3;
```
**Status:** Did not delete rows (D1 issue or transaction not committed)

## Workaround

The simplest fix is to:

1. Use Payload admin UI to clear all genres
2. Re-select the correct genre(s)
3. Save once
4. **Avoid repeated saves** until bug is fixed

Or use raw SQL in wrangler:
```bash
# Delete all genres for comic ID 3
pnpm wrangler d1 execute chimera-d1 --local \
  --command "DELETE FROM comics_genres WHERE parent_id = 3"

# Re-insert correct value
pnpm wrangler d1 execute chimera-d1 --local \
  --command "INSERT INTO comics_genres (parent_id, value, \`order\`) VALUES (3, 'dystopian', 1)"
```

## Impact

### Data Integrity
- ❌ Database contains invalid duplicate data
- ❌ API returns incorrect data (empty array)
- ⚠️  Affects all `hasMany` select fields (genres, tags, etc.)

### User Experience
- ✅ Admin UI might still display correctly (needs verification)
- ❌ API consumers get empty/incorrect genre data
- ⚠️  Storage waste from duplicate entries

### Performance
- ⚠️  Each save adds more rows
- ⚠️  Queries become slower as duplicates grow
- ⚠️  Could eventually hit database limits

## Affected Collections

Any collection with `hasMany: true` select fields:

1. **Comics:**
   - `genres` (select, hasMany)
   - `tags` (text, hasMany) - might have same issue

2. **Other collections:** Review for similar field types

## Similar Known Issues

This is likely related to the D1 adapter's handling of array/relationship tables. Similar issues documented:
- DELETE operations (fixed in v3.65.0)
- R2 storage plugin limitations
- String ID normalization issues

All suggest the D1 adapter is not production-ready for complex schemas.

## Recommended Actions

### Immediate
1. ✅ Document the bug (this file)
2. ⚠️  Manual cleanup of affected comic
3. ⚠️  Audit other comics for duplicate genres/tags

### Short-term
1. Add validation hook to prevent duplicates on save
2. Create maintenance script to periodically deduplicate
3. Monitor for similar issues with `tags` field

### Long-term
1. Report to Payload CMS team
2. Consider migrating to PostgreSQL adapter
3. Or wait for D1 adapter maturity improvements

## Prevention

Until fixed, developers should:
- Minimize repeated saves of comics
- Check database directly after saves: `SELECT COUNT(*) FROM comics_genres WHERE parent_id = X`
- Use version control to track when duplicates appear

## Testing Checklist

To verify if this affects other fields:

```sql
-- Check for duplicate genres
SELECT parent_id, value, COUNT(*) as count
FROM comics_genres
GROUP BY parent_id, value
HAVING COUNT(*) > 1;

-- Check for duplicate tags (if stored similarly)
SELECT parent_id, value, COUNT(*) as count
FROM comics_tags
GROUP BY parent_id, value
HAVING COUNT(*) > 1;
```

## References

- Payload hasMany docs: https://payloadcms.com/docs/fields/select
- Comics collection: `src/collections/Comics.ts:214-251`
- Known D1 issues: `docs/known-issues.md`
- DELETE bug analysis: `docs/d1-delete-bug-analysis.md`

---

**Status:** Unresolved - Bug in Payload v3.65.0 D1 adapter
**Severity:** High - Data integrity issue
**Workaround:** Manual cleanup required
