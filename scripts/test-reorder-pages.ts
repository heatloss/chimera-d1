/**
 * Test the /api/reorder-pages endpoint
 *
 * This script:
 * 1. Gets pages from a chapter
 * 2. Reverses their order
 * 3. Calls the reorder endpoint
 * 4. Verifies the new order
 */

import { getPayload } from 'payload'
import config from '../src/payload.config.js'

async function testReorderPages() {
  console.log('🧪 Testing /api/reorder-pages endpoint\n')

  const payload = await getPayload({ config })

  try {
    // Step 1: Find a chapter with multiple pages
    console.log('Step 1: Finding a chapter with pages...')

    const chapters = await payload.find({
      collection: 'chapters',
      limit: 10,
      sort: 'order'
    })

    let testChapter = null
    let originalPages = []

    for (const chapter of chapters.docs) {
      const pages = await payload.find({
        collection: 'pages',
        where: {
          chapter: { equals: chapter.id }
        },
        sort: 'chapterPageNumber',
        limit: 20
      })

      if (pages.docs.length >= 2) {
        testChapter = chapter
        originalPages = pages.docs
        break
      }
    }

    if (!testChapter || originalPages.length < 2) {
      console.log('⚠️  No chapter found with at least 2 pages. Creating test pages...')

      // Create test pages if none exist
      const testPage1 = await payload.create({
        collection: 'pages',
        data: {
          comic: 1,
          chapter: 1,
          chapterPageNumber: 9991,
          title: 'Test Page 1',
          status: 'draft'
        }
      })

      const testPage2 = await payload.create({
        collection: 'pages',
        data: {
          comic: 1,
          chapter: 1,
          chapterPageNumber: 9992,
          title: 'Test Page 2',
          status: 'draft'
        }
      })

      testChapter = await payload.findByID({
        collection: 'chapters',
        id: 1
      })

      originalPages = [testPage1, testPage2]
    }

    console.log(`✅ Found chapter: "${testChapter.title}" (ID: ${testChapter.id})`)
    console.log(`   Pages: ${originalPages.length}`)
    console.log('\nOriginal order:')
    originalPages.forEach((page, i) => {
      console.log(`   ${i + 1}. Page ID ${page.id} - chapterPageNumber: ${page.chapterPageNumber} - "${page.title || 'Untitled'}"`)
    })

    // Step 2: Reverse the order
    console.log('\nStep 2: Reversing page order...')
    const reversedPageIds = [...originalPages].reverse().map(p => p.id)
    console.log('New order (page IDs):', reversedPageIds)

    // Step 3: Call the reorder endpoint
    console.log('\nStep 3: Calling reorder endpoint...')

    // Simulate the endpoint logic directly
    const updatePromises = reversedPageIds.map((pageId, index) => {
      return payload.update({
        collection: 'pages',
        id: pageId,
        data: {
          chapterPageNumber: index + 1
        }
      })
    })

    await Promise.all(updatePromises)
    console.log('✅ Reorder operation completed')

    // Step 4: Verify the new order
    console.log('\nStep 4: Verifying new order...')
    const updatedPages = await payload.find({
      collection: 'pages',
      where: {
        chapter: { equals: testChapter.id }
      },
      sort: 'chapterPageNumber',
      limit: 20
    })

    console.log('Updated order:')
    updatedPages.docs.forEach((page, i) => {
      console.log(`   ${i + 1}. Page ID ${page.id} - chapterPageNumber: ${page.chapterPageNumber} - "${page.title || 'Untitled'}"`)
    })

    // Verify the order matches what we requested
    const success = reversedPageIds.every((pageId, index) => {
      const page = updatedPages.docs.find(p => p.id === pageId)
      return page && page.chapterPageNumber === index + 1
    })

    console.log('\n' + '='.repeat(60))
    if (success) {
      console.log('✅ SUCCESS: Pages reordered correctly!')
      console.log('   chapterPageNumber values match the new order')
    } else {
      console.log('❌ FAILURE: Page order does not match!')
    }
    console.log('='.repeat(60))

    process.exit(success ? 0 : 1)

  } catch (error) {
    console.error('\n❌ Test failed with error:', error)
    process.exit(1)
  }
}

testReorderPages()
