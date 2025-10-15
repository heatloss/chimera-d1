import * as migration_20250929_111647 from './20250929_111647';
import * as migration_20251014_180231 from './20251014_180231';

export const migrations = [
  {
    up: migration_20250929_111647.up,
    down: migration_20250929_111647.down,
    name: '20250929_111647',
  },
  {
    up: migration_20251014_180231.up,
    down: migration_20251014_180231.down,
    name: '20251014_180231'
  },
];
