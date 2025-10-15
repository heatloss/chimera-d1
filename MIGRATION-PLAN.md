# Migration Plan: Restoring Collections from payload-d1

**Status:** In Progress
**Date Started:** 2025-10-15
**Goal:** Restore Comics, Pages, Chapters, and Media collections from payload-d1 repo using the hybrid UUID approach (INTEGER primary keys + UUID field)

---

## Background

### The Problem We Solved
- **Original approach:** Used TEXT UUIDs as primary keys (`idType: 'text'`, `allowIDOnCreate: true`)
- **Issue:** File uploads worked in dev mode but failed with "Unauthorized" errors in Workers preview mode
- **Root cause:** PayloadCMS's file upload transaction expects INTEGER primary keys; TEXT breaks in Workers runtime
- **Solution:** Hybrid approach - INTEGER primary keys internally, UUID field for public-facing security

### The Hybrid UUID Approach
```typescript
// Database schema
id      INTEGER PRIMARY KEY AUTOINCREMENT  // Payload's internal ID (fast, compatible)
uuid    TEXT UNIQUE NOT NULL                // Public-facing UUID (secure, unguessable)
```

**Benefits:**
- ✅ File uploads work in Workers (no more "Unauthorized" errors)
- ✅ Still get UUID security for public APIs/URLs
- ✅ Fast INTEGER joins for internal database operations
- ✅ Full Payload compatibility

---

## Source Data Location

**Repo:** `/Users/mike/Sites/payload-d1`

**Collections to migrate:**
- Comics: `/Users/mike/Sites/payload-d1/src/collections/Comics.ts`
- Pages: `/Users/mike/Sites/payload-d1/src/collections/Pages.ts`
- Chapters: `/Users/mike/Sites/payload-d1/src/collections/Chapters.ts`
- Media: `/Users/mike/Sites/payload-d1/src/collections/Media.ts`
- Users: `/Users/mike/Sites/payload-d1/src/collections/Users.ts`

**Database backup:** `/Users/mike/Sites/payload-d1/production-deploy-clean.sql`

---

## Migration Steps

### Phase 1: Adapt Collection Configurations

For each collection, we need to:
1. Remove the old `id` field with `beforeValidate` hook (lines 33-48 in Comics.ts, etc.)
2. Add new `uuid` field as a regular field
3. Update any references from `id` to appropriate field

#### Step 1.1: Comics Collection
- [x] Copy `/Users/mike/Sites/payload-d1/src/collections/Comics.ts` to `/Users/mike/Sites/chimera-d1/src/collections/Comics.ts`
- [x] Remove old id field (lines 33-48)
- [x] Add new uuid field with hybrid UUID approach
- [x] Update payload.config.ts to import Comics collection

#### Step 1.2: Chapters Collection
- [x] Copy `/Users/mike/Sites/payload-d1/src/collections/Chapters.ts` to `/Users/mike/Sites/chimera-d1/src/collections/Chapters.ts`
- [x] Apply same UUID field transformation as Comics
- [x] Update payload.config.ts to import Chapters collection

#### Step 1.3: Pages Collection
- [x] Copy `/Users/mike/Sites/payload-d1/src/collections/Pages.ts` to `/Users/mike/Sites/chimera-d1/src/collections/Pages.ts`
- [x] Apply same UUID field transformation as Pages
- [x] Preserved all complex hooks (global page numbering, statistics, navigation)
- [x] Update payload.config.ts to import Pages collection

#### Step 1.4: Media Collection
- [x] Enhanced existing Media.ts with fields from payload-d1
- [x] Added `imageSizes` JSON field for thumbnail metadata
- [x] Added mediaType, uploadedBy, comicMeta fields
- [x] UUID field already present (hybrid approach)
- [x] Update payload.config.ts to import Media collection

#### Step 1.5: Users Collection
- [x] Added `uuid` field to Users collection (hybrid UUID approach)
- [x] Added `role` field (admin, editor, creator, reader)
- [x] **Critical for data migration:** UUIDs will preserve user identity when importing from payload-d1

---

### Phase 2: Generate Database Migrations

After all collections are adapted:

- [x] Deleted old conflicting migrations
- [x] Run `pnpm payload migrate:create complete_schema` to generate fresh migration
- [x] Migration includes all collections: Users, Comics, Chapters, Pages, Media
- [x] All collections have `uuid TEXT UNIQUE NOT NULL` column
- [x] Unique indexes created for uuid fields
- [x] Run `pnpm payload migrate --local` to apply migration
- [x] **Result:** Clean local D1 database with complete schema

---

### Phase 3: Import Data

#### Approach: Transform SQL backup to use hybrid UUID structure

The old data has:
```sql
INSERT INTO comics VALUES('c8410e79-a8e3-4fba-aefe-63fce4c2c35e', 'Title', ...)
                          ^--- OLD: UUID as primary key
```

New structure needs:
```sql
INSERT INTO comics (uuid, title, ...) VALUES('c8410e79-a8e3-4fba-aefe-63fce4c2c35e', 'Title', ...)
                    ^--- NEW: UUID as regular field, INTEGER id auto-generated
```

**Options:**

**Option A: Manual SQL transformation script**
- Parse production-deploy-clean.sql
- Transform INSERT statements to move UUID from id position to uuid field
- Let INTEGER id auto-increment

**Option B: API-based import**
- Write a Node script that:
  - Reads production-deploy-clean.sql
  - Parses data into JSON
  - Uses Payload API to create records
  - API will auto-generate INTEGER ids, we provide UUIDs

**Option C: Direct database import with transformation**
- Import to temporary tables
- Run SQL to transform data
- Copy to final tables

**Recommended: Option B** - cleanest, safest, validates through Payload

#### Step 3.1: Create Import Script
- [ ] Create `/Users/mike/Sites/chimera-d1/scripts/import-from-payload-d1.ts`
- [ ] Parse SQL file to extract data
- [ ] Transform data structure (uuid field instead of id)
- [ ] Use Payload Local API to create records

#### Step 3.2: Import Comics
- [ ] Run script for comics table
- [ ] Verify data in database
- [ ] Check that UUIDs are preserved
- [ ] Check that relationships work

#### Step 3.3: Import Chapters
- [ ] Run script for chapters table
- [ ] Verify parent-child relationships to comics work

#### Step 3.4: Import Pages
- [ ] Run script for pages table
- [ ] Verify relationships to comics and chapters
- [ ] Verify media relationships

#### Step 3.5: Import Media
- [ ] **Important:** Media files need to be in R2
- [ ] Check if payload-d1 has media upload script
- [ ] Verify R2 bucket has the files
- [ ] Import media metadata

---

### Phase 4: Restore Thumbnail Generation

#### Step 4.1: Sharp (Dev Mode)
- [ ] Already restored in Media.ts from payload-d1
- [ ] Test: Upload image in dev mode
- [ ] Verify thumbnails are generated
- [ ] Verify sizes metadata is stored

#### Step 4.2: Jimp (Workers/Preview Mode)
- [ ] Check if payload-d1 has Jimp implementation
- [ ] If yes, copy it
- [ ] If no, implement based on Sharp config
- [ ] Add runtime detection (Node.js = Sharp, Workers = Jimp)
- [ ] Test: Upload image in preview mode
- [ ] Verify thumbnails are generated in Workers

---

### Phase 5: Testing

#### Step 5.1: Dev Mode Tests
- [ ] Start dev server: `pnpm dev`
- [ ] Log in to admin panel
- [ ] Verify all collections are visible
- [ ] Test creating new comic
- [ ] Test creating new chapter
- [ ] Test creating new page
- [ ] Test uploading media
- [ ] Verify thumbnails are generated
- [ ] Verify relationships work

#### Step 5.2: Preview Mode Tests (CRITICAL - Workers Runtime)
- [x] Set wrangler.jsonc to use local D1 (`"remote": false`)
- [x] Build and start preview: `pnpm preview`
- [x] Log in to admin panel
- [x] **CRITICAL TEST:** Upload media in Workers runtime
- [x] ✅ **SUCCESS:** File upload worked (`POST /api/media 201 Created`)
- [x] ✅ **NO "Unauthorized" 500 errors**
- [x] ✅ **CONFIRMED:** INTEGER primary keys solve Workers file upload bug
- [ ] Verify thumbnails are generated (Jimp not yet implemented)

#### Step 5.3: Frontend Integration
- [ ] Update frontend code to use `media.uuid` instead of `media.id`
- [ ] Test API routes that query by UUID
- [ ] Verify public URLs use UUIDs

---

## Current Status

### ✅ Completed
- **Phase 1:** All collection configurations adapted with hybrid UUID approach
  - Comics, Chapters, Pages, Media, Users all have INTEGER id + UUID field
  - All collections imported in payload.config.ts
  - Users collection has role field for access control
- **Phase 2:** Database migrations generated and applied
  - Clean migration: `20251015_031439_complete_schema.ts`
  - Local D1 database has complete schema
  - All uuid fields and indexes created
- **Phase 5 (Partial):** Critical testing completed
  - ✅ Dev mode file uploads working
  - ✅ Preview mode file uploads working (Workers runtime)
  - ✅ **CONFIRMED:** Hybrid UUID approach solves Workers upload bug

### 🔄 In Progress
- None - Ready for next phase

### ⏳ Not Started (Next Steps)
- **Phase 3:** Import data from payload-d1
  - Users (with preserved UUIDs and passwords)
  - Comics, Chapters, Pages (with ownership preserved)
  - Media metadata (files need to be in R2)
- **Phase 4:** Implement Jimp thumbnail generation for Workers
- **Phase 5 (Remaining):** Frontend integration and remote D1 migration

---

## Notes and Decisions

### Decision Log

**2025-10-15:** Chose hybrid UUID approach over TEXT primary keys
- Reason: TEXT primary keys break file uploads in Workers
- Trade-off: Need to maintain both id and uuid fields
- Result: File uploads now work in preview mode

**2025-10-15:** Chose Option B (detailed plan) over immediate execution
- Reason: Need ability to pause and resume migration
- Benefit: Clear checklist for multi-session work

**2025-10-15:** Added UUID and role fields to Users collection
- Reason: Preserve user identity and login credentials during data import
- Benefit: Original creator from payload-d1 will still own their comic data
- Implementation: Same hybrid UUID approach as other collections

**2025-10-15:** CONFIRMED - Workers file upload bug solved
- Test: Uploaded media in preview mode (Workers runtime) with INTEGER primary keys
- Result: `POST /api/media 201 Created` - Success!
- Conclusion: Hybrid UUID approach (INTEGER id + UUID field) is the correct solution

### Important Considerations

1. **Relationships:** Old data uses UUID strings for relationships. We need to:
   - Transform these to reference the new INTEGER ids
   - OR: Update relationship queries to use uuid field instead

2. **Frontend Impact:** Minimal if frontend already uses long string IDs
   - Just swap `media.id` → `media.uuid` references
   - UUID format is identical, just different field name

3. **Media Files:** R2 bucket needs to have the actual files
   - Check payload-d1 for upload scripts
   - May need to re-upload media to R2

4. **Access Control:** payload-d1 Media collection has detailed access control
   - Should we keep it or simplify?
   - Current chimera-d1 Media is very basic

---

## Next Steps

**When resuming this migration:**

1. Check this document for current status
2. Find the first unchecked [ ] box
3. Complete that step
4. Mark it complete with [x]
5. Commit changes with descriptive message
6. Move to next step

**Current Next Step:**
→ Phase 3: Import data from payload-d1 (users, comics, chapters, pages, media)
→ Phase 4: Implement Jimp thumbnail generation for Workers runtime

**Before Production Deployment:**
- Need to migrate remote D1 schema (run migrations on production database)
- Ensure R2 bucket has all media files from payload-d1
