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
}

export const THUMBNAIL_SIZES: ThumbnailSize[] = [
  {
    name: 'thumbnail',
    width: 400,
    height: undefined,
    fit: 'inside',
    position: 'centre',
  },
  {
    name: 'thumbnail_small',
    width: 200,
    height: undefined,
    fit: 'inside',
    position: 'centre',
  },
  {
    name: 'webcomic_page',
    width: 800,
    height: undefined,
    fit: 'inside',
    position: 'centre',
  },
  {
    name: 'webcomic_mobile',
    width: 400,
    height: undefined,
    fit: 'inside',
    position: 'centre',
  },
  {
    name: 'cover_image',
    width: 600,
    height: 800,
    fit: 'cover',
    position: 'centre',
  },
  {
    name: 'social_preview',
    width: 1200,
    height: 630,
    fit: 'cover',
    position: 'centre',
  },
  {
    name: 'avatar',
    width: 200,
    height: 200,
    fit: 'cover',
    position: 'centre',
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
