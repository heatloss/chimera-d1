// storage-adapter-import-placeholder
import { sqliteD1Adapter } from '@payloadcms/db-d1-sqlite' // database-adapter-import
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import { CloudflareContext, getCloudflareContext } from '@opennextjs/cloudflare'
import type { GetPlatformProxyOptions } from 'wrangler'
import { r2Storage } from '@payloadcms/storage-r2'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Comics } from './collections/Comics'
import { Chapters } from './collections/Chapters'
import { Pages } from './collections/Pages'
import { Genres } from './collections/Genres'
import { Tags } from './collections/Tags'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Detect if we're in Cloudflare Workers runtime (no wrangler available)
// In Workers: use getCloudflareContext (already initialized by OpenNext)
// In dev/build: use getCloudflareContextFromWrangler (imports wrangler for local dev)
const isCloudflareWorkers = typeof globalThis.navigator !== 'undefined' &&
  globalThis.navigator.userAgent === 'Cloudflare-Workers'

// Get initial cloudflare context (for local dev this is the actual binding)
const cloudflare = isCloudflareWorkers
  ? await getCloudflareContext({ async: true })
  : await getCloudflareContextFromWrangler()

// Store cloudflare context globally for access in hooks
if (typeof globalThis !== 'undefined') {
  (globalThis as any).__CLOUDFLARE_CONTEXT__ = cloudflare
}

/**
 * Create a Proxy for D1 binding that lazily fetches fresh context in Workers.
 *
 * PROBLEM: In Cloudflare Workers with OpenNext, the D1 binding from module-level
 * initialization becomes stale during actual requests. DELETE operations
 * would return success but not actually delete records.
 *
 * SOLUTION: Use a Proxy that intercepts D1 method calls and fetches a fresh
 * binding from getCloudflareContext() at request time.
 */
function createLazyD1Binding(initialBinding: any) {
  // In local dev, just return the static binding
  if (!isCloudflareWorkers) {
    return initialBinding
  }

  // In Workers, create a proxy that gets fresh binding on each call
  return new Proxy({}, {
    get(target, prop) {
      // Get fresh context synchronously if possible, or return a function that does it async
      const freshContext = getCloudflareContext()

      if (freshContext instanceof Promise) {
        // For async context, we need to return a function that resolves the context first
        // This handles methods like prepare(), batch(), etc.
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

      // For sync context (shouldn't happen in Workers but just in case)
      const freshBinding = (freshContext as any)?.env?.D1 || initialBinding
      const value = freshBinding[prop]
      if (typeof value === 'function') {
        return value.bind(freshBinding)
      }
      return value
    }
  })
}

// Create the lazy D1 binding
const lazyD1Binding = createLazyD1Binding(cloudflare.env.D1)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Comics, Chapters, Pages, Media, Genres, Tags],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  // CORS configuration for frontend (port 8888) to access API (port 3333)
  cors: [
    'http://localhost:8888', // Frontend dev server
    'http://localhost:3333', // API dev server
    'http://localhost:3000', // Default Next.js port (fallback)
    'https://api.chimeracomics.org', // Production API/admin
    'https://cms.chimeracomics.org', // Production frontend
  ],
  // CSRF protection configuration
  csrf: [
    'http://localhost:3333',
    'http://localhost:8888',
    'http://localhost:3000',
    'https://api.chimeracomics.org',
    'https://cms.chimeracomics.org',
  ],
  // database-adapter-config-start
  db: sqliteD1Adapter({
    binding: lazyD1Binding, // Use lazy binding to get fresh D1 context per-request
    push: false, // Disable automatic schema push - use manual migrations for SQLite/D1
    logger: {
      logQuery(query: string, params: unknown[]) {
        console.log('📝 Drizzle SQL:', query)
        console.log('📝 Drizzle params:', params)
      }
    }
  }),
  // database-adapter-config-end
  plugins: [
    // storage-adapter-placeholder
    // DISABLED: R2 storage plugin doesn't work with programmatic uploads
    // We handle R2 uploads manually in Media collection's beforeChange hook
    // r2Storage({
    //   bucket: cloudflare.env.R2,
    //   collections: { media: true },
    // }),
  ],
})

// Adapted from https://github.com/opennextjs/opennextjs-cloudflare/blob/d00b3a13e42e65aad76fba41774815726422cc39/packages/cloudflare/src/api/cloudflare-context.ts#L328C36-L328C46
function getCloudflareContextFromWrangler(): Promise<CloudflareContext> {
  // Use remote bindings in production, local bindings in dev
  const useRemoteBindings = process.env.NODE_ENV === 'production'

  return import(/* webpackIgnore: true */ `${'__wrangler'.replaceAll('_', '')}`).then(
    ({ getPlatformProxy }) =>
      getPlatformProxy({
        environment: process.env.CLOUDFLARE_ENV,
        experimental: { remoteBindings: useRemoteBindings },
      } as any),
  )
}
