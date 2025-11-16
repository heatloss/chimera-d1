import type { CollectionConfig } from 'payload'

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
    read: () => true, // Comics are public (filtering by status happens in queries)
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
      },
      hooks: {
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
            description: 'Optional link to creator\'s website or social media',
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
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
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
        { label: 'Irregular', value: 'irregular' },
        { label: 'Completed', value: 'completed' },
        { label: 'Hiatus', value: 'hiatus' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'genres',
      type: 'select',
      hasMany: true,
      label: 'Genres',
      options: [
        { label: 'Action-Adventure', value: 'action-adventure' },
        { label: 'Alternate History', value: 'alternate-history' },
        { label: 'Comedy', value: 'comedy' },
        { label: 'Cyberpunk', value: 'cyberpunk' },
        { label: 'Drama', value: 'drama' },
        { label: 'Dystopian', value: 'dystopian' },
        { label: 'Educational', value: 'educational' },
        { label: 'Erotica', value: 'erotica' },
        { label: 'Fairytale', value: 'fairytale' },
        { label: 'Fan Comic', value: 'fan-comic' },
        { label: 'Fantasy', value: 'fantasy' },
        { label: 'Historical', value: 'historical' },
        { label: 'Horror', value: 'horror' },
        { label: 'Magical Girl', value: 'magical-girl' },
        { label: 'Mystery', value: 'mystery' },
        { label: 'Nonfiction', value: 'nonfiction' },
        { label: 'Parody', value: 'parody' },
        { label: 'Post-Apocalyptic', value: 'post-apocalyptic' },
        { label: 'Romance', value: 'romance' },
        { label: 'Satire', value: 'satire' },
        { label: 'Sci-Fi', value: 'sci-fi' },
        { label: 'Slice of Life', value: 'slice-of-life' },
        { label: 'Sports', value: 'sports' },
        { label: 'Steampunk', value: 'steampunk' },
        { label: 'Superhero', value: 'superhero' },
        { label: 'Urban Fantasy', value: 'urban-fantasy' },
        { label: 'Western', value: 'western' },
      ],
      admin: {
        description: 'Select all genres that apply to your comic',
      },
    },
    {
      name: 'tags',
      type: 'text',
      hasMany: true,
      label: 'Tags',
      admin: {
        description: 'Custom tags for better searchability (e.g., "lgbtq", "anthropomorphic", "noir")',
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
  },
  timestamps: true,
}
