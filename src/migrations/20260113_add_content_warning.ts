import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

/**
 * Migration: Add content warning field to pages
 *
 * Adds a nullable text column for content warnings.
 * When populated, frontend displays a warning overlay before revealing page content.
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  console.log('🔧 Adding content_warning column to pages table')

  await db.run(sql`ALTER TABLE \`pages\` ADD COLUMN \`content_warning\` text;`)

  console.log('✅ content_warning column added')
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  console.log('🔧 Removing content_warning column from pages table')

  // SQLite doesn't support DROP COLUMN directly, but D1 does
  await db.run(sql`ALTER TABLE \`pages\` DROP COLUMN \`content_warning\`;`)

  console.log('✅ content_warning column removed')
}
