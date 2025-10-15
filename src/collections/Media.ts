import type { CollectionConfig } from 'payload'

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
        description: 'Generated thumbnail sizes (JSON)',
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
  timestamps: true,
}
