# Remote to Local Database Migration Plan

## Current Situation

### Remote Database (Cloudflare)
- **Status**: Contains your production data
- **Schema**: Has INTEGER primary keys + UUID fields (5 tables affected)
- **Data**: 2 users, 1 comic, 5 chapters, 29 pages, 42 media
- **Migration State**: `20251015_031439_complete_schema` applied
- **UUID Columns**: Present in users, comics, chapters, pages, media
- **UUID Indexes**: Present on all 5 tables

### Local Database (Currently)
- **Status**: Deleted (empty directory)
- **Target Schema**: INTEGER primary keys WITHOUT UUID fields
- **Code State**: Collections and config updated to remove UUID fields
- **Migration Ready**: `20251122_165441` migration script ready to drop UUIDs

## Migration Strategy

We have two approaches to choose from:

### Option A: Direct Export/Import (RECOMMENDED)
**Pros**: Simple, fast, uses native Wrangler tools
**Cons**: Requires manual SQL extraction and transformation

**Steps**:
1. Export remote database to SQLite file
2. Create fresh local database with Payload migrations (without UUIDs)
3. Copy data from exported file to local database (skipping UUID columns)
4. Verify data integrity
5. Update R2 media references if needed

### Option B: Migration-Based Approach
**Pros**: Uses existing migration script, maintains migration history
**Cons**: More complex, requires copying remote DB locally first

**Steps**:
1. Export remote database to local SQLite file
2. Place exported database in correct location
3. Run UUID removal migration locally
4. Verify migration success
5. Update migration tracking

## Recommended Plan: Option A (Direct Export/Import)

### Phase 1: Backup and Export (SAFE - No destructive operations)

1. **Create backup directory**
   ```bash
   mkdir -p backups/remote-export-$(date +%Y%m%d-%H%M%S)
   ```

2. **Export remote database structure**
   ```bash
   pnpm wrangler d1 export chimera-d1 --remote --output=backups/remote-export-*/remote-full-export.sql
   ```

3. **Export remote data for verification**
   ```bash
   # Export all table data as JSON for verification
   pnpm wrangler d1 execute chimera-d1 --remote --command "SELECT * FROM users;" --json > backups/remote-export-*/users.json
   pnpm wrangler d1 execute chimera-d1 --remote --command "SELECT * FROM comics;" --json > backups/remote-export-*/comics.json
   pnpm wrangler d1 execute chimera-d1 --remote --command "SELECT * FROM chapters;" --json > backups/remote-export-*/chapters.json
   pnpm wrangler d1 execute chimera-d1 --remote --command "SELECT * FROM pages;" --json > backups/remote-export-*/pages.json
   pnpm wrangler d1 execute chimera-d1 --remote --command "SELECT * FROM media;" --json > backups/remote-export-*/media.json
   ```

### Phase 2: Prepare Local Database (SAFE - Creates new database)

4. **Ensure local D1 directory exists**
   ```bash
   mkdir -p .wrangler/state/v3/d1
   ```

5. **Run Payload migrations to create clean schema (without UUIDs)**
   ```bash
   pnpm payload migrate
   ```
   This will:
   - Create fresh local database
   - Apply base schema migration
   - Skip UUID removal migration (since UUIDs never existed locally)

### Phase 3: Data Migration Script

6. **Create data migration script** (`scripts/migrate-remote-to-local.ts`)
   - Reads exported JSON files
   - Inserts data into local database
   - Skips UUID columns
   - Maintains all INTEGER ID values
   - Preserves relationships

7. **Run data migration**
   ```bash
   pnpm tsx scripts/migrate-remote-to-local.ts
   ```

### Phase 4: Verification

8. **Verify data counts**
   ```bash
   pnpm wrangler d1 execute chimera-d1 --local --command "
     SELECT 'users' as table_name, COUNT(*) as count FROM users
     UNION ALL SELECT 'comics', COUNT(*) FROM comics
     UNION ALL SELECT 'chapters', COUNT(*) FROM chapters
     UNION ALL SELECT 'pages', COUNT(*) FROM pages
     UNION ALL SELECT 'media', COUNT(*) FROM media;
   "
   ```
   Expected: 2 users, 1 comic, 5 chapters, 29 pages, 42 media

9. **Verify schema is correct (no UUID columns)**
   ```bash
   pnpm wrangler d1 execute chimera-d1 --local --command "PRAGMA table_info(users);"
   ```
   Should NOT show uuid column

10. **Verify R2 media files are intact**
    ```bash
    ls -l .wrangler/state/v3/r2/chimera-d1/blobs/ | wc -l
    ```
    Expected: 462 files

11. **Test login functionality**
    ```bash
    pnpm run dev
    ```
    Try logging in at http://localhost:3000/admin

### Phase 5: Migration Tracking Cleanup

12. **Update payload_migrations table**
    ```bash
    pnpm wrangler d1 execute chimera-d1 --local --command "
      DELETE FROM payload_migrations WHERE name = '20251122_165441';
    "
    ```
    (Remove UUID removal migration since it was never needed locally)

## Rollback Plan

If anything goes wrong:
1. Remote database is untouched (safe backup)
2. Delete local `.wrangler/state/v3/d1/` directory
3. R2 media files remain intact
4. Start over from Phase 2

## Key Data to Preserve

### Users Table (2 records)
- id (INTEGER) - PRIMARY KEY
- email, hash, salt - Authentication data
- role - User permissions
- Remove: uuid column

### Comics Table (1 record)
- id (INTEGER) - PRIMARY KEY
- title, slug, description
- author_id - Foreign key to users
- cover_image_id - Foreign key to media
- Remove: uuid column

### Chapters Table (5 records)
- id (INTEGER) - PRIMARY KEY
- comic_id - Foreign key to comics
- title, order
- Remove: uuid column

### Pages Table (29 records)
- id (INTEGER) - PRIMARY KEY
- comic_id, chapter_id - Foreign keys
- page_image_id - Foreign key to media
- chapter_page_number, global_page_number
- Remove: uuid column

### Media Table (42 records)
- id (INTEGER) - PRIMARY KEY
- filename, mimeType, filesize
- R2 storage reference
- Remove: uuid column

## Success Criteria

✅ All data counts match remote database
✅ No UUID columns exist in local schema
✅ All INTEGER IDs preserved
✅ Foreign key relationships intact
✅ Login works with existing credentials
✅ R2 media files accessible
✅ No migration errors in console

## Notes

- **DO NOT** run any operations on remote database except exports
- **DO NOT** delete local database until migration is verified
- R2 media blobs are already local (462 files) - no need to copy
- Migration script will be idempotent (can be run multiple times safely)
