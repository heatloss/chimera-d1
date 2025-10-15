'use client'

import React from 'react'
import { useFormFields } from '@payloadcms/ui'

/**
 * Custom field component to display generated thumbnail previews
 * instead of raw JSON in the Admin UI
 */
const ThumbnailPreviewField = ({ field, path }: any) => {
  // Use Payload's useFormFields hook to get the actual field value
  const { value } = useFormFields(([fields]) => ({
    value: fields[path]?.value
  }))

  // Parse the imageSizes JSON data
  const imageSizes = value as Record<string, {
    url: string
    width: number
    height: number
    mimeType: string
    fileSize: number
    filename: string
  }> | null

  if (!imageSizes || Object.keys(imageSizes).length === 0) {
    return (
      <div style={{ padding: '1rem', color: 'var(--theme-elevation-500)' }}>
        <p>No thumbnails generated yet. Upload an image to see thumbnails.</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '1rem' }}>
      <h4 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '14px', fontWeight: 600 }}>
        Generated Thumbnails ({Object.keys(imageSizes).length} sizes)
      </h4>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '1rem'
      }}>
        {Object.entries(imageSizes).map(([sizeName, sizeData]) => (
          <div
            key={sizeName}
            style={{
              border: '1px solid var(--theme-elevation-150)',
              borderRadius: '4px',
              padding: '0.5rem',
              backgroundColor: 'var(--theme-elevation-50)'
            }}
          >
            <a
              href={sizeData.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                aspectRatio: '16/9',
                backgroundColor: 'var(--theme-elevation-100)',
                borderRadius: '2px',
                overflow: 'hidden',
                cursor: 'pointer'
              }}
            >
              <img
                src={sizeData.url}
                alt={sizeName}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  display: 'block'
                }}
              />
            </a>

            <div style={{ fontSize: '12px' }}>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                {sizeName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </div>
              <div style={{ color: 'var(--theme-elevation-600)', lineHeight: '1.4' }}>
                {sizeData.width} × {sizeData.height}
                <br />
                {(sizeData.fileSize / 1024).toFixed(1)} KB
              </div>
              <a
                href={sizeData.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  marginTop: '4px',
                  color: 'var(--theme-success-500)',
                  textDecoration: 'none',
                  fontSize: '11px'
                }}
              >
                View full size →
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ThumbnailPreviewField
