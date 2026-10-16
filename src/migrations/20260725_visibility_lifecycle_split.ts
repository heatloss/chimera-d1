import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

/**
 * Migration: separate visibility from timestamp (pages) and lifecycle (comics)
 *
 * Both collections previously encoded two independent concepts in one `status`
 * enum. This splits them apart.
 *
 * PAGES: status(draft|scheduled|published) → visibility(private|public)
 *   The reader-facing state becomes derived, not stored:
 *     private + any date           → Draft
 *     public  + past date          → Live
 *     public  + future date        → Queued  (was inexpressible before)
 *   'scheduled' was vestigial — declared in the schema and validated against,
 *   but never written by any code path. It maps to 'public' defensively.
 *
 * COMICS: status(draft|live|hiatus|completed)
 *          → visibility(private|public) + lifecycle(ongoing|hiatus|completed)
 *   Lossy in exactly one cell: 'draft' carried no lifecycle information, so
 *   hidden comics land on the 'ongoing' default. Acceptable — a draft comic is
 *   by definition unrevealed.
 *
 * Both directions are reversible. down() reconstructs the old enums, collapsing
 * private comics back to 'draft' (which is what they were).
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  console.log('🔧 Splitting visibility from timestamp/lifecycle')

  // ---------------------------------------------------------------------------
  // Pre-flight: report what we are about to convert.
  // Local dev and production D1 are not synchronized, so this logs the actual
  // distribution rather than assuming it matches what was tested.
  // ---------------------------------------------------------------------------
  const pagesAudit = await db.all(
    sql`SELECT status, COUNT(*) AS n, SUM(published_date IS NULL) AS null_dates
        FROM \`pages\` GROUP BY status;`,
  )
  console.log('   pages.status distribution:', JSON.stringify(pagesAudit))

  const comicsAudit = await db.all(
    sql`SELECT status, COUNT(*) AS n FROM \`comics\` GROUP BY status;`,
  )
  console.log('   comics.status distribution:', JSON.stringify(comicsAudit))

  // ---------------------------------------------------------------------------
  // Pages
  // ---------------------------------------------------------------------------
  await db.run(
    sql`ALTER TABLE \`pages\` ADD COLUMN \`visibility\` text DEFAULT 'private' NOT NULL;`,
  )

  await db.run(sql`
    UPDATE \`pages\` SET \`visibility\` = CASE
      WHEN \`status\` IN ('published', 'scheduled') THEN 'public'
      ELSE 'private'
    END;
  `)

  // Backfill guard: a public page must always have a go-live date, since the
  // collection hook stamps one on save. Any legacy row that is public with a
  // NULL date gets its creation date rather than now() — backdating to creation
  // preserves archive order instead of dumping old pages into today.
  // Expected to be a no-op: in the data observed, NULL dates correlate exactly
  // with drafts. Kept because production is not synchronized with local dev.
  const orphans = await db.all(sql`
    SELECT COUNT(*) AS n FROM \`pages\`
    WHERE \`visibility\` = 'public' AND \`published_date\` IS NULL;
  `)
  console.log('   public pages missing a go-live date (backfilling):', JSON.stringify(orphans))

  await db.run(sql`
    UPDATE \`pages\`
    SET \`published_date\` = \`created_at\`
    WHERE \`visibility\` = 'public' AND \`published_date\` IS NULL;
  `)

  await db.run(sql`ALTER TABLE \`pages\` DROP COLUMN \`status\`;`)
  console.log('✅ pages.status → pages.visibility')

  // ---------------------------------------------------------------------------
  // Comics
  // ---------------------------------------------------------------------------
  await db.run(
    sql`ALTER TABLE \`comics\` ADD COLUMN \`visibility\` text DEFAULT 'private' NOT NULL;`,
  )
  await db.run(
    sql`ALTER TABLE \`comics\` ADD COLUMN \`lifecycle\` text DEFAULT 'ongoing' NOT NULL;`,
  )

  await db.run(sql`
    UPDATE \`comics\` SET
      \`visibility\` = CASE WHEN \`status\` = 'draft' THEN 'private' ELSE 'public' END,
      \`lifecycle\`  = CASE
        WHEN \`status\` = 'hiatus'    THEN 'hiatus'
        WHEN \`status\` = 'completed' THEN 'completed'
        ELSE 'ongoing'
      END;
  `)

  await db.run(sql`ALTER TABLE \`comics\` DROP COLUMN \`status\`;`)
  console.log('✅ comics.status → comics.visibility + comics.lifecycle')
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  console.log('🔧 Recombining visibility into status')

  // ---------------------------------------------------------------------------
  // Pages
  // ---------------------------------------------------------------------------
  await db.run(sql`ALTER TABLE \`pages\` ADD COLUMN \`status\` text DEFAULT 'draft' NOT NULL;`)

  // Queued pages (public + future date) have no faithful representation in the
  // old model. 'scheduled' is the closest — it is what the old schema intended
  // for them, even though nothing ever wrote it.
  await db.run(sql`
    UPDATE \`pages\` SET \`status\` = CASE
      WHEN \`visibility\` = 'public' AND \`published_date\` > CURRENT_TIMESTAMP THEN 'scheduled'
      WHEN \`visibility\` = 'public' THEN 'published'
      ELSE 'draft'
    END;
  `)

  await db.run(sql`ALTER TABLE \`pages\` DROP COLUMN \`visibility\`;`)
  console.log('✅ pages.visibility → pages.status')

  // ---------------------------------------------------------------------------
  // Comics
  // ---------------------------------------------------------------------------
  await db.run(sql`ALTER TABLE \`comics\` ADD COLUMN \`status\` text DEFAULT 'draft' NOT NULL;`)

  // Private comics collapse to 'draft', discarding lifecycle — this is exactly
  // the information loss the split was made to fix, so it is expected here.
  await db.run(sql`
    UPDATE \`comics\` SET \`status\` = CASE
      WHEN \`visibility\` = 'private' THEN 'draft'
      WHEN \`lifecycle\` = 'hiatus' THEN 'hiatus'
      WHEN \`lifecycle\` = 'completed' THEN 'completed'
      ELSE 'live'
    END;
  `)

  await db.run(sql`ALTER TABLE \`comics\` DROP COLUMN \`visibility\`;`)
  await db.run(sql`ALTER TABLE \`comics\` DROP COLUMN \`lifecycle\`;`)
  console.log('✅ comics.visibility + comics.lifecycle → comics.status')
}
