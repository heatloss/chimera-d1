[
  {
    "results": [
      {
        "sql": "CREATE TABLE _cf_METADATA (\n        key INTEGER PRIMARY KEY,\n        value BLOB\n      )"
      },
      {
        "sql": "CREATE TABLE `chapters` (\n  \t`id` integer PRIMARY KEY NOT NULL,\n  \t`comic_id` integer NOT NULL,\n  \t`title` text NOT NULL,\n  \t`order` numeric,\n  \t`description` text,\n  \t`seo_meta_slug` text,\n  \t`seo_meta_meta_title` text,\n  \t`seo_meta_meta_description` text,\n  \t`stats_page_count` numeric DEFAULT 0,\n  \t`stats_first_page_number` numeric,\n  \t`stats_last_page_number` numeric,\n  \t`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,\n  \t`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,\n  \tFOREIGN KEY (`comic_id`) REFERENCES `comics`(`id`) ON UPDATE no action ON DELETE set null\n  )"
      },
      {
        "sql": "CREATE TABLE `comics` (\n  \t`id` integer PRIMARY KEY NOT NULL,\n  \t`title` text NOT NULL,\n  \t`slug` text NOT NULL,\n  \t`description` text,\n  \t`author_id` integer NOT NULL,\n  \t`cover_image_id` integer,\n  \t`status` text DEFAULT 'draft' NOT NULL,\n  \t`publish_schedule` text DEFAULT 'irregular' NOT NULL,\n  \t`is_n_s_f_w` integer DEFAULT false,\n  \t`seo_meta_meta_title` text,\n  \t`seo_meta_meta_description` text,\n  \t`seo_meta_social_image_id` integer,\n  \t`stats_total_pages` numeric DEFAULT 0,\n  \t`stats_total_chapters` numeric DEFAULT 0,\n  \t`stats_last_page_published` text,\n  \t`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,\n  \t`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,\n  \tFOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,\n  \tFOREIGN KEY (`cover_image_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null,\n  \tFOREIGN KEY (`seo_meta_social_image_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null\n  )"
      },
      {
        "sql": "CREATE TABLE `comics_credits` (\n  \t`_order` integer NOT NULL,\n  \t`_parent_id` integer NOT NULL,\n  \t`id` text PRIMARY KEY NOT NULL,\n  \t`role` text NOT NULL,\n  \t`custom_role` text,\n  \t`name` text NOT NULL,\n  \t`url` text,\n  \tFOREIGN KEY (`_parent_id`) REFERENCES `comics`(`id`) ON UPDATE no action ON DELETE cascade\n  )"
      },
      {
        "sql": "CREATE TABLE `comics_genres` (\n  \t`order` integer NOT NULL,\n  \t`parent_id` integer NOT NULL,\n  \t`value` text,\n  \t`id` integer PRIMARY KEY NOT NULL,\n  \tFOREIGN KEY (`parent_id`) REFERENCES `comics`(`id`) ON UPDATE no action ON DELETE cascade\n  )"
      },
      {
        "sql": "CREATE TABLE `comics_texts` (\n  \t`id` integer PRIMARY KEY NOT NULL,\n  \t`order` integer NOT NULL,\n  \t`parent_id` integer NOT NULL,\n  \t`path` text NOT NULL,\n  \t`text` text,\n  \tFOREIGN KEY (`parent_id`) REFERENCES `comics`(`id`) ON UPDATE no action ON DELETE cascade\n  )"
      },
      {
        "sql": "CREATE TABLE `media` (\n  \t`id` integer PRIMARY KEY NOT NULL,\n  \t`alt` text,\n  \t`caption` text,\n  \t`image_sizes` text,\n  \t`media_type` text DEFAULT 'general' NOT NULL,\n  \t`uploaded_by_id` integer,\n  \t`is_public` integer DEFAULT true,\n  \t`comic_meta_related_comic_id` integer,\n  \t`comic_meta_is_n_s_f_w` integer DEFAULT false,\n  \t`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,\n  \t`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,\n  \t`url` text,\n  \t`thumbnail_u_r_l` text,\n  \t`filename` text,\n  \t`mime_type` text,\n  \t`filesize` numeric,\n  \t`width` numeric,\n  \t`height` numeric,\n  \tFOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,\n  \tFOREIGN KEY (`comic_meta_related_comic_id`) REFERENCES `comics`(`id`) ON UPDATE no action ON DELETE set null\n  )"
      },
      {
        "sql": "CREATE TABLE `pages` (\n  \t`id` integer PRIMARY KEY NOT NULL,\n  \t`comic_id` integer NOT NULL,\n  \t`chapter_id` integer,\n  \t`chapter_page_number` numeric NOT NULL,\n  \t`global_page_number` numeric,\n  \t`title` text,\n  \t`display_title` text,\n  \t`page_image_id` integer,\n  \t`thumbnail_image_id` integer,\n  \t`alt_text` text,\n  \t`author_notes` text,\n  \t`status` text DEFAULT 'draft' NOT NULL,\n  \t`published_date` text,\n  \t`navigation_previous_page_id` integer,\n  \t`navigation_next_page_id` integer,\n  \t`navigation_is_first_page` integer DEFAULT false,\n  \t`navigation_is_last_page` integer DEFAULT false,\n  \t`seo_meta_slug` text,\n  \t`seo_meta_meta_title` text,\n  \t`seo_meta_meta_description` text,\n  \t`stats_view_count` numeric DEFAULT 0,\n  \t`stats_first_viewed` text,\n  \t`stats_last_viewed` text,\n  \t`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,\n  \t`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,\n  \tFOREIGN KEY (`comic_id`) REFERENCES `comics`(`id`) ON UPDATE no action ON DELETE set null,\n  \tFOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE set null,\n  \tFOREIGN KEY (`page_image_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null,\n  \tFOREIGN KEY (`thumbnail_image_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null,\n  \tFOREIGN KEY (`navigation_previous_page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE set null,\n  \tFOREIGN KEY (`navigation_next_page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE set null\n  )"
      },
      {
        "sql": "CREATE TABLE `pages_page_extra_images` (\n  \t`_order` integer NOT NULL,\n  \t`_parent_id` integer NOT NULL,\n  \t`id` text PRIMARY KEY NOT NULL,\n  \t`image_id` integer NOT NULL,\n  \t`alt_text` text,\n  \tFOREIGN KEY (`image_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null,\n  \tFOREIGN KEY (`_parent_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE cascade\n  )"
      },
      {
        "sql": "CREATE TABLE `payload_kv` (\n\t`id` integer PRIMARY KEY NOT NULL,\n\t`key` text NOT NULL,\n\t`data` text NOT NULL\n)"
      },
      {
        "sql": "CREATE TABLE `payload_locked_documents` (\n  \t`id` integer PRIMARY KEY NOT NULL,\n  \t`global_slug` text,\n  \t`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,\n  \t`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL\n  )"
      },
      {
        "sql": "CREATE TABLE `payload_locked_documents_rels` (\n  \t`id` integer PRIMARY KEY NOT NULL,\n  \t`order` integer,\n  \t`parent_id` integer NOT NULL,\n  \t`path` text NOT NULL,\n  \t`users_id` integer,\n  \t`comics_id` integer,\n  \t`chapters_id` integer,\n  \t`pages_id` integer,\n  \t`media_id` integer,\n  \tFOREIGN KEY (`parent_id`) REFERENCES `payload_locked_documents`(`id`) ON UPDATE no action ON DELETE cascade,\n  \tFOREIGN KEY (`users_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,\n  \tFOREIGN KEY (`comics_id`) REFERENCES `comics`(`id`) ON UPDATE no action ON DELETE cascade,\n  \tFOREIGN KEY (`chapters_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade,\n  \tFOREIGN KEY (`pages_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE cascade,\n  \tFOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE cascade\n  )"
      },
      {
        "sql": "CREATE TABLE `payload_migrations` (\n  \t`id` integer PRIMARY KEY NOT NULL,\n  \t`name` text,\n  \t`batch` numeric,\n  \t`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,\n  \t`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL\n  )"
      },
      {
        "sql": "CREATE TABLE `payload_preferences` (\n  \t`id` integer PRIMARY KEY NOT NULL,\n  \t`key` text,\n  \t`value` text,\n  \t`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,\n  \t`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL\n  )"
      },
      {
        "sql": "CREATE TABLE `payload_preferences_rels` (\n  \t`id` integer PRIMARY KEY NOT NULL,\n  \t`order` integer,\n  \t`parent_id` integer NOT NULL,\n  \t`path` text NOT NULL,\n  \t`users_id` integer,\n  \tFOREIGN KEY (`parent_id`) REFERENCES `payload_preferences`(`id`) ON UPDATE no action ON DELETE cascade,\n  \tFOREIGN KEY (`users_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade\n  )"
      },
      {
        "sql": "CREATE TABLE `users` (\n  \t`id` integer PRIMARY KEY NOT NULL,\n  \t`role` text DEFAULT 'creator' NOT NULL,\n  \t`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,\n  \t`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,\n  \t`email` text NOT NULL,\n  \t`reset_password_token` text,\n  \t`reset_password_expiration` text,\n  \t`salt` text,\n  \t`hash` text,\n  \t`login_attempts` numeric DEFAULT 0,\n  \t`lock_until` text\n  )"
      },
      {
        "sql": "CREATE TABLE `users_sessions` (\n  \t`_order` integer NOT NULL,\n  \t`_parent_id` integer NOT NULL,\n  \t`id` text PRIMARY KEY NOT NULL,\n  \t`created_at` text,\n  \t`expires_at` text NOT NULL,\n  \tFOREIGN KEY (`_parent_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade\n  )"
      },
      {
        "sql": "CREATE INDEX `chapters_comic_idx` ON `chapters` (`comic_id`)"
      },
      {
        "sql": "CREATE INDEX `chapters_created_at_idx` ON `chapters` (`created_at`)"
      },
      {
        "sql": "CREATE INDEX `chapters_updated_at_idx` ON `chapters` (`updated_at`)"
      },
      {
        "sql": "CREATE INDEX `comics_author_idx` ON `comics` (`author_id`)"
      },
      {
        "sql": "CREATE INDEX `comics_cover_image_idx` ON `comics` (`cover_image_id`)"
      },
      {
        "sql": "CREATE INDEX `comics_created_at_idx` ON `comics` (`created_at`)"
      },
      {
        "sql": "CREATE INDEX `comics_credits_order_idx` ON `comics_credits` (`_order`)"
      },
      {
        "sql": "CREATE INDEX `comics_credits_parent_id_idx` ON `comics_credits` (`_parent_id`)"
      },
      {
        "sql": "CREATE INDEX `comics_genres_order_idx` ON `comics_genres` (`order`)"
      },
      {
        "sql": "CREATE INDEX `comics_genres_parent_idx` ON `comics_genres` (`parent_id`)"
      },
      {
        "sql": "CREATE INDEX `comics_seo_meta_seo_meta_social_image_idx` ON `comics` (`seo_meta_social_image_id`)"
      },
      {
        "sql": "CREATE UNIQUE INDEX `comics_slug_idx` ON `comics` (`slug`)"
      },
      {
        "sql": "CREATE INDEX `comics_texts_order_parent` ON `comics_texts` (`order`,`parent_id`)"
      },
      {
        "sql": "CREATE INDEX `comics_updated_at_idx` ON `comics` (`updated_at`)"
      },
      {
        "sql": "CREATE INDEX `media_comic_meta_comic_meta_related_comic_idx` ON `media` (`comic_meta_related_comic_id`)"
      },
      {
        "sql": "CREATE INDEX `media_created_at_idx` ON `media` (`created_at`)"
      },
      {
        "sql": "CREATE UNIQUE INDEX `media_filename_idx` ON `media` (`filename`)"
      },
      {
        "sql": "CREATE INDEX `media_updated_at_idx` ON `media` (`updated_at`)"
      },
      {
        "sql": "CREATE INDEX `media_uploaded_by_idx` ON `media` (`uploaded_by_id`)"
      },
      {
        "sql": "CREATE INDEX `pages_chapter_idx` ON `pages` (`chapter_id`)"
      },
      {
        "sql": "CREATE INDEX `pages_comic_idx` ON `pages` (`comic_id`)"
      },
      {
        "sql": "CREATE INDEX `pages_created_at_idx` ON `pages` (`created_at`)"
      },
      {
        "sql": "CREATE INDEX `pages_navigation_navigation_next_page_idx` ON `pages` (`navigation_next_page_id`)"
      },
      {
        "sql": "CREATE INDEX `pages_navigation_navigation_previous_page_idx` ON `pages` (`navigation_previous_page_id`)"
      },
      {
        "sql": "CREATE INDEX `pages_page_extra_images_image_idx` ON `pages_page_extra_images` (`image_id`)"
      },
      {
        "sql": "CREATE INDEX `pages_page_extra_images_order_idx` ON `pages_page_extra_images` (`_order`)"
      },
      {
        "sql": "CREATE INDEX `pages_page_extra_images_parent_id_idx` ON `pages_page_extra_images` (`_parent_id`)"
      },
      {
        "sql": "CREATE INDEX `pages_page_image_idx` ON `pages` (`page_image_id`)"
      },
      {
        "sql": "CREATE INDEX `pages_thumbnail_image_idx` ON `pages` (`thumbnail_image_id`)"
      },
      {
        "sql": "CREATE INDEX `pages_updated_at_idx` ON `pages` (`updated_at`)"
      },
      {
        "sql": "CREATE UNIQUE INDEX `payload_kv_key_idx` ON `payload_kv` (`key`)"
      },
      {
        "sql": "CREATE INDEX `payload_locked_documents_created_at_idx` ON `payload_locked_documents` (`created_at`)"
      },
      {
        "sql": "CREATE INDEX `payload_locked_documents_global_slug_idx` ON `payload_locked_documents` (`global_slug`)"
      },
      {
        "sql": "CREATE INDEX `payload_locked_documents_rels_chapters_id_idx` ON `payload_locked_documents_rels` (`chapters_id`)"
      },
      {
        "sql": "CREATE INDEX `payload_locked_documents_rels_comics_id_idx` ON `payload_locked_documents_rels` (`comics_id`)"
      },
      {
        "sql": "CREATE INDEX `payload_locked_documents_rels_media_id_idx` ON `payload_locked_documents_rels` (`media_id`)"
      },
      {
        "sql": "CREATE INDEX `payload_locked_documents_rels_order_idx` ON `payload_locked_documents_rels` (`order`)"
      },
      {
        "sql": "CREATE INDEX `payload_locked_documents_rels_pages_id_idx` ON `payload_locked_documents_rels` (`pages_id`)"
      },
      {
        "sql": "CREATE INDEX `payload_locked_documents_rels_parent_idx` ON `payload_locked_documents_rels` (`parent_id`)"
      },
      {
        "sql": "CREATE INDEX `payload_locked_documents_rels_path_idx` ON `payload_locked_documents_rels` (`path`)"
      },
      {
        "sql": "CREATE INDEX `payload_locked_documents_rels_users_id_idx` ON `payload_locked_documents_rels` (`users_id`)"
      },
      {
        "sql": "CREATE INDEX `payload_locked_documents_updated_at_idx` ON `payload_locked_documents` (`updated_at`)"
      },
      {
        "sql": "CREATE INDEX `payload_migrations_created_at_idx` ON `payload_migrations` (`created_at`)"
      },
      {
        "sql": "CREATE INDEX `payload_migrations_updated_at_idx` ON `payload_migrations` (`updated_at`)"
      },
      {
        "sql": "CREATE INDEX `payload_preferences_created_at_idx` ON `payload_preferences` (`created_at`)"
      },
      {
        "sql": "CREATE INDEX `payload_preferences_key_idx` ON `payload_preferences` (`key`)"
      },
      {
        "sql": "CREATE INDEX `payload_preferences_rels_order_idx` ON `payload_preferences_rels` (`order`)"
      },
      {
        "sql": "CREATE INDEX `payload_preferences_rels_parent_idx` ON `payload_preferences_rels` (`parent_id`)"
      },
      {
        "sql": "CREATE INDEX `payload_preferences_rels_path_idx` ON `payload_preferences_rels` (`path`)"
      },
      {
        "sql": "CREATE INDEX `payload_preferences_rels_users_id_idx` ON `payload_preferences_rels` (`users_id`)"
      },
      {
        "sql": "CREATE INDEX `payload_preferences_updated_at_idx` ON `payload_preferences` (`updated_at`)"
      },
      {
        "sql": "CREATE INDEX `users_created_at_idx` ON `users` (`created_at`)"
      },
      {
        "sql": "CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`)"
      },
      {
        "sql": "CREATE INDEX `users_sessions_order_idx` ON `users_sessions` (`_order`)"
      },
      {
        "sql": "CREATE INDEX `users_sessions_parent_id_idx` ON `users_sessions` (`_parent_id`)"
      },
      {
        "sql": "CREATE INDEX `users_updated_at_idx` ON `users` (`updated_at`)"
      }
    ],
    "success": true,
    "meta": {
      "duration": 0
    }
  }
]
