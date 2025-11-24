#!/usr/bin/env tsx
/**
 * Fix pages with literal "null" string in seo_meta_slug
 * Replace with actual NULL so the beforeValidate hook can auto-generate slugs
 */

import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'

async function main() {
  console.log('🔧 Fixing null SEO slugs in pages...\n')

  const payload = await getPayload({ config })

  try {
    // Get all pages
    const { docs: pages } = await payload.find({
      collection: 'pages',
      limit: 1000,
    })

    console.log(`📦 Found ${pages.length} pages\n`)

    let fixedCount = 0
    let skippedCount = 0

    for (const page of pages) {
      try {
        // Check if seoMeta has null values
        const needsFixing =
          page.seoMeta?.slug === null ||
          page.seoMeta?.slug === 'null' ||
          !page.seoMeta?.slug

        if (needsFixing) {
          console.log(`🔄 Fixing page ${page.id}: "${page.title || page.displayTitle}"`)

          // Generate slug from title and page number
          const pageNum = page.chapterPageNumber
          const title = page.title

          let newSlug: string
          if (title) {
            newSlug = title
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/(^-|-$)+/g, '')
          } else {
            newSlug = `page-${pageNum}`
          }

          console.log(`  Generated slug: "${newSlug}"`)

          // Update the page with proper seoMeta
          await payload.update({
            collection: 'pages',
            id: page.id,
            data: {
              seoMeta: {
                slug: newSlug,
                metaTitle: page.seoMeta?.metaTitle || null,
                metaDescription: page.seoMeta?.metaDescription || null,
              },
            },
          })

          console.log(`  ✅ Fixed!\n`)
          fixedCount++
        } else {
          console.log(`⏭️  Page ${page.id} already has valid slug: "${page.seoMeta.slug}"`)
          skippedCount++
        }

      } catch (error) {
        console.error(`  ❌ Failed to fix page ${page.id}:`, error)
      }
    }

    console.log('\n📊 Summary:')
    console.log(`  ✅ Fixed: ${fixedCount}`)
    console.log(`  ⏭️  Skipped: ${skippedCount}`)
    console.log(`  📦 Total: ${pages.length}`)

    if (fixedCount === pages.length) {
      console.log('\n🎉 All page SEO slugs fixed!')
    }

  } catch (error) {
    console.error('❌ Script failed:', error)
    throw error
  } finally {
    // D1 connections are managed automatically in a serverless environment
    // and do not need explicit closing.
  }
}

main()
