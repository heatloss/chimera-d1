import { getPayload } from 'payload'
import config from '../src/payload.config'

async function testDelete() {
  console.log('🔧 Initializing Payload...')
  const payload = await getPayload({ config })

  try {
    // Create a test page
    console.log('\n📝 Creating a test page...')
    const createdPage = await payload.create({
      collection: 'pages',
      data: {
        comic: 1, // Assuming comic ID 1 exists
        chapter: 1, // Assuming chapter ID 1 exists
        chapterPageNumber: 999,
        title: 'DELETE TEST PAGE - TEMPORARY',
        status: 'draft',
      },
    })
    console.log(`✅ Created test page with ID: ${createdPage.id}`)

    // Verify it exists in the database
    console.log('\n🔍 Verifying page exists in database...')
    const beforeDelete = await payload.findByID({
      collection: 'pages',
      id: createdPage.id,
    })
    console.log(`✅ Found page: ${beforeDelete.title}`)

    // Now delete it through Payload API
    console.log('\n🗑️  Deleting page through Payload API...')
    const deleteResult = await payload.delete({
      collection: 'pages',
      id: createdPage.id,
    })
    console.log('✅ Delete operation completed')
    console.log('Delete result:', JSON.stringify(deleteResult, null, 2))

    // Try to find it again through Payload API
    console.log('\n🔍 Trying to find page through Payload API...')
    try {
      const afterDelete = await payload.findByID({
        collection: 'pages',
        id: createdPage.id,
      })
      console.log('⚠️  Page still accessible through Payload API!')
      console.log('Page data:', JSON.stringify(afterDelete, null, 2))
    } catch (error) {
      console.log('✅ Page not found through Payload API (expected)')
      console.log('Error:', error.message)
    }

    // Check if it still exists in database with raw query
    console.log('\n🔍 Checking raw database...')
    const db = payload.db.drizzle
    const result = await db.execute(`SELECT * FROM pages WHERE id = ${createdPage.id}`)
    console.log('Raw database query result:', JSON.stringify(result, null, 2))

    if (result.length > 0 || (result as any).results?.length > 0) {
      console.log('❌ FOUND: Page still exists in database after delete!')
    } else {
      console.log('✅ Page successfully deleted from database')
    }
  } catch (error) {
    console.error('❌ Error during test:', error)
    throw error
  }
}

testDelete()
  .then(() => {
    console.log('\n✅ Test completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  })
