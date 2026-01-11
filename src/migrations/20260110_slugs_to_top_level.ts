import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

/**
 * Migration: Move slugs from seoMeta to top-level fields
 *
 * This migration:
 * 1. Adds `slug` column to `chapters` table
 * 2. Adds `slug` column to `pages` table
 * 3. Copies data from `seo_meta_slug` to new `slug` columns
 * 4. Generates slugs for any rows that don't have one
 * 5. Creates indexes for efficient lookups
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  console.log('🚀 Starting slug migration: moving slugs to top-level fields')

  // 1. Add slug column to chapters table
  console.log('📝 Adding slug column to chapters table...')
  await db.run(sql`ALTER TABLE \`chapters\` ADD COLUMN \`slug\` text;`)

  // 2. Copy existing seo_meta_slug values to new slug column for chapters
  console.log('📋 Copying existing chapter slugs...')
  await db.run(sql`
    UPDATE \`chapters\`
    SET \`slug\` = \`seo_meta_slug\`
    WHERE \`seo_meta_slug\` IS NOT NULL AND \`seo_meta_slug\` != '';
  `)

  // 3. Generate slugs for chapters that don't have one (from title)
  console.log('🔧 Generating slugs for chapters without one...')
  const chaptersWithoutSlug = await db.all(sql`
    SELECT id, title, comic_id FROM \`chapters\` WHERE \`slug\` IS NULL OR \`slug\` = '';
  `)

  for (const chapter of chaptersWithoutSlug.rows || []) {
    const baseSlug = generateSlug(chapter.title as string)
    const uniqueSlug = await ensureUniqueSlug(db, 'chapters', 'comic_id', chapter.comic_id as number, baseSlug, chapter.id as number)
    await db.run(sql`UPDATE \`chapters\` SET \`slug\` = ${uniqueSlug} WHERE \`id\` = ${chapter.id};`)
  }

  // 4. Add index for chapter slug lookups (composite with comic_id for uniqueness checks)
  console.log('📇 Creating chapter slug index...')
  await db.run(sql`CREATE INDEX \`chapters_slug_idx\` ON \`chapters\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`chapters_comic_slug_idx\` ON \`chapters\` (\`comic_id\`, \`slug\`);`)

  // 5. Add slug column to pages table
  console.log('📝 Adding slug column to pages table...')
  await db.run(sql`ALTER TABLE \`pages\` ADD COLUMN \`slug\` text;`)

  // 6. Copy existing seo_meta_slug values to new slug column for pages
  console.log('📋 Copying existing page slugs...')
  await db.run(sql`
    UPDATE \`pages\`
    SET \`slug\` = \`seo_meta_slug\`
    WHERE \`seo_meta_slug\` IS NOT NULL AND \`seo_meta_slug\` != '';
  `)

  // 7. Generate/fix slugs for pages that need them
  // This includes: NULL slugs, empty slugs, and integer-only slugs (poor URLs from bulk uploads)
  console.log('🔧 Generating slugs for pages that need them...')
  const allPages = await db.all(sql`
    SELECT p.id, p.title, p.slug, p.comic_id, p.chapter_id, p.chapter_page_number, c.slug as chapter_slug
    FROM \`pages\` p
    LEFT JOIN \`chapters\` c ON p.chapter_id = c.id;
  `)

  // Filter to pages that need new slugs (null, empty, or integer-only)
  const pagesNeedingSlugs = (allPages.rows || []).filter((page: any) => {
    if (!page.slug || page.slug === '') return true
    // Check if slug is integer-only (e.g., "2", "123")
    if (/^\d+$/.test(page.slug)) return true
    return false
  })

  console.log(`📄 Found ${pagesNeedingSlugs.length} pages needing slug generation/fix`)

  for (const page of pagesNeedingSlugs) {
    let baseSlug: string
    const title = page.title as string | null
    const isIntegerOnly = title && /^\d+$/.test(title.trim())

    if (title && title.trim() && !isIntegerOnly) {
      // Title exists and is not just a number - use it
      baseSlug = generateSlug(title)
    } else if (page.chapter_slug && page.chapter_page_number) {
      // Has chapter - use chapter-slug-page-N format
      baseSlug = `${page.chapter_slug}-page-${page.chapter_page_number}`
    } else if (page.chapter_page_number) {
      // No chapter but has page number
      baseSlug = `page-${page.chapter_page_number}`
    } else {
      // Fallback to ID
      baseSlug = `page-${page.id}`
    }

    const uniqueSlug = await ensureUniqueSlug(db, 'pages', 'comic_id', page.comic_id as number, baseSlug, page.id as number)
    await db.run(sql`UPDATE \`pages\` SET \`slug\` = ${uniqueSlug} WHERE \`id\` = ${page.id};`)
  }

  // 8. Add index for page slug lookups (composite with comic_id for uniqueness checks)
  console.log('📇 Creating page slug index...')
  await db.run(sql`CREATE INDEX \`pages_slug_idx\` ON \`pages\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`pages_comic_slug_idx\` ON \`pages\` (\`comic_id\`, \`slug\`);`)

  console.log('✅ Slug migration complete!')
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  console.log('🔄 Rolling back slug migration...')

  // Drop indexes
  await db.run(sql`DROP INDEX IF EXISTS \`chapters_slug_idx\`;`)
  await db.run(sql`DROP INDEX IF EXISTS \`chapters_comic_slug_idx\`;`)
  await db.run(sql`DROP INDEX IF EXISTS \`pages_slug_idx\`;`)
  await db.run(sql`DROP INDEX IF EXISTS \`pages_comic_slug_idx\`;`)

  // Note: SQLite doesn't support DROP COLUMN in older versions
  // For D1/modern SQLite, we can drop the columns
  // But to be safe, we'll leave the columns and just remove the indexes
  // The columns will be ignored by the old schema

  console.log('⚠️  Note: slug columns left in place for safety. Old seo_meta_slug columns still contain the data.')
  console.log('✅ Rollback complete!')
}

// Helper function to generate a URL-safe slug from a string
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

// Helper function to ensure a slug is unique within its parent scope
async function ensureUniqueSlug(
  db: any,
  table: string,
  parentColumn: string,
  parentId: number,
  baseSlug: string,
  currentId: number
): Promise<string> {
  let slug = baseSlug
  let counter = 2

  // Check if slug exists for this parent (excluding current record)
  while (true) {
    const existing = await db.all(
      sql`SELECT id FROM ${sql.raw(`\`${table}\``)}
          WHERE ${sql.raw(`\`${parentColumn}\``)} = ${parentId}
          AND \`slug\` = ${slug}
          AND \`id\` != ${currentId};`
    )

    if (!existing.rows || existing.rows.length === 0) {
      break
    }

    slug = `${baseSlug}-${counter}`
    counter++
  }

  return slug
}
