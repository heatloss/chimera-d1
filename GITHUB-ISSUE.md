# GitHub Issue for Payload CMS

## Title
`beforeValidate` hooks break Media uploads in Cloudflare Workers deployment

## Labels
- bug
- cloudflare
- workers

## Description

### Environment
- **Payload CMS**: 3.58.0
- **Next.js**: 15.5.4
- **@opennextjs/cloudflare**: 1.10.1
- **Deployment**: Cloudflare Workers (via OpenNext adapter)
- **Database**: D1 (remote mode)
- **Storage**: R2

### Summary

Media file uploads fail with a 500 error in Cloudflare Workers (preview/production) when using `beforeValidate` or `beforeChange` hooks on upload-enabled collections. The same code works perfectly in local development.

### Issue

Following the officially recommended pattern from [discussion #5878](https://github.com/payloadcms/payload/discussions/5878) for generating custom UUIDs causes complete upload failure in Workers runtime:

```typescript
export const Media: CollectionConfig = {
  slug: 'media',
  upload: true,
  fields: [
    {
      name: 'id',
      type: 'text',
      required: true,
      admin: { hidden: true },
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

**Result in Workers**: `POST /api/media 500 Internal Server Error`
**Result in dev**: ✅ Works perfectly

### Systematic Testing Results

We performed incremental testing to isolate the exact cause:

| Configuration | Local Dev | Workers (Preview) |
|--------------|-----------|-------------------|
| Base template (no custom fields) | ✅ Works | ✅ Works |
| Custom `id` field, no hooks | ✅ Works | ✅ Works |
| Custom `id` + field-level `beforeValidate` hook | ✅ Works | ❌ 500 Error |
| Custom `id` + collection-level `beforeChange` hook | ✅ Works | ❌ 500 Error |

### Key Finding

**ANY hooks (field-level OR collection-level) that run during Media upload operations break file uploads in Cloudflare Workers.** This is NOT specific to UUID generation - any data manipulation via hooks fails.

### Reproduction Steps

1. Create a PayloadCMS project using the Cloudflare template
2. Add a `beforeValidate` hook to a field in an upload-enabled collection
3. Build and run `pnpm preview` (or deploy to Workers)
4. Attempt to upload a file
5. Observe 500 Internal Server Error

### Expected Behavior

Hooks should work consistently across all runtime environments, including Cloudflare Workers. The pattern recommended in discussion #5878 should work in production deployments.

### Actual Behavior

- **Local dev (`pnpm dev`)**: Works perfectly ✅
- **Workers preview (`pnpm preview`)**: 500 error ❌
- **Workers production**: 500 error ❌

Error response: `{"errors":[{"message":"Something went wrong."}]}`

No detailed error information is available in Workers runtime logs.

### Impact

This affects:
- **Security**: Cannot use UUIDs instead of sequential integers for IDs
- **Any custom validation/transformation**: All hooks during upload operations fail
- **Official guidance**: The recommended pattern from #5878 doesn't work in Workers

### Potential Root Cause

The issue appears to be related to how Payload processes hooks during multipart form uploads in the Workers runtime. Possible causes:

1. Hook execution context differs between Node.js and Workers
2. File upload stream handling incompatible with hook execution
3. OpenNext Cloudflare adapter may not properly handle request context during hooks

### Workarounds

#### Option 1: Manual UUID Generation (Current Solution)
Generate UUIDs in application code before calling Payload:

```typescript
const id = crypto.randomUUID()
await payload.create({
  collection: 'media',
  data: { id, file, ...otherData }
})
```

**Pros**: Works in Workers, maintains UUID security
**Cons**: Not automatic, requires manual ID generation everywhere

#### Option 2: Accept Auto-Increment IDs
Use Payload's default ID generation:

**Pros**: No code changes needed
**Cons**: Sequential IDs are predictable (security concern)

### Related

- Original discussion where pattern was recommended: #5878
- This may also affect other hooks during file operations in Workers
- May be related to OpenNext Cloudflare adapter's request handling

### Request

1. **Fix**: Enable hooks to work during file uploads in Workers runtime
2. **Documentation**: Add note to Cloudflare deployment guide about hook limitations
3. **Error Handling**: Provide more detailed error messages in Workers runtime

### Additional Context

We created a clean reproduction repo starting from the official Cloudflare template and incrementally added features until the bug manifested. Full documentation available in our bug report.

The same code pattern works in:
- Local development
- Node.js deployments
- Vercel deployments (likely, untested)

But fails specifically in Cloudflare Workers environment.

---

## How to Submit

1. Go to https://github.com/payloadcms/payload/issues/new
2. Copy the content above
3. Select appropriate labels: `bug`, `cloudflare`, `workers`
4. Submit the issue

Alternatively, if you prefer to report via Discord first, share this information in the #help channel and mention the Cloudflare Workers context.
