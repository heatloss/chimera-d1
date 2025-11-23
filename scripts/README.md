# Migration Scripts

This directory contains scripts for migrating data from chimera-cms to chimera-d1 and regenerating thumbnails.

## Prerequisites

- Node.js 18.20.2+ or 20.9.0+
- pnpm 9 or 10
- Local dev environment running (`pnpm run dev`)

## Scripts

### 1. migrate-from-chimera-cms.ts

Imports all data from the old chimera-cms database (SQLite with TEXT primary keys) into the new chimera-d1 database (D1 with INTEGER primary keys).

**What it migrates:**
- Users (with auth credentials)
- Comics (with genres, credits, and metadata)
- Chapters (with ordering and SEO)
- Pages (with navigation and extra images)
- Media (basic metadata only, thumbnails excluded)

**What it does NOT migrate:**
- Old thumbnail data (will be regenerated with new script)
- Old TEXT-based IDs (generates new integer IDs)

**Usage:**

```bash
# Make sure dev server is running
pnpm run dev

# In a separate terminal, run the migration
pnpm tsx scripts/migrate-from-chimera-cms.ts
```

**Output:**
- Shows progress for each collection
- Displays old UUID → new INTEGER ID mappings
- Reports any errors during migration
- Provides next steps after completion

**Important Notes:**
- This script is **destructive** - it creates new records, not updates
- Run it only once on a fresh database
- If you need to re-run, clear the database first
- Media files must be manually copied from chimera-cms R2 to chimera-d1 R2

### 2. regenerate-thumbnails.ts

Regenerates thumbnails for all media items that don't have them yet.

**What it does:**
- Finds all media items with `imageSizes` empty/null
- Downloads original images from R2
- Generates 7 thumbnail sizes using Sharp:
  - thumbnail (400px wide)
  - thumbnail_small (200px wide)
  - webcomic_page (800px wide)
  - webcomic_mobile (400px wide)
  - cover_image (600x800)
  - social_preview (1200x630)
  - avatar (200x200 crop)
- Uploads thumbnails back to R2
- Updates media records with thumbnail metadata

**Usage:**

```bash
# Make sure dev server is running
pnpm run dev

# In a separate terminal, run thumbnail regeneration
pnpm tsx scripts/regenerate-thumbnails.ts
```

**Output:**
- Shows progress for each media item
- Displays file sizes and thumbnail counts
- Reports success/failure counts
- Can be run multiple times safely (only processes items without thumbnails)

## Migration Workflow

Follow these steps in order:

### Step 1: Prepare Environment

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm run dev
```

### Step 2: Copy Media Files

Before running the migration, ensure all media files from chimera-cms are available in R2:

```bash
# If chimera-cms used local storage:
# 1. Upload files to chimera-d1 R2 bucket manually, or
# 2. Copy .wrangler/state/v3/r2 directory from chimera-cms

# If chimera-cms used R2:
# 1. Use wrangler to copy between buckets, or
# 2. Download and re-upload files
```

### Step 3: Run Migration

```bash
# Open a new terminal (keep dev server running)
pnpm tsx scripts/migrate-from-chimera-cms.ts
```

Expected output:
```
🚀 Starting migration from chimera-cms to chimera-d1

📖 Opening source database: /Users/mike/Sites/chimera-cms/chimera-cms.db
⚙️  Initializing Payload...

👤 Migrating Users...
   Found 2 users
   ✓ mike@the-ottoman.com (old-text-id → 1)
   ✓ mike@luckbat.com (old-text-id → 2)

📚 Migrating Comics...
   Found 1 comics
   ✓ The Automan's Daughter (old-text-id → 1)

... (continues for all collections)

🔗 Updating Relationships...
   ✓ Updated comic 1 relationships
   ✓ Updated page 1 relationships
   ... (continues)
   ✓ All relationships updated

✅ Migration completed successfully!

📝 Next steps:
1. Verify data in admin UI: http://localhost:3333/admin
2. Run thumbnail regeneration: pnpm tsx scripts/regenerate-thumbnails.ts
```

### Step 4: Verify Data

```bash
# Open admin UI
open http://localhost:3333/admin

# Check:
# - Users exist and can log in
# - Comics show up with correct authors
# - Chapters are in correct order
# - Pages have correct images and navigation
# - Media items exist (without thumbnails yet)
```

### Step 5: Regenerate Thumbnails

```bash
pnpm tsx scripts/regenerate-thumbnails.ts
```

Expected output:
```
🎨 Starting thumbnail regeneration

⚙️  Initializing Payload...

📊 Found 29 media items needing thumbnails

🖼️  Processing: issue-3-page-7.jpg
   📥 Downloaded 856.3 KB from R2
   ✓ Generated 7 thumbnails
   ✓ Uploaded 7 thumbnails to R2
   ✅ Updated media record 12

... (continues for each image)

📊 Regeneration Summary:
   ✅ Success: 29
   ❌ Failed: 0
   📊 Total: 29
```

### Step 6: Verify Thumbnails

```bash
# Open a media item in admin UI
open http://localhost:3333/admin/collections/media

# Check that:
# - Thumbnail gallery shows all 7 sizes
# - Thumbnail URLs are accessible
# - Dimensions and file sizes look correct
```

## Troubleshooting

### Migration fails with "Author ID not found in mapping"

**Cause:** User migration failed, so comic can't find the author.

**Fix:**
1. Check the error message above for why user migration failed
2. Fix the issue (usually duplicate email)
3. Clear the database and re-run migration

### Thumbnail regeneration fails with "File not found in R2"

**Cause:** Original media file wasn't copied to R2 before running the script.

**Fix:**
1. Copy media files from chimera-cms to chimera-d1 R2
2. Re-run the thumbnail regeneration script

### better-sqlite3 build errors

**Cause:** Native module needs to be compiled for your system.

**Fix:**
```bash
pnpm rebuild better-sqlite3
```

### Payload context not available in scripts

**Cause:** Cloudflare context isn't initialized.

**Fix:**
Make sure the dev server is running when you execute the scripts. The scripts rely on the Payload config which initializes the Cloudflare context.

## Advanced Usage

### Selective Migration

To migrate only specific collections, edit the migration script and comment out unwanted sections:

```typescript
// Step 1: Migrate Users
await migrateUsers(sourceDb, payload, idMapping)

// Step 2: Migrate Comics
// await migrateComics(sourceDb, payload, idMapping)  // Comment out to skip

// ... etc
```

### Dry Run Mode

To see what would be migrated without actually creating records, add a dry run flag:

```typescript
const DRY_RUN = true  // Add at top of script

// Then in each migrate function:
if (!DRY_RUN) {
  const newUser = await payload.create({ ... })
}
```

### Custom Thumbnail Sizes

To modify thumbnail dimensions, edit `src/lib/thumbnailConfig.ts`:

```typescript
export const thumbnailSizes = [
  { name: 'thumbnail', width: 400 },        // Change width
  { name: 'custom_size', width: 1000 },    // Add new size
  // ... etc
]
```

Then re-run the thumbnail regeneration script.

## File Locations

- **Source database:** `/Users/mike/Sites/chimera-cms/chimera-cms.db`
- **Target database:** `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite`
- **R2 storage:** `.wrangler/state/v3/r2/`
- **Migration scripts:** `/Users/mike/Sites/chimera-d1/scripts/`
- **Thumbnail config:** `/Users/mike/Sites/chimera-d1/src/lib/thumbnailConfig.ts`

## Support

If you encounter issues not covered here, check:
- PayloadCMS documentation: https://payloadcms.com/docs
- Cloudflare D1 docs: https://developers.cloudflare.com/d1/
- Cloudflare R2 docs: https://developers.cloudflare.com/r2/
