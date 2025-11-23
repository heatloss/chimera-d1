-- Drop all tables from remote database to prepare for fresh import
-- This drops tables in reverse dependency order to avoid foreign key conflicts

PRAGMA foreign_keys = OFF;

-- Drop relation tables first
DROP TABLE IF EXISTS payload_preferences_rels;
DROP TABLE IF EXISTS payload_locked_documents_rels;
DROP TABLE IF EXISTS pages_page_extra_images;
DROP TABLE IF EXISTS comics_texts;
DROP TABLE IF EXISTS comics_genres;
DROP TABLE IF EXISTS comics_credits;
DROP TABLE IF EXISTS users_sessions;

-- Drop main tables
DROP TABLE IF EXISTS pages;
DROP TABLE IF EXISTS chapters;
DROP TABLE IF EXISTS media;
DROP TABLE IF EXISTS comics;
DROP TABLE IF EXISTS users;

-- Drop system tables
DROP TABLE IF EXISTS payload_preferences;
DROP TABLE IF EXISTS payload_locked_documents;
DROP TABLE IF EXISTS payload_migrations;
DROP TABLE IF EXISTS _cf_KV;

PRAGMA foreign_keys = ON;
