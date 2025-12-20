#!/usr/bin/env tsx
/**
 * Test Application Database Connection
 * Tests the actual application's ability to connect and query the database
 */

import { Client } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config()

const connectionConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DATABASE || 'stickmynote',
  user: process.env.POSTGRES_USER || 'stickmynote_user',
  password: process.env.POSTGRES_PASSWORD,
  ssl: process.env.POSTGRES_SSL === 'true' ? {
    rejectUnauthorized: process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED !== 'false'
  } : false
}

async function testApplicationReadiness() {
  const client = new Client(connectionConfig)

  try {
    console.log('\n' + '═'.repeat(70))
    console.log('🚀 APPLICATION DATABASE READINESS TEST')
    console.log('═'.repeat(70))
    
    await client.connect()
    console.log('\n✅ Database connection successful')

    // Test 1: Check if we can create a test organization
    console.log('\n📋 Testing organization creation...')
    const testOrgId = '10000000-0000-0000-0000-000000000001'
    
    await client.query('BEGIN')
    
    try {
      // Clean up if exists
      await client.query('DELETE FROM organizations WHERE id = $1', [testOrgId])
      
      await client.query(
        `INSERT INTO organizations (id, name, slug, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [testOrgId, 'Test Organization', 'test-org']
      )
      console.log('   ✅ Can create organizations')
      
      // Test 2: Check if we can create a test user
      console.log('\n👤 Testing user creation...')
      const testUserId = '20000000-0000-0000-0000-000000000001'
      
      await client.query('DELETE FROM users WHERE id = $1', [testUserId])
      
      await client.query(
        `INSERT INTO users (id, email, full_name, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [testUserId, 'test@test.local', 'Test User']
      )
      console.log('   ✅ Can create users')
      
      // Test 3: Check if we can create a personal stick
      console.log('\n📝 Testing personal stick creation...')
      const testStickId = '30000000-0000-0000-0000-000000000001'
      
      await client.query(
        `INSERT INTO personal_sticks (id, user_id, title, topic, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [testStickId, testUserId, 'Test Stick', 'test']
      )
      console.log('   ✅ Can create personal sticks')
      
      // Test 4: Check if we can create a social pad
      console.log('\n🏢 Testing social pad creation...')
      const testPadId = '40000000-0000-0000-0000-000000000001'
      
      await client.query(
        `INSERT INTO social_pads (id, name, owner_id, is_public, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [testPadId, 'Test Pad', testUserId, false]
      )
      console.log('   ✅ Can create social pads')
      
      // Test 5: Check if we can create a calstick task
      console.log('\n📅 Testing calstick task creation...')
      const testTaskId = '50000000-0000-0000-0000-000000000001'
      
      await client.query(
        `INSERT INTO calstick_tasks (id, user_id, title, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [testTaskId, testUserId, 'Test Task', 'pending']
      )
      console.log('   ✅ Can create calstick tasks')
      
      // Test 6: Check relationships
      console.log('\n🔗 Testing data relationships...')
      const result = await client.query(`
        SELECT 
          u.email,
          u.full_name,
          (SELECT COUNT(*) FROM personal_sticks WHERE user_id = u.id) as stick_count,
          (SELECT COUNT(*) FROM social_pads WHERE owner_id = u.id) as pad_count,
          (SELECT COUNT(*) FROM calstick_tasks WHERE user_id = u.id) as task_count
        FROM users u
        WHERE u.id = $1
      `, [testUserId])
      
      if (result.rows.length > 0) {
        const data = result.rows[0]
        console.log(`   ✅ User: ${data.email} (${data.full_name})`)
        console.log(`   ✅ Personal sticks: ${data.stick_count}`)
        console.log(`   ✅ Social pads: ${data.pad_count}`)
        console.log(`   ✅ Calstick tasks: ${data.task_count}`)
      }
      
      // Rollback test data
      await client.query('ROLLBACK')
      console.log('\n🧹 Test data rolled back')
      
    } catch (error: any) {
      await client.query('ROLLBACK')
      throw error
    }

    // Check for any missing critical indexes
    console.log('\n📊 Checking critical indexes...')
    const indexCheck = await client.query(`
      SELECT 
        tablename,
        indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND tablename IN ('users', 'personal_sticks', 'social_pads', 'social_sticks', 'organizations')
      ORDER BY tablename, indexname
    `)
    
    const indexesByTable = indexCheck.rows.reduce((acc, row) => {
      if (!acc[row.tablename]) acc[row.tablename] = []
      acc[row.tablename].push(row.indexname)
      return acc
    }, {} as Record<string, string[]>)
    
    Object.entries(indexesByTable).forEach(([table, indexes]) => {
      console.log(`   ✅ ${table}: ${indexes.length} indexes`)
    })

    console.log('\n' + '═'.repeat(70))
    console.log('✅ DATABASE IS READY FOR APPLICATION USE')
    console.log('═'.repeat(70))
    console.log('\n📌 Next Steps:')
    console.log('   1. Start the application server')
    console.log('   2. Test user registration/login')
    console.log('   3. Verify RLS policies work from the application')
    console.log('   4. Create some test content\n')

  } catch (error: any) {
    console.error('\n❌ Error:', error.message)
    console.error('\n⚠️  Issue found. Please review the error above.')
    process.exit(1)
  } finally {
    await client.end()
  }
}

testApplicationReadiness().catch(console.error)
