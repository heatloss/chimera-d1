# Reproduction Steps for Payload CMS Workers Hook Bug

## Quick Reproduction (5 minutes)

### 1. Create from Official Template

```bash
npx create-payload-app@latest my-test-app
```

Select:
- Template: **Cloudflare D1**
- Package manager: **pnpm**

### 2. Add Custom ID Hook

Edit `src/collections/Media.ts` and add the custom ID field with hook:

```typescript
import type { CollectionConfig } from 'payload'

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
        hidden: true,
      },
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

### 3. Test Local Dev (Works)

```bash
pnpm dev
```

Navigate to http://localhost:3000/admin/collections/media and upload a file.
**Result**: ✅ Upload succeeds

### 4. Test Workers Preview (Fails)

```bash
pnpm wrangler login
pnpm preview
```

Navigate to the preview URL `/admin/collections/media` and upload a file.
**Result**: ❌ `POST /api/media 500 Internal Server Error`

## Expected vs Actual

- **Expected**: Hooks work in both dev and production
- **Actual**: Hooks work in dev, fail with 500 error in Workers

## Verification Test

To verify this is hook-related, remove the `hooks` section from the `id` field and change `required: true` to `required: false`:

```typescript
{
  name: 'id',
  type: 'text',
  required: false,  // Changed
  admin: {
    hidden: true,
  },
  // hooks removed
}
```

Rebuild and test preview again:
**Result**: ✅ Upload succeeds (without custom ID generation)

## Full Reproduction Repository

For a complete working example with all testing steps documented, see:
[Your GitHub repo URL here if you create one]

Or follow the steps above starting from the official Payload Cloudflare template.
