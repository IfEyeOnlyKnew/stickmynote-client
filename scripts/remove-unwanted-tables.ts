#!/usr/bin/env tsx
/**
 * Remove unwanted tables and check for team_ tables
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

const UNWANTED_TABLES = [
  'team_notes',
  'team_projects',
  'user_activity',
  'rate_limit_tracking',
  'ai_prompts',
  'ai_chat_sessions',
  'search_analytics'
]

async function removeUnwantedTables() {
  const client = new Client(connectionConfig)

  try {
    await client.connect()
    console.log('✅ Connected to database\n')

    // Check for all tables starting with team_
    console.log('🔍 Checking for tables starting with "team_"...')
    const teamTablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'team_%'
      ORDER BY table_name
    `)
    
    const teamTables = teamTablesResult.rows.map(r => r.table_name)
    if (teamTables.length > 0) {
      console.log(`Found ${teamTables.length} tables starting with "team_":`)
      teamTables.forEach(t => console.log(`  - ${t}`))
    } else {
      console.log('✅ No tables starting with "team_" found')
    }

    // Check which unwanted tables exist
    console.log('\n🔍 Checking for unwanted tables...')
    const existingUnwanted: string[] = []
    
    for (const table of UNWANTED_TABLES) {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [table])
      
      if (result.rows[0].exists) {
        existingUnwanted.push(table)
        console.log(`  ⚠️  Found: ${table}`)
      }
    }

    if (existingUnwanted.length === 0) {
      console.log('✅ None of the unwanted tables exist')
    }

    // Combine all tables to delete
    const tablesToDelete = [...new Set([...teamTables, ...existingUnwanted])]

    if (tablesToDelete.length > 0) {
      console.log(`\n🗑️  Dropping ${tablesToDelete.length} tables...`)
      
      for (const table of tablesToDelete) {
        try {
          await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`)
          console.log(`  ✅ Dropped: ${table}`)
        } catch (error: any) {
          console.error(`  ❌ Failed to drop ${table}: ${error.message}`)
        }
      }

      // Also drop any RLS policies for these tables
      console.log('\n🔐 Cleaning up orphaned RLS policies...')
      for (const table of tablesToDelete) {
        try {
          const policies = await client.query(`
            SELECT policyname 
            FROM pg_policies 
            WHERE schemaname = 'public' AND tablename = $1
          `, [table])
          
          for (const policy of policies.rows) {
            await client.query(`DROP POLICY IF EXISTS "${policy.policyname}" ON ${table}`)
          }
        } catch (error: any) {
          // Ignore errors for non-existent tables
        }
      }
      
      console.log('✅ Cleanup complete')
    } else {
      console.log('\n✅ No tables to delete')
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

removeUnwantedTables().catch(console.error)
