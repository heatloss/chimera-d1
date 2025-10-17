# Debugging 500 Errors in Production Deployment

## Current Status
The CMS has been deployed to https://chimera-d1.mike-17c.workers.dev but all endpoints return 500 Internal Server Error.

## Root Cause Analysis

### Confirmed Issues

1. **Multiple `eval()` statements in bundled code**
   - Location: `.open-next/server-functions/default/handler.mjs`
   - Lines: 247, 277, 632, 792
   - Impact: `eval()` with dynamic imports doesn't work reliably in Cloudflare Workers
   - These appear to be from Payload CMS's migration system trying to dynamically load migration files

2. **Missing migrations directory in build**
   - The `/src/migrations` directory is not bundled into `.open-next/`
   - If Payload tries to access migration files at runtime, it will fail

3. **Cloudflare Workers limitations**
   - No access to filesystem
   - Limited dynamic import capabilities
   - Different runtime environment than Node.js

## Recommended Debugging Steps

### Step 1: View Production Logs (MOST IMPORTANT)
Go to Cloudflare Dashboard to see actual error:
1. Visit: https://dash.cloudflare.com/
2. Navigate to: **Workers & Pages** → **chimera-d1** → **Logs**
3. Click "Begin log stream"
4. Make a request to your site: https://chimera-d1.mike-17c.workers.dev/
5. Look for error messages and stack traces

**This will show you the EXACT error message and stack trace.**

### Step 2: Test Production Build Locally
```bash
# Kill any existing wrangler processes
pkill -f "wrangler"

# Start local production server
pnpm wrangler dev .open-next/worker.js

# In another terminal, test it
curl http://localhost:8787/

# Check the terminal output for errors
```

### Step 3: Enable Debug Logging
Add console.log statements to see where it's failing:

Edit `src/payload.config.ts` and add logging:
```typescript
console.log('Payload config: Starting initialization')
const cloudflare = /* ... existing code ... */
console.log('Payload config: Got Cloudflare context', !!cloudflare)
console.log('Payload config: Environment', process.env.NODE_ENV)
```

Then rebuild and redeploy:
```bash
pnpm run build
pnpm run deploy
```

## Potential Solutions

### Solution 1: Disable Migration System in Production
Modify `src/payload.config.ts` to skip migration loading in production:

```typescript
export default buildConfig({
  // ... other config ...
  db: sqliteD1Adapter({
    binding: cloudflare.env.D1,
    idType: 'text',
    allowIDOnCreate: true,
    // Disable auto-migration in production
    push: false,
  }),
})
```

### Solution 2: Use Environment-Specific Config
Create a production-specific config that doesn't try to load migrations:

```typescript
const isProd = process.env.NODE_ENV === 'production' && !process.env.CLOUDFLARE_ENV

export default buildConfig({
  // ... config ...
  db: sqliteD1Adapter({
    binding: cloudflare.env.D1,
    idType: 'text',
    allowIDOnCreate: true,
    ...(isProd ? { push: false, migrationDir: undefined } : {}),
  }),
})
```

### Solution 3: Pre-bundle Migrations
If Payload requires migrations at runtime, they need to be bundled differently. This might require custom webpack/esbuild configuration.

## Next Steps

1. **First**: Check Cloudflare Dashboard logs (Step 1 above) - this will tell us the exact error
2. **Then**: Based on the error, apply one of the solutions above
3. **Test**: Redeploy and verify the fix works

## Additional Notes

- The database schema is already correct and populated
- The PAYLOAD_SECRET is configured
- Local dev with remote D1 works fine
- The issue is specifically with the production Workers runtime environment

## Questions to Answer

From the Cloudflare logs, we need to find:
1. What is the exact error message?
2. What is the stack trace showing?
3. Which file/function is failing?
4. Is it happening during initialization or on first request?

Once we have these answers, we can apply the appropriate fix.
