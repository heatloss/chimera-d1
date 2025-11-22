// Commented out - this migration was already applied to the database
// import * as migration_20251015_031439_complete_schema from './20251015_031439_complete_schema';
import * as migration_20251122_165441 from './20251122_165441';

export const migrations = [
  // Removed - already applied
  // {
  //   up: migration_20251015_031439_complete_schema.up,
  //   down: migration_20251015_031439_complete_schema.down,
  //   name: '20251015_031439_complete_schema',
  // },
  {
    up: migration_20251122_165441.up,
    down: migration_20251122_165441.down,
    name: '20251122_165441'
  },
];
