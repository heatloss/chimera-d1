import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'
import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'

// Initialize Cloudflare context for local development
// This sets up the R2/D1 bindings so getCloudflareContext() works in API routes
initOpenNextCloudflareForDev()

const nextConfig: NextConfig = {
  // Your Next.js config here
      output: 'standalone', // Required for OpenNext Cloudflare builds

  webpack: (webpackConfig: any, { isServer }: any) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    // Exclude @cf-wasm/photon from client bundle (only needed server-side in Workers)
    if (!isServer) {
      webpackConfig.resolve.alias = {
        ...webpackConfig.resolve.alias,
        '@cf-wasm/photon': false,
      }
    }

    // Enable WASM support for wasm-image-optimization
    if (isServer) {
      // Use ESM entry which has WASM embedded as base64
      webpackConfig.resolve.alias = {
        ...webpackConfig.resolve.alias,
        'wasm-image-optimization': path.join(__dirname, 'node_modules/wasm-image-optimization/dist/esm/index.js'),
      }

      // Enable async WebAssembly - this makes .wasm imports work natively
      webpackConfig.experiments = {
        ...webpackConfig.experiments,
        asyncWebAssembly: true,
      }

      // Let webpack handle .wasm files as WebAssembly modules (not as assets)
      // Remove any existing rules that might interfere
      webpackConfig.module.rules = webpackConfig.module.rules.filter(
        (rule: any) => !rule.test?.toString().includes('wasm')
      )
    }

    return webpackConfig
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
