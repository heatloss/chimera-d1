#!/usr/bin/env tsx
/**
 * Fix chapters with literal "null" string in seo_meta_slug
 */

import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'

async function main() {
  console.log('🔧 Fixing null SEO slugs in chapters...\n')

  const payload = await getPayload({ config })

  try {
    // Get all chapters WITHOUT using where clause (to avoid the bug)
    const { docs: chapters } = await payload.find({
      collection: 'chapters',
      limit: 100,
    })

    console.log(`📦 Found ${chapters.length} chapters\n`)

    let fixedCount = 0

    for (const chapter of chapters) {
      try {
        const needsFixing =
          chapter.seoMeta?.slug === null ||
          chapter.seoMeta?.slug === 'null' ||
          !chapter.seoMeta?.slug

        if (needsFixing) {
          console.log(`🔄 Fixing chapter ${chapter.id}: "${chapter.title}"`)

          const newSlug = chapter.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)+/g, '')

          console.log(`  Generated slug: "${newSlug}"`)

          await payload.update({
            collection: 'chapters',
            id: chapter.id,
            data: {
              seoMeta: {
                slug: newSlug,
                metaTitle: chapter.seoMeta?.metaTitle || null,
                metaDescription: chapter.seoMeta?.metaDescription || null,
              },
            },
          })

          console.log(`  ✅ Fixed!\n`)
          fixedCount++
        }
      } catch (error) {
        console.error(`  ❌ Failed to fix chapter ${chapter.id}:`, error)
      }
    }

    console.log('\n📊 Summary:')
    console.log(`  ✅ Fixed: ${fixedCount}`)
    console.log(`  📦 Total: ${chapters.length}`)

  } catch (error) {
    console.error('❌ Script failed:', error)
    throw error
  }
}

main()
