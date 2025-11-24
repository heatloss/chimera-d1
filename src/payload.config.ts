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

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Detect if we're in Cloudflare Workers runtime (no wrangler available)
// In Workers: use getCloudflareContext (already initialized by OpenNext)
// In dev/build: use getCloudflareContextFromWrangler (imports wrangler for local dev)
const isCloudflareWorkers = typeof globalThis.navigator !== 'undefined' &&
  globalThis.navigator.userAgent === 'Cloudflare-Workers'

const cloudflare = isCloudflareWorkers
  ? await getCloudflareContext({ async: true })
  : await getCloudflareContextFromWrangler()

// Store cloudflare context globally for access in hooks
if (typeof globalThis !== 'undefined') {
  (globalThis as any).__CLOUDFLARE_CONTEXT__ = cloudflare
}

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Comics, Chapters, Pages, Media],
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
  ],
  // CSRF protection configuration
  csrf: [
    'http://localhost:3333',
    'http://localhost:8888',
    'http://localhost:3000',
  ],
  // database-adapter-config-start
  db: sqliteD1Adapter({
    binding: cloudflare.env.D1,
  }),
  // database-adapter-config-end
  plugins: [
    // storage-adapter-placeholder
    r2Storage({
      bucket: cloudflare.env.R2,
      collections: { media: true },
    }),
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
