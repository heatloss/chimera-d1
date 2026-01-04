/**
 * Thumbnail size configuration
 * Used by both Sharp (dev) and Jimp (Workers) generators
 */

export interface ThumbnailSize {
  name: string
  width: number
  height?: number
  fit: 'inside' | 'cover' | 'contain'
  position?: 'centre' | 'center' | 'top' | 'bottom' | 'left' | 'right'
  quality?: number // WebP quality 1-100 (default 75)
}

export const THUMBNAIL_SIZES: ThumbnailSize[] = [
  {
    name: 'thumbnail',
    width: 400,
    height: undefined,
    fit: 'inside',
    position: 'centre',
    quality: 75,
  },
  {
    name: 'thumbnail_large',
    width: 800,
    height: undefined,
    fit: 'inside',
    position: 'centre',
    quality: 80, // Slightly higher quality for larger thumbnail
  },
]

export interface GeneratedThumbnail {
  name: string
  width: number
  height: number
  url: string
  mimeType: string
  filesize: number
  buffer?: Buffer | Uint8Array // Include buffer for R2 upload
  filename?: string // Thumbnail filename for R2
}
