'use client'

import React from 'react'

interface GeneratedThumbnail {
  name: string
  width: number
  height: number
  url: string
  mimeType: string
  filesize: number
}

interface ThumbnailCountCellProps {
  data: GeneratedThumbnail[] | null | undefined
}

export const ThumbnailCountCell: React.FC<ThumbnailCountCellProps> = ({ data }) => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return <span style={{ color: 'var(--theme-elevation-400)' }}>No thumbnails</span>
  }

  return (
    <span style={{ color: 'var(--theme-text)' }}>
      {data.length} thumbnail{data.length !== 1 ? 's' : ''}
    </span>
  )
}
