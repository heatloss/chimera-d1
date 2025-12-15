import type { CollectionConfig } from 'payload'

export const Genres: CollectionConfig = {
  slug: 'genres',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug'],
    group: 'Taxonomies',
  },
  access: {
    read: () => true, // Everyone can read genres
    create: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    update: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Genre Name',
      admin: {
        description: 'Display name for the genre (e.g., "Action-Adventure")',
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      label: 'Slug',
      admin: {
        description: 'URL-friendly identifier (e.g., "action-adventure")',
      },
      hooks: {
        beforeValidate: [
          ({ value, data }) => {
            if (data?.name && !value) {
              return data.name
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
      label: 'Description',
      admin: {
        description: 'Optional description of the genre',
      },
    },
  ],
  timestamps: true,
}
