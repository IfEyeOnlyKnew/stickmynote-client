#!/usr/bin/env tsx
import { Client } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config()

const client = new Client({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false
})

async function checkTableStructure() {
  await client.connect()
  
  const tables = ['users', 'organizations', 'personal_sticks', 'social_pads', 'calstick_tasks']
  
  for (const table of tables) {
    console.log(`\n📋 ${table} columns:`)
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [table])
    
    result.rows.forEach(row => {
      console.log(`   - ${row.column_name}: ${row.data_type}${row.is_nullable === 'NO' ? ' NOT NULL' : ''}`)
    })
  }
  
  await client.end()
}

checkTableStructure().catch(console.error)
