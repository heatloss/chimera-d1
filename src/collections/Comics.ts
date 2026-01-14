import type { CollectionConfig } from 'payload'

// Helper hook to normalize string IDs to integers for D1 adapter compatibility
const normalizeRelationshipId = ({ value }: { value?: any }) => {
  if (value && typeof value === 'string') {
    return parseInt(value, 10)
  }
  return value
}

/**
 * Workaround for D1 adapter bug: hasMany relationships accumulate duplicates
 * because the adapter doesn't DELETE existing rows before INSERTing new ones.
 * This hook cleans up duplicates after each save.
 *
 * Bug tracking: https://github.com/payloadcms/payload/issues/XXXXX (to be filed)
 */
const deduplicateRelationships = async ({ doc }: { doc: any }) => {
  try {
    const cloudflare = (globalThis as any).__CLOUDFLARE_CONTEXT__
    const d1 = cloudflare?.env?.D1
    if (!d1) {
      console.warn('⚠️ D1 not available for relationship deduplication')
      return doc
    }

    const comicId = doc.id

    // Delete duplicate genre relationships, keeping only the row with lowest id for each unique genre
    await d1.prepare(`
      DELETE FROM comics_rels
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM comics_rels
        WHERE parent_id = ? AND path = 'genres' AND genres_id IS NOT NULL
        GROUP BY parent_id, path, genres_id
      )
      AND parent_id = ?
      AND path = 'genres'
    `).bind(comicId, comicId).run()

    // Delete duplicate tag relationships, keeping only the row with lowest id for each unique tag
    await d1.prepare(`
      DELETE FROM comics_rels
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM comics_rels
        WHERE parent_id = ? AND path = 'tags' AND tags_id IS NOT NULL
        GROUP BY parent_id, path, tags_id
      )
      AND parent_id = ?
      AND path = 'tags'
    `).bind(comicId, comicId).run()

    // Re-sequence the order values to be contiguous (1, 2, 3, ...)
    // First for genres
    const genreRows = await d1.prepare(`
      SELECT id FROM comics_rels
      WHERE parent_id = ? AND path = 'genres'
      ORDER BY id
    `).bind(comicId).all()

    for (let i = 0; i < (genreRows.results?.length || 0); i++) {
      await d1.prepare(`
        UPDATE comics_rels SET "order" = ? WHERE id = ?
      `).bind(i + 1, genreRows.results![i].id).run()
    }

    // Then for tags
    const tagRows = await d1.prepare(`
      SELECT id FROM comics_rels
      WHERE parent_id = ? AND path = 'tags'
      ORDER BY id
    `).bind(comicId).all()

    for (let i = 0; i < (tagRows.results?.length || 0); i++) {
      await d1.prepare(`
        UPDATE comics_rels SET "order" = ? WHERE id = ?
      `).bind(i + 1, tagRows.results![i].id).run()
    }

    // Also deduplicate credits array (stored in comics_credits table)
    // Delete duplicate credit entries, keeping only the row with lowest id for each unique role+name combo
    await d1.prepare(`
      DELETE FROM comics_credits
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM comics_credits
        WHERE _parent_id = ?
        GROUP BY _parent_id, role, name
      )
      AND _parent_id = ?
    `).bind(comicId, comicId).run()

    // Re-sequence credit order values
    const creditRows = await d1.prepare(`
      SELECT id FROM comics_credits
      WHERE _parent_id = ?
      ORDER BY id
    `).bind(comicId).all()

    for (let i = 0; i < (creditRows.results?.length || 0); i++) {
      await d1.prepare(`
        UPDATE comics_credits SET "_order" = ? WHERE id = ?
      `).bind(i + 1, creditRows.results![i].id).run()
    }

    console.log(`✅ Deduplicated relationships for comic ${comicId}`)
  } catch (error) {
    console.error('⚠️ Failed to deduplicate relationships:', error)
  }
  return doc
}

export const Comics: CollectionConfig = {
  slug: 'comics',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'author', 'status', 'publishSchedule', 'updatedAt'],
    group: 'Comics', // Main group for comic management
  },
  access: {
    // Only creators can create comics, only owners/editors can edit
    create: ({ req: { user } }) => {
      return user && ['creator', 'editor', 'admin'].includes(user.role)
    },
    read: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      if (user?.role === 'editor') return true
      if (!user?.id) return false
      // Creators can only see their own comics
      return {
        author: {
          equals: user.id,
        },
      }
    },
    update: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      if (user?.role === 'editor') return true
      if (!user?.id) return false
      // Creators can only edit their own comics
      return {
        author: {
          equals: user.id,
        },
      }
    },
    delete: ({ req: { user } }) => {
      return user?.role === 'admin'
    },
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Comic Title',
      admin: {
        description: 'The name of your webcomic series',
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      label: 'URL Slug',
      admin: {
        description: 'URL-friendly version of the title (e.g., "my-awesome-comic")',
        position: 'sidebar',
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
      name: 'description',
      type: 'textarea',
      label: 'Series Description',
      admin: {
        description: 'A brief summary of your webcomic for readers',
        rows: 4,
      },
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      label: 'Creator',
      admin: {
        position: 'sidebar',
        condition: (data, siblingData, { user }) => {
          // Only show for admins and editors who can see all users
          return user?.role === 'admin' || user?.role === 'editor'
        },
      },
      hooks: {
        beforeValidate: [normalizeRelationshipId],
        beforeChange: [
          ({ req, operation, value }) => {
            // Auto-assign current user as author on create
            if (operation === 'create' && !value && req.user) {
              return req.user.id
            }
            return value
          },
        ],
      },
    },
    {
      name: 'coverImage',
      type: 'upload',
      relationTo: 'media',
      label: 'Cover Image',
      admin: {
        description: 'Main cover art for the comic series',
        position: 'sidebar',
      },
      hooks: {
        beforeValidate: [normalizeRelationshipId],
      },
    },
    {
      name: 'credits',
      type: 'array',
      label: 'Creator Credits',
      admin: {
        description: 'Team members who work on this comic',
      },
      fields: [
        {
          name: 'role',
          type: 'select',
          required: true,
          label: 'Role',
          options: [
            { label: 'Writer', value: 'writer' },
            { label: 'Artist', value: 'artist' },
            { label: 'Penciller', value: 'penciller' },
            { label: 'Inker', value: 'inker' },
            { label: 'Colorist', value: 'colorist' },
            { label: 'Letterer', value: 'letterer' },
            { label: 'Editor', value: 'editor' },
            { label: 'Other', value: 'other' },
          ],
        },
        {
          name: 'customRole',
          type: 'text',
          label: 'Custom Role Name',
          admin: {
            description: 'Only used if "Other" is selected above',
            condition: (data, siblingData) => siblingData?.role === 'other',
          },
        },
        {
          name: 'name',
          type: 'text',
          required: true,
          label: 'Creator Name',
        },
        {
          name: 'url',
          type: 'text',
          label: 'Website/Social URL',
          admin: {
            description: "Optional link to creator's website or social media",
          },
        },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft/Hidden', value: 'draft' },
        { label: 'Live', value: 'live' },
        { label: 'On Hiatus', value: 'hiatus' },
        { label: 'Completed', value: 'completed' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'publishSchedule',
      type: 'select',
      required: true,
      defaultValue: 'irregular',
      label: 'Publishing Schedule',
      options: [
        { label: 'Daily', value: 'daily' },
        { label: 'Weekly', value: 'weekly' },
        { label: 'Twice Weekly', value: 'twice-weekly' },
        { label: 'Monthly', value: 'monthly' },
        { label: 'Irregular', value: 'irregular' }, // Keep - this is the default
        { label: 'Completed', value: 'completed' },
        { label: 'Inactive', value: 'inactive' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'genres',
      type: 'relationship',
      relationTo: 'genres',
      hasMany: true,
      label: 'Genres',
      admin: {
        description: 'Select all genres that apply to your comic',
      },
    },
    {
      name: 'tags',
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true,
      label: 'Tags',
      admin: {
        description:
          'Tags for better searchability (e.g., "LGBTQ+", "Anthropomorphic", "Noir")',
      },
    },
    {
      name: 'isNSFW',
      type: 'checkbox',
      defaultValue: false,
      label: 'Contains Adult Content (NSFW)',
      admin: {
        description: 'Check if this comic contains mature/adult content',
        position: 'sidebar',
      },
    },
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
            description: 'SEO title (defaults to comic title if empty)',
          },
        },
        {
          name: 'metaDescription',
          type: 'textarea',
          label: 'Meta Description',
          admin: {
            description: 'SEO description (defaults to comic description if empty)',
            rows: 3,
          },
        },
        {
          name: 'socialImage',
          type: 'upload',
          relationTo: 'media',
          label: 'Social Media Image',
          admin: {
            description: 'Image for social media sharing (defaults to cover image)',
          },
          hooks: {
            beforeValidate: [normalizeRelationshipId],
          },
        },
      ],
    },
    // Statistics fields (read-only, updated by hooks)
    {
      name: 'stats',
      type: 'group',
      label: 'Statistics',
      fields: [
        {
          name: 'totalPages',
          type: 'number',
          defaultValue: 0,
        },
        {
          name: 'totalChapters',
          type: 'number',
          defaultValue: 0,
        },
        {
          name: 'lastPagePublished',
          type: 'date',
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
    afterChange: [deduplicateRelationships],
  },
  timestamps: true,
}
