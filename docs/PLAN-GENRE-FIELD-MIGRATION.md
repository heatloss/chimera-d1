# Plan: Migrate Genres from hasMany Select to Array Field

**Date:** 2025-12-02
**Status:** Ready for implementation
**Estimated Time:** 1-2 hours
**Risk Level:** Medium (requires data migration and frontend updates)

## Problem Summary

The `genres` field uses `type: 'select'` with `hasMany: true`, which has a bug in Payload's D1 adapter that causes duplicate values on every save. The `credits` field uses `type: 'array'` and works correctly, so we'll convert genres to use the same pattern.

## Goal

Convert `genres` field from:
```typescript
// Current (broken)
genres: ['dystopian', 'sci-fi']  // Array of strings
```

To:
```typescript
// New (working)
genres: [
  { genre: 'dystopian' },
  { genre: 'sci-fi' }
]  // Array of objects
```

## Implementation Steps

### Phase 1: Backup & Preparation (10 min)

1. **Backup database**
   ```bash
   # Backup local database
   ./scripts/backup-database.sh

   # Or manually
   cp .wrangler/state/v3/d1/*.sqlite backup-before-genre-migration.sqlite
   ```

2. **Document current state**
   ```bash
   # Export current genres for all comics
   pnpm wrangler d1 execute chimera-d1 --local \
     --command "SELECT c.id, c.title, GROUP_CONCAT(cg.value) as genres
                FROM comics c
                LEFT JOIN comics_genres cg ON c.id = cg.parent_id
                GROUP BY c.id" \
     > current-genres.txt
   ```

### Phase 2: Update Field Definition (5 min)

**File:** `src/collections/Comics.ts`

**Replace lines 214-251:**

```typescript
// OLD (lines 214-251)
{
  name: 'genres',
  type: 'select',
  hasMany: true,
  label: 'Genres',
  options: [
    { label: 'Action-Adventure', value: 'action-adventure' },
    // ... all 27 options
  ],
  admin: {
    description: 'Select all genres that apply to your comic',
  },
},
```

**With:**

```typescript
// NEW
{
  name: 'genres',
  type: 'array',
  label: 'Genres',
  admin: {
    description: 'Select all genres that apply to your comic',
  },
  fields: [
    {
      name: 'genre',
      type: 'select',
      required: true,
      options: [
        { label: 'Action-Adventure', value: 'action-adventure' },
        { label: 'Alternate History', value: 'alternate-history' },
        { label: 'Comedy', value: 'comedy' },
        { label: 'Cyberpunk', value: 'cyberpunk' },
        { label: 'Drama', value: 'drama' },
        { label: 'Dystopian', value: 'dystopian' },
        { label: 'Educational', value: 'educational' },
        { label: 'Erotica', value: 'erotica' },
        { label: 'Fairytale', value: 'fairytale' },
        { label: 'Fan Comic', value: 'fan-comic' },
        { label: 'Fantasy', value: 'fantasy' },
        { label: 'Historical', value: 'historical' },
        { label: 'Horror', value: 'horror' },
        { label: 'Magical Girl', value: 'magical-girl' },
        { label: 'Mystery', value: 'mystery' },
        { label: 'Nonfiction', value: 'nonfiction' },
        { label: 'Parody', value: 'parody' },
        { label: 'Post-Apocalyptic', value: 'post-apocalyptic' },
        { label: 'Romance', value: 'romance' },
        { label: 'Satire', value: 'satire' },
        { label: 'Sci-Fi', value: 'sci-fi' },
        { label: 'Slice of Life', value: 'slice-of-life' },
        { label: 'Sports', value: 'sports' },
        { label: 'Steampunk', value: 'steampunk' },
        { label: 'Superhero', value: 'superhero' },
        { label: 'Urban Fantasy', value: 'urban-fantasy' },
        { label: 'Western', value: 'western' },
      ],
    },
  ],
},
```

### Phase 3: Generate Migration (15 min)

1. **Generate Payload migration**
   ```bash
   pnpm payload generate:migration genre-array-conversion
   ```

2. **Review generated migration**
   - Check `src/migrations/YYYY_MM_DD_HHMMSS_genre-array-conversion.ts`
   - Should drop `comics_genres` table
   - Should create new `comics_genres` table with different schema

3. **Add data migration to the generated file**

   After the schema changes, add this data migration logic:

   ```typescript
   // After table recreation, migrate existing data
   await payload.db.execute(`
     -- This is a placeholder - actual migration will be done via script
     -- See scripts/migrate-genres-data.ts
   `)
   ```

### Phase 4: Create Data Migration Script (20 min)

**File:** `scripts/migrate-genres-data.ts`

```typescript
/**
 * Migrate genres from old hasMany select format to new array format
 *
 * Old: comics_genres table with (parent_id, value, order, id)
 * New: comics_genres table with (_parent_id, _order, id, genre)
 */

import { getPayload } from 'payload'
import config from '../src/payload.config.js'

async function migrateGenres() {
  console.log('🔄 Migrating genres to array format\n')

  const payload = await getPayload({ config })

  try {
    // Step 1: Get all comics with their current genres from API
    const comics = await payload.find({
      collection: 'comics',
      limit: 1000,
      depth: 0
    })

    console.log(`Found ${comics.docs.length} comics\n`)

    for (const comic of comics.docs) {
      // Payload should read from old table format before migration
      const oldGenres = comic.genres || []

      if (oldGenres.length === 0) {
        console.log(`  ${comic.title}: No genres to migrate`)
        continue
      }

      // Deduplicate (in case of duplicates from the bug)
      const uniqueGenres = [...new Set(oldGenres)]

      // Convert to new array format
      const newGenres = uniqueGenres.map(genreValue => ({
        genre: genreValue
      }))

      console.log(`  ${comic.title}: Migrating ${oldGenres.length} → ${uniqueGenres.length} unique genres`)
      console.log(`    Old:`, oldGenres)
      console.log(`    New:`, newGenres)

      // Update comic with new format
      // This will write to the new table structure
      await payload.update({
        collection: 'comics',
        id: comic.id,
        data: {
          genres: newGenres
        }
      })

      console.log(`    ✅ Migrated\n`)
    }

    console.log('='.repeat(60))
    console.log('✅ Genre migration complete!')
    console.log('='.repeat(60))

    process.exit(0)

  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    process.exit(1)
  }
}

migrateGenres()
```

### Phase 5: Run Migration (10 min)

1. **Stop dev server if running**
   ```bash
   # Kill any running dev server
   lsof -ti:3333 | xargs kill -9
   ```

2. **Run Payload migration**
   ```bash
   # This will update the schema
   PAYLOAD_SECRET=8e51bde9b249b9105f4d97ccce8b336098825ae5547b4a4b41f99600694d836a \
     pnpm payload migrate
   ```

3. **Run data migration**
   ```bash
   # This will convert the data
   PAYLOAD_SECRET=8e51bde9b249b9105f4d97ccce8b336098825ae5547b4a4b41f99600694d836a \
     pnpm tsx scripts/migrate-genres-data.ts
   ```

4. **Verify migration**
   ```bash
   # Check new table structure
   pnpm wrangler d1 execute chimera-d1 --local \
     --command "PRAGMA table_info(comics_genres);"

   # Check data
   pnpm wrangler d1 execute chimera-d1 --local \
     --command "SELECT * FROM comics_genres LIMIT 10;"
   ```

### Phase 6: Update API Specification (5 min)

**File:** `docs/api-specification.md`

Update line 139 from:
```json
"genres": ["adventure", "comedy", "fantasy"],
```

To:
```json
"genres": [
  { "genre": "adventure" },
  { "genre": "comedy" },
  { "genre": "fantasy" }
],
```

Also update the metadata endpoint documentation around line 448 to note that genre values are returned as objects.

### Phase 7: Frontend Updates (30 min)

**Impact:** Any frontend code that reads or writes genres needs updating.

**Old frontend code:**
```typescript
// Reading
const genreValues = comic.genres  // ['dystopian', 'sci-fi']

// Writing
await updateComic({
  genres: ['dystopian', 'sci-fi']
})

// Displaying
{comic.genres.map(genre => <Tag key={genre}>{genre}</Tag>)}
```

**New frontend code:**
```typescript
// Reading - extract genre values
const genreValues = comic.genres?.map(g => g.genre) || []  // ['dystopian', 'sci-fi']

// Writing - wrap in objects
await updateComic({
  genres: selectedGenres.map(value => ({ genre: value }))
})

// Displaying
{comic.genres?.map(g => <Tag key={g.genre}>{g.genre}</Tag>)}
```

**Files likely needing updates:**
- Any comic list/card components
- Comic detail/edit forms
- Genre filter components
- Comic creation forms
- Any API utility functions that handle comics

### Phase 8: Test Everything (15 min)

1. **Test via admin UI**
   - Edit a comic's genres
   - Save
   - Verify no duplicates in database:
     ```bash
     pnpm wrangler d1 execute chimera-d1 --local \
       --command "SELECT _parent_id, genre FROM comics_genres WHERE _parent_id = 1;"
     ```

2. **Test via API**
   ```bash
   # Get comic
   curl http://localhost:3333/api/comics/1

   # Verify genres format is array of objects
   ```

3. **Test creating new comic**
   - Create via admin UI with genres
   - Verify correct structure

4. **Test updating multiple times**
   - Edit and save same comic 3-4 times
   - Verify no duplicates accumulate

## Rollback Plan

If something goes wrong:

1. **Restore database backup**
   ```bash
   cp backup-before-genre-migration.sqlite .wrangler/state/v3/d1/chimera-d1.sqlite
   ```

2. **Revert code changes**
   ```bash
   git checkout src/collections/Comics.ts
   git clean -fd src/migrations/
   ```

3. **Restart dev server**
   ```bash
   pnpm run dev
   ```

## Post-Migration Verification

Run these checks after migration is complete:

```bash
# 1. Count genres per comic
pnpm wrangler d1 execute chimera-d1 --local \
  --command "SELECT _parent_id, COUNT(*) as genre_count
             FROM comics_genres
             GROUP BY _parent_id;"

# 2. Check for any duplicates (should be 0)
pnpm wrangler d1 execute chimera-d1 --local \
  --command "SELECT _parent_id, genre, COUNT(*) as count
             FROM comics_genres
             GROUP BY _parent_id, genre
             HAVING COUNT(*) > 1;"

# 3. Verify table structure matches credits table
pnpm wrangler d1 execute chimera-d1 --local \
  --command "PRAGMA table_info(comics_genres);"

# Should have _order, _parent_id (with underscores)
```

## Success Criteria

- ✅ `comics_genres` table uses `_order` and `_parent_id` (with underscores)
- ✅ Table has `genre` column instead of `value` column
- ✅ Primary key is TEXT (UUID) instead of INTEGER
- ✅ All existing genre data preserved (deduplicated)
- ✅ Saving comics doesn't create duplicates
- ✅ API returns correct genre format
- ✅ Admin UI works correctly
- ✅ Frontend displays/edits genres correctly

## Notes

- **Tags field:** Has same structure as genres (`hasMany` text field). Consider migrating it too if needed.
- **Similar pattern:** This migration pattern can be reused for any other `hasMany` fields that need converting.
- **Database size:** Migration doesn't significantly increase size (same data, different structure).

## Timeline

| Phase | Time | Cumulative |
|-------|------|------------|
| 1. Backup & Prep | 10 min | 10 min |
| 2. Update Field | 5 min | 15 min |
| 3. Generate Migration | 15 min | 30 min |
| 4. Data Migration Script | 20 min | 50 min |
| 5. Run Migration | 10 min | 60 min |
| 6. Update Docs | 5 min | 65 min |
| 7. Frontend Updates | 30 min | 95 min |
| 8. Testing | 15 min | 110 min |

**Total: ~2 hours**

## Questions to Resolve Before Starting

1. Are there other places genres are used that need updating?
2. Is there a staging environment to test this first?
3. Should tags field be migrated at the same time (has same issue)?
4. Do we need to migrate production database or just local?

## References

- Bug analysis: `docs/GENRE-DUPLICATION-BUG.md`
- Credits field (working example): `src/collections/Comics.ts:132-179`
- Current genres field: `src/collections/Comics.ts:214-251`
- Migration guide: This document

---

**Status:** Ready for implementation
**Next Session:** Follow this plan step-by-step
**Backup First:** Always backup before schema changes!
