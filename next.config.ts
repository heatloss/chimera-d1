import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

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

    return webpackConfig
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
