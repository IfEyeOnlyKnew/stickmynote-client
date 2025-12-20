#!/usr/bin/env tsx
/**
 * Run RLS Policy Scripts (10-17)
 * Executes Row Level Security policies on PostgreSQL database
 */

import { Client } from 'pg'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load environment variables
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

const RLS_SCRIPTS = [
  '10-create-rls-policies-core.sql',
  '11-create-rls-policies-sticks.sql',
  '12-create-rls-policies-social.sql',
  '13-create-rls-policies-calstick.sql',
  '14-create-rls-policies-teams.sql',
  '15-create-rls-policies-notifications.sql',
  '16-create-rls-policies-analytics.sql',
  '17-create-rls-policies-tags-search-ai.sql'
]

async function runRLSPolicies() {
  const client = new Client(connectionConfig)

  try {
    console.log('🔌 Connecting to PostgreSQL...')
    console.log(`   Host: ${connectionConfig.host}:${connectionConfig.port}`)
    console.log(`   Database: ${connectionConfig.database}`)
    console.log(`   User: ${connectionConfig.user}`)
    
    await client.connect()
    console.log('✅ Connected successfully\n')

    const scriptsDir = path.join(__dirname, 'windows-server')

    for (let i = 0; i < RLS_SCRIPTS.length; i++) {
      const scriptName = RLS_SCRIPTS[i]
      const scriptPath = path.join(scriptsDir, scriptName)
      
      const separator = '='.repeat(70)
      console.log(`\n${separator}`)
      console.log(`📜 Running Script ${i + 1}/${RLS_SCRIPTS.length}: ${scriptName}`)
      console.log(separator)

      if (!fs.existsSync(scriptPath)) {
        console.error(`❌ Script not found: ${scriptPath}`)
        continue
      }

      const sql = fs.readFileSync(scriptPath, 'utf-8')
      
      try {
        const startTime = Date.now()
        await client.query(sql)
        const duration = Date.now() - startTime
        console.log(`✅ Successfully executed in ${duration}ms`)
      } catch (error: any) {
        console.error(`❌ Error executing ${scriptName}:`)
        console.error(error.message)
        
        // Continue with next script instead of stopping
        if (error.message.includes('already exists') || error.message.includes('does not exist')) {
          console.log('⚠️  Continuing with next script...')
        } else {
          console.log('⚠️  This might be a critical error. Review and fix before proceeding.')
        }
      }
    }

    const finalSeparator = '='.repeat(70)
    console.log(`\n${finalSeparator}`)
    console.log('✅ RLS Policy Scripts Execution Complete!')
    console.log(`${finalSeparator}\n`)

  } catch (error: any) {
    console.error('❌ Fatal Error:', error.message)
    process.exit(1)
  } finally {
    await client.end()
    console.log('🔌 Database connection closed')
  }
}

// Run the script
runRLSPolicies().catch(console.error)
