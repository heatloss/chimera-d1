#!/usr/bin/env tsx
/**
 * Data Migration Script: Remote to Local
 *
 * Migrates data from remote Cloudflare D1 database (with UUIDs) to local database (without UUIDs)
 *
 * Source: backups/remote-export-20251122-154410/*.json
 * Target: Local D1 database
 *
 * This script:
 * 1. Reads exported JSON data files
 * 2. Inserts data into local database
 * 3. Skips UUID columns
 * 4. Preserves all INTEGER IDs and relationships
 * 5. Is idempotent (can be run multiple times safely)
 */

import fs from 'fs'
import path from 'path'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { sql } from 'drizzle-orm'

const BACKUP_DIR = 'backups/remote-export-20251122-154410'

interface RemoteUser {
  id: number
  uuid: string // Will be skipped
  role: string
  updated_at: string
  created_at: string
  email: string
  reset_password_token: string | null
  reset_password_expiration: string | null
  salt: string
  hash: string
  login_attempts: number
  lock_until: string | null
}

interface RemoteComic {
  id: number
  uuid: string // Will be skipped
  title: string
  slug: string
  description: string | null
  author_id: number
  cover_image_id: number | null
  status: string
  publish_schedule: string
  is_n_s_f_w: number
  stats_total_pages: number
  stats_total_chapters: number
  stats_last_page_published: string | null
  updated_at: string
  created_at: string
}

interface RemoteChapter {
  id: number
  uuid: string // Will be skipped
  comic_id: number
  title: string
  order: number
  description: string | null
  updated_at: string
  created_at: string
}

interface RemotePage {
  id: number
  uuid: string // Will be skipped
  comic_id: number
  chapter_id: number | null
  chapter_page_number: number
  global_page_number: number
  title: string | null
  display_title: string | null
  page_image_id: number | null
  thumbnail_image_id: number | null
  alt_text: string | null
  author_notes: string | null
  status: string
  published_date: string | null
  navigation_previous_page_id: number | null
  navigation_next_page_id: number | null
  navigation_is_first_page: number
  navigation_is_last_page: number
  stats_view_count: number
  stats_first_viewed: string | null
  stats_last_viewed: string | null
  updated_at: string
  created_at: string
}

interface RemoteMedia {
  id: number
  uuid: string // Will be skipped
  alt: string | null
  updated_at: string
  created_at: string
  url: string | null
  thumbnail_u_r_l: string | null
  filename: string | null
  mime_type: string | null
  filesize: number | null
  width: number | null
  height: number | null
  focal_x: number | null
  focal_y: number | null
  prefix: string | null
  media_type: string | null
}

function readExportFile<T>(filename: string): T[] {
  const filePath = path.join(BACKUP_DIR, filename)
  console.log(`📖 Reading ${filename}...`)

  if (!fs.existsSync(filePath)) {
    throw new Error(`Export file not found: ${filePath}`)
  }

  const content = fs.readFileSync(filePath, 'utf-8')
  const parsed = JSON.parse(content)

  // Wrangler JSON format has results array
  if (Array.isArray(parsed) && parsed[0]?.results) {
    return parsed[0].results as T[]
  }

  throw new Error(`Unexpected JSON format in ${filename}`)
}

async function migrateUsers(drizzle: any) {
  console.log('\n👥 Migrating users...')
  const users = readExportFile<RemoteUser>('users.json')

  for (const user of users) {
    // Check if user already exists
    const existing = await drizzle.run(sql`SELECT id FROM users WHERE id = ${user.id}`)

    if (existing.results && existing.results.length > 0) {
      console.log(`  ⏭️  User ${user.id} (${user.email}) already exists, skipping`)
      continue
    }

    // Insert user (skip uuid column)
    await drizzle.run(sql`
      INSERT INTO users (
        id, role, updated_at, created_at, email,
        reset_password_token, reset_password_expiration,
        salt, hash, login_attempts, lock_until
      ) VALUES (
        ${user.id}, ${user.role}, ${user.updated_at}, ${user.created_at}, ${user.email},
        ${user.reset_password_token}, ${user.reset_password_expiration},
        ${user.salt}, ${user.hash}, ${user.login_attempts}, ${user.lock_until}
      )
    `)

    console.log(`  ✅ Migrated user ${user.id}: ${user.email}`)
  }

  console.log(`✅ Migrated ${users.length} users`)
}

async function migrateComics(db: any) {
  console.log('\n📚 Migrating comics...')
  const comics = readExportFile<RemoteComic>('comics.json')

  for (const comic of comics) {
    const existing = await db.run({
      sql: 'SELECT id FROM comics WHERE id = ?',
      args: [comic.id]
    })

    if (existing.results && existing.results.length > 0) {
      console.log(`  ⏭️  Comic ${comic.id} (${comic.title}) already exists, skipping`)
      continue
    }

    await db.run({
      sql: `
        INSERT INTO comics (
          id, title, slug, description, author_id, cover_image_id,
          status, publish_schedule, is_n_s_f_w,
          stats_total_pages, stats_total_chapters, stats_last_page_published,
          updated_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        comic.id,
        comic.title,
        comic.slug,
        comic.description,
        comic.author_id,
        comic.cover_image_id,
        comic.status,
        comic.publish_schedule,
        comic.is_n_s_f_w,
        comic.stats_total_pages,
        comic.stats_total_chapters,
        comic.stats_last_page_published,
        comic.updated_at,
        comic.created_at
      ]
    })

    console.log(`  ✅ Migrated comic ${comic.id}: ${comic.title}`)
  }

  console.log(`✅ Migrated ${comics.length} comics`)
}

async function migrateChapters(db: any) {
  console.log('\n📖 Migrating chapters...')
  const chapters = readExportFile<RemoteChapter>('chapters.json')

  for (const chapter of chapters) {
    const existing = await db.run({
      sql: 'SELECT id FROM chapters WHERE id = ?',
      args: [chapter.id]
    })

    if (existing.results && existing.results.length > 0) {
      console.log(`  ⏭️  Chapter ${chapter.id} already exists, skipping`)
      continue
    }

    await db.run({
      sql: `
        INSERT INTO chapters (
          id, comic_id, title, "order", description,
          updated_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        chapter.id,
        chapter.comic_id,
        chapter.title,
        chapter.order,
        chapter.description,
        chapter.updated_at,
        chapter.created_at
      ]
    })

    console.log(`  ✅ Migrated chapter ${chapter.id}: ${chapter.title}`)
  }

  console.log(`✅ Migrated ${chapters.length} chapters`)
}

async function migratePages(db: any) {
  console.log('\n📄 Migrating pages...')
  const pages = readExportFile<RemotePage>('pages.json')

  for (const page of pages) {
    const existing = await db.run({
      sql: 'SELECT id FROM pages WHERE id = ?',
      args: [page.id]
    })

    if (existing.results && existing.results.length > 0) {
      console.log(`  ⏭️  Page ${page.id} already exists, skipping`)
      continue
    }

    await db.run({
      sql: `
        INSERT INTO pages (
          id, comic_id, chapter_id, chapter_page_number, global_page_number,
          title, display_title, page_image_id, thumbnail_image_id,
          alt_text, author_notes, status, published_date,
          navigation_previous_page_id, navigation_next_page_id,
          navigation_is_first_page, navigation_is_last_page,
          stats_view_count, stats_first_viewed, stats_last_viewed,
          updated_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        page.id,
        page.comic_id,
        page.chapter_id,
        page.chapter_page_number,
        page.global_page_number,
        page.title,
        page.display_title,
        page.page_image_id,
        page.thumbnail_image_id,
        page.alt_text,
        page.author_notes,
        page.status,
        page.published_date,
        page.navigation_previous_page_id,
        page.navigation_next_page_id,
        page.navigation_is_first_page,
        page.navigation_is_last_page,
        page.stats_view_count,
        page.stats_first_viewed,
        page.stats_last_viewed,
        page.updated_at,
        page.created_at
      ]
    })

    console.log(`  ✅ Migrated page ${page.id}`)
  }

  console.log(`✅ Migrated ${pages.length} pages`)
}

async function migrateMedia(db: any) {
  console.log('\n🖼️  Migrating media...')
  const mediaItems = readExportFile<RemoteMedia>('media.json')

  for (const media of mediaItems) {
    const existing = await db.run({
      sql: 'SELECT id FROM media WHERE id = ?',
      args: [media.id]
    })

    if (existing.results && existing.results.length > 0) {
      console.log(`  ⏭️  Media ${media.id} already exists, skipping`)
      continue
    }

    await db.run({
      sql: `
        INSERT INTO media (
          id, alt, updated_at, created_at, url, thumbnail_u_r_l,
          filename, mime_type, filesize, width, height,
          focal_x, focal_y, prefix, media_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        media.id,
        media.alt,
        media.updated_at,
        media.created_at,
        media.url,
        media.thumbnail_u_r_l,
        media.filename,
        media.mime_type,
        media.filesize,
        media.width,
        media.height,
        media.focal_x,
        media.focal_y,
        media.prefix,
        media.media_type
      ]
    })

    console.log(`  ✅ Migrated media ${media.id}: ${media.filename}`)
  }

  console.log(`✅ Migrated ${mediaItems.length} media items`)
}

async function verifyMigration(db: any) {
  console.log('\n🔍 Verifying migration...')

  const counts = await db.run({
    sql: `
      SELECT 'users' as table_name, COUNT(*) as count FROM users
      UNION ALL SELECT 'comics', COUNT(*) FROM comics
      UNION ALL SELECT 'chapters', COUNT(*) FROM chapters
      UNION ALL SELECT 'pages', COUNT(*) FROM pages
      UNION ALL SELECT 'media', COUNT(*) FROM media
    `
  })

  console.log('\n📊 Record counts:')
  for (const row of counts.results) {
    console.log(`  ${row.table_name}: ${row.count}`)
  }

  // Verify no UUID columns exist
  const userSchema = await db.run({
    sql: 'PRAGMA table_info(users)'
  })

  const hasUuid = userSchema.results.some((col: any) => col.name === 'uuid')
  if (hasUuid) {
    throw new Error('❌ ERROR: UUID column still exists in users table!')
  }

  console.log('\n✅ Verification passed: No UUID columns found')

  // Expected counts
  const expected = {
    users: 2,
    comics: 1,
    chapters: 5,
    pages: 29,
    media: 42
  }

  console.log('\n📈 Expected vs Actual:')
  let allMatch = true
  for (const row of counts.results) {
    const tableName = row.table_name as keyof typeof expected
    const expectedCount = expected[tableName]
    const actualCount = row.count
    const match = expectedCount === actualCount ? '✅' : '❌'
    console.log(`  ${match} ${tableName}: expected ${expectedCount}, got ${actualCount}`)
    if (expectedCount !== actualCount) {
      allMatch = false
    }
  }

  if (!allMatch) {
    console.log('\n⚠️  Warning: Some counts do not match expected values')
  } else {
    console.log('\n✅ All counts match expected values!')
  }
}

async function main() {
  console.log('🚀 Starting data migration from remote to local...\n')
  console.log(`Source: ${BACKUP_DIR}`)
  console.log(`Target: Local D1 database\n`)

  // Get Payload instance to access database
  const payload = await getPayload({ config })
  const db = payload.db

  try {
    // Run migrations in order (respecting foreign key constraints)
    await migrateUsers(db)
    await migrateMedia(db)  // Media before comics (cover_image_id FK)
    await migrateComics(db)
    await migrateChapters(db)
    await migratePages(db)

    // Verify everything worked
    await verifyMigration(db)

    console.log('\n🎉 Migration completed successfully!')
    console.log('\nNext steps:')
    console.log('  1. Run: pnpm run dev')
    console.log('  2. Test login at: http://localhost:3000/admin')
    console.log('  3. Verify data in admin panel')

  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    throw error
  } finally {
    await payload.db.drizzle.$client.close()
  }
}

main()
