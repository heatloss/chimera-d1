'use client'
import { useEffect } from 'react'
import { useFormFields } from '@payloadcms/ui'

/**
 * WORKAROUND COMPONENT
 *
 * Generates UUIDs client-side for Media collection uploads via Admin UI.
 *
 * Why this exists:
 * - PayloadCMS field-level hooks break in Cloudflare Workers during file uploads
 * - This component runs in the browser (not Workers) so it works
 * - Automatically sets UUID when upload form loads
 * - Transparent to admin users (hidden field)
 *
 * When to remove:
 * - When PayloadCMS fixes hook execution in Workers runtime
 * - See WORKAROUND-UUID.md for migration instructions
 *
 * Related:
 * - Bug Report: https://github.com/payloadcms/payload/discussions/[issue-number]
 * - Documentation: /WORKAROUND-UUID.md
 */
const UUIDField = (): null => {
  const { value, setValue } = useFormFields(([fields, dispatch]) => ({
    value: fields.id?.value as string | undefined,
    setValue: (newValue: string) => {
      dispatch({
        type: 'UPDATE',
        path: 'id',
        value: newValue,
      })
    },
  }))

  useEffect(() => {
    // Only set UUID if one doesn't already exist
    if (!value) {
      const newId = crypto.randomUUID()
      console.log('[UUIDField Workaround] Generated UUID:', newId)
      setValue(newId)
    }
  }, [value, setValue])

  // Hidden field - no UI needed
  return null
}

export default UUIDField
