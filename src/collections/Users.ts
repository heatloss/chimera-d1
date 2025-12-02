import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  auth: true,
  access: {
    // Only admins can create new user accounts
    create: ({ req: { user } }) => {
      return user?.role === 'admin'
    },
    // Users can only see their own account, admins/editors can see all
    read: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      if (user?.role === 'editor') return true
      if (!user?.id) return false
      // All other users can only see their own account
      return {
        id: {
          equals: user.id,
        },
      }
    },
    // Users can update their own account, admins can update any
    update: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      if (!user?.id) return false
      // Users can only update their own account
      return {
        id: {
          equals: user.id,
        },
      }
    },
    // Only admins can delete user accounts
    delete: ({ req: { user } }) => {
      return user?.role === 'admin'
    },
  },
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
