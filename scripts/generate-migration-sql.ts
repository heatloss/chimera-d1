#!/usr/bin/env tsx
/**
 * Generate SQL INSERT statements from exported JSON files
 * Output can be executed directly with wrangler d1 execute
 */

import fs from 'fs'
import path from 'path'

const BACKUP_DIR = 'backups/remote-export-20251122-154410'
const OUTPUT_FILE = 'backups/remote-export-20251122-154410/migration.sql'

function readExportFile<T>(filename: string): T[] {
  const filePath = path.join(BACKUP_DIR, filename)
  const content = fs.readFileSync(filePath, 'utf-8')
  const parsed = JSON.parse(content)

  if (Array.isArray(parsed) && parsed[0]?.results) {
    return parsed[0].results as T[]
  }

  throw new Error(`Unexpected JSON format in ${filename}`)
}

function escapeSQL(value: any): string {
  if (value === null || value === undefined) {
    return 'NULL'
  }
  if (typeof value === 'number') {
    return value.toString()
  }
  // Escape single quotes for SQL strings
  return `'${value.toString().replace(/'/g, "''")}'`
}

console.log('🔄 Generating SQL migration script...\n')

let sql = `-- Data Migration SQL
-- Generated from remote database export
-- Skips UUID columns

`

// Users
const users = readExportFile<any>('users.json')
sql += `-- Users (${users.length} records)\n`
for (const user of users) {
  sql += `INSERT OR IGNORE INTO users (id, role, updated_at, created_at, email, reset_password_token, reset_password_expiration, salt, hash, login_attempts, lock_until) VALUES (${user.id}, ${escapeSQL(user.role)}, ${escapeSQL(user.updated_at)}, ${escapeSQL(user.created_at)}, ${escapeSQL(user.email)}, ${escapeSQL(user.reset_password_token)}, ${escapeSQL(user.reset_password_expiration)}, ${escapeSQL(user.salt)}, ${escapeSQL(user.hash)}, ${user.login_attempts}, ${escapeSQL(user.lock_until)});\n`
}
sql += '\n'

// Media
const media = readExportFile<any>('media.json')
sql += `-- Media (${media.length} records)\n`
for (const m of media) {
  sql += `INSERT OR IGNORE INTO media (id, alt, caption, image_sizes, media_type, uploaded_by_id, is_public, comic_meta_related_comic_id, comic_meta_is_n_s_f_w, updated_at, created_at, url, thumbnail_u_r_l, filename, mime_type, filesize, width, height) VALUES (${m.id}, ${escapeSQL(m.alt)}, ${escapeSQL(m.caption)}, ${escapeSQL(m.image_sizes)}, ${escapeSQL(m.media_type)}, ${escapeSQL(m.uploaded_by_id)}, ${escapeSQL(m.is_public)}, ${escapeSQL(m.comic_meta_related_comic_id)}, ${escapeSQL(m.comic_meta_is_n_s_f_w)}, ${escapeSQL(m.updated_at)}, ${escapeSQL(m.created_at)}, ${escapeSQL(m.url)}, ${escapeSQL(m.thumbnail_u_r_l)}, ${escapeSQL(m.filename)}, ${escapeSQL(m.mime_type)}, ${escapeSQL(m.filesize)}, ${escapeSQL(m.width)}, ${escapeSQL(m.height)});\n`
}
sql += '\n'

// Comics
const comics = readExportFile<any>('comics.json')
sql += `-- Comics (${comics.length} records)\n`
for (const comic of comics) {
  sql += `INSERT OR IGNORE INTO comics (id, title, slug, description, author_id, cover_image_id, status, publish_schedule, is_n_s_f_w, stats_total_pages, stats_total_chapters, stats_last_page_published, updated_at, created_at) VALUES (${comic.id}, ${escapeSQL(comic.title)}, ${escapeSQL(comic.slug)}, ${escapeSQL(comic.description)}, ${comic.author_id}, ${escapeSQL(comic.cover_image_id)}, ${escapeSQL(comic.status)}, ${escapeSQL(comic.publish_schedule)}, ${comic.is_n_s_f_w}, ${comic.stats_total_pages}, ${comic.stats_total_chapters}, ${escapeSQL(comic.stats_last_page_published)}, ${escapeSQL(comic.updated_at)}, ${escapeSQL(comic.created_at)});\n`
}
sql += '\n'

// Chapters
const chapters = readExportFile<any>('chapters.json')
sql += `-- Chapters (${chapters.length} records)\n`
for (const chapter of chapters) {
  sql += `INSERT OR IGNORE INTO chapters (id, comic_id, title, "order", description, updated_at, created_at) VALUES (${chapter.id}, ${chapter.comic_id}, ${escapeSQL(chapter.title)}, ${chapter.order}, ${escapeSQL(chapter.description)}, ${escapeSQL(chapter.updated_at)}, ${escapeSQL(chapter.created_at)});\n`
}
sql += '\n'

// Pages
const pages = readExportFile<any>('pages.json')
sql += `-- Pages (${pages.length} records)\n`
for (const page of pages) {
  sql += `INSERT OR IGNORE INTO pages (id, comic_id, chapter_id, chapter_page_number, global_page_number, title, display_title, page_image_id, thumbnail_image_id, alt_text, author_notes, status, published_date, navigation_previous_page_id, navigation_next_page_id, navigation_is_first_page, navigation_is_last_page, stats_view_count, stats_first_viewed, stats_last_viewed, updated_at, created_at) VALUES (${page.id}, ${page.comic_id}, ${escapeSQL(page.chapter_id)}, ${page.chapter_page_number}, ${page.global_page_number}, ${escapeSQL(page.title)}, ${escapeSQL(page.display_title)}, ${escapeSQL(page.page_image_id)}, ${escapeSQL(page.thumbnail_image_id)}, ${escapeSQL(page.alt_text)}, ${escapeSQL(page.author_notes)}, ${escapeSQL(page.status)}, ${escapeSQL(page.published_date)}, ${escapeSQL(page.navigation_previous_page_id)}, ${escapeSQL(page.navigation_next_page_id)}, ${page.navigation_is_first_page}, ${page.navigation_is_last_page}, ${page.stats_view_count}, ${escapeSQL(page.stats_first_viewed)}, ${escapeSQL(page.stats_last_viewed)}, ${escapeSQL(page.updated_at)}, ${escapeSQL(page.created_at)});\n`
}

// Write to file
fs.writeFileSync(OUTPUT_FILE, sql)

console.log(`✅ Generated SQL migration script: ${OUTPUT_FILE}`)
console.log(`\nTo execute:`)
console.log(`  pnpm wrangler d1 execute chimera-d1 --local --file=${OUTPUT_FILE}`)
