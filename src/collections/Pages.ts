import type { CollectionConfig } from 'payload'

export const Pages: CollectionConfig = {
  slug: 'pages',
  // Disable default REST API to prevent ID enumeration
  // Use custom UUID-based routes at /api/get-pages/[uuid]
  disableAPI: true,
  admin: {
    useAsTitle: 'displayTitle',
    defaultColumns: ['displayTitle', 'comic', 'chapter', 'chapterPageNumber', 'globalPageNumber', 'status', 'publishedDate'],
    group: 'Comics', // Same group as Comics for unified workflow
    listSearchableFields: ['title', 'authorNotes', 'altText'],
    pagination: {
      defaultLimit: 25,
    },
    description: 'After saving a page, you can use the "Duplicate" button to quickly create the next page with incremented page number.',
  },
  access: {
    create: ({ req: { user } }) => {
      return user && ['creator', 'editor', 'admin'].includes(user.role)
    },
    read: () => true, // Pages are public (filtering by status happens in queries)
    update: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      if (user?.role === 'editor') return true
      if (!user?.id) return false
      // Creators can only edit pages for their own comics
      return {
        'comic.author': {
          equals: user.id,
        },
      }
    },
    delete: ({ req: { user } }) => {
      return user?.role === 'admin'
    },
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
        description: 'Unique public identifier for this page',
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
      name: 'comic',
      type: 'relationship',
      relationTo: 'comics',
      required: true,
      label: 'Comic Series',
      admin: {
        description: 'Which comic series this page belongs to',
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
      name: 'chapter',
      type: 'relationship',
      relationTo: 'chapters',
      label: 'Chapter',
      admin: {
        description: 'Which chapter this page belongs to (optional)',
        position: 'sidebar',
        sortOptions: 'chapters.order', // Sort by chapter order, not title
      },
    },
    {
      name: 'chapterPageNumber',
      type: 'number',
      required: true,
      label: 'Chapter Page Number',
      admin: {
        description: 'Page number within this chapter (0 = chapter cover, 1+ = regular pages)',
        position: 'sidebar',
      },
      validate: (val: number) => {
        if (val !== undefined && val !== null && val < 0) {
          return 'Chapter page number must be 0 or greater (0 = chapter cover)'
        }
        return true
      },
      hooks: {
        beforeValidate: [
          async ({ value, operation, req, data, siblingData }) => {
            // Auto-assign next chapter page number if not provided
            if (operation === 'create' && (value === undefined || value === null) && req.payload) {
              const chapterId = siblingData?.chapter || data?.chapter
              if (chapterId) {
                try {
                  const existingPages = await req.payload.find({
                    collection: 'pages',
                    where: {
                      chapter: { equals: chapterId }
                    },
                    sort: '-chapterPageNumber',
                    limit: 1,
                    req: {
                      ...req,
                      skipGlobalPageCalculation: true, // Prevent hook cascades
                    } as any
                  })

                  if (existingPages.docs.length === 0) {
                    // First page in chapter = cover (chapterPageNumber: 0)
                    return 0
                  } else {
                    // Subsequent pages = increment from highest
                    const highestPageNumber = existingPages.docs[0]?.chapterPageNumber || 0
                    const nextPageNumber = highestPageNumber + 1
                    return nextPageNumber
                  }
                } catch (error) {
                  console.error('Error calculating next chapter page number:', error)
                  return 1
                }
              }
            }
            return value
          }
        ]
      }
    },
    {
      name: 'globalPageNumber',
      type: 'number',
      label: 'Global Page Number',
      admin: {
        description: 'Auto-calculated sequential number across entire comic (used for navigation)',
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'title',
      type: 'text',
      label: 'Page Title',
      admin: {
        description: 'Optional title for this specific page',
      },
    },
    {
      name: 'displayTitle',
      type: 'text',
      admin: {
        hidden: true, // This is computed, not user-editable
      },
      hooks: {
        beforeChange: [
          async ({ data, siblingData, req }) => {
            // Create a display title for the admin interface
            const chapterPageNum = siblingData.chapterPageNumber || data?.chapterPageNumber
            const title = siblingData.title || data?.title
            const chapterId = siblingData.chapter || data?.chapter

            let displayTitle = ''

            // Get chapter info if chapter is set
            if (chapterId && req.payload) {
              try {
                const chapter = await req.payload.findByID({
                  collection: 'chapters',
                  id: chapterId
                })
                if (chapter) {
                  displayTitle = `${chapter.title} - Page ${chapterPageNum || '?'}`
                } else {
                  displayTitle = `Page ${chapterPageNum || '?'}`
                }
              } catch (error) {
                console.error('Error fetching chapter for display title:', error)
                displayTitle = `Page ${chapterPageNum || '?'}`
              }
            } else {
              displayTitle = `Page ${chapterPageNum || '?'}`
            }

            if (title) displayTitle += `: ${title}`

            return displayTitle
          },
        ],
      },
    },
    {
      name: 'pageImage',
      type: 'upload',
      relationTo: 'media',
      required: false, // Temporarily made optional for data migration
      label: 'Comic Page Image',
      admin: {
        description: 'The main comic page image that readers will see',
      },
    },
    {
      name: 'pageExtraImages',
      type: 'array',
      label: 'Additional Page Images',
      admin: {
        description: 'Optional additional images for multi-image pages',
      },
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
          label: 'Image',
        },
        {
          name: 'altText',
          type: 'textarea',
          label: 'Alt Text',
          admin: {
            description: 'Accessibility description for this specific image',
            rows: 2,
          },
        },
      ],
    },
    {
      name: 'thumbnailImage',
      type: 'upload',
      relationTo: 'media',
      label: 'Thumbnail Image',
      admin: {
        description: 'Custom thumbnail image (auto-populated from main page image if empty)',
      },
    },
    {
      name: 'altText',
      type: 'textarea',
      required: false,
      label: 'Alt Text',
      admin: {
        description: 'Accessibility description of what happens in this page',
        rows: 3,
      },
    },
    {
      name: 'authorNotes',
      type: 'textarea',
      label: 'Author Notes',
      admin: {
        description: 'Optional commentary, behind-the-scenes notes, or author thoughts (Markdown supported)',
        rows: 4,
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Scheduled', value: 'scheduled' },
        { label: 'Published', value: 'published' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'publishedDate',
      type: 'date',
      label: 'Publish Date',
      admin: {
        description: 'When this page should go live (for scheduling)',
        position: 'sidebar',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
      validate: (val, { siblingData }) => {
        if ((siblingData as any).status === 'scheduled' && !val) {
          return 'Published date is required for scheduled pages'
        }
        return true
      },
    },
    // Navigation helpers (computed fields)
    {
      name: 'navigation',
      type: 'group',
      label: 'Page Navigation',
      admin: {
        readOnly: true,
      },
      fields: [
        {
          name: 'previousPage',
          type: 'relationship',
          relationTo: 'pages',
          admin: {
            readOnly: true,
            description: 'Previous page in the series',
          },
        },
        {
          name: 'nextPage',
          type: 'relationship',
          relationTo: 'pages',
          admin: {
            readOnly: true,
            description: 'Next page in the series',
          },
        },
        {
          name: 'isFirstPage',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            readOnly: true,
          },
        },
        {
          name: 'isLastPage',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            readOnly: true,
          },
        },
      ],
    },
    // SEO and metadata
    {
      name: 'seoMeta',
      type: 'group',
      label: 'SEO & Metadata',
            fields: [
        {
          name: 'slug',
          type: 'text',
          label: 'Page Slug',
          admin: {
            description: 'URL-friendly page identifier (auto-generated if empty)',
          },
          hooks: {
            beforeValidate: [
              ({ value, data, siblingData }) => {
                if (!value) {
                  const pageNum = siblingData?.pageNumber || data?.pageNumber
                  const title = siblingData?.title || data?.title
                  if (title) {
                    return title
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/(^-|-$)+/g, '')
                  }
                  return `page-${pageNum}`
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
            description: 'SEO title (auto-generated if empty)',
          },
        },
        {
          name: 'metaDescription',
          type: 'textarea',
          label: 'Meta Description',
          admin: {
            description: 'SEO description (uses alt text if empty)',
            rows: 2,
          },
        },
      ],
    },
    // Reader engagement statistics
    {
      name: 'stats',
      type: 'group',
      label: 'Reader Statistics',
      admin: {
        readOnly: true,
      },
      fields: [
        {
          name: 'viewCount',
          type: 'number',
          defaultValue: 0,
          admin: {
            readOnly: true,
            description: 'Number of times this page has been viewed',
          },
        },
        {
          name: 'firstViewed',
          type: 'date',
          admin: {
            readOnly: true,
            description: 'When this page was first viewed by a reader',
          },
        },
        {
          name: 'lastViewed',
          type: 'date',
          admin: {
            readOnly: true,
            description: 'When this page was last viewed by a reader',
          },
        },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, operation, req }) => {
        // MINIMAL HOOK - Only essential operations to test for hanging

        // Set timestamps
        if (operation === 'create') {
          data.createdOn = new Date()
        }
        data.updatedOn = new Date()

        // Auto-set publish date when status changes to published
        if (data.status === 'published' && !data.publishedDate) {
          data.publishedDate = new Date()
        }

        // Calculate global page number based on chapter order and chapter page number
        // Using guard clause to prevent hook cascades

        if (data.chapter && (data.chapterPageNumber !== undefined && data.chapterPageNumber !== null) && req.payload && !(req as any).skipGlobalPageCalculation) {
          try {

            // Handle chapter ID - it might be an object or string
            const chapterId = typeof data.chapter === 'object' ? data.chapter.id : data.chapter

            // Get the chapter to find its order - WITH GUARD FLAG
            const chapter = await req.payload.findByID({
              collection: 'chapters',
              id: chapterId,
              req: {
                ...req,
                skipGlobalPageCalculation: true, // Prevent cascading hooks
              } as any
            })

            if (chapter && chapter.order !== undefined) {
              // Handle comic ID - it might be an object or string
              const comicId = typeof chapter.comic === 'object' ? chapter.comic.id : chapter.comic

              // Get all previous chapters for this comic - WITH GUARD FLAG
              const previousChapters = await req.payload.find({
                collection: 'chapters',
                where: {
                  comic: { equals: comicId },
                  order: { less_than: chapter.order }
                },
                sort: 'order',
                limit: 100,
                req: {
                  ...req,
                  skipGlobalPageCalculation: true, // Prevent cascading hooks
                } as any
              })

              // Count total pages in all previous chapters - WITH GUARD FLAG
              let totalPreviousPages = 0
              const chapterPageCounts = []

              for (const prevChapter of previousChapters.docs) {
                const pagesInChapter = await req.payload.find({
                  collection: 'pages',
                  where: {
                    chapter: { equals: prevChapter.id }
                  },
                  limit: 1000,
                  req: {
                    ...req,
                    skipGlobalPageCalculation: true, // Prevent cascading hooks
                  } as any
                })

                totalPreviousPages += pagesInChapter.totalDocs
                chapterPageCounts.push(`Ch${prevChapter.order}:${pagesInChapter.totalDocs}`)
              }

              // Calculate the global page number
              // All pages (including covers) are counted equally for global numbering
              const calculatedGlobal = totalPreviousPages + data.chapterPageNumber + 1

              data.globalPageNumber = calculatedGlobal

              // Global page number calculated successfully

            } else {
              console.warn(`⚠️ Chapter not found or missing order: ${chapterId}`)
              data.globalPageNumber = data.chapterPageNumber || 1
            }

          } catch (error) {
            console.error('❌ Error calculating global page number:', error)
            // Fallback to simple calculation to prevent complete failure
            data.globalPageNumber = data.chapterPageNumber || 1
          }
        } else if (!data.globalPageNumber) {
          // Fallback for pages without chapters or when calculation is skipped
          data.globalPageNumber = data.chapterPageNumber || 1
        }

        // Simple thumbnail auto-population (no async operations)
        if (data.pageImage && !data.thumbnailImage) {
          const pageImageId = typeof data.pageImage === 'object' ? data.pageImage.id : data.pageImage
          if (pageImageId) {
            data.thumbnailImage = pageImageId
          }
        }

        return data
      },
    ],
    afterChange: [
      async ({ doc, operation }) => {
        // Log success message for user feedback
        if (operation === 'create') {
          console.log(`✅ Page ${doc.chapterPageNumber || 'unknown'} created successfully!`)
        } else if (operation === 'update') {
          console.log(`✅ Page ${doc.chapterPageNumber || 'unknown'} updated successfully!`)
        }
      },
    ],
    afterOperation: [
      async ({ operation, req, result }) => {
        // Update statistics immediately after page operations
        if (operation === 'create' || operation === 'update' || operation === 'updateByID') {
          const doc = result.doc || result
          console.log(`✅ Page operation ${operation} completed successfully`)

          // Update comic statistics immediately but safely
          if (doc?.comic && req.payload && !(req as any).skipComicStatsCalculation) {
            try {
              const comicId = typeof doc.comic === 'object' ? doc.comic.id : doc.comic
              await updateComicStatisticsImmediate(req.payload, comicId, req)
            } catch (error) {
              console.error('❌ Error updating comic statistics:', error)
              // Don't throw - let the main operation succeed
            }
          }
        }

        return result
      },
    ],
  },
  timestamps: true,
}

// Safe immediate statistics update function
async function updateComicStatisticsImmediate(payload: any, comicId: string, req: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    // Count published pages with guard clauses
    const pages = await payload.find({
      collection: 'pages',
      where: {
        comic: { equals: comicId },
        status: { equals: 'published' },
      },
      limit: 1000,
      req: {
        ...req,
        skipGlobalPageCalculation: true,
        skipComicStatsCalculation: true, // Prevent loops
      } as any
    })

    // Count chapters with guard clauses
    const chapters = await payload.find({
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

    // Find last published page date
    let lastPagePublished = null
    if (pages.docs.length > 0) {
      // Sort by publishedDate to find the most recent
      const sortedPages = pages.docs
        .filter((page: any) => page.publishedDate)
        .sort((a: any, b: any) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime())

      if (sortedPages.length > 0) {
        lastPagePublished = sortedPages[0].publishedDate
      }
    }

    // Update comic statistics with guard clauses
    await payload.update({
      collection: 'comics',
      id: comicId,
      data: {
        stats: {
          totalPages: pages.totalDocs,
          totalChapters: chapters.totalDocs,
          lastPagePublished: lastPagePublished,
        }
      },
      req: {
        ...req,
        skipGlobalPageCalculation: true,
        skipComicStatsCalculation: true, // Prevent loops
      } as any,
    })

    console.log(`📊 Updated comic statistics: ${pages.totalDocs} pages, ${chapters.totalDocs} chapters`)
    return true
  } catch (error) {
    console.error('Error in updateComicStatisticsImmediate:', error)
    return false
  }
}
