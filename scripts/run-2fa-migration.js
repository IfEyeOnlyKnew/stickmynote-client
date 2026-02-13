// Run 2FA Migration Script
// Usage: node scripts/run-2fa-migration.js

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  // Load environment variables
  require('dotenv').config({ path: '.env' });
  require('dotenv').config({ path: '.env.local' });

  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected!');

    // Read the migration file
    const migrationPath = path.join(__dirname, 'create-2fa-tables-simple.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running 2FA migration...');
    await client.query(sql);

    console.log('✅ Migration completed successfully!');
    console.log('\nCreated tables:');
    console.log('  - user_2fa_secrets');
    console.log('  - twofa_verification_sessions');
    console.log('  - twofa_audit_log');
    console.log('  - organization_2fa_policies');

  } catch (error) {
    console.error('❌ Migration failed:');
    console.error(error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
