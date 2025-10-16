# Database Recovery Instructions

If the migration fails and corrupts your database, follow these steps to recover.

## Quick Recovery (Recommended)

The schema is defined in code, so you can always recreate it:

```bash
# 1. Stop dev server if running
# Ctrl+C in the terminal running pnpm run dev

# 2. Delete corrupted database
rm -rf .wrangler/state/v3/d1

# 3. Run Payload migrations to recreate schema
pnpm payload migrate

# 4. Start dev server
pnpm run dev

# 5. Verify schema is correct
pnpm wrangler d1 execute chimera-d1 --local --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

## What Gets Restored

✅ **Automatically restored:**
- All table structures
- All indexes
- All field types
- All relationships

❌ **NOT automatically restored (you'd need to re-run migration):**
- User data
- Comic/chapter/page content
- Media metadata

## If You Need to Re-Run Migration

```bash
# 1. Recover clean schema (steps above)

# 2. Re-run data migration
pnpm tsx scripts/migrate-from-chimera-cms.ts

# 3. Regenerate thumbnails
pnpm tsx scripts/regenerate-thumbnails.ts
```

## Schema Source of Truth

The definitive schema is stored in:
- `src/collections/Users.ts`
- `src/collections/Comics.ts`
- `src/collections/Chapters.ts`
- `src/collections/Pages.ts`
- `src/collections/Media.ts`

These files define:
- Field names and types
- Relationships
- Validation rules
- Default values
- Hooks and lifecycle events

## Documentation Backups

Critical knowledge preserved in:
1. **`backups/SCHEMA-DOCUMENTATION.md`** - Complete schema with design rationale
2. **`scripts/README.md`** - Migration workflow and usage
3. **`src/collections/*.ts`** - Source code (ultimate truth)

## Manual Schema Export (For Reference)

If you want to manually inspect the current schema before migration:

```bash
# Export all table definitions
pnpm wrangler d1 execute chimera-d1 --local --command "
SELECT name, sql FROM sqlite_master
WHERE type='table' AND name NOT LIKE 'sqlite_%'
ORDER BY name;" --json > backups/manual-schema-$(date +%Y%m%d-%H%M%S).json

# Export table counts
pnpm wrangler d1 execute chimera-d1 --local --command "
SELECT 'users' as t, COUNT(*) as c FROM users UNION ALL
SELECT 'comics', COUNT(*) FROM comics UNION ALL
SELECT 'chapters', COUNT(*) FROM chapters UNION ALL
SELECT 'pages', COUNT(*) FROM pages UNION ALL
SELECT 'media', COUNT(*) FROM media;" --json
```

## Testing Schema Recovery

You can test recovery without losing your current database:

```bash
# 1. Create a test directory
mkdir -p .test-recovery
cd .test-recovery

# 2. Initialize fresh Payload
# (This would require copying your src/ files and package.json)

# 3. Run migrations
pnpm payload migrate

# 4. Verify schema matches
# Compare with documentation in backups/SCHEMA-DOCUMENTATION.md
```

## Prevention

Before running risky operations:

```bash
# 1. Export current schema
pnpm wrangler d1 execute chimera-d1 --local --command "
SELECT sql FROM sqlite_master WHERE type='table';" --json > pre-migration-schema.json

# 2. Take note of record counts
pnpm wrangler d1 execute chimera-d1 --local --command "
SELECT 'users' as t, COUNT(*) as c FROM users;" --json

# 3. Commit current state to git
git add .
git commit -m "Backup before migration"
```

## Worst Case Scenario

If everything fails and you can't recover:

1. **Schema:** Recreate from collection definitions (`src/collections/*.ts`)
2. **Data:** Re-import from `chimera-cms.db` using migration script
3. **Thumbnails:** Regenerate using regeneration script
4. **Lessons learned:** Preserved in `backups/SCHEMA-DOCUMENTATION.md`

The most valuable asset is the documented reasoning behind design decisions, not the data itself (which can be re-migrated from chimera-cms).

## Support Files

- **Schema docs:** `backups/SCHEMA-DOCUMENTATION.md`
- **Migration guide:** `scripts/README.md`
- **Collection code:** `src/collections/*.ts`
- **Payload config:** `src/payload.config.ts`
- **Source database:** `/Users/mike/Sites/chimera-cms/chimera-cms.db`

## Success Verification

After recovery, verify these work:

```bash
# 1. Server starts
pnpm run dev

# 2. Can login to admin
open http://localhost:3333/admin

# 3. Tables exist
pnpm wrangler d1 execute chimera-d1 --local --command "SELECT name FROM sqlite_master WHERE type='table';"

# 4. Can create test media
# Upload an image in admin UI

# 5. Thumbnails generate
# Check that imageSizes field populates with JSON
```

---

**Remember:** The code (`src/collections/*.ts`) is the source of truth. As long as those files exist, you can always recreate the database schema with `pnpm payload migrate`.
