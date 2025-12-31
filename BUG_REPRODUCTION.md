# Payload D1 DELETE Bug Reproduction

This branch demonstrates a bug where `@payloadcms/db-d1-sqlite` DELETE operations return success but do not actually delete records from D1 when deployed to Cloudflare Workers.

## Bug Summary

- **Affected Package:** `@payloadcms/db-d1-sqlite@3.69.0`
- **Environment:** Cloudflare Workers (production only - local dev works correctly)
- **Deployment Method:** OpenNext (`@opennextjs/cloudflare@1.14.7`)

## Symptoms

1. DELETE requests via Payload API return 200 OK with the deleted document
2. The Payload Admin UI shows the record as deleted
3. Subsequent Payload queries may not find the record (due to caching)
4. **BUT:** The record still exists in D1 and reappears on page refresh

## Root Cause

The D1 binding passed to `sqliteD1Adapter()` is captured at **module initialization time** in `payload.config.ts`. In Cloudflare Workers, this binding becomes stale by the time actual HTTP requests arrive.

The stale binding accepts queries and returns success responses, but write operations (including DELETEs) are not committed to the actual database.

This occurs because Cloudflare Workers are stateless and ephemeral - the binding established at cold-start may not remain valid for subsequent request handling.

## Reproduction Steps

### Prerequisites

- Cloudflare account with D1 database
- Wrangler CLI configured

### Deploy and Test

1. Clone this branch:
   ```bash
   git clone -b payload-d1-bug-repro https://github.com/heatloss/chimera-d1.git
   cd chimera-d1
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Set up your D1 database and update `wrangler.toml` with your database ID

4. Deploy to Cloudflare Workers:
   ```bash
   pnpm run build
   pnpm wrangler deploy
   ```

5. Run the test endpoint:
   ```bash
   curl https://your-worker.workers.dev/api/delete-test
   ```

6. Observe the response - if the bug is present, you'll see:
   ```json
   {
     "conclusion": {
       "bugPresent": true,
       "message": "BUG CONFIRMED: Payload says deleted, but record still exists in D1!"
     }
   }
   ```

### Local Testing (Bug Does NOT Appear)

Running locally with `pnpm dev` will NOT reproduce the bug because wrangler maintains a stable D1 binding throughout the dev session.

## Test Endpoint

The file `src/app/api/delete-test/route.ts` contains a self-contained test that:

1. Creates a test record via Payload
2. Verifies it exists via direct D1 query
3. Deletes it via Payload API
4. Checks if Payload thinks it's deleted
5. Checks if D1 actually deleted it
6. Reports the discrepancy

## Workaround

See the `main` branch for the fix. The solution is to create a Proxy that lazily fetches a fresh D1 binding from `getCloudflareContext()` on each database operation:

```typescript
// In payload.config.ts
import { getCloudflareContext } from '@opennextjs/cloudflare'

function createLazyD1Binding(initialBinding: any) {
  const isCloudflareWorkers = typeof globalThis.navigator !== 'undefined' &&
    globalThis.navigator.userAgent === 'Cloudflare-Workers'

  if (!isCloudflareWorkers) {
    return initialBinding // Local dev uses static binding
  }

  return new Proxy({}, {
    get(target, prop) {
      const freshContext = getCloudflareContext()
      if (freshContext instanceof Promise) {
        return (...args: any[]) => {
          return freshContext.then(ctx => {
            const freshBinding = ctx?.env?.D1 || initialBinding
            const method = freshBinding[prop]
            if (typeof method === 'function') {
              return method.apply(freshBinding, args)
            }
            return method
          })
        }
      }
      const freshBinding = (freshContext as any)?.env?.D1 || initialBinding
      const value = freshBinding[prop]
      if (typeof value === 'function') {
        return value.bind(freshBinding)
      }
      return value
    }
  })
}

// Usage
db: sqliteD1Adapter({
  binding: createLazyD1Binding(cloudflare.env.D1),
})
```

## Suggested Fix for Payload

The adapter should either:

1. Accept a function/getter for the binding instead of a static value
2. Internally use `getCloudflareContext()` when detecting a Workers environment
3. Document this limitation for Workers deployments

## Related Files

- `src/payload.config.ts` - Shows the problematic static binding pattern
- `src/app/api/delete-test/route.ts` - Test endpoint for reproduction
- `main` branch - Contains the workaround fix
