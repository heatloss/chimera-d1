/**
 * Direct test of Drizzle ORM DELETE with D1
 * Tests if upgrading to 0.44.7 fixes the DELETE bug
 */

import { getPayload } from 'payload'
import config from '../src/payload.config.js'

async function testDrizzleDelete() {
  console.log('🧪 Testing Drizzle ORM 0.44.7 DELETE behavior\n')

  const payload = await getPayload({ config })

  try {
    // Step 1: Create a test page
    console.log('Step 1: Creating test page...')
    const created = await payload.create({
      collection: 'pages',
      data: {
        comic: 1,
        chapter: 1,
        chapterPageNumber: 99999,
        title: 'DRIZZLE DELETE TEST',
        status: 'draft',
      },
    })
    const testId = created.id
    console.log(`✅ Created page ID: ${testId}\n`)

    // Step 2: Verify it exists in D1
    console.log('Step 2: Verifying in database...')
    const db = payload.db
    // @ts-expect-error - accessing internal drizzle instance
    const beforeCheck = await db.drizzle.run(`SELECT id, title FROM pages WHERE id = ${testId}`)
    console.log('Before delete:', JSON.stringify(beforeCheck, null, 2))

    // Step 3: Delete via Payload (uses Drizzle ORM)
    console.log('\nStep 3: Deleting via Payload API (Drizzle ORM)...')
    const deleteResult = await payload.delete({
      collection: 'pages',
      id: testId,
    })
    console.log('Delete result:', JSON.stringify(deleteResult, null, 2))

    // Step 4: Check if actually deleted from D1
    console.log('\nStep 4: Checking if actually deleted from D1...')
    // @ts-expect-error - accessing internal drizzle instance
    const afterCheck = await db.drizzle.run(`SELECT id, title FROM pages WHERE id = ${testId}`)
    console.log('After delete:', JSON.stringify(afterCheck, null, 2))

    // Parse results
    const resultsArray = (afterCheck as any).results || afterCheck
    const stillExists = resultsArray && resultsArray.length > 0

    console.log('\n' + '='.repeat(60))
    if (stillExists) {
      console.log('❌ BUG STILL EXISTS: Record not deleted')
      console.log('Drizzle 0.44.7 did NOT fix the issue')
    } else {
      console.log('✅ SUCCESS: Record was actually deleted!')
      console.log('Drizzle 0.44.7 appears to have fixed the issue')
    }
    console.log('='.repeat(60))

    process.exit(stillExists ? 1 : 0)
  } catch (error) {
    console.error('\n❌ Test failed with error:', error)
    process.exit(1)
  }
}

testDrizzleDelete()
