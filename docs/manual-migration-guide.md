# Manual Migration Guide - Disabling Push Mode

This guide explains how to disable Payload's automatic schema push and use manual migrations instead. This is necessary when automatic migrations fail due to SQLite's limitations with foreign key constraints.

## When to Use This Guide

Use this approach when:
- Automatic migrations fail with `NOT NULL constraint failed` errors
- You need to change default values on fields
- You're stuck in a migration loop with `__new_*` tables
- You need more control over complex schema changes

## Why Automatic Push Fails

When Payload detects a schema change (including adding OR removing default values), it attempts to rebuild tables:

1. Create `comics_new` with the new schema
2. Copy data from `comics` to `comics_new`
3. Drop the old `comics` table ← **FAILS HERE**
4. Rename `comics_new` to `comics`

**Step 3 fails** because SQLite's foreign key constraints prevent dropping tables that other tables reference (e.g., `pages.comic_id` → `comics.id`).

## Understanding the Function Default Trap

**Important:** Changing from a static default to a function default (or vice versa) is equally destructive:

```typescript
// Both of these trigger table rebuilds:
defaultValue: 'draft'        // SQL DEFAULT constraint
defaultValue: () => 'draft'  // Removes SQL DEFAULT constraint
```

Switching between them tells Payload to add/remove the SQL DEFAULT constraint, which requires rebuilding the table.

---

## Step-by-Step Solution

### Step 1: Disable Push Mode

Edit `src/payload.config.ts`:

```typescript
export default buildConfig({
  // ...
  db: sqliteD1Adapter({
    binding: cloudflare.env.D1,
    push: false, // ← Add this line
  }),
})
```

**Effect:** Dev server will now start without attempting automatic migrations.

### Step 2: Generate Migration File

Run in your terminal:

```bash
pnpm payload migrate:create fix_schema_change
```

**Note:** Replace `fix_schema_change` with a descriptive name (e.g., `update_comics_defaults`, `add_new_field`, etc.)

This creates a new file in `src/migrations/` (e.g., `20241125_fix_schema_change.ts`).

### Step 3: Edit Migration File

Open the generated migration file. It will contain the destructive SQL operations. Wrap them with PRAGMA statements to bypass foreign key checks:

```typescript
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  // 1. Temporarily disable foreign key constraint checks
  await payload.db.drizzle.run(sql`PRAGMA defer_foreign_keys = ON;`)

  // 2. Run the generated Payload operations
  // (Keep whatever SQL Payload generated - examples below)
  await payload.db.drizzle.run(sql`CREATE TABLE __new_comics (
    -- ... generated schema ...
  );`)

  await payload.db.drizzle.run(sql`INSERT INTO __new_comics
    SELECT * FROM comics;`)

  await payload.db.drizzle.run(sql`DROP TABLE comics;`) // ← Now succeeds

  await payload.db.drizzle.run(sql`ALTER TABLE __new_comics RENAME TO comics;`)

  // 3. Re-enable foreign key checks
  await payload.db.drizzle.run(sql`PRAGMA defer_foreign_keys = OFF;`)
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  // Optionally implement rollback logic with same PRAGMA pattern
  // Or leave empty if rollback isn't needed
}
```

**Key Points:**
- `PRAGMA defer_foreign_keys = ON` tells SQLite to temporarily allow foreign key violations
- Keep all the generated SQL between the two PRAGMA statements
- `PRAGMA defer_foreign_keys = OFF` restores normal foreign key enforcement

### Step 4: Run the Migration

Execute the migration:

```bash
pnpm payload migrate
```

This applies the migration with the PRAGMA protection, allowing the table rebuild to succeed.

### Step 5: Verify Success

```bash
# Check for leftover tables
pnpm wrangler d1 execute chimera-d1 --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '__new_%';"

# Should return empty - no leftover tables

# Check migration status
pnpm wrangler d1 execute chimera-d1 --local --command "SELECT * FROM payload_migrations ORDER BY created_at DESC LIMIT 5;"

# Should show your new migration as applied
```

---

## Alternative: Simple Schema Changes

For simple changes that **don't require table rebuilds** (like adding nullable fields), you can edit the migration to skip the destructive operations:

```typescript
export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  // Instead of DROP/CREATE, just add the column:
  await payload.db.drizzle.run(sql`ALTER TABLE comics ADD COLUMN new_field TEXT;`)

  // No PRAGMA needed for simple additions
}
```

---

## When to Keep Push Disabled

**Keep `push: false` if:**
- You work with D1/SQLite (limited ALTER TABLE support)
- You need fine-grained control over migrations
- You frequently make schema changes
- You want to review SQL before it runs

**Re-enable `push: true` if:**
- You rarely change schemas
- You trust automatic migrations
- You're comfortable with the risks

---

## Production Deployments

**Important:** Always test migrations locally first:

```bash
# 1. Test locally
pnpm payload migrate

# 2. Verify database state
pnpm wrangler d1 execute chimera-d1 --local --command "SELECT * FROM comics LIMIT 1;"

# 3. If successful, apply to production
pnpm payload migrate --remote
# OR
pnpm wrangler d1 migrations apply chimera-d1 --remote
```

---

## Troubleshooting

### Migration Still Fails

If the PRAGMA approach doesn't work:

1. Check that all SQL statements use proper syntax
2. Verify column names match exactly (case-sensitive)
3. Ensure data types are compatible during copy
4. Check for any triggers or indexes that might interfere

### Stuck in Migration Loop

If you get stuck again:

```bash
# Clean up leftover tables
pnpm wrangler d1 execute chimera-d1 --local --command "DROP TABLE IF EXISTS __new_comics; DROP TABLE IF EXISTS __new_chapters; DROP TABLE IF EXISTS __new_pages;"

# Remove failed migration record
pnpm wrangler d1 execute chimera-d1 --local --command "DELETE FROM payload_migrations WHERE name = 'dev' OR batch = -1;"

# Restart fresh
pnpm run dev
```

### Need to Rollback

```bash
# Rollback last migration
pnpm payload migrate:rollback

# Or manually:
pnpm wrangler d1 execute chimera-d1 --local --command "DELETE FROM payload_migrations WHERE id = (SELECT MAX(id) FROM payload_migrations);"
```

---

## Best Practices

1. **Always backup before migrations:**
   ```bash
   cp .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite \
      .wrangler/state/v3/d1/miniflare-D1DatabaseObject/backup-$(date +%Y%m%d-%H%M%S).sqlite
   ```

2. **Review generated SQL** before running migrations

3. **Test locally** before applying to production

4. **Keep migration files** in version control

5. **Document complex migrations** with comments in the migration file

---

## Summary

```bash
# Complete workflow:
1. Set push: false in payload.config.ts
2. pnpm payload migrate:create descriptive_name
3. Edit migration file, add PRAGMA statements
4. pnpm payload migrate
5. Verify success
6. Commit migration file to git
```

With `push: false`, you have full control over when and how schema changes are applied. This is the recommended approach for D1/SQLite projects that require schema stability.

---

**See Also:**
- [Known Issues](./known-issues.md) - Common problems and limitations
- [API Specification](./api-specification.md) - API documentation
- [Payload Migrations Docs](https://payloadcms.com/docs/database/migrations)
- [SQLite PRAGMA Documentation](https://www.sqlite.org/pragma.html#pragma_defer_foreign_keys)

---

**Last Updated:** 2025-11-25
