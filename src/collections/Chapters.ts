import type { CollectionConfig } from 'payload'

export const Chapters: CollectionConfig = {
  slug: 'chapters',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'comic', 'order', 'pageCount'],
    group: 'Comics',
    description: 'Organize comic pages into chapters. Order is currently read-only - use the Move Chapter API endpoint to reorder chapters without conflicts.',
    listSearchableFields: ['title', 'description'],
  },
  defaultSort: 'order', // Sort by order by default
  access: {
    // Same access control as comics - only authors and editors
    create: ({ req: { user } }) => {
      return user && ['creator', 'editor', 'admin'].includes(user.role)
    },
    read: () => true,
    update: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      if (user?.role === 'editor') return true
      if (!user?.id) return false
      // Creators can only edit chapters for their own comics
      return {
        'comic.author': {
          equals: user.id,
        },
      }
    },
    delete: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      if (user?.role === 'editor') return true
      if (!user?.id) return false
      // Creators can only delete chapters for their own comics
      return {
        'comic.author': {
          equals: user.id,
        },
      }
    },
  },
  fields: [
    // UUID PRIMARY KEY: Use UUID as the primary key for this collection
    {
      name: 'id',
      type: 'text',
      label: 'ID',
      required: true,
      unique: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Unique identifier (UUID)',
      },
      hooks: {
        beforeValidate: [
          ({ value, operation }) => {
            // Auto-generate UUID on create if not provided
            if (operation === 'create' && !value) {
              return crypto.randomUUID()
            }
            return value
          }
        ]
      }
    },
    {
      name: 'comic',
      type: 'relationship',
      relationTo: 'comics',
      required: true,
      label: 'Comic Series',
      admin: {
        description: 'Which comic series this chapter belongs to',
        position: 'sidebar',
      },
      defaultValue: async ({ user, req }) => {
        // Auto-select comic if user has only one
        if (user && req.payload) {
          try {
            const userComics = await req.payload.find({
              collection: 'comics',
              where: {
                author: { equals: user.id }
              },
              limit: 2 // Only need to check if there's exactly 1
            })

            if (userComics.docs.length === 1) {
              return userComics.docs[0].id
            }
          } catch (error) {
            console.error('Error getting user comics for default:', error)
          }
        }
        return undefined
      },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Chapter Title',
      admin: {
        description: 'Name of this chapter (e.g., "The Beginning", "Dark Waters")',
      },
    },
    {
      name: 'order',
      type: 'number',
      required: false, // Auto-assigned by hook
      label: 'Chapter Order',
      admin: {
        description: 'Chapter order (read-only). To move: POST /api/move-chapter with chapterId and direction ("up"/"down")',
        position: 'sidebar',
        readOnly: true, // Users can't edit directly
      },
      hooks: {
        beforeValidate: [
          async ({ value, operation, req }) => {
            // Auto-assign order for new chapters
            if (operation === 'create' && !value && req.payload) {
              try {
                const existingChapters = await req.payload.find({
                  collection: 'chapters',
                  limit: 1,
                  sort: '-order', // Get highest order
                })

                const highestOrder = existingChapters.docs[0]?.order || 0
                return highestOrder + 1
              } catch (error) {
                console.error('Error calculating chapter order:', error)
                return 1
              }
            }
            return value
          }
        ]
      }
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Chapter Description',
      admin: {
        description: 'Optional summary of what happens in this chapter',
        rows: 3,
      },
    },
    // SEO fields for chapter-specific pages
    {
      name: 'seoMeta',
      type: 'group',
      label: 'SEO & Metadata',
      fields: [
        {
          name: 'slug',
          type: 'text',
          label: 'Chapter Slug',
          admin: {
            description: 'URL-friendly chapter identifier (auto-generated if empty)',
          },
          hooks: {
            beforeValidate: [
              ({ value, data }) => {
                if (data?.title && !value) {
                  return data.title
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/(^-|-$)+/g, '')
                }
                return value
              },
            ],
          },
        },
        {
          name: 'metaTitle',
          type: 'text',
          label: 'Meta Title',
          admin: {
            description: 'SEO title (defaults to chapter title if empty)',
          },
        },
        {
          name: 'metaDescription',
          type: 'textarea',
          label: 'Meta Description',
          admin: {
            description: 'SEO description for this chapter',
            rows: 2,
          },
        },
      ],
    },
    // Statistics (read-only, updated by hooks)
    {
      name: 'stats',
      type: 'group',
      label: 'Chapter Statistics',
      admin: {
        readOnly: true,
      },
      fields: [
        {
          name: 'pageCount',
          type: 'number',
          defaultValue: 0,
          admin: {
            readOnly: true,
            description: 'Number of pages in this chapter',
          },
        },
        {
          name: 'firstPageNumber',
          type: 'number',
          admin: {
            readOnly: true,
            description: 'First page number in this chapter',
          },
        },
        {
          name: 'lastPageNumber',
          type: 'number',
          admin: {
            readOnly: true,
            description: 'Last page number in this chapter',
          },
        },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        // Set timestamps
        if (operation === 'create') {
          data.createdOn = new Date()
        }
        data.updatedOn = new Date()
        return data
      },
    ],
    afterChange: [
      async ({ doc, req, operation }) => {
        console.log(`✅ Chapter ${operation} completed: ${doc.title}`)

        // Update comic chapter statistics immediately and safely
        if (doc.comic && req.payload && !(req as any).skipComicStatsCalculation) {
          try {
            const comicId = typeof doc.comic === 'object' ? doc.comic.id : doc.comic

            // Count chapters immediately
            const chapters = await req.payload.find({
              collection: 'chapters',
              where: {
                comic: { equals: comicId },
              },
              limit: 100,
              req: {
                ...req,
                skipGlobalPageCalculation: true,
                skipComicStatsCalculation: true, // Prevent loops
              } as any
            })

            // Update comic with chapter count
            await req.payload.update({
              collection: 'comics',
              id: comicId,
              data: {
                stats: {
                  totalChapters: chapters.totalDocs,
                }
              },
              req: {
                ...req,
                skipGlobalPageCalculation: true,
                skipComicStatsCalculation: true, // Prevent loops
              } as any,
            })

            console.log(`📚 Updated comic chapter count: ${chapters.totalDocs} chapters`)
          } catch (error) {
            console.error('❌ Error updating chapter statistics:', error)
            // Don't throw - let the main operation succeed
          }
        }
      },
    ],
  },
  timestamps: true,
}
