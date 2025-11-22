import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`DROP INDEX \`users_uuid_idx\`;`)
  await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`uuid\`;`)
  await db.run(sql`DROP INDEX \`comics_uuid_idx\`;`)
  await db.run(sql`ALTER TABLE \`comics\` DROP COLUMN \`uuid\`;`)
  await db.run(sql`DROP INDEX \`chapters_uuid_idx\`;`)
  await db.run(sql`ALTER TABLE \`chapters\` DROP COLUMN \`uuid\`;`)
  await db.run(sql`DROP INDEX \`pages_uuid_idx\`;`)
  await db.run(sql`ALTER TABLE \`pages\` DROP COLUMN \`uuid\`;`)
  await db.run(sql`DROP INDEX \`media_uuid_idx\`;`)
  await db.run(sql`ALTER TABLE \`media\` DROP COLUMN \`uuid\`;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`users\` ADD \`uuid\` text NOT NULL;`)
  await db.run(sql`CREATE UNIQUE INDEX \`users_uuid_idx\` ON \`users\` (\`uuid\`);`)
  await db.run(sql`ALTER TABLE \`comics\` ADD \`uuid\` text NOT NULL;`)
  await db.run(sql`CREATE UNIQUE INDEX \`comics_uuid_idx\` ON \`comics\` (\`uuid\`);`)
  await db.run(sql`ALTER TABLE \`chapters\` ADD \`uuid\` text NOT NULL;`)
  await db.run(sql`CREATE UNIQUE INDEX \`chapters_uuid_idx\` ON \`chapters\` (\`uuid\`);`)
  await db.run(sql`ALTER TABLE \`pages\` ADD \`uuid\` text NOT NULL;`)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_uuid_idx\` ON \`pages\` (\`uuid\`);`)
  await db.run(sql`ALTER TABLE \`media\` ADD \`uuid\` text NOT NULL;`)
  await db.run(sql`CREATE UNIQUE INDEX \`media_uuid_idx\` ON \`media\` (\`uuid\`);`)
}
