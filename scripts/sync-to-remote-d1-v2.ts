#!/usr/bin/env tsx
/**
 * Sync local D1 database to remote D1
 * Exports local database and imports to remote using wrangler execute
 */

import Database from 'better-sqlite3'
import { execa } from 'execa'
import fs from 'fs'

const LOCAL_DB = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/71ea17b93de1684d034c11957d24f940ab865936bf90542392bf0517b4af1470.sqlite'
const D1_DATABASE = 'chimera-d1'

async function executeRemote(sql: string): Promise<void> {
  const { stdout, stderr } = await execa('pnpm', [
    'wrangler',
    'd1',
    'execute',
    D1_DATABASE,
    '--remote',
    `--command=${sql}`
  ], { stdio: 'pipe' })

  if (stderr && !stderr.includes('wrangler') && !stderr.includes('Executing on remote')) {
    console.error('Error:', stderr)
    throw new Error(`Failed to execute: ${stderr}`)
  }
}

async function main() {
  console.log('📦 Syncing local D1 database to remote...\n')

  const db = new Database(LOCAL_DB, { readonly: true })

  // Get all table names (excluding internal tables)
  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table'
    AND name NOT LIKE 'sqlite_%'
    AND name NOT LIKE '_cf_%'
    ORDER BY name
  `).all() as { name: string }[]

  console.log(`Found ${tables.length} tables to sync\n`)

  for (const { name: tableName } of tables) {
    console.log(`[${tableName}]`)

    // Get table schema
    const schema = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`).get(tableName) as { sql: string } | undefined

    if (!schema) {
      console.log(`  ⚠️  No schema found`)
      continue
    }

    // Check if table exists on remote
    try {
      await executeRemote(`SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`)
      console.log(`  ℹ️  Table already exists on remote`)
    } catch (error) {
      // Table doesn't exist, create it
      console.log(`  📝 Creating table...`)
      try {
        await executeRemote(schema.sql)
        console.log(`  ✓ Table created`)
      } catch (err) {
        console.log(`  ⚠️  Failed to create table:`, err instanceof Error ? err.message : err)
        continue
      }
    }

    // Get row count
    const count = db.prepare(`SELECT COUNT(*) as count FROM "${tableName}"`).get() as { count: number }

    if (count.count === 0) {
      console.log(`  ℹ️  No data to sync`)
      continue
    }

    console.log(`  📊 ${count.count} rows to sync`)

    // Get all rows
    const rows = db.prepare(`SELECT * FROM "${tableName}"`).all()

    // Get column names
    const columns = db.prepare(`PRAGMA table_info("${tableName}")`).all() as { name: string }[]
    const columnNames = columns.map(c => c.name)

    // Clear existing data on remote (if any)
    try {
      await executeRemote(`DELETE FROM "${tableName}"`)
    } catch (error) {
      // Ignore errors if table is empty
    }

    // Insert in batches
    const BATCH_SIZE = 10
    let inserted = 0

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE)

      const values = batch.map(row => {
        const vals = columnNames.map(col => {
          const val = (row as any)[col]
          if (val === null || val === undefined) return 'NULL'
          if (typeof val === 'number') return val
          // Escape single quotes in strings
          return `'${String(val).replace(/'/g, "''")}'`
        })
        return `(${vals.join(',')})`
      })

      const insertSQL = `INSERT INTO "${tableName}" (${columnNames.map(c => `"${c}"`).join(',')}) VALUES ${values.join(',')};`

      try {
        await executeRemote(insertSQL)
        inserted += batch.length
        process.stdout.write(`\r  📤 Inserted ${inserted}/${rows.length} rows`)
      } catch (error) {
        console.error(`\n  ✗ Failed to insert batch:`, error instanceof Error ? error.message : error)
      }
    }

    console.log(`\n  ✅ Synced ${inserted} rows\n`)
  }

  db.close()

  console.log('\n✅ Sync complete!\n')

  // Verify
  console.log('Verifying remote database...')
  const { stdout } = await execa('pnpm', [
    'wrangler',
    'd1',
    'execute',
    D1_DATABASE,
    '--remote',
    '--command=SELECT (SELECT COUNT(*) FROM users) as users, (SELECT COUNT(*) FROM comics) as comics, (SELECT COUNT(*) FROM chapters) as chapters, (SELECT COUNT(*) FROM pages) as pages, (SELECT COUNT(*) FROM media) as media;'
  ], { stdio: 'pipe' })

  console.log(stdout)
}

main().catch(console.error)
