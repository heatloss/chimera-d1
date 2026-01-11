import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

/**
 * Migration: Fix integer-only page slugs
 *
 * The previous migration's integer detection didn't work correctly.
 * This migration fixes pages with integer-only slugs by generating
 * better slugs in the format: {chapter-slug}-page-{N}
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  console.log('🔧 Starting integer-only slug fix migration')

  // Fetch ALL pages - Drizzle's sql tagged template doesn't handle GLOB patterns well
  // We'll filter in JavaScript instead
  const allPagesResult = await db.all(sql`
    SELECT p.id, p.slug, p.title, p.comic_id, p.chapter_id, p.chapter_page_number, c.slug as chapter_slug
    FROM \`pages\` p
    LEFT JOIN \`chapters\` c ON p.chapter_id = c.id
    ORDER BY p.comic_id, p.chapter_id, p.chapter_page_number;
  `)

  const allPages = allPagesResult.rows || []
  console.log(`📊 Total pages in database: ${allPages.length}`)

  // Filter to find pages with integer-only slugs using JavaScript regex
  const pages = allPages.filter((page: any) => {
    const slug = page.slug as string | null
    if (!slug) return false
    // Check if slug is purely numeric (integer-only)
    return /^\d+$/.test(slug)
  })

  console.log(`📄 Found ${pages.length} pages with integer-only slugs`)

  if (pages.length === 0) {
    console.log('✅ No integer-only slugs to fix')
    return
  }

  let fixedCount = 0
  let errorCount = 0

  for (const page of pages) {
    try {
      const pageId = page.id as number
      const chapterSlug = page.chapter_slug as string | null
      const chapterPageNumber = page.chapter_page_number as number
      const comicId = page.comic_id as number
      const oldSlug = page.slug as string

      // Generate new slug based on chapter
      let newBaseSlug: string
      if (chapterSlug && chapterPageNumber) {
        newBaseSlug = `${chapterSlug}-page-${chapterPageNumber}`
      } else if (chapterPageNumber) {
        newBaseSlug = `page-${chapterPageNumber}`
      } else {
        newBaseSlug = `page-${pageId}`
      }

      // Ensure uniqueness within the comic
      const uniqueSlug = await ensureUniqueSlug(db, comicId, newBaseSlug, pageId)

      // Update the page
      await db.run(sql`UPDATE \`pages\` SET \`slug\` = ${uniqueSlug} WHERE \`id\` = ${pageId};`)

      console.log(`  ✓ Page ${pageId}: "${oldSlug}" → "${uniqueSlug}"`)
      fixedCount++
    } catch (error: any) {
      console.error(`  ✗ Page ${page.id}: ${error.message}`)
      errorCount++
    }
  }

  console.log(`✅ Fixed ${fixedCount} page slugs (${errorCount} errors)`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // This migration is a data fix - rollback would require storing original values
  // which we didn't do. Log a warning instead.
  console.log('⚠️  This migration cannot be automatically rolled back.')
  console.log('    Original integer slugs were: 0, 1, 2, 3, etc.')
  console.log('    Manual intervention required if rollback is needed.')
}

// Helper function to ensure a slug is unique within its comic
async function ensureUniqueSlug(
  db: any,
  comicId: number,
  baseSlug: string,
  currentId: number
): Promise<string> {
  let slug = baseSlug
  let counter = 2

  while (true) {
    const existing = await db.all(
      sql`SELECT id FROM \`pages\`
          WHERE \`comic_id\` = ${comicId}
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
