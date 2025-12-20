#!/usr/bin/env tsx
/**
 * Check which project/team tables exist
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

async function checkProjectTables() {
  const client = new Client(connectionConfig)

  try {
    await client.connect()

    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name LIKE 'project%' OR table_name LIKE 'team%')
      ORDER BY table_name
    `)
    
    console.log('\n📋 Project/Team related tables:')
    if (result.rows.length > 0) {
      result.rows.forEach(row => {
        console.log(`  ✓ ${row.table_name}`)
      })
    } else {
      console.log('  (none found)')
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message)
  } finally {
    await client.end()
  }
}

checkProjectTables().catch(console.error)
