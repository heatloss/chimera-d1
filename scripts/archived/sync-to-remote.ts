/**
 * Sync local database to remote Cloudflare D1 database
 * This script copies all data from the local database to the remote database
 */

import { getPayload } from 'payload'
import config from '../src/payload.config'

async function syncToRemote() {
  console.log('🚀 Starting database sync from local to remote...')

  // Get local payload instance
  process.env.NODE_ENV = 'development'
  const localPayload = await getPayload({ config })
  console.log('✅ Connected to local database')

  // Get remote payload instance
  process.env.NODE_ENV = 'production'
  const remotePayload = await getPayload({ config })
  console.log('✅ Connected to remote database')

  // Sync users first (no dependencies)
  console.log('\n📝 Syncing users...')
  const users = await localPayload.find({
    collection: 'users',
    limit: 1000,
  })
  for (const user of users.docs) {
    await remotePayload.create({
      collection: 'users',
      data: {
        id: user.id,
        role: user.role,
        email: user.email,
        password: user.hash, // Copy hashed password
      },
    })
  }
  console.log(`✅ Synced ${users.docs.length} users`)

  // Sync media (depends on users)
  console.log('\n📝 Syncing media...')
  const media = await localPayload.find({
    collection: 'media',
    limit: 1000,
  })
  for (const item of media.docs) {
    await remotePayload.create({
      collection: 'media',
      data: {
        ...item,
        id: item.id,
      },
    })
  }
  console.log(`✅ Synced ${media.docs.length} media items`)

  // Sync comics (depends on users and media)
  console.log('\n📝 Syncing comics...')
  const comics = await localPayload.find({
    collection: 'comics',
    limit: 1000,
  })
  for (const comic of comics.docs) {
    await remotePayload.create({
      collection: 'comics',
      data: {
        ...comic,
        id: comic.id,
      },
    })
  }
  console.log(`✅ Synced ${comics.docs.length} comics`)

  // Sync chapters (depends on comics)
  console.log('\n📝 Syncing chapters...')
  const chapters = await localPayload.find({
    collection: 'chapters',
    limit: 1000,
  })
  for (const chapter of chapters.docs) {
    await remotePayload.create({
      collection: 'chapters',
      data: {
        ...chapter,
        id: chapter.id,
      },
    })
  }
  console.log(`✅ Synced ${chapters.docs.length} chapters`)

  // Sync pages (depends on comics, chapters, media)
  console.log('\n📝 Syncing pages...')
  const pages = await localPayload.find({
    collection: 'pages',
    limit: 1000,
  })
  for (const page of pages.docs) {
    await remotePayload.create({
      collection: 'pages',
      data: {
        ...page,
        id: page.id,
      },
    })
  }
  console.log(`✅ Synced ${pages.docs.length} pages`)

  console.log('\n✨ Database sync complete!')
  process.exit(0)
}

syncToRemote().catch((error) => {
  console.error('❌ Sync failed:', error)
  process.exit(1)
})
