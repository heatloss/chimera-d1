'use client'

import React from 'react'
import { useField } from '@payloadcms/ui'

interface GeneratedThumbnail {
  name: string
  width: number
  height: number
  url: string
  mimeType: string
  filesize: number
}

interface ThumbnailGalleryProps {
  path: string
  readOnly?: boolean
}

export const ThumbnailGallery: React.FC<ThumbnailGalleryProps> = ({ path, readOnly = true }) => {
  const { value } = useField<GeneratedThumbnail[]>({ path })

  if (!value || !Array.isArray(value) || value.length === 0) {
    return (
      <div style={{ padding: '1rem', color: 'var(--theme-elevation-400)', fontStyle: 'italic' }}>
        No thumbnails generated
      </div>
    )
  }

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '1rem'
      }}>
        {value.map((thumbnail) => (
          <div
            key={thumbnail.name}
            style={{
              border: '1px solid var(--theme-elevation-150)',
              borderRadius: '4px',
              padding: '0.5rem',
              backgroundColor: 'var(--theme-elevation-50)'
            }}
          >
            <a
              href={thumbnail.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'block', marginBottom: '0.5rem', textDecoration: 'none' }}
            >
              <img
                src={thumbnail.url}
                alt={thumbnail.name}
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                  borderRadius: '2px',
                  cursor: 'pointer'
                }}
              />
            </a>
            <div style={{ fontSize: '0.875rem' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.25rem', color: 'var(--theme-text)' }}>
                {thumbnail.name}
              </div>
              <div style={{ color: 'var(--theme-elevation-400)', fontSize: '0.75rem' }}>
                {thumbnail.width} × {thumbnail.height}
              </div>
              <div style={{ color: 'var(--theme-elevation-400)', fontSize: '0.75rem' }}>
                {(thumbnail.filesize / 1024).toFixed(1)} KB
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
