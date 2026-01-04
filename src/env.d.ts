// Type declarations for Cloudflare environment bindings

interface CloudflareEnv {
  D1: D1Database
  R2: R2Bucket
  ASSETS: Fetcher
  PAYLOAD_SECRET: string
  // Service binding to image processor worker
  IMAGE_WORKER: Fetcher
}

// Augment the OpenNext module to include our custom env types
declare module '@opennextjs/cloudflare' {
  export type CloudflareContext = {
    env: CloudflareEnv
    ctx: ExecutionContext
  }

  export function getCloudflareContext(options?: any): Promise<CloudflareContext>

  // Re-export the original function so TypeScript can see it
  export function initOpenNextCloudflareForDev(options?: any): Promise<void>
}
