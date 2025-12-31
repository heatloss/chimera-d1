import type { CollectionConfig } from 'payload'
// NOTE: Using dynamic imports to avoid bundling Sharp into Workers build

// Helper hook to normalize string IDs to integers for D1 adapter compatibility
const normalizeRelationshipId = ({ value }: { value?: any }) => {
  if (value && typeof value === 'string') {
    return parseInt(value, 10)
  }
  return value
}

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
    read: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      if (user?.role === 'editor') return true
      if (!user?.id) return false
      // Creators can only see their own uploads
      return {
        uploadedBy: {
          equals: user.id,
        },
      }
    },
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
          normalizeRelationshipId,
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
          hooks: {
            beforeValidate: [normalizeRelationshipId],
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

          // Get R2 bucket (needed for both main image and thumbnails)
          const cloudflare = (globalThis as any).__CLOUDFLARE_CONTEXT__
          const bucket = cloudflare?.env?.R2

          if (bucket) {
            // WORKAROUND: R2 storage plugin doesn't work with programmatic uploads
            // Manually upload the main image file to R2
            console.log('📤 Manually uploading main image to R2')

            // Sanitize filename: replace spaces with underscores, remove special chars
            let sanitizedName = req.file.name
              .replace(/\s+/g, '_')            // Replace spaces with underscores
              .replace(/[^a-zA-Z0-9._-]/g, '') // Remove special chars (keep dots, underscores, hyphens)
              .replace(/_+/g, '_')             // Collapse multiple underscores
              .toLowerCase()                   // Lowercase for consistency

            // Check for filename collision and append suffix if needed
            let finalFilename = sanitizedName
            let attempt = 0
            const maxAttempts = 100 // Prevent infinite loop

            while (attempt < maxAttempts) {
              // Check if filename already exists in database
              const existing = await req.payload.find({
                collection: 'media',
                where: {
                  filename: { equals: finalFilename },
                },
                limit: 1,
              })

              if (existing.docs.length === 0) {
                // Filename is unique, we can use it
                break
              }

              // Filename collision - append suffix
              attempt++
              const nameParts = sanitizedName.split('.')
              const extension = nameParts.length > 1 ? nameParts.pop() : ''
              const baseName = nameParts.join('.')
              finalFilename = extension
                ? `${baseName}-${attempt}.${extension}`
                : `${baseName}-${attempt}`
            }

            if (attempt >= maxAttempts) {
              throw new Error('Unable to find unique filename after 100 attempts')
            }

            if (attempt > 0) {
              console.log(`⚠️  Filename collision detected, using: ${finalFilename}`)
            }

            const mainFileKey = `media/${finalFilename}`

            try {
              // Use Uint8Array instead of Buffer for Miniflare compatibility
              await bucket.put(mainFileKey, new Uint8Array(req.file.data), {
                httpMetadata: {
                  contentType: req.file.mimetype,
                },
              })
              console.log(`✅ Main image uploaded to R2: ${mainFileKey}`)

              // IMPORTANT: Update the filename in the data to match what we uploaded
              // This ensures the database record matches the actual R2 file
              data.filename = finalFilename
            } catch (error) {
              console.error('❌ Failed to upload main image to R2:', error)
              throw error // Fail the upload if main image can't be saved
            }
          } else {
            console.warn('⚠️  R2 bucket not found - main image will not be uploaded')
          }

          // Skip thumbnail generation if imageSizes is already provided (client-side thumbnails)
          if (data.imageSizes && Array.isArray(data.imageSizes) && data.imageSizes.length > 0) {
            console.log(`📦 Using pre-provided thumbnails (${data.imageSizes.length} sizes) - skipping server generation`)
          } else {
            // Detect runtime: Workers or Node.js
            const isWorkersRuntime = typeof process === 'undefined' ||
              (typeof globalThis !== 'undefined' && 'caches' in globalThis)

            try {
              let thumbnails
              if (isWorkersRuntime) {
                console.log('🌐 Using Jimp (Workers runtime)')
                const { generateThumbnailsJimp } = await import('@/lib/generateThumbnailsJimp')
                thumbnails = await generateThumbnailsJimp(
                  req.file.data,
                  req.file.name,
                  req.file.mimetype
                )
              } else {
                console.log('🖥️  Using Sharp (Node.js runtime)')
                const { generateThumbnailsSharp } = await import('@/lib/generateThumbnailsSharp')
                thumbnails = await generateThumbnailsSharp(
                  req.file.data,
                  req.file.name,
                  req.file.mimetype
                )
              }

              // Upload thumbnails to R2
              if (bucket) {
                console.log('📦 Uploading thumbnails to R2')
                const { uploadThumbnailsToR2 } = await import('@/lib/uploadThumbnails')
                thumbnails = await uploadThumbnailsToR2(thumbnails, bucket, 'media')
              } else {
                console.warn('⚠️  R2 bucket not found - storing thumbnail metadata only')
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
        }

        return data
      },
    ],
    afterRead: [
      async ({ doc }) => {
        // Populate thumbnailURL from the first thumbnail in imageSizes
        if (doc.imageSizes && Array.isArray(doc.imageSizes) && doc.imageSizes.length > 0) {
          // Use the first thumbnail (usually named "thumbnail")
          const firstThumbnail = doc.imageSizes[0]
          if (firstThumbnail?.url) {
            // URL-encode the thumbnail URL to match the encoding of the main url field
            const urlPath = firstThumbnail.url.split('/').pop() || ''
            const encodedPath = encodeURIComponent(urlPath)
            const baseUrl = firstThumbnail.url.substring(0, firstThumbnail.url.lastIndexOf('/') + 1)
            doc.thumbnailURL = baseUrl + encodedPath
          }
        }
        // Leave width/height as original image dimensions (matches doc.url)
        // Thumbnail dimensions are available in doc.imageSizes array
        return doc
      },
    ],
  },
  timestamps: true,
}
