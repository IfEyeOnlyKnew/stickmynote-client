#!/usr/bin/env tsx
/**
 * Quick check for stick tab tables
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

async function checkTables() {
  const client = new Client(connectionConfig)

  try {
    await client.connect()

    // Check for all stick-related tables
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%stick%'
      ORDER BY table_name
    `)
    
    console.log('\n📋 All stick-related tables in database:')
    result.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`)
    })

    // Check specifically for personal_stick_tabs
    const personalTabCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'personal_stick_tabs'
      )
    `)
    
    console.log(`\n🔍 personal_stick_tabs exists: ${personalTabCheck.rows[0].exists}`)

  } catch (error: any) {
    console.error('❌ Error:', error.message)
  } finally {
    await client.end()
  }
}

checkTables().catch(console.error)
