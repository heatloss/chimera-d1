import type { CollectionConfig } from 'payload'
import { generateImageSizes } from '../lib/generateImageSizes'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
  },
  fields: [
    // NOTE: Custom UUID field temporarily removed for dev testing
    // Admin UI uploads will use Payload's default auto-increment IDs
    // UUID field will be re-added when implementing custom API routes
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
    {
      // Image size variants metadata (stored as JSON to avoid D1's 100-parameter limit)
      // Database column: image_sizes (snake_case, Drizzle default)
      name: 'imageSizes',
      type: 'json',
      label: 'Image Sizes',
      admin: {
        readOnly: true,
        description: 'Auto-generated thumbnail sizes (7 variants)',
        components: {
          Field: '@/components/ThumbnailPreviewField',
          Cell: '@/components/ThumbnailCellField',
        },
      },
    },
  ],
  upload: {
    // These are not supported on Workers yet due to lack of sharp
    crop: false,
    focalPoint: false,
  },
  hooks: {
    beforeChange: [
      async ({ data, req }) => {
        // Only generate thumbnails when a new file is uploaded
        if (!req.file) {
          return data
        }

        console.log('🖼️  Media beforeChange hook triggered for file upload')

        try {
          // Get R2 bucket from Cloudflare context
          const cloudflare = await getCloudflareContext({ async: true })
          const r2Bucket = cloudflare.env.R2

          if (!r2Bucket) {
            console.error('❌ R2 bucket not available in context')
            return data
          }

          // Read the uploaded file from R2
          const originalFilename = data.filename || req.file.name
          const r2Object = await r2Bucket.get(originalFilename)

          if (!r2Object) {
            console.error(`❌ Could not retrieve uploaded file from R2: ${originalFilename}`)
            return data
          }

          // Get file buffer
          const arrayBuffer = await r2Object.arrayBuffer()
          const mimeType = data.mimeType || req.file.mimetype || 'image/jpeg'

          // Generate image sizes using Sharp (Node.js dev mode)
          console.log('📐 Generating image sizes with Sharp...')
          const imageSizes = await generateImageSizes(
            arrayBuffer,
            originalFilename,
            r2Bucket,
            mimeType
          )

          // Store metadata in JSON field
          data.imageSizes = imageSizes

          console.log(`✅ Image sizes generated and stored in metadata`)
        } catch (error: any) {
          console.error('❌ Error generating image sizes:', error.message || error)
          // Don't fail the upload if thumbnail generation fails
          // Just log the error and continue
        }

        return data
      },
    ],
  },
}
