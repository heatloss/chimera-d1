#!/usr/bin/env tsx
/**
 * Migration Script: Import data from chimera-cms to chimera-d1
 *
 * This script:
 * 1. Reads data from chimera-cms.db (old schema with TEXT IDs)
 * 2. Transforms and imports into chimera-d1 (new schema with INTEGER IDs + UUIDs)
 * 3. Maintains relationships using ID mapping
 * 4. Skips old thumbnail data (will be regenerated)
 *
 * Usage: pnpm tsx scripts/migrate-from-chimera-cms.ts
 */

import 'dotenv/config'
import Database from 'better-sqlite3'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import path from 'path'
import crypto from 'crypto'

const SOURCE_DB = '/Users/mike/Sites/chimera-cms/chimera-cms.db'
const TARGET_ENV = 'local' // Change to 'remote' for production migration

interface IDMapping {
  users: Map<string, number>
  comics: Map<string, number>
  chapters: Map<string, number>
  pages: Map<string, number>
  media: Map<string, number>
}

interface OldUser {
  id: string
  email: string
  role: string
  hash: string | null
  salt: string | null
  login_attempts: number | null
  lock_until: string | null
}

interface OldComic {
  id: string
  title: string
  slug: string
  description: string | null
  author_id: string
  cover_image_id: string | null
  status: string
  publish_schedule: string
  is_n_s_f_w: number
  seo_meta_meta_title: string | null
  seo_meta_meta_description: string | null
  seo_meta_social_image_id: string | null
  stats_total_pages: number | null
  stats_total_chapters: number | null
  stats_last_page_published: string | null
  updated_at: string
  created_at: string
}

interface OldChapter {
  id: string
  comic_id: string
  title: string
  order: number | null
  description: string | null
  seo_meta_slug: string | null
  seo_meta_meta_title: string | null
  seo_meta_meta_description: string | null
  stats_page_count: number | null
  stats_first_page_number: number | null
  stats_last_page_number: number | null
  updated_at: string
  created_at: string
}

interface OldPage {
  id: string
  comic_id: string
  chapter_id: string | null
  chapter_page_number: number
  global_page_number: number | null
  title: string | null
  display_title: string | null
  page_image_id: string | null
  thumbnail_image_id: string | null
  alt_text: string | null
  author_notes: string | null
  status: string
  published_date: string | null
  navigation_previous_page_id: string | null
  navigation_next_page_id: string | null
  navigation_is_first_page: number | null
  navigation_is_last_page: number | null
  seo_meta_slug: string | null
  seo_meta_meta_title: string | null
  seo_meta_meta_description: string | null
  updated_at: string
  created_at: string
}

interface OldMedia {
  id: string
  alt: string | null
  caption: string | null
  media_type: string
  uploaded_by_id: string
  is_public: number
  comic_meta_related_comic_id: string | null
  comic_meta_is_n_s_f_w: number
  updated_at: string
  created_at: string
  url: string | null
  thumbnail_u_r_l: string | null
  filename: string | null
  mime_type: string | null
  filesize: number | null
  width: number | null
  height: number | null
}

async function main() {
  console.log('🚀 Starting migration from chimera-cms to chimera-d1\n')

  // Open source database
  console.log(`📖 Opening source database: ${SOURCE_DB}`)
  const sourceDb = new Database(SOURCE_DB, { readonly: true })

  // Initialize Payload
  console.log('⚙️  Initializing Payload...')
  const payload = await getPayload({ config })

  // ID mapping to track old UUID -> new INTEGER ID conversions
  const idMapping: IDMapping = {
    users: new Map(),
    comics: new Map(),
    chapters: new Map(),
    pages: new Map(),
    media: new Map(),
  }

  try {
    // Step 1: Migrate Users
    await migrateUsers(sourceDb, payload, idMapping)

    // Step 2: Migrate Comics
    await migrateComics(sourceDb, payload, idMapping)

    // Step 3: Migrate Chapters
    await migrateChapters(sourceDb, payload, idMapping)

    // Step 4: Migrate Pages
    await migratePages(sourceDb, payload, idMapping)

    // Step 5: Migrate Media
    await migrateMedia(sourceDb, payload, idMapping)

    // Step 6: Update relationships (cover images, page images, etc.)
    await updateRelationships(payload, idMapping)

    console.log('\n✅ Migration completed successfully!')
    console.log('\n📝 Next steps:')
    console.log('1. Verify data in admin UI: http://localhost:3333/admin')
    console.log('2. Run thumbnail regeneration: pnpm tsx scripts/regenerate-thumbnails.ts')

  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    throw error
  } finally {
    sourceDb.close()
  }
}

async function migrateUsers(
  sourceDb: Database.Database,
  payload: any,
  idMapping: IDMapping
) {
  console.log('\n👤 Migrating Users...')

  const oldUsers = sourceDb.prepare('SELECT * FROM users').all() as OldUser[]
  console.log(`   Found ${oldUsers.length} users`)

  // Store temp passwords for documentation
  const tempPasswords: Array<{ email: string; password: string }> = []

  for (const oldUser of oldUsers) {
    try {
      // Generate secure temporary password (users will need to reset)
      const tempPassword = crypto.randomBytes(32).toString('hex')

      // Create user with new UUID and temp password
      const newUser = await payload.create({
        collection: 'users',
        data: {
          uuid: crypto.randomUUID(), // Generate new UUID
          email: oldUser.email,
          role: oldUser.role as 'admin' | 'editor' | 'creator' | 'reader',
          password: tempPassword, // Payload will hash this
        },
      })

      idMapping.users.set(oldUser.id, newUser.id)
      tempPasswords.push({ email: oldUser.email, password: tempPassword })
      console.log(`   ✓ ${oldUser.email} (${oldUser.id} → ${newUser.id})`)
    } catch (error) {
      console.error(`   ✗ Failed to migrate user ${oldUser.email}:`, error)
      throw error
    }
  }

  // Write temp passwords to file for safekeeping
  const fs = await import('fs')
  const passwordsFile = 'backups/temp-passwords-' + new Date().toISOString().replace(/:/g, '-') + '.txt'
  const passwordsContent = [
    '='.repeat(70),
    'TEMPORARY PASSWORDS - Migration from chimera-cms',
    '='.repeat(70),
    '',
    'IMPORTANT: These are temporary passwords generated during migration.',
    'Users should reset their passwords after logging in.',
    '',
    'Generated: ' + new Date().toISOString(),
    '',
    ...tempPasswords.map(({ email, password }) =>
      `Email: ${email}\nPassword: ${password}\n`
    ),
    '='.repeat(70),
  ].join('\n')

  fs.writeFileSync(passwordsFile, passwordsContent)
  console.log(`\n   📝 Temporary passwords saved to: ${passwordsFile}`)
  console.log(`   ⚠️  IMPORTANT: Users must reset passwords after first login!`)
}

async function migrateComics(
  sourceDb: Database.Database,
  payload: any,
  idMapping: IDMapping
) {
  console.log('\n📚 Migrating Comics...')

  const oldComics = sourceDb.prepare('SELECT * FROM comics').all() as OldComic[]
  console.log(`   Found ${oldComics.length} comics`)

  // Get genres from array table
  const comicGenres = sourceDb.prepare('SELECT * FROM comics_genres').all() as Array<{
    id: string
    _order: number
    _parent_id: string
    value: string
  }>

  // Get credits from array table
  const comicCredits = sourceDb.prepare('SELECT * FROM comics_credits').all() as Array<{
    id: string
    role: string
    custom_role: string | null
    name: string
    url: string | null
    _order: number
    _parent_id: string
  }>

  for (const oldComic of oldComics) {
    try {
      const newAuthorId = idMapping.users.get(oldComic.author_id)
      if (!newAuthorId) {
        throw new Error(`Author ID ${oldComic.author_id} not found in mapping`)
      }

      // Get genres for this comic
      const genres = comicGenres
        .filter(g => g._parent_id === oldComic.id)
        .sort((a, b) => a._order - b._order)
        .map(g => g.value)

      // Get credits for this comic
      const credits = comicCredits
        .filter(c => c._parent_id === oldComic.id)
        .sort((a, b) => a._order - b._order)
        .map(c => ({
          role: c.role,
          customRole: c.custom_role,
          name: c.name,
          url: c.url,
        }))

      const newComic = await payload.create({
        collection: 'comics',
        data: {
          uuid: crypto.randomUUID(),
          title: oldComic.title,
          slug: oldComic.slug,
          description: oldComic.description,
          author: newAuthorId,
          // Note: cover_image_id will be updated in updateRelationships()
          status: oldComic.status,
          publishSchedule: oldComic.publish_schedule,
          genres: genres.length > 0 ? genres : undefined,
          credits: credits.length > 0 ? credits : undefined,
          isNSFW: Boolean(oldComic.is_n_s_f_w),
          seoMeta: {
            metaTitle: oldComic.seo_meta_meta_title,
            metaDescription: oldComic.seo_meta_meta_description,
            // socialImage will be updated in updateRelationships()
          },
          stats: {
            totalPages: oldComic.stats_total_pages,
            totalChapters: oldComic.stats_total_chapters,
            lastPagePublished: oldComic.stats_last_page_published,
          },
        },
      })

      idMapping.comics.set(oldComic.id, newComic.id)
      console.log(`   ✓ ${oldComic.title} (${oldComic.id} → ${newComic.id})`)
    } catch (error) {
      console.error(`   ✗ Failed to migrate comic ${oldComic.title}:`, error)
      throw error
    }
  }
}

async function migrateChapters(
  sourceDb: Database.Database,
  payload: any,
  idMapping: IDMapping
) {
  console.log('\n📖 Migrating Chapters...')

  const oldChapters = sourceDb.prepare('SELECT * FROM chapters ORDER BY `order`').all() as OldChapter[]
  console.log(`   Found ${oldChapters.length} chapters`)

  for (const oldChapter of oldChapters) {
    try {
      const newComicId = idMapping.comics.get(oldChapter.comic_id)
      if (!newComicId) {
        throw new Error(`Comic ID ${oldChapter.comic_id} not found in mapping`)
      }

      const newChapter = await payload.create({
        collection: 'chapters',
        data: {
          uuid: crypto.randomUUID(),
          comic: newComicId,
          title: oldChapter.title,
          order: oldChapter.order,
          description: oldChapter.description,
          seoMeta: {
            slug: oldChapter.seo_meta_slug,
            metaTitle: oldChapter.seo_meta_meta_title,
            metaDescription: oldChapter.seo_meta_meta_description,
          },
          stats: {
            pageCount: oldChapter.stats_page_count,
            firstPageNumber: oldChapter.stats_first_page_number,
            lastPageNumber: oldChapter.stats_last_page_number,
          },
        },
      })

      idMapping.chapters.set(oldChapter.id, newChapter.id)
      console.log(`   ✓ ${oldChapter.title} (${oldChapter.id} → ${newChapter.id})`)
    } catch (error) {
      console.error(`   ✗ Failed to migrate chapter ${oldChapter.title}:`, error)
      throw error
    }
  }
}

async function migratePages(
  sourceDb: Database.Database,
  payload: any,
  idMapping: IDMapping
) {
  console.log('\n📄 Migrating Pages...')

  const oldPages = sourceDb.prepare('SELECT * FROM pages ORDER BY global_page_number').all() as OldPage[]
  console.log(`   Found ${oldPages.length} pages`)

  // Get extra images from array table
  const pageExtraImages = sourceDb.prepare('SELECT * FROM pages_page_extra_images').all() as Array<{
    id: string
    image_id: string
    alt_text: string | null
    _order: number
    _parent_id: string
  }>

  for (const oldPage of oldPages) {
    try {
      const newComicId = idMapping.comics.get(oldPage.comic_id)
      const newChapterId = oldPage.chapter_id ? idMapping.chapters.get(oldPage.chapter_id) : null

      if (!newComicId) {
        throw new Error(`Comic ID ${oldPage.comic_id} not found in mapping`)
      }

      // Get extra images for this page
      const extraImages = pageExtraImages
        .filter(ei => ei._parent_id === oldPage.id)
        .sort((a, b) => a._order - b._order)
        .map(ei => {
          const newImageId = idMapping.media.get(ei.image_id)
          return newImageId ? {
            image: newImageId,
            altText: ei.alt_text,
          } : null
        })
        .filter(Boolean)

      const newPage = await payload.create({
        collection: 'pages',
        data: {
          uuid: crypto.randomUUID(),
          comic: newComicId,
          chapter: newChapterId,
          chapterPageNumber: oldPage.chapter_page_number,
          globalPageNumber: oldPage.global_page_number,
          title: oldPage.title,
          displayTitle: oldPage.display_title,
          // Note: pageImage and thumbnailImage will be updated in updateRelationships()
          pageExtraImages: extraImages.length > 0 ? extraImages : undefined,
          altText: oldPage.alt_text,
          authorNotes: oldPage.author_notes,
          status: oldPage.status,
          publishedDate: oldPage.published_date,
          navigation: {
            // Note: previousPage and nextPage will be updated in updateRelationships()
            isFirstPage: Boolean(oldPage.navigation_is_first_page),
            isLastPage: Boolean(oldPage.navigation_is_last_page),
          },
          seoMeta: {
            slug: oldPage.seo_meta_slug,
            metaTitle: oldPage.seo_meta_meta_title,
            metaDescription: oldPage.seo_meta_meta_description,
          },
        },
      })

      idMapping.pages.set(oldPage.id, newPage.id)
      console.log(`   ✓ Page ${oldPage.global_page_number || oldPage.chapter_page_number} (${oldPage.id} → ${newPage.id})`)
    } catch (error) {
      console.error(`   ✗ Failed to migrate page ${oldPage.id}:`, error)
      throw error
    }
  }
}

async function migrateMedia(
  sourceDb: Database.Database,
  payload: any,
  idMapping: IDMapping
) {
  console.log('\n🖼️  Migrating Media...')

  const oldMedia = sourceDb.prepare('SELECT * FROM media').all() as OldMedia[]
  console.log(`   Found ${oldMedia.length} media items`)

  for (const oldMediaItem of oldMedia) {
    try {
      const newUploaderId = idMapping.users.get(oldMediaItem.uploaded_by_id)
      if (!newUploaderId) {
        throw new Error(`Uploader ID ${oldMediaItem.uploaded_by_id} not found in mapping`)
      }

      const newRelatedComicId = oldMediaItem.comic_meta_related_comic_id
        ? idMapping.comics.get(oldMediaItem.comic_meta_related_comic_id)
        : null

      const newMedia = await payload.create({
        collection: 'media',
        data: {
          uuid: crypto.randomUUID(),
          alt: oldMediaItem.alt,
          caption: oldMediaItem.caption,
          mediaType: oldMediaItem.media_type,
          uploadedBy: newUploaderId,
          isPublic: Boolean(oldMediaItem.is_public),
          comicMeta: {
            relatedComic: newRelatedComicId,
            isNSFW: Boolean(oldMediaItem.comic_meta_is_n_s_f_w),
          },
          // Copy file metadata (actual files need to be copied separately)
          url: oldMediaItem.url,
          thumbnailURL: oldMediaItem.thumbnail_u_r_l,
          filename: oldMediaItem.filename,
          mimeType: oldMediaItem.mime_type,
          filesize: oldMediaItem.filesize,
          width: oldMediaItem.width,
          height: oldMediaItem.height,
          // imageSizes will be populated when thumbnails are regenerated
          imageSizes: null,
        },
      })

      idMapping.media.set(oldMediaItem.id, newMedia.id)
      console.log(`   ✓ ${oldMediaItem.filename} (${oldMediaItem.id} → ${newMedia.id})`)
    } catch (error) {
      console.error(`   ✗ Failed to migrate media ${oldMediaItem.filename}:`, error)
      throw error
    }
  }
}

async function updateRelationships(payload: any, idMapping: IDMapping) {
  console.log('\n🔗 Updating Relationships...')

  // Re-read source data to get relationship IDs
  const sourceDb = new Database(SOURCE_DB, { readonly: true })

  try {
    // Update comic cover images
    const oldComics = sourceDb.prepare('SELECT id, cover_image_id, seo_meta_social_image_id FROM comics').all() as Array<{
      id: string
      cover_image_id: string | null
      seo_meta_social_image_id: string | null
    }>

    for (const oldComic of oldComics) {
      const newComicId = idMapping.comics.get(oldComic.id)
      if (!newComicId) continue

      const updates: any = {}

      if (oldComic.cover_image_id) {
        const newCoverId = idMapping.media.get(oldComic.cover_image_id)
        if (newCoverId) {
          updates.coverImage = newCoverId
        }
      }

      if (oldComic.seo_meta_social_image_id) {
        const newSocialImageId = idMapping.media.get(oldComic.seo_meta_social_image_id)
        if (newSocialImageId) {
          updates['seoMeta.socialImage'] = newSocialImageId
        }
      }

      if (Object.keys(updates).length > 0) {
        await payload.update({
          collection: 'comics',
          id: newComicId,
          data: updates,
        })
        console.log(`   ✓ Updated comic ${newComicId} relationships`)
      }
    }

    // Update page images and navigation
    const oldPages = sourceDb.prepare('SELECT id, page_image_id, thumbnail_image_id, navigation_previous_page_id, navigation_next_page_id FROM pages').all() as Array<{
      id: string
      page_image_id: string | null
      thumbnail_image_id: string | null
      navigation_previous_page_id: string | null
      navigation_next_page_id: string | null
    }>

    for (const oldPage of oldPages) {
      const newPageId = idMapping.pages.get(oldPage.id)
      if (!newPageId) continue

      const updates: any = {}

      if (oldPage.page_image_id) {
        const newImageId = idMapping.media.get(oldPage.page_image_id)
        if (newImageId) {
          updates.pageImage = newImageId
        }
      }

      if (oldPage.thumbnail_image_id) {
        const newThumbId = idMapping.media.get(oldPage.thumbnail_image_id)
        if (newThumbId) {
          updates.thumbnailImage = newThumbId
        }
      }

      if (oldPage.navigation_previous_page_id) {
        const newPrevId = idMapping.pages.get(oldPage.navigation_previous_page_id)
        if (newPrevId) {
          if (!updates.navigation) updates.navigation = {}
          updates.navigation.previousPage = newPrevId
        }
      }

      if (oldPage.navigation_next_page_id) {
        const newNextId = idMapping.pages.get(oldPage.navigation_next_page_id)
        if (newNextId) {
          if (!updates.navigation) updates.navigation = {}
          updates.navigation.nextPage = newNextId
        }
      }

      if (Object.keys(updates).length > 0) {
        await payload.update({
          collection: 'pages',
          id: newPageId,
          data: updates,
        })
        console.log(`   ✓ Updated page ${newPageId} relationships`)
      }
    }

  } finally {
    sourceDb.close()
  }

  console.log('   ✓ All relationships updated')
}

// Run migration
main().catch(console.error)
