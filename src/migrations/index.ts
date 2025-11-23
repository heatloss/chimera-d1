import * as migration_20251015_031439_complete_schema from './20251015_031439_complete_schema';
import * as migration_20251122_165441 from './20251122_165441';
import * as migration_20251123_150728_test_items from './20251123_150728_test_items';

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
    up: migration_20251123_150728_test_items.up,
    down: migration_20251123_150728_test_items.down,
    name: '20251123_150728_test_items'
  },
];
