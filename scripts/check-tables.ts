import { Client } from 'pg';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const client = new Client({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DATABASE || process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function main() {
  try {
    console.log('🔄 Connecting to database...');
    await client.connect();
    console.log('✅ Connected!\n');

    // Get all tables
    const tablesResult = await client.query(`
      SELECT 
        schemaname,
        tablename,
        tableowner
      FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY schemaname, tablename;
    `);

    console.log('📋 Database Tables:\n');
    console.log('Schema\t\t\tTable Name\t\t\t\tOwner');
    console.log('─'.repeat(80));
    
    tablesResult.rows.forEach(row => {
      console.log(`${row.schemaname}\t\t${row.tablename.padEnd(35)}\t${row.tableowner}`);
    });

    console.log(`\n📊 Total tables: ${tablesResult.rows.length}\n`);

    // Check for specific tables we expect
    const expectedTables = [
      'users',
      'profiles', 
      'organizations',
      'organization_members',
      'personal_sticks',
      'note_replies',
      'paks_pads',
      'social_pads',
      'social_sticks',
      'calsticks'
    ];

    console.log('🔍 Checking for expected tables:\n');
    for (const table of expectedTables) {
      const exists = tablesResult.rows.some(r => r.tablename === table);
      console.log(`${exists ? '✅' : '❌'} ${table}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
