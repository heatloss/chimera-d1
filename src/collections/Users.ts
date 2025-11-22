import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  auth: true,
  fields: [
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'creator',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Editor', value: 'editor' },
        { label: 'Creator', value: 'creator' },
        { label: 'Reader', value: 'reader' },
      ],
      admin: {
        position: 'sidebar',
        description: 'User role for access control',
      },
    },
  ],
}
