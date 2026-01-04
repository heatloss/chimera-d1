# Chimera Image Processor

A Cloudflare Worker for WASM-based image resizing and WebP conversion, used by the main Chimera app for thumbnail generation.

## Why a Separate Worker?

WASM-based image processing doesn't work reliably in the Next.js → webpack → OpenNext → esbuild pipeline. The build tooling can't handle WASM imports correctly, resulting in runtime errors on Cloudflare.

This worker bypasses that issue entirely:
- **Pure esbuild** - Wrangler uses esbuild directly, which handles WASM imports natively
- **Service binding** - Zero-latency communication with the main app (no HTTP overhead)
- **Independent deployment** - Can be updated without rebuilding the main app

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Cloudflare Edge                          │
│                                                                 │
│  ┌─────────────────────┐      Service      ┌─────────────────┐ │
│  │                     │      Binding      │                 │ │
│  │   chimera-d1        │ ───────────────── │ chimera-image-  │ │
│  │   (Main App)        │   IMAGE_WORKER    │ processor       │ │
│  │                     │                   │                 │ │
│  │  generateThumbnails │                   │  Photon (WASM)  │ │
│  │  Photon.ts          │                   │  jSquash (WASM) │ │
│  │                     │                   │                 │ │
│  └─────────────────────┘                   └─────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Hybrid Processing Pipeline

Uses two WASM libraries for optimal quality and compression:

1. **Photon** (`@cf-wasm/photon`) - Rust-based image manipulation
   - Decodes input JPEG/PNG
   - Resizes using **Lanczos3** algorithm (high quality, preserves sharpness)
   - Outputs raw RGBA pixel data

2. **jSquash** (`@jsquash/webp`) - WebP encoder with quality control
   - Takes raw pixels from Photon
   - Encodes to WebP with configurable quality (1-100)
   - Produces well-compressed output

This hybrid approach gives us:
- **Lanczos3 quality** - Best resampling for downscaling (important for comic art with linework)
- **Compression control** - Unlike Photon's `get_bytes_webp()`, jSquash supports quality settings
- **~8x smaller files** - Compared to Photon-only WebP output

## API

### `GET /health`

Health check endpoint.

```json
{
  "ok": true,
  "service": "chimera-image-processor",
  "encoder": "photon+jsquash"
}
```

### `POST /resize`

Resize and convert an image to WebP.

**Headers:**
| Header | Required | Description |
|--------|----------|-------------|
| `X-Width` | Yes | Target width in pixels |
| `X-Height` | No | Target height (0 or omit = maintain aspect ratio) |
| `X-Quality` | No | WebP quality 1-100 (default: 75) |

**Body:** Raw image bytes (JPEG or PNG)

**Response:** WebP image bytes

**Response Headers:**
- `X-Original-Width` / `X-Original-Height` - Input dimensions
- `X-Output-Width` / `X-Output-Height` - Output dimensions
- `X-Quality` - Quality setting used

## Configuration

### Worker Config (`wrangler.jsonc`)

```jsonc
{
  "name": "chimera-image-processor",
  "main": "src/index.ts",
  "compatibility_date": "2024-12-01",
  "compatibility_flags": ["nodejs_compat"]
}
```

### Service Binding (Main App `wrangler.jsonc`)

```jsonc
{
  "services": [
    {
      "binding": "IMAGE_WORKER",
      "service": "chimera-image-processor"
    }
  ]
}
```

### TypeScript Types (Main App `src/env.d.ts`)

```typescript
interface CloudflareEnv {
  // ... other bindings
  IMAGE_WORKER: Fetcher
}
```

## Deployment

### Deploy the Image Worker

```bash
cd workers/image-processor
pnpm install
pnpm run deploy
```

### Deploy Main App (includes service binding)

```bash
# From repo root
pnpm run build
pnpm exec opennextjs-cloudflare build
pnpm wrangler deploy
```

The service binding automatically connects to the deployed `chimera-image-processor` worker.

## Development

### Run Worker Locally

```bash
cd workers/image-processor
pnpm run dev
# Runs on http://localhost:8787
```

### Test Directly

```bash
# Health check
curl http://localhost:8787/health

# Resize image
curl -X POST http://localhost:8787/resize \
  -H "X-Width: 400" \
  -H "X-Quality: 75" \
  --data-binary @input.jpg \
  -o output.webp
```

### Local Development Note

The service binding (`IMAGE_WORKER`) only works on deployed Cloudflare Workers. For local development of the main app, thumbnail generation falls back to Sharp (Node.js), which is configured in `src/collections/Media.ts`:

```typescript
if (isWorkersRuntime) {
  // Cloudflare → Photon+jSquash via service binding
  const { generateThumbnailsPhoton } = await import('@/lib/generateThumbnailsPhoton')
  thumbnails = await generateThumbnailsPhoton(...)
} else {
  // Local dev → Sharp
  const { generateThumbnailsSharp } = await import('@/lib/generateThumbnailsSharp')
  thumbnails = await generateThumbnailsSharp(...)
}
```

## Integration with Main App

The main app calls this worker via `src/lib/generateThumbnailsPhoton.ts`:

```typescript
const { env } = await getCloudflareContext()

const response = await env.IMAGE_WORKER.fetch(
  new Request('https://internal/resize', {
    method: 'POST',
    headers: {
      'X-Width': size.width.toString(),
      'X-Height': (size.height || 0).toString(),
      'X-Quality': (size.quality || 75).toString(),
    },
    body: imageBuffer,
  })
)
```

Thumbnail sizes and quality settings are configured in `src/lib/thumbnailConfig.ts`.

## Memory Considerations

Cloudflare Workers have a 128MB memory limit. The code frees Photon images immediately after extracting pixel data to minimize memory usage:

```typescript
const outputImage = resize(inputImage, width, height, SamplingFilter.Lanczos3)
inputImage.free()  // Free immediately

const imageData = outputImage.get_image_data()
outputImage.free()  // Free before encoding

const webpBuffer = await encode(imageData, { quality })
```

For very large images (e.g., 4000x4000), monitor memory usage in the Cloudflare dashboard.

## Files

```
workers/image-processor/
├── src/
│   └── index.ts          # Worker entry point
├── package.json          # Dependencies (@cf-wasm/photon, @jsquash/webp)
├── wrangler.jsonc        # Cloudflare Worker config
├── tsconfig.json         # TypeScript config
└── README.md             # This file
```

Main app integration:
```
src/
├── lib/
│   ├── generateThumbnailsPhoton.ts  # Calls IMAGE_WORKER service binding
│   ├── generateThumbnailsSharp.ts   # Local dev fallback
│   └── thumbnailConfig.ts           # Thumbnail sizes & quality settings
├── collections/
│   └── Media.ts                     # Routes to Photon or Sharp based on runtime
└── env.d.ts                         # TypeScript types for IMAGE_WORKER binding
```
