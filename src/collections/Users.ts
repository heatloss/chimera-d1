import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  auth: true,
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
        description: 'Unique public identifier for this user',
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
