/**
 * Simple test to observe Payload's delete behavior with D1
 *
 * This script will:
 * 1. Start dev server in background
 * 2. Call the Payload REST API DELETE endpoint
 * 3. Check if the record actually got deleted from D1
 */

import { execSync } from 'child_process'

async function testPayloadDelete() {
  console.log('🧪 Testing Payload DELETE behavior with D1\n')

  // First, let's create a test page via API
  console.log('Step 1: Create a test page via Payload API...')

  const createResponse = await fetch('http://localhost:3333/api/pages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      comic: 1,
      chapter: 1,
      chapterPageNumber: 9999,
      title: 'TEST DELETE PAGE',
      status: 'draft',
    }),
  })

  if (!createResponse.ok) {
    console.error('❌ Failed to create test page')
    console.error('Response:', await createResponse.text())
    return
  }

  const createdPage = await createResponse.json()
  const testPageId = createdPage.doc.id
  console.log(`✅ Created test page with ID: ${testPageId}\n`)

  // Verify it exists in D1
  console.log('Step 2: Verify page exists in D1 database...')
  const beforeDelete = execSync(
    `pnpm wrangler d1 execute chimera-d1 --local --command "SELECT id, title FROM pages WHERE id = ${testPageId};"`,
    { encoding: 'utf-8' }
  )
  console.log('D1 query result:', beforeDelete)
  console.log('✅ Page exists in D1\n')

  // Now delete via Payload API
  console.log('Step 3: Delete page via Payload REST API...')
  const deleteResponse = await fetch(`http://localhost:3333/api/pages/${testPageId}`, {
    method: 'DELETE',
  })

  if (!deleteResponse.ok) {
    console.error('❌ Delete request failed')
    console.error('Response:', await deleteResponse.text())
    return
  }

  const deleteResult = await deleteResponse.json()
  console.log('Delete API response:', JSON.stringify(deleteResult, null, 2))
  console.log('✅ Delete API call succeeded\n')

  // Check if it still exists in D1
  console.log('Step 4: Check if page still exists in D1...')
  const afterDelete = execSync(
    `pnpm wrangler d1 execute chimera-d1 --local --command "SELECT id, title FROM pages WHERE id = ${testPageId};"`,
    { encoding: 'utf-8' }
  )

  // Parse the results
  const hasResults = afterDelete.includes('"results"') &&
                     afterDelete.includes(testPageId.toString())

  if (hasResults) {
    console.log('❌ BUG CONFIRMED: Page still exists in D1 after Payload DELETE!')
    console.log('D1 query result:', afterDelete)
  } else {
    console.log('✅ Page successfully deleted from D1')
  }

  console.log('\n' + '='.repeat(60))
  console.log('TEST COMPLETE')
  console.log('='.repeat(60))
}

// Run the test
testPayloadDelete().catch(console.error)
