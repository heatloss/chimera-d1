import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  auth: true,
  fields: [
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