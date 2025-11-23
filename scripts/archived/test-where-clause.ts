#!/usr/bin/env tsx
/**
 * Test where clause functionality with minimal test collection
 */

import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'

async function main() {
  console.log('🧪 Testing where clause functionality\n')

  const payload = await getPayload({ config })

  try {
    // First, test simple query without where clause
    console.log('1️⃣  Testing simple query (no where clause)...')
    const simpleQuery = await payload.find({
      collection: 'chapters',
      limit: 3,
    })
    console.log(`✅ Simple query works: Found ${simpleQuery.totalDocs} chapters\n`)

    // Test where clause on comic relationship
    console.log('2️⃣  Testing where clause on comic relationship...')
    console.log('   Query: where[comic][equals]=1')

    const startTime = Date.now()
    const timeout = setTimeout(() => {
      console.log(`❌ Query is hanging (> 5 seconds)`)
      console.log(`   This confirms the where clause bug exists\n`)
      process.exit(1)
    }, 5000)

    const whereQuery = await payload.find({
      collection: 'chapters',
      where: {
        comic: {
          equals: 1
        }
      },
      limit: 10,
    })

    clearTimeout(timeout)
    const elapsed = Date.now() - startTime
    console.log(`✅ Where clause works! Found ${whereQuery.totalDocs} chapters in ${elapsed}ms\n`)

  } catch (error) {
    console.error('❌ Test failed:', error)
    throw error
  } finally {
    await payload.db.drizzle.$client.close()
  }
}

main()
