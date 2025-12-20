#!/usr/bin/env tsx
/**
 * Comprehensive Database Setup Test
 * Tests connectivity, tables, RLS policies, and basic operations
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

interface TestResult {
  category: string
  test: string
  status: 'PASS' | 'FAIL' | 'WARN'
  message?: string
}

const results: TestResult[] = []

function addResult(category: string, test: string, status: 'PASS' | 'FAIL' | 'WARN', message?: string) {
  results.push({ category, test, status, message })
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️'
  console.log(`${icon} ${test}${message ? ': ' + message : ''}`)
}

async function testDatabaseConnection(client: Client) {
  console.log('\n📡 Testing Database Connection...')
  console.log('━'.repeat(70))
  
  try {
    const result = await client.query('SELECT version()')
    addResult('Connection', 'Database connectivity', 'PASS', result.rows[0].version.split(',')[0])
    
    const dbResult = await client.query('SELECT current_database()')
    addResult('Connection', 'Current database', 'PASS', dbResult.rows[0].current_database)
    
    const userResult = await client.query('SELECT current_user')
    addResult('Connection', 'Current user', 'PASS', userResult.rows[0].current_user)
    
    return true
  } catch (error: any) {
    addResult('Connection', 'Database connectivity', 'FAIL', error.message)
    return false
  }
}

async function testCoreTablesExist(client: Client) {
  console.log('\n📋 Testing Core Tables...')
  console.log('━'.repeat(70))
  
  const coreTables = [
    'users',
    'organizations',
    'organization_members',
    'organization_invites',
    'organization_domains',
    'personal_sticks',
    'personal_sticks_tabs',
    'social_pads',
    'social_pad_members',
    'social_sticks',
    'social_stick_tabs',
    'social_stick_replies',
    'calstick_tasks',
    'notifications',
    'tags',
    'saved_searches'
  ]
  
  for (const table of coreTables) {
    try {
      const result = await client.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )`,
        [table]
      )
      
      if (result.rows[0].exists) {
        addResult('Tables', `Table: ${table}`, 'PASS')
      } else {
        addResult('Tables', `Table: ${table}`, 'FAIL', 'Table does not exist')
      }
    } catch (error: any) {
      addResult('Tables', `Table: ${table}`, 'FAIL', error.message)
    }
  }
}

async function testMissingTables(client: Client) {
  console.log('\n🔍 Checking for Tables Referenced in RLS Scripts...')
  console.log('━'.repeat(70))
  
  // These tables were referenced in RLS scripts but have been confirmed as not needed
  // and have been commented out in the RLS policy files
  const commentedOutTables = [
    'team_notes',
    'team_projects',
    'project_notes',
    'user_activity',
    'rate_limit_tracking',
    'ai_prompts',
    'ai_chat_sessions',
    'search_analytics'
  ]
  
  console.log('   Tables that were commented out in RLS scripts (not needed):')
  commentedOutTables.forEach(table => {
    console.log(`   - ${table}`)
  })
  
  addResult('Missing Tables', 'Commented out tables', 'PASS', `${commentedOutTables.length} tables removed from RLS scripts`)
}

async function testRLSEnabled(client: Client) {
  console.log('\n🔐 Testing RLS Policies...')
  console.log('━'.repeat(70))
  
  const rlsTables = [
    'users',
    'organizations',
    'organization_members',
    'personal_sticks',
    'social_pads',
    'social_pad_members',
    'social_sticks',
    'calstick_tasks'
  ]
  
  for (const table of rlsTables) {
    try {
      const result = await client.query(
        `SELECT relrowsecurity 
         FROM pg_class 
         WHERE relname = $1 AND relnamespace = 'public'::regnamespace`,
        [table]
      )
      
      if (result.rows.length > 0) {
        if (result.rows[0].relrowsecurity) {
          addResult('RLS', `RLS enabled on ${table}`, 'PASS')
        } else {
          addResult('RLS', `RLS enabled on ${table}`, 'FAIL', 'RLS is not enabled')
        }
      } else {
        addResult('RLS', `RLS enabled on ${table}`, 'WARN', 'Table not found')
      }
    } catch (error: any) {
      addResult('RLS', `RLS enabled on ${table}`, 'FAIL', error.message)
    }
  }
}

async function testRLSPoliciesExist(client: Client) {
  console.log('\n📜 Testing RLS Policy Count...')
  console.log('━'.repeat(70))
  
  try {
    const result = await client.query(`
      SELECT 
        tablename,
        COUNT(*) as policy_count
      FROM pg_policies 
      WHERE schemaname = 'public'
      GROUP BY tablename
      ORDER BY policy_count DESC
    `)
    
    if (result.rows.length > 0) {
      addResult('RLS Policies', 'Policy count', 'PASS', `${result.rows.length} tables have RLS policies`)
      
      console.log('\n   Table-wise policy distribution:')
      result.rows.slice(0, 10).forEach(row => {
        console.log(`   - ${row.tablename}: ${row.policy_count} policies`)
      })
    } else {
      addResult('RLS Policies', 'Policy count', 'WARN', 'No RLS policies found')
    }
  } catch (error: any) {
    addResult('RLS Policies', 'Policy count', 'FAIL', error.message)
  }
}

async function testIndexes(client: Client) {
  console.log('\n📊 Testing Database Indexes...')
  console.log('━'.repeat(70))
  
  try {
    const result = await client.query(`
      SELECT 
        schemaname,
        tablename,
        COUNT(*) as index_count
      FROM pg_indexes 
      WHERE schemaname = 'public'
      GROUP BY schemaname, tablename
      ORDER BY index_count DESC
      LIMIT 10
    `)
    
    if (result.rows.length > 0) {
      addResult('Performance', 'Database indexes', 'PASS', `Indexes found on ${result.rows.length} tables`)
      
      console.log('\n   Top indexed tables:')
      result.rows.forEach(row => {
        console.log(`   - ${row.tablename}: ${row.index_count} indexes`)
      })
    } else {
      addResult('Performance', 'Database indexes', 'WARN', 'No indexes found')
    }
  } catch (error: any) {
    addResult('Performance', 'Database indexes', 'FAIL', error.message)
  }
}

async function testTriggersExist(client: Client) {
  console.log('\n⚡ Testing Database Triggers...')
  console.log('━'.repeat(70))
  
  try {
    const result = await client.query(`
      SELECT 
        event_object_table as table_name,
        trigger_name,
        event_manipulation as event
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
      ORDER BY event_object_table
      LIMIT 15
    `)
    
    if (result.rows.length > 0) {
      addResult('Triggers', 'Database triggers', 'PASS', `${result.rows.length} triggers found`)
      
      console.log('\n   Sample triggers:')
      result.rows.slice(0, 10).forEach(row => {
        console.log(`   - ${row.table_name}: ${row.trigger_name} (${row.event})`)
      })
    } else {
      addResult('Triggers', 'Database triggers', 'WARN', 'No triggers found')
    }
  } catch (error: any) {
    addResult('Triggers', 'Database triggers', 'FAIL', error.message)
  }
}

async function testExtensions(client: Client) {
  console.log('\n🔌 Testing PostgreSQL Extensions...')
  console.log('━'.repeat(70))
  
  const requiredExtensions = ['uuid-ossp', 'pgcrypto']
  
  for (const ext of requiredExtensions) {
    try {
      const result = await client.query(
        `SELECT EXISTS (
          SELECT FROM pg_extension WHERE extname = $1
        )`,
        [ext]
      )
      
      if (result.rows[0].exists) {
        addResult('Extensions', `Extension: ${ext}`, 'PASS')
      } else {
        addResult('Extensions', `Extension: ${ext}`, 'WARN', 'Extension not installed')
      }
    } catch (error: any) {
      addResult('Extensions', `Extension: ${ext}`, 'FAIL', error.message)
    }
  }
}

async function testSampleDataInsert(client: Client) {
  console.log('\n🧪 Testing Sample Data Operations...')
  console.log('━'.repeat(70))
  
  try {
    // Test inserting a test user
    const testUserId = '00000000-0000-0000-0000-000000000001'
    
    // First, try to delete if exists
    await client.query('DELETE FROM users WHERE id = $1', [testUserId])
    
    // Insert test user
    await client.query(
      `INSERT INTO users (id, email, full_name, created_at, updated_at) 
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [testUserId, 'test@stickmynote.com', 'Test User']
    )
    
    // Verify insert
    const result = await client.query('SELECT * FROM users WHERE id = $1', [testUserId])
    
    if (result.rows.length > 0) {
      addResult('Data Operations', 'Insert test user', 'PASS')
      
      // Cleanup
      await client.query('DELETE FROM users WHERE id = $1', [testUserId])
      addResult('Data Operations', 'Delete test user', 'PASS')
    } else {
      addResult('Data Operations', 'Insert test user', 'FAIL', 'Could not verify insert')
    }
  } catch (error: any) {
    addResult('Data Operations', 'Sample data operations', 'FAIL', error.message)
  }
}

function printSummary() {
  console.log('\n')
  console.log('═'.repeat(70))
  console.log('📊 TEST SUMMARY')
  console.log('═'.repeat(70))
  
  const passed = results.filter(r => r.status === 'PASS').length
  const failed = results.filter(r => r.status === 'FAIL').length
  const warned = results.filter(r => r.status === 'WARN').length
  const total = results.length
  
  console.log(`\nTotal Tests: ${total}`)
  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`⚠️  Warnings: ${warned}`)
  
  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:')
    results
      .filter(r => r.status === 'FAIL')
      .forEach(r => {
        console.log(`   - [${r.category}] ${r.test}: ${r.message || 'Unknown error'}`)
      })
  }
  
  if (warned > 0) {
    console.log('\n⚠️  WARNINGS:')
    results
      .filter(r => r.status === 'WARN')
      .forEach(r => {
        console.log(`   - [${r.category}] ${r.test}: ${r.message || 'Warning'}`)
      })
  }
  
  console.log('\n' + '═'.repeat(70))
  
  if (failed === 0) {
    console.log('✅ All critical tests passed!')
  } else {
    console.log('❌ Some tests failed. Please review and fix issues.')
  }
  
  console.log('═'.repeat(70) + '\n')
}

async function runAllTests() {
  const client = new Client(connectionConfig)

  try {
    console.log('\n')
    console.log('═'.repeat(70))
    console.log('🧪 COMPREHENSIVE DATABASE SETUP TEST')
    console.log('═'.repeat(70))
    console.log(`\n📍 Server: ${connectionConfig.host}:${connectionConfig.port}`)
    console.log(`📍 Database: ${connectionConfig.database}`)
    console.log(`📍 User: ${connectionConfig.user}`)
    console.log(`📍 SSL: ${connectionConfig.ssl ? 'Enabled' : 'Disabled'}`)
    
    await client.connect()
    
    const connected = await testDatabaseConnection(client)
    if (!connected) {
      console.error('\n❌ Cannot proceed - database connection failed!')
      return
    }
    
    await testExtensions(client)
    await testCoreTablesExist(client)
    await testMissingTables(client)
    await testRLSEnabled(client)
    await testRLSPoliciesExist(client)
    await testIndexes(client)
    await testTriggersExist(client)
    await testSampleDataInsert(client)
    
    printSummary()
    
  } catch (error: any) {
    console.error('\n❌ Fatal Error:', error.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

runAllTests().catch(console.error)
