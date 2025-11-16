import * as migration_20251116_210928 from './20251116_210928';

export const migrations = [
  {
    up: migration_20251116_210928.up,
    down: migration_20251116_210928.down,
    name: '20251116_210928'
  },
];
