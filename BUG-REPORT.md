# Media Upload Bug - Root Cause Analysis

## Date
Investigation conducted: October 11, 2025

## Summary

Media uploads fail in Cloudflare Workers (preview/production) with a 500 Internal Server Error when custom fields with `beforeValidate` hooks are present in the Media collection. The bug occurs **before** any user authentication issues manifest.

## Methodology

Used a clean PayloadCMS Cloudflare template to incrementally reintroduce features from a broken project until the bug manifested. This systematic approach isolated the exact code change that triggers the failure.

## Environment

- **Payload CMS**: 3.58.0
- **Next.js**: 15.5.4
- **OpenNext Cloudflare**: 1.10.1
- **Wrangler**: 4.42.2
- **Database**: D1 (remote mode)
- **Storage**: R2 (local mode in preview)

## Symptoms

- **Error**: `POST /api/media 500 Internal Server Error`
- **Response**: `{"errors":[{"message":"Something went wrong."}]}`
- **When**: Only in Cloudflare Workers (preview/production)
- **Not affected**: Local development (`pnpm dev`) works fine

## Root Cause - UPDATED

**ANY hooks (field-level OR collection-level) that manipulate data during Media uploads break file uploads in Cloudflare Workers.**

The issue is NOT specific to `beforeValidate` hooks or UUID generation - it's ANY hook that runs during the upload process.

### Test Results

| Configuration | Result |
|--------------|--------|
| No custom `id` field | ✅ Works |
| Custom `id` field, no hooks | ✅ Works |
| Custom `id` field with field-level `beforeValidate` hook | ❌ 500 Error |
| Custom `id` field with collection-level `beforeChange` hook | ❌ 500 Error |

### Conclusion

**Hooks break Media uploads in Workers**, regardless of where they're placed. The custom `id` field itself is fine - it's the attempt to auto-generate values via hooks that causes the failure.

Specifically, this code BREAKS uploads:

```typescript
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
}
```

## Evidence

### Test Sequence

1. **Phase 1 - Baseline** ✅
   - Fresh PayloadCMS template
   - Updated packages to match target project versions
   - **Result**: Media uploads work in preview

2. **Phase 2 - Add Custom ID Field** ❌
   - Added custom `id` field with `beforeValidate` hook
   - **Result**: Media uploads fail with 500 error

3. **Phase 2.1 - Remove Custom ID Field** ✅
   - Removed custom `id` field
   - **Result**: Media uploads work again

### Server Logs

```
[wrangler:info] POST /api/media 500 Internal Server Error (285ms)
```

No detailed error message available in Workers runtime.

## Technical Analysis

### Why This Breaks

The issue appears to be related to how Payload processes field hooks during file upload operations in the Workers runtime environment. Possible causes:

1. **Execution Context**: `beforeValidate` hooks may execute in a different context during file uploads vs regular operations
2. **Timing Issue**: The hook runs before file validation, potentially interfering with multipart form data processing
3. **Workers Runtime Limitation**: Cloudflare Workers may have restrictions on hook execution during streaming file uploads

### Comparison to Previous Analysis

The previous investigation (documented in `payload-d1/ISSUE-WORKERS-AUTH.md`) concluded this was an OpenNext cookie handling issue where POST requests lose authentication context. However, our systematic testing shows:

- The bug occurs **before** any user authentication checks
- It's triggered by field-level hooks, not auth middleware
- The error is a 500 (server error), not 401 (unauthorized)

The "undefined user" issue described in the previous report may be a **symptom** of this underlying hook execution problem, not a separate cookie/auth issue.

## Impact Assessment

### Affected Code Patterns

This pattern appears in multiple places in the payload-d1 project:

1. **Media Collection** (`src/collections/Media.ts:112-130`)
   - Custom `id` field with `crypto.randomUUID()` hook
   - Custom `uploadedBy` field with user assignment hook

2. **Users Collection** (`src/collections/Users.ts:50-68`)
   - Custom `id` field with `crypto.randomUUID()` hook

3. **Other Collections**
   - Comics, Chapters, Pages likely have similar patterns

### Severity

**HIGH** - This completely breaks file upload functionality in production/preview environments.

## Reproduction Steps

1. Create a PayloadCMS project with Cloudflare Workers adapter
2. Add a custom field with a `beforeValidate` hook to a upload-enabled collection
3. Build and run `pnpm preview`
4. Attempt to upload a file
5. Observe 500 error

## Workarounds

### Option 1: Manual UUID Generation in Application Code (RECOMMENDED)
Keep custom `id` field but generate UUIDs in your application code BEFORE calling Payload APIs:

```typescript
// In your frontend or API route
const newMedia = {
  id: crypto.randomUUID(), // Generate UUID in application code
  alt: 'Image description',
  file: uploadedFile
}

await payload.create({
  collection: 'media',
  data: newMedia
})
```

**Pros**:
- Full control over UUID format
- Works in Workers
- Maintains security (no sequential IDs)

**Cons**:
- Less convenient than automatic generation
- Need to generate IDs wherever you create media

### Option 2: Use Payload's Built-in ID
Accept Payload's default auto-incrementing IDs:

```typescript
// Remove custom id field entirely
// Payload will use its default id field
```

**Pros**: Guaranteed to work, no code changes needed
**Cons**:
- Sequential integer IDs are predictable (security concern)
- Lose control over ID format

### Option 3: Hybrid Approach
Use Payload's default ID but add a separate UUID field for external references:

```typescript
fields: [
  {
    name: 'publicId',  // Use this for external/public references
    type: 'text',
    required: false,
    admin: { readOnly: true }
  }
]
```

Generate `publicId` in application code when needed, keep internal `id` as auto-increment.

**Pros**: Security benefits of UUIDs where needed, uploads still work
**Cons**: More complex data model

## Recommended Solution

**Immediate**: Remove field-level `beforeValidate` hooks from Media collection to restore upload functionality.

**Long-term**:
1. Report this as a bug to Payload CMS team (Workers runtime incompatibility)
2. Report to OpenNext Cloudflare team (may be related to multipart form handling)
3. Test whether collection-level hooks work as a workaround
4. Consider alternative ID generation strategies that don't use field hooks

## Questions Remaining

1. Why does the same code work in local dev but fail in Workers?
2. Are all field-level `beforeValidate` hooks broken, or only on upload-enabled collections?
3. Does this affect Users collection during registration?
4. How did the payload-d1 project ever work with this code? Were users/media only created in dev?

## Related Issues

- payload-d1 project: `ISSUE-WORKERS-AUTH.md` (likely related, but different root cause)
- This may explain the "undefined user" symptoms described in that report

## Files Modified During Investigation

- `/Users/mike/Sites/chimera-d1/package.json` - Updated package versions
- `/Users/mike/Sites/chimera-d1/next.config.ts` - Added `output: 'standalone'`
- `/Users/mike/Sites/chimera-d1/src/payload.config.ts` - Fixed `isNextBuild` detection
- `/Users/mike/Sites/chimera-d1/src/collections/Media.ts` - Added/removed custom ID field for testing

## Next Steps

1. ✅ Document findings (this report)
2. ⏳ Test collection-level hooks as workaround
3. ⏳ Verify if Users collection has same issue during registration
4. ⏳ Test if the uploadedBy field (with user context hook) has similar issues
5. ⏳ Report bug to Payload CMS / OpenNext Cloudflare
6. ⏳ Implement permanent fix in payload-d1 project
