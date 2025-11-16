import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`users_sessions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`created_at\` text,
  	\`expires_at\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`users_sessions_order_idx\` ON \`users_sessions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`users_sessions_parent_id_idx\` ON \`users_sessions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`users\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`uuid\` text NOT NULL,
  	\`role\` text DEFAULT 'creator' NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`email\` text NOT NULL,
  	\`reset_password_token\` text,
  	\`reset_password_expiration\` text,
  	\`salt\` text,
  	\`hash\` text,
  	\`login_attempts\` numeric DEFAULT 0,
  	\`lock_until\` text
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`users_uuid_idx\` ON \`users\` (\`uuid\`);`)
  await db.run(sql`CREATE INDEX \`users_updated_at_idx\` ON \`users\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`users_created_at_idx\` ON \`users\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`users_email_idx\` ON \`users\` (\`email\`);`)
  await db.run(sql`CREATE TABLE \`comics_credits\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`role\` text NOT NULL,
  	\`custom_role\` text,
  	\`name\` text NOT NULL,
  	\`url\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`comics\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`comics_credits_order_idx\` ON \`comics_credits\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`comics_credits_parent_id_idx\` ON \`comics_credits\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`comics_genres\` (
  	\`order\` integer NOT NULL,
  	\`parent_id\` text NOT NULL,
  	\`value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`comics\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`comics_genres_order_idx\` ON \`comics_genres\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`comics_genres_parent_idx\` ON \`comics_genres\` (\`parent_id\`);`)
  await db.run(sql`CREATE TABLE \`comics\` (
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`title\` text NOT NULL,
  	\`slug\` text NOT NULL,
  	\`description\` text,
  	\`author_id\` integer NOT NULL,
  	\`cover_image_id\` text,
  	\`status\` text DEFAULT 'draft' NOT NULL,
  	\`publish_schedule\` text DEFAULT 'irregular' NOT NULL,
  	\`is_n_s_f_w\` integer DEFAULT false,
  	\`seo_meta_meta_title\` text,
  	\`seo_meta_meta_description\` text,
  	\`seo_meta_social_image_id\` text,
  	\`stats_total_pages\` numeric DEFAULT 0,
  	\`stats_total_chapters\` numeric DEFAULT 0,
  	\`stats_last_page_published\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`author_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`cover_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`seo_meta_social_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`comics_slug_idx\` ON \`comics\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`comics_author_idx\` ON \`comics\` (\`author_id\`);`)
  await db.run(sql`CREATE INDEX \`comics_cover_image_idx\` ON \`comics\` (\`cover_image_id\`);`)
  await db.run(sql`CREATE INDEX \`comics_seo_meta_seo_meta_social_image_idx\` ON \`comics\` (\`seo_meta_social_image_id\`);`)
  await db.run(sql`CREATE INDEX \`comics_updated_at_idx\` ON \`comics\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`comics_created_at_idx\` ON \`comics\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`comics_texts\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer NOT NULL,
  	\`parent_id\` text NOT NULL,
  	\`path\` text NOT NULL,
  	\`text\` text,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`comics\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`comics_texts_order_parent_idx\` ON \`comics_texts\` (\`order\`,\`parent_id\`);`)
  await db.run(sql`CREATE TABLE \`chapters\` (
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`comic_id\` text NOT NULL,
  	\`title\` text NOT NULL,
  	\`order\` numeric,
  	\`description\` text,
  	\`seo_meta_slug\` text,
  	\`seo_meta_meta_title\` text,
  	\`seo_meta_meta_description\` text,
  	\`stats_page_count\` numeric DEFAULT 0,
  	\`stats_first_page_number\` numeric,
  	\`stats_last_page_number\` numeric,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`comic_id\`) REFERENCES \`comics\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`chapters_comic_idx\` ON \`chapters\` (\`comic_id\`);`)
  await db.run(sql`CREATE INDEX \`chapters_updated_at_idx\` ON \`chapters\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`chapters_created_at_idx\` ON \`chapters\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`pages_page_extra_images\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`image_id\` text NOT NULL,
  	\`alt_text\` text,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_page_extra_images_order_idx\` ON \`pages_page_extra_images\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_page_extra_images_parent_id_idx\` ON \`pages_page_extra_images\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_page_extra_images_image_idx\` ON \`pages_page_extra_images\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE \`pages\` (
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`comic_id\` text NOT NULL,
  	\`chapter_id\` text,
  	\`chapter_page_number\` numeric NOT NULL,
  	\`global_page_number\` numeric,
  	\`title\` text,
  	\`display_title\` text,
  	\`page_image_id\` text,
  	\`thumbnail_image_id\` text,
  	\`alt_text\` text,
  	\`author_notes\` text,
  	\`status\` text DEFAULT 'draft' NOT NULL,
  	\`published_date\` text,
  	\`navigation_previous_page_id\` text,
  	\`navigation_next_page_id\` text,
  	\`navigation_is_first_page\` integer DEFAULT false,
  	\`navigation_is_last_page\` integer DEFAULT false,
  	\`seo_meta_slug\` text,
  	\`seo_meta_meta_title\` text,
  	\`seo_meta_meta_description\` text,
  	\`stats_view_count\` numeric DEFAULT 0,
  	\`stats_first_viewed\` text,
  	\`stats_last_viewed\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`comic_id\`) REFERENCES \`comics\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`chapter_id\`) REFERENCES \`chapters\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`page_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`thumbnail_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`navigation_previous_page_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`navigation_next_page_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_comic_idx\` ON \`pages\` (\`comic_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_chapter_idx\` ON \`pages\` (\`chapter_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_page_image_idx\` ON \`pages\` (\`page_image_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_thumbnail_image_idx\` ON \`pages\` (\`thumbnail_image_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_navigation_navigation_previous_page_idx\` ON \`pages\` (\`navigation_previous_page_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_navigation_navigation_next_page_idx\` ON \`pages\` (\`navigation_next_page_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_updated_at_idx\` ON \`pages\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`pages_created_at_idx\` ON \`pages\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`media\` (
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`alt\` text,
  	\`caption\` text,
  	\`image_sizes\` text,
  	\`media_type\` text DEFAULT 'general' NOT NULL,
  	\`uploaded_by_id\` integer,
  	\`is_public\` integer DEFAULT true,
  	\`comic_meta_related_comic_id\` text,
  	\`comic_meta_is_n_s_f_w\` integer DEFAULT false,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`url\` text,
  	\`thumbnail_u_r_l\` text,
  	\`filename\` text,
  	\`mime_type\` text,
  	\`filesize\` numeric,
  	\`width\` numeric,
  	\`height\` numeric,
  	FOREIGN KEY (\`uploaded_by_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`comic_meta_related_comic_id\`) REFERENCES \`comics\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`media_uploaded_by_idx\` ON \`media\` (\`uploaded_by_id\`);`)
  await db.run(sql`CREATE INDEX \`media_comic_meta_comic_meta_related_comic_idx\` ON \`media\` (\`comic_meta_related_comic_id\`);`)
  await db.run(sql`CREATE INDEX \`media_updated_at_idx\` ON \`media\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`media_created_at_idx\` ON \`media\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`media_filename_idx\` ON \`media\` (\`filename\`);`)
  await db.run(sql`CREATE TABLE \`payload_locked_documents\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`global_slug\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_global_slug_idx\` ON \`payload_locked_documents\` (\`global_slug\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_updated_at_idx\` ON \`payload_locked_documents\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_created_at_idx\` ON \`payload_locked_documents\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_locked_documents_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	\`comics_id\` text,
  	\`chapters_id\` text,
  	\`pages_id\` text,
  	\`media_id\` text,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`comics_id\`) REFERENCES \`comics\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`chapters_id\`) REFERENCES \`chapters\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`pages_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_comics_id_idx\` ON \`payload_locked_documents_rels\` (\`comics_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_chapters_id_idx\` ON \`payload_locked_documents_rels\` (\`chapters_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_pages_id_idx\` ON \`payload_locked_documents_rels\` (\`pages_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_media_id_idx\` ON \`payload_locked_documents_rels\` (\`media_id\`);`)
  await db.run(sql`CREATE TABLE \`payload_preferences\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text,
  	\`value\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_preferences_key_idx\` ON \`payload_preferences\` (\`key\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_updated_at_idx\` ON \`payload_preferences\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_created_at_idx\` ON \`payload_preferences\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_preferences_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_preferences\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_order_idx\` ON \`payload_preferences_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_parent_idx\` ON \`payload_preferences_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_path_idx\` ON \`payload_preferences_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_users_id_idx\` ON \`payload_preferences_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`payload_migrations\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text,
  	\`batch\` numeric,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_migrations_updated_at_idx\` ON \`payload_migrations\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_migrations_created_at_idx\` ON \`payload_migrations\` (\`created_at\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`users_sessions\`;`)
  await db.run(sql`DROP TABLE \`users\`;`)
  await db.run(sql`DROP TABLE \`comics_credits\`;`)
  await db.run(sql`DROP TABLE \`comics_genres\`;`)
  await db.run(sql`DROP TABLE \`comics\`;`)
  await db.run(sql`DROP TABLE \`comics_texts\`;`)
  await db.run(sql`DROP TABLE \`chapters\`;`)
  await db.run(sql`DROP TABLE \`pages_page_extra_images\`;`)
  await db.run(sql`DROP TABLE \`pages\`;`)
  await db.run(sql`DROP TABLE \`media\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_preferences\`;`)
  await db.run(sql`DROP TABLE \`payload_preferences_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_migrations\`;`)
}
