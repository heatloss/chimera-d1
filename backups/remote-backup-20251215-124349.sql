PRAGMA defer_foreign_keys=TRUE;
ANALYZE sqlite_schema;
INSERT INTO "sqlite_stat1" VALUES('payload_migrations','payload_migrations_created_at_idx','2 1');
INSERT INTO "sqlite_stat1" VALUES('payload_migrations','payload_migrations_updated_at_idx','2 1');
INSERT INTO "sqlite_stat1" VALUES('payload_preferences','payload_preferences_created_at_idx','4 1');
INSERT INTO "sqlite_stat1" VALUES('payload_preferences','payload_preferences_updated_at_idx','4 1');
INSERT INTO "sqlite_stat1" VALUES('payload_preferences','payload_preferences_key_idx','4 1');
INSERT INTO "sqlite_stat1" VALUES('media','media_filename_idx','42 1');
INSERT INTO "sqlite_stat1" VALUES('media','media_created_at_idx','42 21');
INSERT INTO "sqlite_stat1" VALUES('media','media_updated_at_idx','42 1');
INSERT INTO "sqlite_stat1" VALUES('media','media_comic_meta_comic_meta_related_comic_idx','42 42');
INSERT INTO "sqlite_stat1" VALUES('media','media_uploaded_by_idx','42 42');
INSERT INTO "sqlite_stat1" VALUES('pages','pages_created_at_idx','29 1');
INSERT INTO "sqlite_stat1" VALUES('pages','pages_updated_at_idx','29 1');
INSERT INTO "sqlite_stat1" VALUES('pages','pages_navigation_navigation_next_page_idx','29 29');
INSERT INTO "sqlite_stat1" VALUES('pages','pages_navigation_navigation_previous_page_idx','29 29');
INSERT INTO "sqlite_stat1" VALUES('pages','pages_thumbnail_image_idx','29 1');
INSERT INTO "sqlite_stat1" VALUES('pages','pages_page_image_idx','29 1');
INSERT INTO "sqlite_stat1" VALUES('pages','pages_chapter_idx','29 10');
INSERT INTO "sqlite_stat1" VALUES('pages','pages_comic_idx','29 29');
INSERT INTO "sqlite_stat1" VALUES('chapters','chapters_created_at_idx','5 1');
INSERT INTO "sqlite_stat1" VALUES('chapters','chapters_updated_at_idx','5 1');
INSERT INTO "sqlite_stat1" VALUES('chapters','chapters_comic_idx','5 5');
INSERT INTO "sqlite_stat1" VALUES('_cf_KV','_cf_KV','1 1');
INSERT INTO "sqlite_stat1" VALUES('payload_preferences_rels','payload_preferences_rels_users_id_idx','4 4');
INSERT INTO "sqlite_stat1" VALUES('payload_preferences_rels','payload_preferences_rels_path_idx','4 4');
INSERT INTO "sqlite_stat1" VALUES('payload_preferences_rels','payload_preferences_rels_parent_idx','4 1');
INSERT INTO "sqlite_stat1" VALUES('payload_preferences_rels','payload_preferences_rels_order_idx','4 4');
INSERT INTO "sqlite_stat1" VALUES('users_sessions','users_sessions_parent_id_idx','1 1');
INSERT INTO "sqlite_stat1" VALUES('users_sessions','users_sessions_order_idx','1 1');
INSERT INTO "sqlite_stat1" VALUES('users_sessions','sqlite_autoindex_users_sessions_1','1 1');
INSERT INTO "sqlite_stat1" VALUES('users','users_email_idx','2 1');
INSERT INTO "sqlite_stat1" VALUES('users','users_created_at_idx','2 1');
INSERT INTO "sqlite_stat1" VALUES('users','users_updated_at_idx','2 1');
INSERT INTO "sqlite_stat1" VALUES('comics','comics_created_at_idx','1 1');
INSERT INTO "sqlite_stat1" VALUES('comics','comics_updated_at_idx','1 1');
INSERT INTO "sqlite_stat1" VALUES('comics','comics_seo_meta_seo_meta_social_image_idx','1 1');
INSERT INTO "sqlite_stat1" VALUES('comics','comics_cover_image_idx','1 1');
INSERT INTO "sqlite_stat1" VALUES('comics','comics_author_idx','1 1');
INSERT INTO "sqlite_stat1" VALUES('comics','comics_slug_idx','1 1');
CREATE TABLE `users_sessions` (
  	`_order` integer NOT NULL,
  	`_parent_id` integer NOT NULL,
  	`id` text PRIMARY KEY NOT NULL,
  	`created_at` text,
  	`expires_at` text NOT NULL,
  	FOREIGN KEY (`_parent_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
  );
INSERT INTO "users_sessions" VALUES(1,1,'01bb0e70-1f98-4220-aa58-aac07b8bcbde','2025-11-23T21:13:59.175Z','2025-11-23T23:13:59.175Z');
CREATE TABLE `users` (
  	`id` integer PRIMARY KEY NOT NULL,
  	`role` text DEFAULT 'creator' NOT NULL,
  	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	`email` text NOT NULL,
  	`reset_password_token` text,
  	`reset_password_expiration` text,
  	`salt` text,
  	`hash` text,
  	`login_attempts` numeric DEFAULT 0,
  	`lock_until` text
  );
INSERT INTO "users" VALUES(1,'creator','2025-11-23T15:45:33.783Z','2025-10-15T20:25:51.368Z','mike@the-ottoman.com',NULL,NULL,'fa14d866ffb86a01ad7d3fdb92768c19a3dc75574e2183d01649954208e82f09','6560686066d9dbc8d6987449ffb8eb55b35db5a2d2f22ebc7fe2efbe6e3141a8a3ccbb0e7dfe4c954bc3d495bfc12b9c3d19579c8706bad412310a272bd771bca2e573d269129aaabb686c7a9cd5bff1b8b77a7a520bba89ef34f403b1b9a02aa2fabf1bb7f72d8755f66be381d21472b3f9d52af5c73a65111b992ab560ad6555e1bbd2889e11c1efe0a7293a363022c8e4f3b31491ea8be9338c3a87e0c71eb61a607274185918fd987bbf04493c48f6c7a66925fafec785b2d84fe4ede9721ba1fe6910a8b1b94ef5c83a3a2431918665c3769da95fb2cb29bbe243e0945701b16116bd706c07c4677df60586fb093bed8786e02c0437798d0d6ebd219c2f58bacaa192ebfda4f41327f99fcc29cb0a66df02d2fd3b3b7f8ad21d0cf5b5fcf28dafdd83d7ff12a62db5c4fc6b5d674134df090b8c47d9d680a21d400ead5b8265a770798cba21919372498af7d47952d3aa2d39b0e4f0eb5d1316c1284bf4960e392a1259d0f1c5cec759d96d9722d2b12a6937dcdd88dc069120a7fb730260659d54782945ae65db024da686ae1eff2cad794300c589bb327a311db8ab1bf8a76785595b2e162f0263a513113d9863a056d596d050782085e6eca9ff8129ecd74d49d644c9517756208c9b58a622ed5adf5ae3d4e6ad7691d2f3ff94e66e45f8afe624475f9987d27180195eda86706239a3d646a68fbf04ba505c268fe1',0,NULL);
INSERT INTO "users" VALUES(2,'admin','2025-11-22T21:34:45.889Z','2025-10-15T20:25:51.446Z','mike@luckbat.com',NULL,NULL,'7aae678915dbbaef3090204be712e0c68d48c3f8f1b3dfe7daf9d684e317a321','410686b63911753a4882cc154d8a867ba990f548d03d71d0ee6fdc91e55681b4df8a93132afbc8782981504d975d26d3d6b1fe1ea2acbf57f2def0efc6d8f575b274fada90b49eeabd9049b9fdb800a8cf8ac73539740efbc7137ba3199d9c7a94d8da44a31aa1200be033cc85cdc86bdceabee14d1de9c8bf8dc92e91495a766440209c34655bdf42b889751ed1f935ed9f71350ec72462ed7dbd1984ecdd12fe6ee352d9a0884d5b9dfad23a3d649addb4270eb90880bfaae7be25400ce3162bb5435d55cb4e930cfb0079c6b2d3ea149ad73af3c3417bf4cf9ec27aefd45b16f314b530ece24eb8fafe62daca8ee25f792d4e174f79f04fc36587b80d48573bf111af6b255966fa3b1db6237f6a5dfb446cffab3d81cc1875de4aa7a70403740b0461e42947b035715035c780c9d0e53bd067fc8a38b20870188b15aaa5135fd4b06dd02de725b6b89f04a58eef2633e7562083f44126e9bc76ddfa4dd035fbe13439e746f79e8d0fa2e0b5fd32bff34ae7cd37245f72270e566cffe023e7c28813ccdabc05972bcc391bb0db2b6ab60e891d8b9521dd8e8281ebc5ca378adc3958e7479857536a2eaebeafde72f23a91514dff06c1c4dbaf34dcb6ca5e9d677259d9059177d0885709256496cf1bcb20d217e5fdcf7e8a8a81a61096ac8e76b36c6e774b72f2947f71f9274da3b0cc4e075bf68c5a0f174f18252fa0de9a',0,NULL);
CREATE TABLE `comics_credits` (
  	`_order` integer NOT NULL,
  	`_parent_id` integer NOT NULL,
  	`id` text PRIMARY KEY NOT NULL,
  	`role` text NOT NULL,
  	`custom_role` text,
  	`name` text NOT NULL,
  	`url` text,
  	FOREIGN KEY (`_parent_id`) REFERENCES `comics`(`id`) ON UPDATE no action ON DELETE cascade
  );
CREATE TABLE `comics_genres` (
  	`order` integer NOT NULL,
  	`parent_id` integer NOT NULL,
  	`value` text,
  	`id` integer PRIMARY KEY NOT NULL,
  	FOREIGN KEY (`parent_id`) REFERENCES `comics`(`id`) ON UPDATE no action ON DELETE cascade
  );
CREATE TABLE `comics` (
  	`id` integer PRIMARY KEY NOT NULL,
  	`title` text NOT NULL,
  	`slug` text NOT NULL,
  	`description` text,
  	`author_id` integer NOT NULL,
  	`cover_image_id` integer,
  	`status` text DEFAULT 'draft' NOT NULL,
  	`publish_schedule` text DEFAULT 'irregular' NOT NULL,
  	`is_n_s_f_w` integer DEFAULT false,
  	`seo_meta_meta_title` text,
  	`seo_meta_meta_description` text,
  	`seo_meta_social_image_id` integer,
  	`stats_total_pages` numeric DEFAULT 0,
  	`stats_total_chapters` numeric DEFAULT 0,
  	`stats_last_page_published` text,
  	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (`cover_image_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (`seo_meta_social_image_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null
  );
INSERT INTO "comics" VALUES(1,'The Automan''s Daughter','automans-daughter','An adventure story set in an alternate-historical dieselpunk world, The Automan''s Daughter follows military-school dropout Aisha Osman and her industrialist uncle Siddig as they outwit bikers, spies and kidnappers while gearing up for a tournament showdown with the formidable Widowmaker mecha.',1,31,'hiatus','irregular',0,NULL,NULL,NULL,27,5,'2025-09-28T10:16:00.000Z','2025-11-23T01:56:14.497Z','2025-10-15T20:25:51.457Z');
CREATE TABLE `comics_texts` (
  	`id` integer PRIMARY KEY NOT NULL,
  	`order` integer NOT NULL,
  	`parent_id` integer NOT NULL,
  	`path` text NOT NULL,
  	`text` text,
  	FOREIGN KEY (`parent_id`) REFERENCES `comics`(`id`) ON UPDATE no action ON DELETE cascade
  );
CREATE TABLE `chapters` (
  	`id` integer PRIMARY KEY NOT NULL,
  	`comic_id` integer NOT NULL,
  	`title` text NOT NULL,
  	`order` numeric,
  	`description` text,
  	`seo_meta_slug` text,
  	`seo_meta_meta_title` text,
  	`seo_meta_meta_description` text,
  	`stats_page_count` numeric DEFAULT 0,
  	`stats_first_page_number` numeric,
  	`stats_last_page_number` numeric,
  	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (`comic_id`) REFERENCES `comics`(`id`) ON UPDATE no action ON DELETE set null
  );
INSERT INTO "chapters" VALUES(1,1,'Chapter 1',1,NULL,'chapter-1',NULL,NULL,0,NULL,NULL,'2025-11-23T02:10:13.795Z','2025-10-15T20:25:51.475Z');
INSERT INTO "chapters" VALUES(2,1,'Chapter 2',2,NULL,'chapter-2',NULL,NULL,0,NULL,NULL,'2025-11-23T02:10:13.820Z','2025-10-15T20:25:51.534Z');
INSERT INTO "chapters" VALUES(3,1,'Chapter 3',3,NULL,'chapter-3',NULL,NULL,0,NULL,NULL,'2025-11-23T02:10:13.842Z','2025-10-15T20:25:51.585Z');
INSERT INTO "chapters" VALUES(4,1,'Chapter 4',4,'','chapter-4',NULL,NULL,0,NULL,NULL,'2025-11-23T02:10:13.869Z','2025-10-15T20:25:51.641Z');
INSERT INTO "chapters" VALUES(5,1,'Chapter 5',5,'','chapter-5',NULL,NULL,0,NULL,NULL,'2025-11-23T02:10:13.895Z','2025-10-15T20:25:51.692Z');
CREATE TABLE `pages_page_extra_images` (
  	`_order` integer NOT NULL,
  	`_parent_id` integer NOT NULL,
  	`id` text PRIMARY KEY NOT NULL,
  	`image_id` integer NOT NULL,
  	`alt_text` text,
  	FOREIGN KEY (`image_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (`_parent_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE cascade
  );
CREATE TABLE `pages` (
  	`id` integer PRIMARY KEY NOT NULL,
  	`comic_id` integer NOT NULL,
  	`chapter_id` integer,
  	`chapter_page_number` numeric NOT NULL,
  	`global_page_number` numeric,
  	`title` text,
  	`display_title` text,
  	`page_image_id` integer,
  	`thumbnail_image_id` integer,
  	`alt_text` text,
  	`author_notes` text,
  	`status` text DEFAULT 'draft' NOT NULL,
  	`published_date` text,
  	`navigation_previous_page_id` integer,
  	`navigation_next_page_id` integer,
  	`navigation_is_first_page` integer DEFAULT false,
  	`navigation_is_last_page` integer DEFAULT false,
  	`seo_meta_slug` text,
  	`seo_meta_meta_title` text,
  	`seo_meta_meta_description` text,
  	`stats_view_count` numeric DEFAULT 0,
  	`stats_first_viewed` text,
  	`stats_last_viewed` text,
  	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (`comic_id`) REFERENCES `comics`(`id`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (`page_image_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (`thumbnail_image_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (`navigation_previous_page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (`navigation_next_page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE set null
  );
INSERT INTO "pages" VALUES(1,1,3,0,23,'Chapter 3, cover','Chapter 3 - Page ?: Chapter 3, cover',4,4,'The cover for Chapter 3, featuring a photo of the Osmans standing in front of an ornate door and wearing fancy outfits. Aisha looks much younger, Tajj is holding her infant son.','','published','2025-09-28T00:58:00.000Z',NULL,NULL,0,0,'chapter-3-cover',NULL,NULL,0,NULL,NULL,'2025-11-23T01:56:14.474Z','2025-10-15T20:25:51.782Z');
INSERT INTO "pages" VALUES(2,1,2,0,11,'Chapter 2, Cover','Chapter 2 - Page ?: Chapter 2, Cover',25,25,NULL,NULL,'published','2025-08-29T02:43:13.003Z',NULL,NULL,0,0,'chapter-2-cover',NULL,NULL,0,NULL,NULL,'2025-11-23T01:56:14.395Z','2025-10-15T20:25:51.868Z');
INSERT INTO "pages" VALUES(3,1,1,0,1,'Chapter 1, cover','Chapter 1 - Page ?: Chapter 1, cover',14,14,'Aisha Osman lies on the desert ground, surrounded by assorted monocycle parts. She is fixing a carburetor with a screwdriver.',NULL,'published','2025-08-28T21:15:12.332Z',NULL,NULL,0,0,'chapter-1-cover',NULL,NULL,0,NULL,NULL,'2025-11-23T01:56:14.306Z','2025-10-15T20:25:51.947Z');
INSERT INTO "pages" VALUES(4,1,3,1,24,'Chapter 3, page 1','Chapter 3 - Page 1: Chapter 3, page 1',10,10,'The limo approaches a junkyard on the outskirts of the city. Ali asks Aisha about it. She admits that her parents own the junkyard. They''re waiting outside.','','published','2025-09-27T21:29:23.745Z',NULL,NULL,0,0,'chapter-3-page-1',NULL,NULL,0,NULL,NULL,'2025-11-23T01:56:14.246Z','2025-10-15T20:25:52.041Z');
INSERT INTO "pages" VALUES(5,1,2,1,12,'Chapter 2, page 1','Chapter 2 - Page 1: Chapter 2, page 1',26,26,NULL,NULL,'published','2025-08-29T02:43:13.003Z',NULL,NULL,0,0,'chapter-2-page-1',NULL,NULL,0,NULL,NULL,'2025-11-23T01:56:14.158Z','2025-10-15T20:25:52.118Z');
INSERT INTO "pages" VALUES(6,1,1,1,2,'Chapter 1, page 1','Chapter 1 - Page 1: Chapter 1, page 1',15,15,NULL,NULL,'published','2025-08-28T21:23:35.198Z',NULL,NULL,0,0,'chapter-1-page-1',NULL,NULL,0,NULL,NULL,'2025-11-23T01:56:14.074Z','2025-10-15T20:25:52.205Z');
INSERT INTO "pages" VALUES(7,1,3,2,25,'Chapter 3, page 2','Chapter 3 - Page 2: Chapter 3, page 2',5,5,'Aisha embraces her mom and tearfully admits that she dropped out of the Academy. Tajj immediately demands to know if she''s pregnant.','','published','2025-09-28T01:30:00.000Z',NULL,NULL,0,0,'chapter-3-page-2',NULL,NULL,0,NULL,NULL,'2025-11-23T01:56:14.011Z','2025-10-15T20:25:52.298Z');
INSERT INTO "pages" VALUES(8,1,2,2,13,'Chapter 2, page 2','Chapter 2 - Page 2: Chapter 2, page 2',27,27,NULL,NULL,'published','2025-08-29T03:03:35.389Z',NULL,NULL,0,0,'chapter-2-page-2',NULL,NULL,0,NULL,NULL,'2025-11-23T01:56:13.932Z','2025-10-15T20:25:52.377Z');
INSERT INTO "pages" VALUES(9,1,1,2,3,'Chapter 1, page 2','Chapter 1 - Page 2: Chapter 1, page 2',18,18,NULL,NULL,'published','2025-08-28T21:25:45.709Z',NULL,NULL,0,0,'chapter-1-page-2',NULL,NULL,0,NULL,NULL,'2025-11-23T01:56:13.850Z','2025-10-15T20:25:52.446Z');
INSERT INTO "pages" VALUES(10,1,3,3,26,'Chapter 3, Page 3','Chapter 3 - Page 3: Chapter 3, Page 3',11,11,'Aisha''s parents protest that Aisha needs to return to the Academy, but Aisha gets surly.','','published','2025-09-28T01:37:00.000Z',NULL,NULL,0,0,'chapter-3-page-3',NULL,NULL,0,NULL,NULL,'2025-11-23T01:56:13.794Z','2025-10-15T20:25:52.535Z');
INSERT INTO "pages" VALUES(11,1,2,3,14,'Chapter 2, page 3','Chapter 2 - Page 3: Chapter 2, page 3',28,28,NULL,NULL,'published','2025-08-29T02:56:01.381Z',NULL,NULL,0,0,'chapter-2-page-3',NULL,NULL,0,NULL,NULL,'2025-11-23T01:56:13.712Z','2025-10-15T20:25:52.612Z');
INSERT INTO "pages" VALUES(12,1,1,3,4,'Chapter 1, page 3','Chapter 1 - Page 3: Chapter 1, page 3',16,16,NULL,NULL,'published','2025-08-28T21:33:28.306Z',NULL,NULL,0,0,'chapter-1-page-3',NULL,NULL,0,NULL,NULL,'2025-11-23T01:56:13.638Z','2025-10-15T20:25:52.681Z');
INSERT INTO "pages" VALUES(13,1,3,4,27,'Issue 3 Page 4','Chapter 3 - Page 4: Issue 3 Page 4',12,12,'Aisha stomps off to her room, leaving her parents in stunned silence. Unfortunately, Aisha is horrified to discover that her room is now filled with equipment and machinery.','','published','2025-09-28T10:16:00.000Z',NULL,NULL,0,0,'issue-3-page-4',NULL,NULL,0,NULL,NULL,'2025-11-23T01:56:13.579Z','2025-10-15T20:25:52.772Z');
INSERT INTO "pages" VALUES(14,1,2,4,15,'Chapter 2, page 4','Chapter 2 - Page 4: Chapter 2, page 4',29,29,NULL,NULL,'published','2025-08-29T02:59:07.782Z',NULL,NULL,0,0,'chapter-2-page-4',NULL,NULL,0,NULL,NULL,'2025-11-23T01:56:13.497Z','2025-10-15T20:25:52.841Z');
INSERT INTO "pages" VALUES(15,1,1,4,5,'Chapter 1, page 4','Chapter 1 - Page 4: Chapter 1, page 4',19,19,NULL,NULL,'published','2025-08-28T21:33:14.019Z',NULL,NULL,0,0,'chapter-1-page-4',NULL,NULL,0,NULL,NULL,'2025-11-23T01:56:13.416Z','2025-10-15T20:25:52.904Z');
INSERT INTO "pages" VALUES(16,1,3,5,28,'Issue 3 Page 5','Chapter 3 - Page 5: Issue 3 Page 5',13,13,'Aisha''s room is unfit for habitation, so her father suggests that she live in the broken-down van in the junkyard. Aisha is displeased at this turn of events.','','draft','2025-09-28T14:13:00.000Z',NULL,NULL,0,0,'issue-3-page-5',NULL,NULL,0,NULL,NULL,'2025-11-23T01:56:13.341Z','2025-10-15T20:25:52.977Z');
INSERT INTO "pages" VALUES(17,1,2,5,16,'Chapter 2, page 5','Chapter 2 - Page 5: Chapter 2, page 5',32,32,'Farad marches over to Siddig''s table to yell at him about his work ethic, but Siddig only needles him further.','','published','2025-09-20T21:09:39.943Z',NULL,NULL,0,0,'chapter-2-page-5',NULL,NULL,0,NULL,NULL,'2025-11-23T01:56:13.237Z','2025-10-15T20:25:53.048Z');
INSERT INTO "pages" VALUES(18,1,1,5,6,'Chapter 1, page 5','Chapter 1 - Page 5: Chapter 1, page 5',20,20,NULL,NULL,'published','2025-08-29T02:22:26.074Z',NULL,NULL,0,0,'chapter-1-page-5',NULL,NULL,0,NULL,NULL,'2025-11-23T01:56:13.141Z','2025-10-15T20:25:53.109Z');
INSERT INTO "pages" VALUES(19,1,3,6,29,'Chapter 3, Page 6','Chapter 3 - Page 6: Chapter 3, Page 6',6,6,'Osman introduces Aisha to Djalapi, his old tournament mech which has been repurposed into a junkyard patrol mech. He tosses her the remote control and wishes her a good night.','','draft',NULL,NULL,NULL,0,0,'chapter-3-page-6',NULL,NULL,0,NULL,NULL,'2025-11-23T01:56:13.059Z','2025-10-15T20:25:53.207Z');
INSERT INTO "pages" VALUES(20,1,2,6,17,'Chapter 2, page 6','Chapter 2 - Page 6: Chapter 2, page 6',40,33,'Farad loudly declares that Siddig will fight the Death Strider mecha as part of a live demonstration. Aisha asks Siddig why he hates his own company, but he gets up without answering her.','','published','2025-09-21T15:36:17.407Z',NULL,NULL,0,0,'chapter-2-page-6',NULL,NULL,0,NULL,NULL,'2025-11-23T01:56:12.958Z','2025-10-15T20:25:53.276Z');
INSERT INTO "pages" VALUES(21,1,1,6,7,'Chapter 1, page 6','Chapter 1 - Page 6: Chapter 1, page 6',21,21,NULL,NULL,'published','2025-08-29T02:34:07.477Z',NULL,NULL,0,0,'chapter-1-page-6',NULL,NULL,0,NULL,NULL,'2025-11-23T01:56:12.857Z','2025-10-15T20:25:53.347Z');
INSERT INTO "pages" VALUES(22,1,2,7,18,'Chapter 2, page 7','Chapter 2 - Page 7: Chapter 2, page 7',41,34,'Farad taunts Siddig by emphasizing the mech''s technical prowess, but Siddig brushes him off and then pours a full pitcher of ice water onto his head.','','published','2025-09-21T15:40:16.181Z',NULL,NULL,0,0,'chapter-2-page-7',NULL,NULL,0,NULL,NULL,'2025-11-23T01:56:12.776Z','2025-10-15T20:25:53.428Z');
INSERT INTO "pages" VALUES(23,1,1,7,8,'Chapter 1, page 7','Chapter 1 - Page 7: Chapter 1, page 7',22,22,NULL,NULL,'published','2025-08-29T02:34:57.369Z',NULL,NULL,0,0,'chapter-1-page-7',NULL,NULL,0,NULL,NULL,'2025-11-23T01:56:12.676Z','2025-10-15T20:25:53.488Z');
INSERT INTO "pages" VALUES(24,1,2,8,19,'Chapter 2, page 8','Chapter 2 - Page 8: Chapter 2, page 8',1,1,'Grabbing the chafing-dish lid off a hot turkey platter on a nearby catering trolly, Siddig kicks the trolley down the length of the dining hall. The mech''s heat sensor follows the turkey.','','published','2025-09-27T20:33:36.717Z',NULL,NULL,0,0,'chapter-2-page-8',NULL,NULL,0,NULL,NULL,'2025-11-23T01:56:12.591Z','2025-10-15T20:25:53.561Z');
INSERT INTO "pages" VALUES(25,1,1,8,9,'Chapter 1, page 8','Chapter 1 - Page 8: Chapter 1, page 8',23,23,NULL,NULL,'published','2025-08-29T02:36:57.578Z',NULL,NULL,0,0,'chapter-1-page-8',NULL,NULL,0,NULL,NULL,'2025-11-23T01:56:12.480Z','2025-10-15T20:25:53.619Z');
INSERT INTO "pages" VALUES(26,1,2,9,20,'Chapter 2, page 9','Chapter 2 - Page 9: Chapter 2, page 9',2,2,'','','published','2025-09-27T20:42:07.046Z',NULL,NULL,0,0,'chapter-2-page-9',NULL,NULL,0,NULL,NULL,'2025-11-23T01:56:12.393Z','2025-10-15T20:25:53.691Z');
INSERT INTO "pages" VALUES(27,1,1,9,10,'Chapter 1, page 9','Chapter 1 - Page 9: Chapter 1, page 9',24,24,NULL,NULL,'published','2025-08-29T02:36:57.578Z',NULL,NULL,0,0,'chapter-1-page-9',NULL,NULL,0,NULL,NULL,'2025-11-23T01:56:12.278Z','2025-10-15T20:25:53.747Z');
INSERT INTO "pages" VALUES(28,1,2,10,21,'Chapter 2, page 10','Chapter 2 - Page 10: Chapter 2, page 10',3,3,'Siddig has clambered into the Death Strider''s cockpit. He chastises Farad and loudly declares his own company a washed-up joke.','','published','2025-09-28T00:58:00.000Z',NULL,NULL,0,0,'chapter-2-page-10',NULL,NULL,0,NULL,NULL,'2025-11-23T01:56:12.182Z','2025-10-15T20:25:53.811Z');
INSERT INTO "pages" VALUES(29,1,2,11,22,'Chapter 2, page 11','Chapter 2 - Page 11: Chapter 2, page 11',9,9,'Farad sneers angrily at Siddig, perched in the tank''s cockpit, and swears that there will be consequences. Aisha, crouched behind a nearby table, frets.','','published','2025-09-28T00:57:00.000Z',NULL,NULL,0,0,'chapter-2-page-11',NULL,NULL,0,NULL,NULL,'2025-11-23T01:56:12.056Z','2025-10-15T20:25:53.884Z');
CREATE TABLE `media` (
  	`id` integer PRIMARY KEY NOT NULL,
  	`alt` text,
  	`caption` text,
  	`image_sizes` text,
  	`media_type` text DEFAULT 'general' NOT NULL,
  	`uploaded_by_id` integer,
  	`is_public` integer DEFAULT true,
  	`comic_meta_related_comic_id` integer,
  	`comic_meta_is_n_s_f_w` integer DEFAULT false,
  	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	`url` text,
  	`thumbnail_u_r_l` text,
  	`filename` text,
  	`mime_type` text,
  	`filesize` numeric,
  	`width` numeric,
  	`height` numeric,
  	FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (`comic_meta_related_comic_id`) REFERENCES `comics`(`id`) ON UPDATE no action ON DELETE set null
  );
INSERT INTO "media" VALUES(1,NULL,NULL,'[{"name":"thumbnail","width":400,"height":657,"url":"/api/media/thumbnail/issue-2-page-22-thumbnail.jpg","mimeType":"image/jpg","filesize":66759,"filename":"issue-2-page-22-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":1313,"url":"/api/media/thumbnail/issue-2-page-22-thumbnail_large.jpg","mimeType":"image/jpg","filesize":226854,"filename":"issue-2-page-22-thumbnail_large.jpg"}]','general',2,1,NULL,0,'2025-11-23T00:25:14.874Z','2025-10-16T01:03:49.477Z','/api/media/file/issue-2-page-22.jpg',NULL,'issue-2-page-22.jpg','image/jpg',522147,1600,2626);
INSERT INTO "media" VALUES(2,NULL,NULL,'[{"name":"thumbnail","width":400,"height":657,"url":"/api/media/thumbnail/issue-2-page-16-thumbnail.jpg","mimeType":"image/jpg","filesize":63369,"filename":"issue-2-page-16-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":1313,"url":"/api/media/thumbnail/issue-2-page-16-thumbnail_large.jpg","mimeType":"image/jpg","filesize":221249,"filename":"issue-2-page-16-thumbnail_large.jpg"}]','general',2,1,NULL,0,'2025-11-23T00:25:14.824Z','2025-10-16T01:03:49.477Z','/api/media/file/issue-2-page-16.jpg',NULL,'issue-2-page-16.jpg','image/jpg',519527,1600,2626);
INSERT INTO "media" VALUES(3,NULL,NULL,'[{"name":"thumbnail","width":400,"height":657,"url":"/api/media/thumbnail/issue-2-page-18-thumbnail.jpg","mimeType":"image/jpg","filesize":66228,"filename":"issue-2-page-18-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":1313,"url":"/api/media/thumbnail/issue-2-page-18-thumbnail_large.jpg","mimeType":"image/jpg","filesize":225082,"filename":"issue-2-page-18-thumbnail_large.jpg"}]','general',2,1,NULL,0,'2025-11-23T00:25:14.772Z','2025-10-16T01:03:49.477Z','/api/media/file/issue-2-page-18.jpg',NULL,'issue-2-page-18.jpg','image/jpg',507786,1600,2626);
INSERT INTO "media" VALUES(4,NULL,NULL,'[{"name":"thumbnail","width":400,"height":616,"url":"/api/media/thumbnail/issue-3-cover-thumbnail.jpg","mimeType":"image/jpg","filesize":61028,"filename":"issue-3-cover-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":1232,"url":"/api/media/thumbnail/issue-3-cover-thumbnail_large.jpg","mimeType":"image/jpg","filesize":189138,"filename":"issue-3-cover-thumbnail_large.jpg"}]','general',2,1,NULL,0,'2025-11-23T00:25:14.721Z','2025-10-16T01:03:49.477Z','/api/media/file/issue-3-cover.jpg',NULL,'issue-3-cover.jpg','image/jpg',407810,1600,2464);
INSERT INTO "media" VALUES(5,NULL,NULL,'[{"name":"thumbnail","width":400,"height":657,"url":"/api/media/thumbnail/issue-3-page_2-thumbnail.jpg","mimeType":"image/jpg","filesize":60283,"filename":"issue-3-page_2-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":1313,"url":"/api/media/thumbnail/issue-3-page_2-thumbnail_large.jpg","mimeType":"image/jpg","filesize":200212,"filename":"issue-3-page_2-thumbnail_large.jpg"}]','general',2,1,NULL,0,'2025-11-23T00:25:14.670Z','2025-10-16T01:03:49.477Z','/api/media/file/issue-3-page_2.jpg',NULL,'issue-3-page_2.jpg','image/jpg',452049,1600,2626);
INSERT INTO "media" VALUES(6,NULL,NULL,'[{"name":"thumbnail","width":400,"height":657,"url":"/api/media/thumbnail/issue-3-page-6-thumbnail.jpg","mimeType":"image/jpg","filesize":70329,"filename":"issue-3-page-6-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":1313,"url":"/api/media/thumbnail/issue-3-page-6-thumbnail_large.jpg","mimeType":"image/jpg","filesize":261132,"filename":"issue-3-page-6-thumbnail_large.jpg"}]','comic_page',2,1,NULL,0,'2025-11-23T00:25:14.622Z','2025-10-16T01:03:49.477Z','/api/media/file/issue-3-page-6.jpg',NULL,'issue-3-page-6.jpg','image/jpg',647585,1600,2626);
INSERT INTO "media" VALUES(7,NULL,NULL,'[{"name":"thumbnail","width":400,"height":657,"url":"/api/media/thumbnail/issue-2-page-15-thumbnail.jpg","mimeType":"image/jpg","filesize":63369,"filename":"issue-2-page-15-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":1313,"url":"/api/media/thumbnail/issue-2-page-15-thumbnail_large.jpg","mimeType":"image/jpg","filesize":221249,"filename":"issue-2-page-15-thumbnail_large.jpg"}]','general',2,1,NULL,0,'2025-11-23T00:25:14.571Z','2025-10-16T01:03:49.478Z','/api/media/file/issue-2-page-15.jpg',NULL,'issue-2-page-15.jpg','image/jpg',519527,1600,2626);
INSERT INTO "media" VALUES(8,NULL,NULL,'[{"name":"thumbnail","width":400,"height":657,"url":"/api/media/thumbnail/issue-2-page-17-thumbnail.jpg","mimeType":"image/jpg","filesize":66228,"filename":"issue-2-page-17-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":1313,"url":"/api/media/thumbnail/issue-2-page-17-thumbnail_large.jpg","mimeType":"image/jpg","filesize":225082,"filename":"issue-2-page-17-thumbnail_large.jpg"}]','general',2,1,NULL,0,'2025-11-23T00:25:14.521Z','2025-10-16T01:03:49.478Z','/api/media/file/issue-2-page-17.jpg',NULL,'issue-2-page-17.jpg','image/jpg',507786,1600,2626);
INSERT INTO "media" VALUES(9,NULL,NULL,'[{"name":"thumbnail","width":400,"height":657,"url":"/api/media/thumbnail/issue-2-page-19-thumbnail.jpg","mimeType":"image/jpg","filesize":52445,"filename":"issue-2-page-19-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":1313,"url":"/api/media/thumbnail/issue-2-page-19-thumbnail_large.jpg","mimeType":"image/jpg","filesize":178856,"filename":"issue-2-page-19-thumbnail_large.jpg"}]','general',2,1,NULL,0,'2025-11-23T00:25:14.470Z','2025-10-16T01:03:49.478Z','/api/media/file/issue-2-page-19.jpg',NULL,'issue-2-page-19.jpg','image/jpg',404446,1600,2626);
INSERT INTO "media" VALUES(10,NULL,NULL,'[{"name":"thumbnail","width":400,"height":657,"url":"/api/media/thumbnail/issue-3-page_1-thumbnail.jpg","mimeType":"image/jpg","filesize":59799,"filename":"issue-3-page_1-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":1313,"url":"/api/media/thumbnail/issue-3-page_1-thumbnail_large.jpg","mimeType":"image/jpg","filesize":203086,"filename":"issue-3-page_1-thumbnail_large.jpg"}]','general',2,1,NULL,0,'2025-11-23T00:25:14.422Z','2025-10-16T01:03:49.478Z','/api/media/file/issue-3-page_1.jpg',NULL,'issue-3-page_1.jpg','image/jpg',470115,1600,2626);
INSERT INTO "media" VALUES(11,NULL,NULL,'[{"name":"thumbnail","width":400,"height":657,"url":"/api/media/thumbnail/issue-3-page-3-thumbnail.jpg","mimeType":"image/jpg","filesize":67886,"filename":"issue-3-page-3-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":1313,"url":"/api/media/thumbnail/issue-3-page-3-thumbnail_large.jpg","mimeType":"image/jpg","filesize":220846,"filename":"issue-3-page-3-thumbnail_large.jpg"}]','comic_page',2,1,NULL,0,'2025-11-23T00:25:14.373Z','2025-10-16T01:03:49.478Z','/api/media/file/issue-3-page-3.jpg',NULL,'issue-3-page-3.jpg','image/jpg',496473,1600,2626);
INSERT INTO "media" VALUES(12,NULL,NULL,'[{"name":"thumbnail","width":400,"height":657,"url":"/api/media/thumbnail/issue-3-page-4-thumbnail.jpg","mimeType":"image/jpg","filesize":64425,"filename":"issue-3-page-4-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":1313,"url":"/api/media/thumbnail/issue-3-page-4-thumbnail_large.jpg","mimeType":"image/jpg","filesize":214231,"filename":"issue-3-page-4-thumbnail_large.jpg"}]','comic_page',2,1,NULL,0,'2025-11-23T00:25:14.323Z','2025-10-16T01:03:49.478Z','/api/media/file/issue-3-page-4.jpg',NULL,'issue-3-page-4.jpg','image/jpg',500997,1600,2626);
INSERT INTO "media" VALUES(13,NULL,NULL,'[{"name":"thumbnail","width":400,"height":657,"url":"/api/media/thumbnail/issue-3-page-5-thumbnail.jpg","mimeType":"image/jpg","filesize":71061,"filename":"issue-3-page-5-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":1313,"url":"/api/media/thumbnail/issue-3-page-5-thumbnail_large.jpg","mimeType":"image/jpg","filesize":236048,"filename":"issue-3-page-5-thumbnail_large.jpg"}]','comic_page',2,1,NULL,0,'2025-11-23T00:25:14.274Z','2025-10-16T01:03:49.478Z','/api/media/file/issue-3-page-5.jpg',NULL,'issue-3-page-5.jpg','image/jpg',537392,1600,2626);
INSERT INTO "media" VALUES(14,'Cover artwork for The Automan''s Daughter, chapter 1',NULL,'[{"name":"thumbnail","width":400,"height":616,"url":"/api/media/thumbnail/issue-1-cover-thumbnail.jpg","mimeType":"image/jpg","filesize":51575,"filename":"issue-1-cover-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":1232,"url":"/api/media/thumbnail/issue-1-cover-thumbnail_large.jpg","mimeType":"image/jpg","filesize":166175,"filename":"issue-1-cover-thumbnail_large.jpg"}]','comic_cover',2,1,NULL,0,'2025-11-23T00:25:14.224Z','2025-10-16T01:03:49.478Z','/api/media/file/issue-1-cover.jpg',NULL,'issue-1-cover.jpg','image/jpg',333480,1600,2464);
INSERT INTO "media" VALUES(15,'Three-panel sequence of Aisha Osman pushing her smoking monocycle along a desert highway',NULL,'[{"name":"thumbnail","width":400,"height":657,"url":"/api/media/thumbnail/issue-1-page_1-thumbnail.jpg","mimeType":"image/jpg","filesize":62739,"filename":"issue-1-page_1-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":1313,"url":"/api/media/thumbnail/issue-1-page_1-thumbnail_large.jpg","mimeType":"image/jpg","filesize":202037,"filename":"issue-1-page_1-thumbnail_large.jpg"}]','comic_page',2,1,NULL,0,'2025-11-23T00:25:14.178Z','2025-10-16T01:03:49.478Z','/api/media/file/issue-1-page_1.jpg',NULL,'issue-1-page_1.jpg','image/jpg',458389,1600,2626);
INSERT INTO "media" VALUES(16,'Siddig Khan floats in an inner tube and ignores the ringing of the suitcase phone floating in his swimming pool, which is mounted on top of his limousine, as it speeds down the highway.',NULL,'[{"name":"thumbnail","width":400,"height":657,"url":"/api/media/thumbnail/issue-1-page_3-thumbnail.jpg","mimeType":"image/jpg","filesize":50902,"filename":"issue-1-page_3-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":1313,"url":"/api/media/thumbnail/issue-1-page_3-thumbnail_large.jpg","mimeType":"image/jpg","filesize":172859,"filename":"issue-1-page_3-thumbnail_large.jpg"}]','comic_page',2,1,NULL,0,'2025-11-23T00:25:14.128Z','2025-10-16T01:03:49.478Z','/api/media/file/issue-1-page_3.jpg',NULL,'issue-1-page_3.jpg','image/jpg',406564,1600,2626);
INSERT INTO "media" VALUES(17,'The Automan''s Daughter 2025 promo artwork','The Automan''s Daughter 2025 promo artwork','[{"name":"thumbnail","width":400,"height":200,"url":"/api/media/thumbnail/2025 promo art-thumbnail.jpg","mimeType":"image/jpg","filesize":21890,"filename":"2025 promo art-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":400,"url":"/api/media/thumbnail/2025 promo art-thumbnail_large.jpg","mimeType":"image/jpg","filesize":66948,"filename":"2025 promo art-thumbnail_large.jpg"}]','general',2,1,NULL,0,'2025-11-23T00:25:14.077Z','2025-10-16T01:03:49.478Z','/api/media/file/2025%20promo%20art.jpg',NULL,'2025 promo art.jpg','image/jpg',4576983,6000,3000);
INSERT INTO "media" VALUES(18,'Aisha pulls off her goggles and squints into the distance. She sees a bar/fuel station up on top of a rocky hill.',NULL,'[{"name":"thumbnail","width":400,"height":657,"url":"/api/media/thumbnail/issue-1-page_2-thumbnail.jpg","mimeType":"image/jpg","filesize":46819,"filename":"issue-1-page_2-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":1313,"url":"/api/media/thumbnail/issue-1-page_2-thumbnail_large.jpg","mimeType":"image/jpg","filesize":153121,"filename":"issue-1-page_2-thumbnail_large.jpg"}]','comic_page',2,1,NULL,0,'2025-11-23T00:25:13.938Z','2025-10-16T01:03:49.478Z','/api/media/file/issue-1-page_2.jpg',NULL,'issue-1-page_2.jpg','image/jpg',344498,1600,2626);
INSERT INTO "media" VALUES(19,'Aisha makes a phone call from the wheeler bar. Ali, Sid''s chauffeur, tells Aisha he''s on his way.',NULL,'[{"name":"thumbnail","width":400,"height":657,"url":"/api/media/thumbnail/issue-1-page-4-thumbnail.jpg","mimeType":"image/jpg","filesize":70434,"filename":"issue-1-page-4-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":1313,"url":"/api/media/thumbnail/issue-1-page-4-thumbnail_large.jpg","mimeType":"image/jpg","filesize":228305,"filename":"issue-1-page-4-thumbnail_large.jpg"}]','comic_page',2,1,NULL,0,'2025-11-23T00:25:13.890Z','2025-10-16T01:03:49.478Z','/api/media/file/issue-1-page-4.jpg',NULL,'issue-1-page-4.jpg','image/jpg',514061,1600,2626);
INSERT INTO "media" VALUES(20,'This should be the same as the image''s alt text.',NULL,'[{"name":"thumbnail","width":400,"height":657,"url":"/api/media/thumbnail/issue-1-page_5-thumbnail.jpg","mimeType":"image/jpg","filesize":69960,"filename":"issue-1-page_5-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":1313,"url":"/api/media/thumbnail/issue-1-page_5-thumbnail_large.jpg","mimeType":"image/jpg","filesize":234382,"filename":"issue-1-page_5-thumbnail_large.jpg"}]','comic_page',2,1,NULL,0,'2025-11-23T00:25:13.833Z','2025-10-16T01:03:49.478Z','/api/media/file/issue-1-page_5.jpg',NULL,'issue-1-page_5.jpg','image/jpg',554985,1600,2626);
INSERT INTO "media" VALUES(21,'Aisha tumbles onto the ground just as the limo pulls up abruptly, dousing the wheelers with swimming-pool water.',NULL,'[{"name":"thumbnail","width":400,"height":657,"url":"/api/media/thumbnail/issue-1-page_6-thumbnail.jpg","mimeType":"image/jpg","filesize":68788,"filename":"issue-1-page_6-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":1313,"url":"/api/media/thumbnail/issue-1-page_6-thumbnail_large.jpg","mimeType":"image/jpg","filesize":226266,"filename":"issue-1-page_6-thumbnail_large.jpg"}]','comic_page',2,1,NULL,0,'2025-11-23T00:25:13.777Z','2025-10-16T01:03:49.478Z','/api/media/file/issue-1-page_6.jpg',NULL,'issue-1-page_6.jpg','image/jpg',516545,1600,2626);
INSERT INTO "media" VALUES(22,'Sid sits at the bottom of his limo pool, confused. The wheelers look ready to attack, when suddenly the limo begins to unfold...',NULL,'[{"name":"thumbnail","width":400,"height":657,"url":"/api/media/thumbnail/issue-1-page_7-thumbnail.jpg","mimeType":"image/jpg","filesize":64812,"filename":"issue-1-page_7-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":1313,"url":"/api/media/thumbnail/issue-1-page_7-thumbnail_large.jpg","mimeType":"image/jpg","filesize":214058,"filename":"issue-1-page_7-thumbnail_large.jpg"}]','comic_page',2,1,NULL,0,'2025-11-23T00:25:13.722Z','2025-10-16T01:03:49.478Z','/api/media/file/issue-1-page_7.jpg',NULL,'issue-1-page_7.jpg','image/jpg',472675,1600,2626);
INSERT INTO "media" VALUES(23,'The limo, now standing atop six mecha-legs, looms over Aisha and the wheelers. She looks over her shoulder at them, defiantly.',NULL,'[{"name":"thumbnail","width":400,"height":657,"url":"/api/media/thumbnail/issue-1-page_8-thumbnail.jpg","mimeType":"image/jpg","filesize":49373,"filename":"issue-1-page_8-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":1313,"url":"/api/media/thumbnail/issue-1-page_8-thumbnail_large.jpg","mimeType":"image/jpg","filesize":191218,"filename":"issue-1-page_8-thumbnail_large.jpg"}]','comic_page',2,1,NULL,0,'2025-11-23T00:25:13.667Z','2025-10-16T01:03:49.478Z','/api/media/file/issue-1-page_8.jpg',NULL,'issue-1-page_8.jpg','image/jpg',523644,1600,2626);
INSERT INTO "media" VALUES(24,'The wheelers run off. Ali asks Aisha if she needs a ride. "Yes," she replies meekly.',NULL,'[{"name":"thumbnail","width":400,"height":657,"url":"/api/media/thumbnail/issue-1-page_9-thumbnail.jpg","mimeType":"image/jpg","filesize":66706,"filename":"issue-1-page_9-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":1313,"url":"/api/media/thumbnail/issue-1-page_9-thumbnail_large.jpg","mimeType":"image/jpg","filesize":223544,"filename":"issue-1-page_9-thumbnail_large.jpg"}]','comic_page',2,1,NULL,0,'2025-11-23T00:25:13.610Z','2025-10-16T01:03:49.478Z','/api/media/file/issue-1-page_9.jpg',NULL,'issue-1-page_9.jpg','image/jpg',517220,1600,2626);
INSERT INTO "media" VALUES(25,'A vest-clad Sid stares directly down the barrel of a gigantic cannon aimed at him.',NULL,'[{"name":"thumbnail","width":400,"height":616,"url":"/api/media/thumbnail/issue-2-cover-thumbnail.jpg","mimeType":"image/jpg","filesize":52899,"filename":"issue-2-cover-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":1232,"url":"/api/media/thumbnail/issue-2-cover-thumbnail_large.jpg","mimeType":"image/jpg","filesize":168364,"filename":"issue-2-cover-thumbnail_large.jpg"}]','comic_page',2,1,NULL,0,'2025-11-23T00:25:13.558Z','2025-10-16T01:03:49.478Z','/api/media/file/issue-2-cover.jpg',NULL,'issue-2-cover.jpg','image/jpg',337910,1600,2464);
INSERT INTO "media" VALUES(26,'Sid has a flashback to a small hand wiping away his tears, then awakens in the limo with a start.',NULL,'[{"name":"thumbnail","width":400,"height":657,"url":"/api/media/thumbnail/issue-2-page-1-thumbnail.jpg","mimeType":"image/jpg","filesize":50818,"filename":"issue-2-page-1-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":1313,"url":"/api/media/thumbnail/issue-2-page-1-thumbnail_large.jpg","mimeType":"image/jpg","filesize":170792,"filename":"issue-2-page-1-thumbnail_large.jpg"}]','comic_page',2,1,NULL,0,'2025-11-23T00:25:13.510Z','2025-10-16T01:03:49.478Z','/api/media/file/issue-2-page-1.jpg',NULL,'issue-2-page-1.jpg','image/jpg',411571,1600,2626);
INSERT INTO "media" VALUES(27,'Ali, Sid and Aisha exit the limo, having arrived at their destination.',NULL,'[{"name":"thumbnail","width":400,"height":657,"url":"/api/media/thumbnail/issue-2-page-2-thumbnail.jpg","mimeType":"image/jpg","filesize":51978,"filename":"issue-2-page-2-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":1313,"url":"/api/media/thumbnail/issue-2-page-2-thumbnail_large.jpg","mimeType":"image/jpg","filesize":174490,"filename":"issue-2-page-2-thumbnail_large.jpg"}]','comic_page',2,1,NULL,0,'2025-11-23T00:25:13.460Z','2025-10-16T01:03:49.478Z','/api/media/file/issue-2-page-2.jpg',NULL,'issue-2-page-2.jpg','image/jpg',393472,1600,2626);
INSERT INTO "media" VALUES(28,NULL,NULL,'[{"name":"thumbnail","width":400,"height":657,"url":"/api/media/thumbnail/issue-2-page-3-thumbnail.jpg","mimeType":"image/jpg","filesize":64811,"filename":"issue-2-page-3-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":1313,"url":"/api/media/thumbnail/issue-2-page-3-thumbnail_large.jpg","mimeType":"image/jpg","filesize":218889,"filename":"issue-2-page-3-thumbnail_large.jpg"}]','comic_page',2,1,NULL,0,'2025-11-23T00:25:13.413Z','2025-10-16T01:03:49.478Z','/api/media/file/issue-2-page-3.jpg',NULL,'issue-2-page-3.jpg','image/jpg',493900,1600,2626);
INSERT INTO "media" VALUES(29,NULL,NULL,'[{"name":"thumbnail","width":400,"height":657,"url":"/api/media/thumbnail/issue-2-page-4-thumbnail.jpg","mimeType":"image/jpg","filesize":67702,"filename":"issue-2-page-4-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":1313,"url":"/api/media/thumbnail/issue-2-page-4-thumbnail_large.jpg","mimeType":"image/jpg","filesize":231266,"filename":"issue-2-page-4-thumbnail_large.jpg"}]','comic_page',2,1,NULL,0,'2025-11-23T00:25:13.354Z','2025-10-16T01:03:49.478Z','/api/media/file/issue-2-page-4.jpg',NULL,'issue-2-page-4.jpg','image/jpg',524969,1600,2626);
INSERT INTO "media" VALUES(30,NULL,NULL,'[{"name":"thumbnail","width":400,"height":200,"url":"/api/media/thumbnail/2025 promo-thumbnail.jpg","mimeType":"image/jpg","filesize":21910,"filename":"2025 promo-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":400,"url":"/api/media/thumbnail/2025 promo-thumbnail_large.jpg","mimeType":"image/jpg","filesize":67067,"filename":"2025 promo-thumbnail_large.jpg"}]','comic_cover',2,1,NULL,0,'2025-11-23T00:25:13.297Z','2025-10-16T01:03:49.478Z','/api/media/file/2025%20promo.jpg',NULL,'2025 promo.jpg','image/jpg',995322,3000,1500);
INSERT INTO "media" VALUES(31,NULL,NULL,'[{"name":"thumbnail","width":400,"height":400,"url":"/api/media/thumbnail/2025 promo art square-thumbnail.jpg","mimeType":"image/jpg","filesize":37086,"filename":"2025 promo art square-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":800,"url":"/api/media/thumbnail/2025 promo art square-thumbnail_large.jpg","mimeType":"image/jpg","filesize":114548,"filename":"2025 promo art square-thumbnail_large.jpg"}]','comic_cover',2,1,NULL,0,'2025-11-23T00:25:13.241Z','2025-10-16T01:03:49.478Z','/api/media/file/2025%20promo%20art%20square.jpg',NULL,'2025 promo art square.jpg','image/jpg',855523,2000,2000);
INSERT INTO "media" VALUES(32,NULL,NULL,'[{"name":"thumbnail","width":400,"height":656,"url":"/api/media/thumbnail/issue-2-page-5-thumbnail.jpg","mimeType":"image/jpg","filesize":63751,"filename":"issue-2-page-5-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":1313,"url":"/api/media/thumbnail/issue-2-page-5-thumbnail_large.jpg","mimeType":"image/jpg","filesize":202515,"filename":"issue-2-page-5-thumbnail_large.jpg"}]','general',2,1,NULL,0,'2025-11-23T00:25:13.180Z','2025-10-16T01:03:49.478Z','/api/media/file/issue-2-page-5.jpg',NULL,'issue-2-page-5.jpg','image/jpg',630917,1360,2232);
INSERT INTO "media" VALUES(33,NULL,NULL,'[{"name":"thumbnail","width":400,"height":656,"url":"/api/media/thumbnail/issue-2-page-6-thumbnail.jpg","mimeType":"image/jpg","filesize":63751,"filename":"issue-2-page-6-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":1313,"url":"/api/media/thumbnail/issue-2-page-6-thumbnail_large.jpg","mimeType":"image/jpg","filesize":202515,"filename":"issue-2-page-6-thumbnail_large.jpg"}]','general',2,1,NULL,0,'2025-11-23T00:25:13.123Z','2025-10-16T01:03:49.478Z','/api/media/file/issue-2-page-6.jpg',NULL,'issue-2-page-6.jpg','image/jpg',630917,1360,2232);
INSERT INTO "media" VALUES(34,NULL,NULL,'[{"name":"thumbnail","width":400,"height":656,"url":"/api/media/thumbnail/issue-2-page-7-thumbnail.jpg","mimeType":"image/jpg","filesize":63751,"filename":"issue-2-page-7-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":1313,"url":"/api/media/thumbnail/issue-2-page-7-thumbnail_large.jpg","mimeType":"image/jpg","filesize":202515,"filename":"issue-2-page-7-thumbnail_large.jpg"}]','general',2,1,NULL,0,'2025-11-23T00:25:13.066Z','2025-10-16T01:03:49.478Z','/api/media/file/issue-2-page-7.jpg',NULL,'issue-2-page-7.jpg','image/jpg',630917,1360,2232);
INSERT INTO "media" VALUES(35,NULL,NULL,'[{"name":"thumbnail","width":400,"height":656,"url":"/api/media/thumbnail/issue-2-page-8-thumbnail.jpg","mimeType":"image/jpg","filesize":63751,"filename":"issue-2-page-8-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":1313,"url":"/api/media/thumbnail/issue-2-page-8-thumbnail_large.jpg","mimeType":"image/jpg","filesize":202515,"filename":"issue-2-page-8-thumbnail_large.jpg"}]','general',2,1,NULL,0,'2025-11-23T00:25:13.008Z','2025-10-16T01:03:49.478Z','/api/media/file/issue-2-page-8.jpg',NULL,'issue-2-page-8.jpg','image/jpg',630917,1360,2232);
INSERT INTO "media" VALUES(36,NULL,NULL,'[{"name":"thumbnail","width":400,"height":657,"url":"/api/media/thumbnail/issue-2-page-9-thumbnail.jpg","mimeType":"image/jpg","filesize":69093,"filename":"issue-2-page-9-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":1313,"url":"/api/media/thumbnail/issue-2-page-9-thumbnail_large.jpg","mimeType":"image/jpg","filesize":222769,"filename":"issue-2-page-9-thumbnail_large.jpg"}]','general',2,1,NULL,0,'2025-11-23T00:25:12.953Z','2025-10-16T01:03:49.478Z','/api/media/file/issue-2-page-9.jpg',NULL,'issue-2-page-9.jpg','image/jpg',499801,1600,2626);
INSERT INTO "media" VALUES(37,NULL,NULL,'[{"name":"thumbnail","width":400,"height":657,"url":"/api/media/thumbnail/issue-2-page-10-thumbnail.jpg","mimeType":"image/jpg","filesize":58648,"filename":"issue-2-page-10-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":1313,"url":"/api/media/thumbnail/issue-2-page-10-thumbnail_large.jpg","mimeType":"image/jpg","filesize":201471,"filename":"issue-2-page-10-thumbnail_large.jpg"}]','general',2,1,NULL,0,'2025-11-23T00:25:12.896Z','2025-10-16T01:03:49.478Z','/api/media/file/issue-2-page-10.jpg',NULL,'issue-2-page-10.jpg','image/jpg',456729,1600,2626);
INSERT INTO "media" VALUES(38,NULL,NULL,'[{"name":"thumbnail","width":400,"height":656,"url":"/api/media/thumbnail/issue-2-page-11-thumbnail.jpg","mimeType":"image/jpg","filesize":63751,"filename":"issue-2-page-11-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":1313,"url":"/api/media/thumbnail/issue-2-page-11-thumbnail_large.jpg","mimeType":"image/jpg","filesize":202515,"filename":"issue-2-page-11-thumbnail_large.jpg"}]','general',2,1,NULL,0,'2025-11-23T00:25:12.839Z','2025-10-16T01:03:49.478Z','/api/media/file/issue-2-page-11.jpg',NULL,'issue-2-page-11.jpg','image/jpg',630917,1360,2232);
INSERT INTO "media" VALUES(39,NULL,NULL,'[{"name":"thumbnail","width":1,"height":1,"url":"/api/media/thumbnail/dot-thumbnail.gif","mimeType":"image/gif","filesize":49,"filename":"dot-thumbnail.gif"},{"name":"thumbnail_large","width":1,"height":1,"url":"/api/media/thumbnail/dot-thumbnail_large.gif","mimeType":"image/gif","filesize":49,"filename":"dot-thumbnail_large.gif"}]','website_asset',2,1,NULL,0,'2025-11-23T00:25:12.782Z','2025-10-16T01:03:49.478Z','/api/media/file/dot.gif',NULL,'dot.gif','image/gif',49,1,1);
INSERT INTO "media" VALUES(40,NULL,NULL,'[{"name":"thumbnail","width":400,"height":657,"url":"/api/media/thumbnail/issue-2-page-12-thumbnail.jpg","mimeType":"image/jpg","filesize":69093,"filename":"issue-2-page-12-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":1313,"url":"/api/media/thumbnail/issue-2-page-12-thumbnail_large.jpg","mimeType":"image/jpg","filesize":222769,"filename":"issue-2-page-12-thumbnail_large.jpg"}]','general',2,1,NULL,0,'2025-11-23T00:25:12.760Z','2025-10-16T01:03:49.478Z','/api/media/file/issue-2-page-12.jpg',NULL,'issue-2-page-12.jpg','image/jpg',499801,1600,2626);
INSERT INTO "media" VALUES(41,NULL,NULL,'[{"name":"thumbnail","width":400,"height":657,"url":"/api/media/thumbnail/issue-2-page-13-thumbnail.jpg","mimeType":"image/jpg","filesize":58648,"filename":"issue-2-page-13-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":1313,"url":"/api/media/thumbnail/issue-2-page-13-thumbnail_large.jpg","mimeType":"image/jpg","filesize":201471,"filename":"issue-2-page-13-thumbnail_large.jpg"}]','general',2,1,NULL,0,'2025-11-23T00:25:12.700Z','2025-10-16T01:03:49.478Z','/api/media/file/issue-2-page-13.jpg',NULL,'issue-2-page-13.jpg','image/jpg',456729,1600,2626);
INSERT INTO "media" VALUES(42,NULL,NULL,'[{"name":"thumbnail","width":400,"height":657,"url":"/api/media/thumbnail/issue-2-page-14-thumbnail.jpg","mimeType":"image/jpg","filesize":63369,"filename":"issue-2-page-14-thumbnail.jpg"},{"name":"thumbnail_large","width":800,"height":1313,"url":"/api/media/thumbnail/issue-2-page-14-thumbnail_large.jpg","mimeType":"image/jpg","filesize":221249,"filename":"issue-2-page-14-thumbnail_large.jpg"}]','general',2,1,NULL,0,'2025-11-23T00:25:12.638Z','2025-10-16T01:03:49.478Z','/api/media/file/issue-2-page-14.jpg',NULL,'issue-2-page-14.jpg','image/jpg',519527,1600,2626);
CREATE TABLE `payload_locked_documents` (
  	`id` integer PRIMARY KEY NOT NULL,
  	`global_slug` text,
  	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
CREATE TABLE `payload_locked_documents_rels` (
  	`id` integer PRIMARY KEY NOT NULL,
  	`order` integer,
  	`parent_id` integer NOT NULL,
  	`path` text NOT NULL,
  	`users_id` integer,
  	`comics_id` integer,
  	`chapters_id` integer,
  	`pages_id` integer,
  	`media_id` integer,
  	FOREIGN KEY (`parent_id`) REFERENCES `payload_locked_documents`(`id`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (`users_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (`comics_id`) REFERENCES `comics`(`id`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (`chapters_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (`pages_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE cascade
  );
CREATE TABLE `payload_preferences` (
  	`id` integer PRIMARY KEY NOT NULL,
  	`key` text,
  	`value` text,
  	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
INSERT INTO "payload_preferences" VALUES(1,'collection-comics','{"editViewType":"default"}','2025-11-22T21:35:03.048Z','2025-11-22T21:35:01.970Z');
INSERT INTO "payload_preferences" VALUES(2,'collection-users','{}','2025-11-22T21:35:05.223Z','2025-11-22T21:35:05.223Z');
INSERT INTO "payload_preferences" VALUES(3,'collection-pages','{"editViewType":"default"}','2025-11-22T21:35:17.499Z','2025-11-22T21:35:16.182Z');
INSERT INTO "payload_preferences" VALUES(4,'collection-media','{"editViewType":"default"}','2025-11-22T21:35:27.138Z','2025-11-22T21:35:24.765Z');
CREATE TABLE `payload_preferences_rels` (
  	`id` integer PRIMARY KEY NOT NULL,
  	`order` integer,
  	`parent_id` integer NOT NULL,
  	`path` text NOT NULL,
  	`users_id` integer,
  	FOREIGN KEY (`parent_id`) REFERENCES `payload_preferences`(`id`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (`users_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
  );
INSERT INTO "payload_preferences_rels" VALUES(1,NULL,1,'user',1);
INSERT INTO "payload_preferences_rels" VALUES(2,NULL,2,'user',1);
INSERT INTO "payload_preferences_rels" VALUES(3,NULL,3,'user',1);
INSERT INTO "payload_preferences_rels" VALUES(4,NULL,4,'user',1);
CREATE TABLE `payload_migrations` (
  	`id` integer PRIMARY KEY NOT NULL,
  	`name` text,
  	`batch` numeric,
  	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
INSERT INTO "payload_migrations" VALUES(1,'20251015_031439_complete_schema',1,'2025-11-23T22:18:28.143Z','2025-11-23T22:18:28.142Z');
INSERT INTO "payload_migrations" VALUES(2,'20251122_165441',1,'2025-11-23T22:18:29.614Z','2025-11-23T22:18:29.614Z');
CREATE INDEX `users_sessions_order_idx` ON `users_sessions` (`_order`);
CREATE INDEX `users_sessions_parent_id_idx` ON `users_sessions` (`_parent_id`);
CREATE INDEX `users_updated_at_idx` ON `users` (`updated_at`);
CREATE INDEX `users_created_at_idx` ON `users` (`created_at`);
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);
CREATE INDEX `comics_credits_order_idx` ON `comics_credits` (`_order`);
CREATE INDEX `comics_credits_parent_id_idx` ON `comics_credits` (`_parent_id`);
CREATE INDEX `comics_genres_order_idx` ON `comics_genres` (`order`);
CREATE INDEX `comics_genres_parent_idx` ON `comics_genres` (`parent_id`);
CREATE UNIQUE INDEX `comics_slug_idx` ON `comics` (`slug`);
CREATE INDEX `comics_author_idx` ON `comics` (`author_id`);
CREATE INDEX `comics_cover_image_idx` ON `comics` (`cover_image_id`);
CREATE INDEX `comics_seo_meta_seo_meta_social_image_idx` ON `comics` (`seo_meta_social_image_id`);
CREATE INDEX `comics_updated_at_idx` ON `comics` (`updated_at`);
CREATE INDEX `comics_created_at_idx` ON `comics` (`created_at`);
CREATE INDEX `comics_texts_order_parent_idx` ON `comics_texts` (`order`,`parent_id`);
CREATE INDEX `chapters_comic_idx` ON `chapters` (`comic_id`);
CREATE INDEX `chapters_updated_at_idx` ON `chapters` (`updated_at`);
CREATE INDEX `chapters_created_at_idx` ON `chapters` (`created_at`);
CREATE INDEX `pages_page_extra_images_order_idx` ON `pages_page_extra_images` (`_order`);
CREATE INDEX `pages_page_extra_images_parent_id_idx` ON `pages_page_extra_images` (`_parent_id`);
CREATE INDEX `pages_page_extra_images_image_idx` ON `pages_page_extra_images` (`image_id`);
CREATE INDEX `pages_comic_idx` ON `pages` (`comic_id`);
CREATE INDEX `pages_chapter_idx` ON `pages` (`chapter_id`);
CREATE INDEX `pages_page_image_idx` ON `pages` (`page_image_id`);
CREATE INDEX `pages_thumbnail_image_idx` ON `pages` (`thumbnail_image_id`);
CREATE INDEX `pages_navigation_navigation_previous_page_idx` ON `pages` (`navigation_previous_page_id`);
CREATE INDEX `pages_navigation_navigation_next_page_idx` ON `pages` (`navigation_next_page_id`);
CREATE INDEX `pages_updated_at_idx` ON `pages` (`updated_at`);
CREATE INDEX `pages_created_at_idx` ON `pages` (`created_at`);
CREATE INDEX `media_uploaded_by_idx` ON `media` (`uploaded_by_id`);
CREATE INDEX `media_comic_meta_comic_meta_related_comic_idx` ON `media` (`comic_meta_related_comic_id`);
CREATE INDEX `media_updated_at_idx` ON `media` (`updated_at`);
CREATE INDEX `media_created_at_idx` ON `media` (`created_at`);
CREATE UNIQUE INDEX `media_filename_idx` ON `media` (`filename`);
CREATE INDEX `payload_locked_documents_global_slug_idx` ON `payload_locked_documents` (`global_slug`);
CREATE INDEX `payload_locked_documents_updated_at_idx` ON `payload_locked_documents` (`updated_at`);
CREATE INDEX `payload_locked_documents_created_at_idx` ON `payload_locked_documents` (`created_at`);
CREATE INDEX `payload_locked_documents_rels_order_idx` ON `payload_locked_documents_rels` (`order`);
CREATE INDEX `payload_locked_documents_rels_parent_idx` ON `payload_locked_documents_rels` (`parent_id`);
CREATE INDEX `payload_locked_documents_rels_path_idx` ON `payload_locked_documents_rels` (`path`);
CREATE INDEX `payload_locked_documents_rels_users_id_idx` ON `payload_locked_documents_rels` (`users_id`);
CREATE INDEX `payload_locked_documents_rels_comics_id_idx` ON `payload_locked_documents_rels` (`comics_id`);
CREATE INDEX `payload_locked_documents_rels_chapters_id_idx` ON `payload_locked_documents_rels` (`chapters_id`);
CREATE INDEX `payload_locked_documents_rels_pages_id_idx` ON `payload_locked_documents_rels` (`pages_id`);
CREATE INDEX `payload_locked_documents_rels_media_id_idx` ON `payload_locked_documents_rels` (`media_id`);
CREATE INDEX `payload_preferences_key_idx` ON `payload_preferences` (`key`);
CREATE INDEX `payload_preferences_updated_at_idx` ON `payload_preferences` (`updated_at`);
CREATE INDEX `payload_preferences_created_at_idx` ON `payload_preferences` (`created_at`);
CREATE INDEX `payload_preferences_rels_order_idx` ON `payload_preferences_rels` (`order`);
CREATE INDEX `payload_preferences_rels_parent_idx` ON `payload_preferences_rels` (`parent_id`);
CREATE INDEX `payload_preferences_rels_path_idx` ON `payload_preferences_rels` (`path`);
CREATE INDEX `payload_preferences_rels_users_id_idx` ON `payload_preferences_rels` (`users_id`);
CREATE INDEX `payload_migrations_updated_at_idx` ON `payload_migrations` (`updated_at`);
CREATE INDEX `payload_migrations_created_at_idx` ON `payload_migrations` (`created_at`);
