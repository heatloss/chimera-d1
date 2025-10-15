import type { CollectionConfig } from 'payload'
import { generateThumbnailsSharp } from '@/lib/generateThumbnailsSharp'
import { generateThumbnailsJimp } from '@/lib/generateThumbnailsJimp'
import { uploadThumbnailsToR2 } from '@/lib/uploadThumbnails'

export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    useAsTitle: 'filename',
    group: 'Admin',
  },
  access: {
    create: ({ req: { user } }) => {
      return user && ['creator', 'editor', 'admin'].includes(user.role)
    },
    read: () => true,
    update: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      if (user?.role === 'editor') return true
      if (!user?.id) return false
      return {
        uploadedBy: {
          equals: user.id,
        },
      }
    },
    delete: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      if (user?.role === 'editor') return true
      if (!user?.id) return false
      return {
        uploadedBy: {
          equals: user.id,
        },
      }
    },
  },
  upload: {
    staticDir: 'media',
    // NOTE: We store thumbnail metadata in JSON to avoid D1's 100-parameter limit
    // Thumbnails are generated via Jimp (Workers) or Sharp (dev) and stored as JSON
    mimeTypes: ['image/*'],
    disableLocalStorage: true, // R2 only
    crop: false,
    focalPoint: false,
  },
  fields: [
    // HYBRID UUID APPROACH: Keep INTEGER primary key, add UUID as regular field
    {
      name: 'uuid',
      type: 'text',
      label: 'Public ID',
      required: true,
      unique: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Unique public identifier for this media item',
      },
      hooks: {
        beforeValidate: [
          ({ value }) => {
            // Auto-generate UUID if not provided
            return value || crypto.randomUUID()
          }
        ]
      }
    },
    {
      name: 'alt',
      type: 'text',
      required: false,
      label: 'Alt Text',
      admin: {
        description: 'Optional alt text (for webcomics, alt text is usually set on the page)',
      },
    },
    {
      name: 'caption',
      type: 'text',
      label: 'Caption',
      admin: {
        description: 'Optional caption or description',
      },
    },
    // Store generated thumbnails as JSON to avoid D1's 100-parameter limit
    {
      name: 'imageSizes',
      type: 'json',
      label: 'Generated Thumbnails',
      admin: {
        readOnly: true,
        description: 'Generated thumbnail sizes',
        components: {
          Field: '@/components/admin/ThumbnailGallery#ThumbnailGallery',
          Cell: '@/components/admin/ThumbnailCountCell#ThumbnailCountCell',
        },
      },
    },
    {
      name: 'mediaType',
      type: 'select',
      required: true,
      defaultValue: 'general',
      options: [
        { label: 'General Image', value: 'general' },
        { label: 'Comic Page', value: 'comic_page' },
        { label: 'Comic Cover', value: 'comic_cover' },
        { label: 'Chapter Cover', value: 'chapter_cover' },
        { label: 'User Avatar', value: 'user_avatar' },
        { label: 'Website Asset', value: 'website_asset' },
      ],
      admin: {
        position: 'sidebar',
        description: 'What type of image is this?',
      },
    },
    {
      name: 'uploadedBy',
      type: 'relationship',
      relationTo: 'users',
      required: false,
      label: 'Uploaded By',
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
      hooks: {
        beforeValidate: [
          ({ req, operation, value }) => {
            if (operation === 'create' && !value && req.user?.id) {
              return req.user.id
            }
            return value
          },
        ],
      },
    },
    {
      name: 'isPublic',
      type: 'checkbox',
      defaultValue: true,
      label: 'Public Image',
      admin: {
        position: 'sidebar',
        description: 'Whether this image can be viewed by the public',
      },
    },
    // Metadata for comic pages
    {
      name: 'comicMeta',
      type: 'group',
      label: 'Comic Metadata',
      admin: {
        condition: (data, siblingData) => {
          return ['comic_page', 'comic_cover', 'chapter_cover'].includes(siblingData?.mediaType)
        },
      },
      fields: [
        {
          name: 'relatedComic',
          type: 'relationship',
          relationTo: 'comics',
          label: 'Related Comic',
          admin: {
            description: 'Which comic this image belongs to',
          },
        },
        {
          name: 'isNSFW',
          type: 'checkbox',
          defaultValue: false,
          label: 'Contains Adult Content (NSFW)',
        },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, req }) => {
        // Generate thumbnails when a new image is uploaded
        if (req.file && req.file.data) {
          console.log(`🎨 Processing image upload: ${req.file.name}`)

          // Detect runtime: Workers or Node.js
          const isWorkersRuntime = typeof process === 'undefined' ||
            (typeof globalThis !== 'undefined' && 'caches' in globalThis)

          try {
            let thumbnails
            if (isWorkersRuntime) {
              console.log('🌐 Using Jimp (Workers runtime)')
              thumbnails = await generateThumbnailsJimp(
                req.file.data,
                req.file.name,
                req.file.mimetype
              )
            } else {
              console.log('🖥️  Using Sharp (Node.js runtime)')
              thumbnails = await generateThumbnailsSharp(
                req.file.data,
                req.file.name,
                req.file.mimetype
              )
            }

            // Upload thumbnails to R2
            // Get cloudflare context from global (stored during config initialization)
            const cloudflare = (globalThis as any).__CLOUDFLARE_CONTEXT__
            const bucket = cloudflare?.env?.R2
            if (bucket) {
              console.log('📦 Found R2 bucket from cloudflare context')
              thumbnails = await uploadThumbnailsToR2(thumbnails, bucket, 'media')
            } else {
              console.warn('⚠️  R2 bucket not found - storing metadata only')
              console.warn('Cloudflare context available:', !!cloudflare)
              console.warn('Cloudflare env available:', !!cloudflare?.env)
              // Remove buffers from metadata if we can't upload
              thumbnails = thumbnails.map(t => {
                const { buffer, ...rest } = t
                return rest
              })
            }

            // Store thumbnails as JSON (without buffers)
            data.imageSizes = thumbnails
            console.log(`✅ Stored ${thumbnails.length} thumbnail metadata entries`)
          } catch (error) {
            console.error('❌ Thumbnail generation failed:', error)
            // Don't fail the upload if thumbnail generation fails
            data.imageSizes = []
          }
        }

        return data
      },
    ],
  },
  timestamps: true,
}
