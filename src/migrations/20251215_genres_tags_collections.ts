import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

// Initial genres to seed (from the previously hardcoded list)
const INITIAL_GENRES = [
  { name: 'Action-Adventure', slug: 'action-adventure' },
  { name: 'Alternate History', slug: 'alternate-history' },
  { name: 'Comedy', slug: 'comedy' },
  { name: 'Cyberpunk', slug: 'cyberpunk' },
  { name: 'Drama', slug: 'drama' },
  { name: 'Dystopian', slug: 'dystopian' },
  { name: 'Educational', slug: 'educational' },
  { name: 'Erotica', slug: 'erotica' },
  { name: 'Fairytale', slug: 'fairytale' },
  { name: 'Fan Comic', slug: 'fan-comic' },
  { name: 'Fantasy', slug: 'fantasy' },
  { name: 'Historical', slug: 'historical' },
  { name: 'Horror', slug: 'horror' },
  { name: 'Magical Girl', slug: 'magical-girl' },
  { name: 'Mystery', slug: 'mystery' },
  { name: 'Nonfiction', slug: 'nonfiction' },
  { name: 'Parody', slug: 'parody' },
  { name: 'Post-Apocalyptic', slug: 'post-apocalyptic' },
  { name: 'Romance', slug: 'romance' },
  { name: 'Satire', slug: 'satire' },
  { name: 'Sci-Fi', slug: 'sci-fi' },
  { name: 'Slice of Life', slug: 'slice-of-life' },
  { name: 'Sports', slug: 'sports' },
  { name: 'Steampunk', slug: 'steampunk' },
  { name: 'Superhero', slug: 'superhero' },
  { name: 'Urban Fantasy', slug: 'urban-fantasy' },
  { name: 'Western', slug: 'western' },
]

// Initial tags to seed (from the "General" category in the tag taxonomy)
const INITIAL_TAGS = [
  { name: 'Aliens', slug: 'aliens' },
  { name: 'All-Ages', slug: 'all-ages' },
  { name: 'Angels', slug: 'angels' },
  { name: 'Cats', slug: 'cats' },
  { name: 'Contemporary', slug: 'contemporary' },
  { name: 'Crime', slug: 'crime' },
  { name: 'Cryptids', slug: 'cryptids' },
  { name: 'Dark Humor', slug: 'dark-humor' },
  { name: 'Demons', slug: 'demons' },
  { name: 'Detective', slug: 'detective' },
  { name: 'Dogs', slug: 'dogs' },
  { name: 'Dragons', slug: 'dragons' },
  { name: 'Faeries', slug: 'faeries' },
  { name: 'Food', slug: 'food' },
  { name: 'Found Family', slug: 'found-family' },
  { name: 'Furries', slug: 'furries' },
  { name: 'Gaming', slug: 'gaming' },
  { name: 'Ghosts', slug: 'ghosts' },
  { name: 'Gore', slug: 'gore' },
  { name: 'LGBT', slug: 'lgbt' },
  { name: 'Mature Audiences', slug: 'mature-audiences' },
  { name: 'Mecha', slug: 'mecha' },
  { name: 'Mermaids/Mermen', slug: 'mermaids-mermen' },
  { name: 'Music', slug: 'music' },
  { name: 'Mythological', slug: 'mythological' },
  { name: 'NSFW', slug: 'nsfw' },
  { name: 'Nudity', slug: 'nudity' },
  { name: 'Pirates', slug: 'pirates' },
  { name: 'Robots', slug: 'robots' },
  { name: 'Sexual Themes', slug: 'sexual-themes' },
  { name: 'Space', slug: 'space' },
  { name: 'Supernatural', slug: 'supernatural' },
  { name: 'Superpowers', slug: 'superpowers' },
  { name: 'Time Travel', slug: 'time-travel' },
  { name: 'TTRPG', slug: 'ttrpg' },
  { name: 'Vampires', slug: 'vampires' },
  { name: 'Violence', slug: 'violence' },
  { name: 'Werewolves', slug: 'werewolves' },
  { name: 'Witches', slug: 'witches' },
  { name: 'Workplace', slug: 'workplace' },
]

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // 1. Create genres table
  await db.run(sql`CREATE TABLE \`genres\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`name\` text NOT NULL,
    \`slug\` text NOT NULL,
    \`description\` text,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );`)
  await db.run(sql`CREATE UNIQUE INDEX \`genres_slug_idx\` ON \`genres\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`genres_updated_at_idx\` ON \`genres\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`genres_created_at_idx\` ON \`genres\` (\`created_at\`);`)

  // 2. Create tags table
  await db.run(sql`CREATE TABLE \`tags\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`name\` text NOT NULL,
    \`slug\` text NOT NULL,
    \`description\` text,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );`)
  await db.run(sql`CREATE UNIQUE INDEX \`tags_slug_idx\` ON \`tags\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`tags_updated_at_idx\` ON \`tags\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`tags_created_at_idx\` ON \`tags\` (\`created_at\`);`)

  // 3. Create comics_rels table for hasMany relationships
  await db.run(sql`CREATE TABLE \`comics_rels\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`order\` integer,
    \`parent_id\` integer NOT NULL,
    \`path\` text NOT NULL,
    \`genres_id\` integer,
    \`tags_id\` integer,
    FOREIGN KEY (\`parent_id\`) REFERENCES \`comics\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`genres_id\`) REFERENCES \`genres\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`tags_id\`) REFERENCES \`tags\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX \`comics_rels_order_idx\` ON \`comics_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`comics_rels_parent_idx\` ON \`comics_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`comics_rels_path_idx\` ON \`comics_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`comics_rels_genres_id_idx\` ON \`comics_rels\` (\`genres_id\`);`)
  await db.run(sql`CREATE INDEX \`comics_rels_tags_id_idx\` ON \`comics_rels\` (\`tags_id\`);`)

  // 4. Add genres and tags columns to payload_locked_documents_rels
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`genres_id\` integer REFERENCES \`genres\`(\`id\`) ON DELETE cascade;`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`tags_id\` integer REFERENCES \`tags\`(\`id\`) ON DELETE cascade;`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_genres_id_idx\` ON \`payload_locked_documents_rels\` (\`genres_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_tags_id_idx\` ON \`payload_locked_documents_rels\` (\`tags_id\`);`)

  // 5. Seed initial genres
  for (const genre of INITIAL_GENRES) {
    await db.run(sql`INSERT INTO \`genres\` (\`name\`, \`slug\`) VALUES (${genre.name}, ${genre.slug});`)
  }

  // 6. Seed initial tags
  for (const tag of INITIAL_TAGS) {
    await db.run(sql`INSERT INTO \`tags\` (\`name\`, \`slug\`) VALUES (${tag.name}, ${tag.slug});`)
  }

  // 7. Migrate existing genre assignments from comics_genres to comics_rels
  // The old table stored genre slugs as 'value', we need to map them to genre IDs
  // Note: 'order' is a SQL reserved word, using double quotes for SQLite compatibility
  await db.run(sql`
    INSERT INTO comics_rels ("order", parent_id, path, genres_id)
    SELECT
      cg."order",
      cg.parent_id,
      'genres',
      g.id
    FROM comics_genres cg
    INNER JOIN genres g ON g.slug = cg.value
  ;`)

  // 8. Migrate existing tags from comics_texts to tags table and comics_rels
  // First, create any additional tags from unique values in comics_texts where path='tags.%.tag'
  // (these may be custom tags not in INITIAL_TAGS)
  await db.run(sql`
    INSERT OR IGNORE INTO \`tags\` (\`name\`, \`slug\`)
    SELECT DISTINCT
      \`text\`,
      LOWER(REPLACE(REPLACE(REPLACE(\`text\`, ' ', '-'), '''', ''), '"', ''))
    FROM \`comics_texts\`
    WHERE \`path\` LIKE 'tags.%.tag'
    AND \`text\` IS NOT NULL
    AND \`text\` != ''
  ;`)

  // Then create the relationships
  await db.run(sql`
    INSERT INTO comics_rels ("order", parent_id, path, tags_id)
    SELECT
      ct."order",
      ct.parent_id,
      'tags',
      t.id
    FROM comics_texts ct
    INNER JOIN tags t ON t.name = ct.text
    WHERE ct.path LIKE 'tags.%.tag'
    AND ct.text IS NOT NULL
    AND ct.text != ''
  ;`)

  // 9. Clean up old tables
  await db.run(sql`DROP TABLE IF EXISTS \`comics_genres\`;`)
  // Remove tag entries from comics_texts
  await db.run(sql`DELETE FROM \`comics_texts\` WHERE \`path\` LIKE 'tags.%.tag';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Recreate comics_genres table
  await db.run(sql`CREATE TABLE \`comics_genres\` (
    \`order\` integer NOT NULL,
    \`parent_id\` integer NOT NULL,
    \`value\` text,
    \`id\` integer PRIMARY KEY NOT NULL,
    FOREIGN KEY (\`parent_id\`) REFERENCES \`comics\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX \`comics_genres_order_idx\` ON \`comics_genres\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`comics_genres_parent_idx\` ON \`comics_genres\` (\`parent_id\`);`)

  // Migrate data back from comics_rels to comics_genres
  await db.run(sql`
    INSERT INTO comics_genres ("order", parent_id, value)
    SELECT
      cr."order",
      cr.parent_id,
      g.slug
    FROM comics_rels cr
    INNER JOIN genres g ON g.id = cr.genres_id
    WHERE cr.path = 'genres'
  ;`)

  // Migrate tags back to comics_texts
  await db.run(sql`
    INSERT INTO comics_texts ("order", parent_id, path, text)
    SELECT
      cr."order",
      cr.parent_id,
      'tags.' || cr."order" || '.tag',
      t.name
    FROM comics_rels cr
    INNER JOIN tags t ON t.id = cr.tags_id
    WHERE cr.path = 'tags'
  ;`)

  // Drop indexes on payload_locked_documents_rels
  await db.run(sql`DROP INDEX IF EXISTS \`payload_locked_documents_rels_genres_id_idx\`;`)
  await db.run(sql`DROP INDEX IF EXISTS \`payload_locked_documents_rels_tags_id_idx\`;`)

  // Note: SQLite doesn't support DROP COLUMN easily, so we leave the columns
  // They won't cause issues as orphaned columns

  // Drop new tables
  await db.run(sql`DROP TABLE IF EXISTS \`comics_rels\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`tags\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`genres\`;`)
}
