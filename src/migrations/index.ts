import * as migration_20251015_031439_complete_schema from './20251015_031439_complete_schema';
import * as migration_20251122_165441 from './20251122_165441';
import * as migration_20251215_genres_tags_collections from './20251215_genres_tags_collections';

export const migrations = [
  {
    up: migration_20251015_031439_complete_schema.up,
    down: migration_20251015_031439_complete_schema.down,
    name: '20251015_031439_complete_schema',
  },
  {
    up: migration_20251122_165441.up,
    down: migration_20251122_165441.down,
    name: '20251122_165441',
  },
  {
    up: migration_20251215_genres_tags_collections.up,
    down: migration_20251215_genres_tags_collections.down,
    name: '20251215_genres_tags_collections',
  },
];
