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
    read: async ({ req }) => {
      const { user } = req
      if (user?.role === 'admin') return true
      if (user?.role === 'editor') return true
      if (!user?.id) return false

      // For creators, find all comics they own and allow access to those chapters
      try {
        const userComics = await req.payload.find({
          collection: 'comics',
          where: {
            author: { equals: user.id }
          },
          limit: 1000,
        })

        const comicIds = userComics.docs.map(comic => comic.id)

        if (comicIds.length === 0) return false

        return {
          comic: {
            in: comicIds,
          },
        }
      } catch (error) {
        console.error('Error in chapters read access:', error)
        return false
      }
    },
    update: async ({ req }) => {
      const { user } = req
      if (user?.role === 'admin') return true
      if (user?.role === 'editor') return true
      if (!user?.id) return false

      // For creators, find all comics they own and allow updates to those chapters
      try {
        const userComics = await req.payload.find({
          collection: 'comics',
          where: {
            author: { equals: user.id }
          },
          limit: 1000,
        })

        const comicIds = userComics.docs.map(comic => comic.id)
        if (comicIds.length === 0) return false

        return {
          comic: {
            in: comicIds,
          },
        }
      } catch (error) {
        console.error('Error in chapters update access:', error)
        return false
      }
    },
    delete: async ({ req }) => {
      const { user } = req
      if (user?.role === 'admin') return true
      if (user?.role === 'editor') return true
      if (!user?.id) return false

      // For creators, find all comics they own and allow deletes for those chapters
      try {
        const userComics = await req.payload.find({
          collection: 'comics',
          where: {
            author: { equals: user.id }
          },
          limit: 1000,
        })

        const comicIds = userComics.docs.map(comic => comic.id)
        if (comicIds.length === 0) return false

        return {
          comic: {
            in: comicIds,
          },
        }
      } catch (error) {
        console.error('Error in chapters delete access:', error)
        return false
      }
    },
  },
  fields: [
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
      hooks: {
        beforeValidate: [
          ({ value }) => {
            // Normalize string IDs to integers for D1 adapter compatibility
            if (value && typeof value === 'string') {
              return parseInt(value, 10)
            }
            return value
          },
        ],
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
        description: 'Chapter order (read-only). Use POST /api/reorder-chapters to reorder chapters.',
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
    beforeDelete: [
      async ({ id, req }) => {
        // Get the chapter being deleted to find its comic
        const chapterToDelete = await req.payload.findByID({
          collection: 'chapters',
          id,
        })

        if (!chapterToDelete) return

        const comicId = typeof chapterToDelete.comic === 'object'
          ? chapterToDelete.comic.id
          : chapterToDelete.comic

        // Check if this chapter has any pages
        const pagesInChapter = await req.payload.find({
          collection: 'pages',
          where: { chapter: { equals: id } },
          limit: 1,
        })

        if (pagesInChapter.totalDocs === 0) {
          console.log(`🗑️ Chapter "${chapterToDelete.title}" has no pages, safe to delete`)
          return
        }

        console.log(`⚠️ Chapter "${chapterToDelete.title}" has ${pagesInChapter.totalDocs} pages, reassigning to "Unassigned Pages"`)

        // Find or create "Unassigned Pages" chapter for this comic
        const unassignedChapter = await findOrCreateUnassignedChapter(req.payload, comicId)

        // Get ALL pages in the chapter being deleted
        const allPages = await req.payload.find({
          collection: 'pages',
          where: { chapter: { equals: id } },
          limit: 1000,
        })

        // Reassign each page to the "Unassigned Pages" chapter
        for (const page of allPages.docs) {
          await req.payload.update({
            collection: 'pages',
            id: page.id,
            data: { chapter: unassignedChapter.id },
            req: {
              ...req,
              skipGlobalPageCalculation: true,
              skipComicStatsCalculation: true,
              skipChapterStatsCalculation: true,
            } as any,
          })
        }

        console.log(`✅ Reassigned ${allPages.docs.length} pages to "${unassignedChapter.title}"`)

        // Update stats for the "Unassigned Pages" chapter
        await updateChapterStats(req.payload, unassignedChapter.id, req)
      },
    ],
    afterChange: [
      async ({ doc, req, operation }) => {
        console.log(`✅ Chapter ${operation} completed: ${doc.title}`)

        // Update comic chapter statistics immediately and safely
        if (doc.comic && req.payload && !(req as any).skipComicStatsCalculation) {
          try {
            const comicId = typeof doc.comic === 'object' ? doc.comic.id : doc.comic

            // Get current comic to preserve existing stats
            const comic = await req.payload.findByID({
              collection: 'comics',
              id: comicId,
              req: {
                ...req,
                skipGlobalPageCalculation: true,
                skipComicStatsCalculation: true,
              } as any
            })

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

            // Update comic with chapter count, preserving other stats
            await req.payload.update({
              collection: 'comics',
              id: comicId,
              data: {
                stats: {
                  totalPages: (comic as any).stats?.totalPages || 0,
                  totalChapters: chapters.totalDocs,
                  lastPagePublished: (comic as any).stats?.lastPagePublished || null,
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

// Helper function to find or create the "Unassigned Pages" fallback chapter
async function findOrCreateUnassignedChapter(
  payload: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  comicId: number | string
) {
  const UNASSIGNED_CHAPTER_TITLE = 'Unassigned Pages'

  // Try to find existing "Unassigned Pages" chapter for this comic
  const existingChapters = await payload.find({
    collection: 'chapters',
    where: {
      comic: { equals: comicId },
      title: { equals: UNASSIGNED_CHAPTER_TITLE },
    },
    limit: 1,
  })

  if (existingChapters.docs.length > 0) {
    console.log(`📁 Using existing "${UNASSIGNED_CHAPTER_TITLE}" chapter`)
    return existingChapters.docs[0]
  }

  // Create new "Unassigned Pages" chapter
  console.log(`📁 Creating "${UNASSIGNED_CHAPTER_TITLE}" chapter`)

  // Get current highest chapter order for this comic
  const allChapters = await payload.find({
    collection: 'chapters',
    where: { comic: { equals: comicId } },
    sort: '-order',
    limit: 1,
  })

  const nextOrder = allChapters.docs.length > 0 ? allChapters.docs[0].order + 1 : 1

  const newChapter = await payload.create({
    collection: 'chapters',
    data: {
      comic: comicId,
      title: UNASSIGNED_CHAPTER_TITLE,
      description: 'Pages that were orphaned when their original chapter was deleted',
      order: nextOrder,
    },
  })

  console.log(`✅ Created "${UNASSIGNED_CHAPTER_TITLE}" chapter (Order: ${nextOrder})`)
  return newChapter
}

// Helper function to update chapter statistics
async function updateChapterStats(
  payload: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  chapterId: number | string,
  req: any // eslint-disable-line @typescript-eslint/no-explicit-any
) {
  const pagesInChapter = await payload.find({
    collection: 'pages',
    where: { chapter: { equals: chapterId } },
    sort: 'chapterPageNumber',
    limit: 1000,
  })

  const pageCount = pagesInChapter.totalDocs
  let firstPageNumber = null
  let lastPageNumber = null

  if (pagesInChapter.docs.length > 0) {
    const sortedByGlobal = pagesInChapter.docs
      .filter((p: any) => p.globalPageNumber !== null && p.globalPageNumber !== undefined)
      .sort((a: any, b: any) => a.globalPageNumber - b.globalPageNumber)

    if (sortedByGlobal.length > 0) {
      firstPageNumber = sortedByGlobal[0].globalPageNumber
      lastPageNumber = sortedByGlobal[sortedByGlobal.length - 1].globalPageNumber
    }
  }

  await payload.update({
    collection: 'chapters',
    id: chapterId,
    data: {
      stats: {
        pageCount,
        firstPageNumber,
        lastPageNumber,
      },
    },
    req: {
      ...req,
      skipGlobalPageCalculation: true,
      skipComicStatsCalculation: true,
      skipChapterStatsCalculation: true,
    } as any,
  })

  console.log(`📖 Updated chapter ${chapterId} stats: ${pageCount} pages`)
}
