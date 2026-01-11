import type { CollectionConfig } from 'payload'
import { findOrCreateUnassignedChapter } from './Chapters'

// Helper hook to normalize string IDs to integers for D1 adapter compatibility
const normalizeRelationshipId = ({ value }: { value?: any }) => {
  if (value && typeof value === 'string') {
    return parseInt(value, 10)
  }
  return value
}

export const Pages: CollectionConfig = {
  slug: 'pages',
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
    read: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      if (user?.role === 'editor') return true
      if (!user?.id) return false
      // Creators can only see pages for their own comics
      return {
        'comic.author': {
          equals: user.id,
        },
      }
    },
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
    delete: ({ req }) => {
      const { user } = req
      // Allow admins and editors to delete any page
      if (user?.role === 'admin') return true
      if (user?.role === 'editor') return true
      // Disallow unauthenticated or reader users
      if (!user?.id || user?.role === 'reader') return false
      // Allow creators to delete (frontend should enforce showing only their own pages)
      return user?.role === 'creator'
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
        description: 'Which comic series this page belongs to',
        position: 'sidebar',
      },
      hooks: {
        beforeValidate: [normalizeRelationshipId],
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
        description: 'Which chapter this page belongs to (auto-assigned to "Unassigned Pages" if not selected)',
        position: 'sidebar',
        sortOptions: 'chapters.order', // Sort by chapter order, not title
      },
      hooks: {
        beforeValidate: [
          normalizeRelationshipId,
          async ({ value, operation, req, siblingData, data }) => {
            // Auto-assign to "Unassigned Pages" chapter if no chapter selected on create
            if (operation === 'create' && !value && req.payload) {
              const comicId = siblingData?.comic || data?.comic
              if (comicId) {
                try {
                  const unassignedChapter = await findOrCreateUnassignedChapter(req.payload, comicId)
                  console.log(`📁 Auto-assigning page to "${unassignedChapter.title}" chapter`)
                  return unassignedChapter.id
                } catch (error) {
                  console.error('Error auto-assigning chapter:', error)
                }
              }
            }
            return value
          },
        ],
      },
    },
    {
      name: 'chapterPageNumber',
      type: 'number',
      required: true,
      label: 'Chapter Page Number',
      admin: {
        description: 'Page number within this chapter (starting from 1)',
        position: 'sidebar',
      },
      validate: (val: number) => {
        if (val !== undefined && val !== null && val < 1) {
          return 'Chapter page number must be 1 or greater'
        }
        return true
      },
      hooks: {
        beforeValidate: [
          async ({ value, operation, req, data, siblingData }) => {
            // Auto-assign next chapter page number if not provided
            if (operation === 'create' && (value === undefined || value === null) && req.payload) {
              const chapterId = siblingData?.chapter || data?.chapter
              const comicId = siblingData?.comic || data?.comic

              try {
                let whereClause: any
                if (chapterId) {
                  // Query pages within the same chapter
                  whereClause = { chapter: { equals: chapterId } }
                } else if (comicId) {
                  // Query pages without a chapter in the same comic
                  whereClause = {
                    comic: { equals: comicId },
                    chapter: { exists: false }
                  }
                } else {
                  // No comic or chapter - just default to 1
                  return 1
                }

                const existingPages = await req.payload.find({
                  collection: 'pages',
                  where: whereClause,
                  sort: '-chapterPageNumber',
                  limit: 1,
                  req: {
                    ...req,
                    skipGlobalPageCalculation: true, // Prevent hook cascades
                  } as any
                })

                if (existingPages.docs.length === 0) {
                  // First page starts at 1
                  return 1
                } else {
                  // Subsequent pages = increment from highest
                  const highestPageNumber = existingPages.docs[0]?.chapterPageNumber || 0
                  return highestPageNumber + 1
                }
              } catch (error) {
                console.error('Error calculating next chapter page number:', error)
                return 1
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
      name: 'slug',
      type: 'text',
      required: true,
      label: 'URL Slug',
      admin: {
        description: 'URL-friendly identifier. Auto-regenerates when chapter changes or title becomes meaningful (unless manually customized).',
        position: 'sidebar',
      },
      hooks: {
        beforeValidate: [
          async ({ value, data, req, operation, originalDoc, siblingData }) => {
            const comicId = data?.comic || siblingData?.comic || originalDoc?.comic
            const pageId = originalDoc?.id
            const currentSlug = value || originalDoc?.slug

            // Determine if we should force-regenerate the slug
            // This handles cases where chapter assignment or title changes after initial creation
            let shouldRegenerate = false

            if (operation === 'update' && originalDoc && currentSlug) {
              // Check if chapter changed
              const oldChapterId = typeof originalDoc.chapter === 'object' ? originalDoc.chapter?.id : originalDoc.chapter
              const newChapterId = data?.chapter || siblingData?.chapter || oldChapterId
              const chapterChanged = oldChapterId !== newChapterId

              // Check if title changed from integer-only to meaningful
              const oldTitle = originalDoc.title
              const newTitle = data?.title || siblingData?.title
              const oldTitleIsIntegerOnly = !oldTitle || /^\d+$/.test(String(oldTitle).trim())
              const newTitleIsIntegerOnly = !newTitle || /^\d+$/.test(String(newTitle).trim())
              const titleBecameMeaningful = oldTitleIsIntegerOnly && !newTitleIsIntegerOnly

              // Only regenerate if slug appears auto-generated (contains -page-N pattern)
              const slugIsAutoGenerated = /-page-\d+/.test(currentSlug) || /^page-\d+$/.test(currentSlug)

              if (slugIsAutoGenerated && (chapterChanged || titleBecameMeaningful)) {
                shouldRegenerate = true
                console.log(`🔄 Regenerating slug for page ${pageId}: chapter changed=${chapterChanged}, title became meaningful=${titleBecameMeaningful}`)
              }
            }

            // Auto-generate slug from title or page number if not provided OR if regeneration triggered
            let slug = shouldRegenerate ? null : value
            if (!slug) {
              const title = data?.title || siblingData?.title
              const chapterPageNum = data?.chapterPageNumber || siblingData?.chapterPageNumber
              const chapterId = data?.chapter || siblingData?.chapter || originalDoc?.chapter
              const isIntegerOnly = title && /^\d+$/.test(title.trim())

              if (title && !isIntegerOnly) {
                // Title exists and is not just a number - use it
                slug = title
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/(^-|-$)+/g, '')
              } else if (chapterId && chapterPageNum && req.payload) {
                // Title is missing or just a number, but has chapter - try to get chapter slug
                try {
                  const chapter = await req.payload.findByID({
                    collection: 'chapters',
                    id: typeof chapterId === 'object' ? chapterId.id : chapterId,
                  })
                  if (chapter?.slug) {
                    slug = `${chapter.slug}-page-${chapterPageNum}`
                  } else {
                    slug = `page-${chapterPageNum}`
                  }
                } catch {
                  slug = `page-${chapterPageNum}`
                }
              } else if (chapterPageNum) {
                slug = `page-${chapterPageNum}`
              } else {
                slug = `page-${Date.now()}`
              }
            }

            if (!slug) return value

            // Check for uniqueness within the comic
            if (comicId && req.payload) {
              const existing = await req.payload.find({
                collection: 'pages',
                where: {
                  comic: { equals: comicId },
                  slug: { equals: slug },
                  ...(pageId ? { id: { not_equals: pageId } } : {}),
                },
                limit: 1,
              })

              if (existing.docs.length > 0) {
                // Append number to make unique
                let counter = 2
                let newSlug = `${slug}-${counter}`
                while (true) {
                  const check = await req.payload.find({
                    collection: 'pages',
                    where: {
                      comic: { equals: comicId },
                      slug: { equals: newSlug },
                      ...(pageId ? { id: { not_equals: pageId } } : {}),
                    },
                    limit: 1,
                  })
                  if (check.docs.length === 0) break
                  counter++
                  newSlug = `${slug}-${counter}`
                }
                slug = newSlug
              }
            }

            return slug
          },
        ],
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
      hooks: {
        beforeValidate: [normalizeRelationshipId],
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
          hooks: {
            beforeValidate: [normalizeRelationshipId],
          },
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
      hooks: {
        beforeValidate: [normalizeRelationshipId],
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
          hooks: {
            beforeValidate: [normalizeRelationshipId],
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
          hooks: {
            beforeValidate: [normalizeRelationshipId],
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
      async ({ data, operation, req, originalDoc }) => {
        // Track original chapter for stats update when page is reassigned
        if (operation === 'update' && originalDoc?.chapter) {
          const oldChapterId = typeof originalDoc.chapter === 'object'
            ? originalDoc.chapter.id
            : originalDoc.chapter
          ;(req as any).originalChapterId = oldChapterId
        }

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
              // All pages are counted sequentially across all chapters
              const calculatedGlobal = totalPreviousPages + data.chapterPageNumber

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
      async ({ doc, operation, req }) => {
        // Log success message for user feedback
        if (operation === 'create') {
          console.log(`✅ Page ${doc.chapterPageNumber || 'unknown'} created successfully!`)
        } else if (operation === 'update') {
          console.log(`✅ Page ${doc.chapterPageNumber || 'unknown'} updated successfully!`)
        }

        // Update comic page statistics immediately and safely
        // Only update page-related stats (totalPages, lastPagePublished)
        // Guard: Skip if flag is set to prevent infinite loops
        if (doc.comic && req.payload && !(req as any).skipComicStatsCalculation) {
          try {
            const comicId = typeof doc.comic === 'object' ? doc.comic.id : doc.comic
            await updateComicPageStatistics(req.payload, comicId, req)
          } catch (error) {
            console.error('❌ Error updating comic page statistics:', error)
            // Don't throw - let the main operation succeed
          }
        }

        // Update chapter statistics (pageCount, firstPageNumber, lastPageNumber)
        // Guard: Skip if flag is set to prevent infinite loops
        if (doc.chapter && req.payload && !(req as any).skipChapterStatsCalculation) {
          try {
            const chapterId = typeof doc.chapter === 'object' ? doc.chapter.id : doc.chapter
            await updateChapterStatistics(req.payload, chapterId, req)
          } catch (error) {
            console.error('❌ Error updating chapter statistics:', error)
            // Don't throw - let the main operation succeed
          }
        }

        // Update OLD chapter statistics when page is reassigned to a different chapter
        const originalChapterId = (req as any).originalChapterId
        if (originalChapterId && req.payload && !(req as any).skipChapterStatsCalculation) {
          const newChapterId = typeof doc.chapter === 'object' ? doc.chapter?.id : doc.chapter
          // Only update if chapter actually changed
          if (originalChapterId !== newChapterId) {
            try {
              console.log(`📊 Updating stats for old chapter ${originalChapterId} (page reassigned)`)
              await updateChapterStatistics(req.payload, originalChapterId, req)
            } catch (error) {
              console.error('❌ Error updating old chapter statistics:', error)
            }
          }
        }
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        console.log(`🗑️ Page ${doc.chapterPageNumber || 'unknown'} deleted`)

        // Update comic page statistics after deletion
        if (doc.comic && req.payload && !(req as any).skipComicStatsCalculation) {
          try {
            const comicId = typeof doc.comic === 'object' ? doc.comic.id : doc.comic
            await updateComicPageStatistics(req.payload, comicId, req)
          } catch (error) {
            console.error('❌ Error updating comic page statistics after delete:', error)
          }
        }

        // Update chapter statistics after deletion
        if (doc.chapter && req.payload && !(req as any).skipChapterStatsCalculation) {
          try {
            const chapterId = typeof doc.chapter === 'object' ? doc.chapter.id : doc.chapter
            await updateChapterStatistics(req.payload, chapterId, req)
          } catch (error) {
            console.error('❌ Error updating chapter statistics after delete:', error)
          }
        }
      },
    ],
    // DISABLED: afterOperation hook was causing issues with DELETE operations
    // This was related to a Drizzle ORM bug (fixed in v0.44.7 / Payload v3.65.0)
    // The hook can potentially be re-enabled now, but needs testing
    // afterOperation: [
    //   async ({ operation, req, result }) => {
    //     // Update statistics immediately after page operations
    //     if (operation === 'create' || operation === 'update' || operation === 'updateByID') {
    //       const doc = result.doc || result
    //       console.log(`✅ Page operation ${operation} completed successfully`)
    //
    //       // Update comic statistics immediately but safely
    //       if (doc?.comic && req.payload && !(req as any).skipComicStatsCalculation) {
    //         try {
    //           const comicId = typeof doc.comic === 'object' ? doc.comic.id : doc.comic
    //           await updateComicStatisticsImmediate(req.payload, comicId, req)
    //         } catch (error) {
    //           console.error('❌ Error updating comic statistics:', error)
    //           // Don't throw - let the main operation succeed
    //         }
    //       }
    //     }
    //
    //     return result
    //   },
    // ],
  },
  timestamps: true,
}

// Update chapter statistics (pageCount, firstPageNumber, lastPageNumber)
// Called after page create/update/delete operations
async function updateChapterStatistics(payload: any, chapterId: string | number, req: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    // Get all pages in this chapter, sorted by chapterPageNumber
    const pagesInChapter = await payload.find({
      collection: 'pages',
      where: {
        chapter: { equals: chapterId },
      },
      sort: 'chapterPageNumber',
      limit: 1000,
      req: {
        ...req,
        skipGlobalPageCalculation: true,
        skipComicStatsCalculation: true,
        skipChapterStatsCalculation: true,
      } as any
    })

    const pageCount = pagesInChapter.totalDocs
    let firstPageNumber = null
    let lastPageNumber = null

    if (pagesInChapter.docs.length > 0) {
      // First page has the lowest globalPageNumber
      const sortedByGlobal = pagesInChapter.docs
        .filter((p: any) => p.globalPageNumber !== null && p.globalPageNumber !== undefined)
        .sort((a: any, b: any) => a.globalPageNumber - b.globalPageNumber)

      if (sortedByGlobal.length > 0) {
        firstPageNumber = sortedByGlobal[0].globalPageNumber
        lastPageNumber = sortedByGlobal[sortedByGlobal.length - 1].globalPageNumber
      }
    }

    // Update chapter stats
    await payload.update({
      collection: 'chapters',
      id: chapterId,
      data: {
        stats: {
          pageCount,
          firstPageNumber,
          lastPageNumber,
        }
      },
      req: {
        ...req,
        skipGlobalPageCalculation: true,
        skipComicStatsCalculation: true,
        skipChapterStatsCalculation: true,
      } as any,
    })

    console.log(`📖 Updated chapter ${chapterId} stats: ${pageCount} pages, global range: ${firstPageNumber || 'n/a'}-${lastPageNumber || 'n/a'}`)
    return true
  } catch (error) {
    console.error('Error in updateChapterStatistics:', error)
    return false
  }
}

// Update ONLY page-related statistics (totalPages, lastPagePublished)
// This function preserves chapter-related stats (totalChapters)
// to prevent conflicts with the Chapters collection hook
async function updateComicPageStatistics(payload: any, comicId: string, req: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    // Get current comic to preserve chapter stats
    const comic = await payload.findByID({
      collection: 'comics',
      id: comicId,
      req: {
        ...req,
        skipGlobalPageCalculation: true,
        skipComicStatsCalculation: true,
      } as any
    })

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

    // Update comic with page stats, preserving chapter stats
    await payload.update({
      collection: 'comics',
      id: comicId,
      data: {
        stats: {
          totalPages: pages.totalDocs,
          totalChapters: comic.stats?.totalChapters || 0, // Preserve from Chapters hook
          lastPagePublished: lastPagePublished,
        }
      },
      req: {
        ...req,
        skipGlobalPageCalculation: true,
        skipComicStatsCalculation: true, // Prevent loops
      } as any,
    })

    console.log(`📄 Updated comic page statistics: ${pages.totalDocs} pages, last published: ${lastPagePublished ? new Date(lastPagePublished).toLocaleDateString() : 'never'}`)
    return true
  } catch (error) {
    console.error('Error in updateComicPageStatistics:', error)
    return false
  }
}
