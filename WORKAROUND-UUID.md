# UUID Workaround Documentation

## Status: TEMPORARY WORKAROUND
**Date Implemented**: October 12, 2025
**Reason**: PayloadCMS hooks break in Cloudflare Workers runtime
**GitHub Issue**: [Link to your submitted issue]
**Expected Resolution**: Pending fix from PayloadCMS team

---

## Problem Statement

PayloadCMS field-level and collection-level hooks fail during file upload operations in Cloudflare Workers environments. This prevents the use of the officially recommended pattern for generating custom UUIDs via `beforeValidate` hooks.

### What We Want (But Can't Use)
```typescript
// ❌ THIS BREAKS IN WORKERS
fields: [
  {
    name: 'id',
    type: 'text',
    hooks: {
      beforeValidate: [
        ({ value, operation }) => {
          if (operation === 'create' && !value) {
            return crypto.randomUUID()
          }
          return value
        }
      ]
    }
  }
]
```

### Why It Breaks
- Works perfectly in local dev (`pnpm dev`)
- Fails with 500 error in Workers (`pnpm preview` or production)
- Error occurs during multipart form upload processing
- Affects ALL hooks (field-level and collection-level) during file uploads

See `BUG-REPORT.md` for full investigation details.

---

## Our Workaround Solution

We generate UUIDs **manually** before calling Payload APIs, rather than relying on Payload hooks.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     UUID Generation Flow                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Custom Frontend                    Payload Admin UI         │
│        ↓                                   ↓                 │
│   API Routes                        UUIDField Component      │
│        ↓                                   ↓                 │
│   Generate UUID                     Generate UUID            │
│        ↓                                   ↓                 │
│   ┌────────────────────────────────────────────┐           │
│   │    payload.create({ data: { id, ... } })   │           │
│   └────────────────────────────────────────────┘           │
│                         ↓                                    │
│              Cloudflare D1 Database                          │
│              (TEXT column stores UUID)                       │
└─────────────────────────────────────────────────────────────┘
```

### Two Implementation Paths

#### Path 1: API Routes (Primary Use Case)
For custom frontend applications that upload via API:

```typescript
// app/api/media/upload/route.ts
import { getPayload } from 'payload'

export async function POST(req: Request) {
  const payload = await getPayload({ config })
  const formData = await req.formData()

  // Generate UUID manually before calling Payload
  const id = crypto.randomUUID()

  const media = await payload.create({
    collection: 'media',
    data: {
      id,  // ← Manually provided UUID
      file: formData.get('file'),
      alt: formData.get('alt'),
    },
  })

  return Response.json(media)
}
```

#### Path 2: Custom React Component (Admin UI Fallback)
For emergency admin uploads via Payload Admin UI:

```typescript
// src/components/UUIDField.tsx
'use client'
import { useEffect } from 'react'
import { useForm } from '@payloadcms/ui'

/**
 * WORKAROUND COMPONENT
 *
 * Generates UUIDs client-side for Media collection uploads via Admin UI.
 *
 * Why this exists:
 * - PayloadCMS hooks break in Cloudflare Workers during file uploads
 * - This component runs in the browser (not Workers) so it works
 * - Automatically sets UUID when upload form loads
 * - Transparent to admin users (hidden field)
 *
 * When to remove:
 * - When PayloadCMS fixes hook execution in Workers runtime
 * - See WORKAROUND-UUID.md for migration instructions
 *
 * Related:
 * - GitHub Issue: [your issue link]
 * - Bug Report: BUG-REPORT.md
 */
export const UUIDField = () => {
  const { getDataByPath, setDataByPath } = useForm()
  const id = getDataByPath('id')

  useEffect(() => {
    // Only set UUID if one doesn't already exist
    if (!id) {
      const newId = crypto.randomUUID()
      console.log('[UUIDField Workaround] Generated UUID:', newId)
      setDataByPath('id', newId)
    }
  }, [id, setDataByPath])

  // Hidden field - no UI needed
  return null
}
```

---

## Configuration Changes

### 1. Database Adapter (`src/payload.config.ts`)

```typescript
import { sqliteD1Adapter } from '@payloadcms/db-d1-sqlite'

export default buildConfig({
  // ... other config
  db: sqliteD1Adapter({
    binding: cloudflare.env.D1,

    // WORKAROUND: Use TEXT column type for UUIDs instead of INTEGER
    idType: 'text',

    // WORKAROUND: Allow manually specifying IDs during record creation
    // Without this, Payload rejects { id: '...' } in create() calls
    allowIDOnCreate: true,
  }),
})
```

**Why these settings:**
- `idType: 'text'` - Creates TEXT columns instead of INTEGER for ID fields
- `allowIDOnCreate: true` - Permits passing custom ID values to `payload.create()`

### 2. Media Collection (`src/collections/Media.ts`)

```typescript
import type { CollectionConfig } from 'payload'
import { UUIDField } from '../components/UUIDField'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'id',
      type: 'text',
      required: true,
      admin: {
        hidden: true,  // Don't show in Admin UI
        components: {
          // WORKAROUND: Custom component generates UUID client-side
          Field: UUIDField,
        },
      },
      // NOTE: No hooks - they break in Workers!
      // hooks: { beforeValidate: [...] }  ← DO NOT ADD THIS
    },
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
  upload: {
    crop: false,
    focalPoint: false,
  },
}
```

---

## Database Schema

The workaround uses the same schema as the native Payload approach would:

```sql
CREATE TABLE media (
  id TEXT PRIMARY KEY,  -- ← UUID stored as TEXT
  alt TEXT NOT NULL,
  filename TEXT,
  -- ... other upload fields
  created_at DATETIME,
  updated_at DATETIME
);
```

**Example data:**
```
| id                                   | filename    | alt          |
|--------------------------------------|-------------|--------------|
| 550e8400-e29b-41d4-a716-446655440000 | photo1.jpg  | Beach photo  |
| 6ba7b810-9dad-11d1-80b4-00c04fd430c8 | logo.png    | Company logo |
```

---

## Usage Examples

### For Custom Frontend Developers

When uploading files via API:

```typescript
// Your frontend code
const uploadFile = async (file: File, alt: string) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('alt', alt)

  const response = await fetch('/api/media/upload', {
    method: 'POST',
    body: formData,
  })

  return response.json()
}

// The API route handles UUID generation automatically
// You don't need to generate UUIDs in frontend code
```

### For Admin Users

When uploading via Payload Admin UI (`/admin/collections/media/create`):

1. Navigate to Media collection
2. Click "Create New"
3. Upload file and fill in alt text
4. Click "Save"
5. **UUID is generated automatically** (via UUIDField component)

**Admin users don't need to do anything differently** - the workaround is transparent.

---

## Testing Checklist

Before deploying to production, verify:

### Local Development
- [ ] Files upload successfully via Admin UI
- [ ] Files upload successfully via API routes
- [ ] Generated IDs are valid UUIDs
- [ ] Created records appear in database with TEXT IDs

### Workers Preview (`pnpm preview`)
- [ ] Files upload successfully via Admin UI (no 500 errors)
- [ ] Files upload successfully via API routes
- [ ] Check browser console for UUID generation logs
- [ ] Verify records in D1 database have UUIDs

### Production (Cloudflare Workers)
- [ ] End-to-end upload test via custom frontend
- [ ] Emergency admin upload test via Payload UI
- [ ] Verify all existing records still accessible
- [ ] Check error logs for any UUID-related issues

---

## Migration Plan: Switching to Native Hooks

### When to Migrate

Migrate back to native Payload hooks when:
1. PayloadCMS team fixes the Workers runtime issue
2. The GitHub issue is marked as resolved
3. You've tested the fix in preview environment

### Migration Steps

#### Step 1: Update Media Collection
```typescript
// src/collections/Media.ts
export const Media: CollectionConfig = {
  fields: [
    {
      name: 'id',
      type: 'text',
      required: true,
      admin: {
        hidden: true,
        // REMOVE THIS:
        // components: {
        //   Field: UUIDField,
        // },
      },
      // ADD THIS:
      hooks: {
        beforeValidate: [
          ({ value, operation }) => {
            if (operation === 'create' && !value) {
              return crypto.randomUUID()
            }
            return value
          }
        ]
      }
    },
    // ... other fields
  ],
}
```

#### Step 2: Delete Workaround Component
```bash
rm src/components/UUIDField.tsx
```

#### Step 3: Update API Routes
Remove manual UUID generation from all API routes:

```typescript
// BEFORE (workaround)
const id = crypto.randomUUID()  // ← Remove this
await payload.create({
  collection: 'media',
  data: { id, file, alt }  // ← Remove id from data
})

// AFTER (native)
await payload.create({
  collection: 'media',
  data: { file, alt }  // Hook generates id automatically
})
```

#### Step 4: (Optional) Clean Up Config
```typescript
// src/payload.config.ts
db: sqliteD1Adapter({
  binding: cloudflare.env.D1,
  idType: 'text',  // Keep this
  // allowIDOnCreate: true,  // Remove this (optional)
})
```

#### Step 5: Test Migration
- [ ] Test new uploads via Admin UI
- [ ] Test new uploads via API
- [ ] Verify existing records still work
- [ ] Check all relationships still resolve

### Database Impact

**No database migration needed** - existing records already have UUIDs stored as TEXT and will continue to work identically.

### Estimated Migration Effort

- Code changes: 10-15 minutes
- Testing: 20-30 minutes
- Total: 30-45 minutes
- Risk level: Low

---

## Troubleshooting

### Issue: "Cannot insert explicit ID"

**Symptom:** Error when trying to create records with manual IDs

**Cause:** `allowIDOnCreate` not set in database adapter config

**Fix:**
```typescript
db: sqliteD1Adapter({
  binding: cloudflare.env.D1,
  allowIDOnCreate: true  // ← Add this
})
```

### Issue: Admin UI uploads still fail with 500 error

**Symptom:** Uploads fail even with UUIDField component

**Possible causes:**
1. Component not properly imported in Media collection
2. `idType: 'text'` not set in database config
3. Different hook still present in collection config

**Debug steps:**
1. Check browser console for UUID generation log
2. Verify Media.ts imports UUIDField correctly
3. Verify payload.config.ts has `idType: 'text'`
4. Search for any remaining `hooks:` in Media collection

### Issue: UUIDs not being generated

**Symptom:** Records created with undefined or null IDs

**Cause:** UUIDField component not firing or API routes not generating UUIDs

**Fix:**
- Admin UI: Check that `components.Field: UUIDField` is set on id field
- API routes: Verify `crypto.randomUUID()` is called before `payload.create()`

### Issue: "crypto.randomUUID is not a function"

**Symptom:** Error in older Node.js versions

**Cause:** `crypto.randomUUID()` requires Node.js 14.17.0+

**Fix:** Upgrade Node.js or use polyfill:
```typescript
import { randomUUID } from 'crypto'
const id = randomUUID()
```

---

## Related Documentation

- **Bug Investigation**: `BUG-REPORT.md` - Full root cause analysis
- **GitHub Issue**: `GITHUB-ISSUE.md` - Issue template for PayloadCMS team
- **Reproduction Steps**: `REPRODUCTION-STEPS.md` - How to reproduce the bug
- **PayloadCMS Discussion**: https://github.com/payloadcms/payload/discussions/5878

---

## Questions & Decisions Log

### Why not use auto-increment IDs?
Sequential integer IDs are predictable and pose a security risk. UUIDs provide:
- Non-sequential, unpredictable IDs
- No information leakage about record counts
- Better security for public-facing APIs

### Why not use a hybrid approach with both ID types?
Maintaining two ID systems (internal integer, public UUID) adds complexity:
- More fields to manage
- More migration overhead
- Confusion about which ID to use where
- Our use case doesn't require this complexity

### Can we use the database to generate UUIDs?
D1/SQLite doesn't have native UUID generation. Options would be:
- `lower(hex(randomblob(16)))` - Not RFC 4122 compliant
- Custom SQL function - Requires D1 extensions (not available)
- Manual generation is simpler and more portable

### Why allow manual IDs at all? Security concern?
`allowIDOnCreate: true` is safe in this context because:
- IDs are generated by our code, not user input
- Users never directly submit ID values
- API routes and Admin UI both use crypto.randomUUID()
- Payload still validates ID uniqueness

---

## Maintenance Notes

**Last Updated**: October 12, 2025
**Maintained By**: [Your team name]
**Review Frequency**: Check monthly for PayloadCMS updates
**Monitoring**: Watch GitHub issue for resolution updates

When the bug is fixed:
1. Update this document's status to "RESOLVED"
2. Follow migration plan above
3. Archive this document for historical reference
4. Update team documentation/wiki
