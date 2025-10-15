import * as migration_20251015_031439_complete_schema from './20251015_031439_complete_schema';

export const migrations = [
  {
    up: migration_20251015_031439_complete_schema.up,
    down: migration_20251015_031439_complete_schema.down,
    name: '20251015_031439_complete_schema'
  },
];
