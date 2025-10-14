'use client'

import React from 'react'

/**
 * Custom cell component for list view - shows thumbnail count instead of raw JSON
 */
const ThumbnailCellField = ({ rowData, cellData }: any) => {
  // Try both rowData.imageSizes and cellData
  const imageSizes = cellData || rowData?.imageSizes

  if (!imageSizes || typeof imageSizes !== 'object' || Object.keys(imageSizes).length === 0) {
    return (
      <span style={{ fontSize: '13px', opacity: 0.6 }}>
        No thumbnails
      </span>
    )
  }

  const count = Object.keys(imageSizes).length

  return (
    <span style={{ fontSize: '13px' }}>
      {count} thumbnail{count !== 1 ? 's' : ''} generated
    </span>
  )
}

export default ThumbnailCellField
