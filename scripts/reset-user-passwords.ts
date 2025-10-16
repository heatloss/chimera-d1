#!/usr/bin/env tsx
/**
 * Reset user passwords to something easier to use
 * Usage: pnpm tsx scripts/reset-user-passwords.ts
 */

import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'

async function main() {
  console.log('🔐 Resetting user passwords...\n')

  const payload = await getPayload({ config })

  // Get all users
  const users = await payload.find({
    collection: 'users',
    limit: 100,
  })

  console.log(`Found ${users.docs.length} users:\n`)

  for (const user of users.docs) {
    // Set a simple password: "password123" for testing
    // You can change this to whatever you want
    const newPassword = 'password123'

    await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        password: newPassword,
      },
    })

    console.log(`✓ ${user.email} → password: ${newPassword}`)
  }

  console.log('\n✅ All passwords reset!')
  console.log('\n⚠️  Remember to change these passwords to something secure!')
}

main().catch(console.error)
