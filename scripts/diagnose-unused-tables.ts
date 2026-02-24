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

// Tables that appear to have ZERO code references (candidates for deletion)
const POTENTIALLY_UNUSED_TABLES = [
  'note_shares',
  'note_attachments',
  'note_favorites',
  'note_versions',
  'note_views',
  'note_tags',        // Check this one too
  'reply_reactions',  // Might be replaced by personal_sticks_reactions
];

// Tables we initially thought were unused but ARE actually used
const TABLES_STILL_IN_USE = [
  'chat_messages',    // Used by app/api/chat/[parentReplyId]/messages/route.ts
  'notes',            // Used by lib/data/notes-data.ts, search, export, etc.
  'note_tabs',        // Used by database-health, community-notes search
  'replies',          // Used by export-data, delete-account, community-notes
  'sticks',           // Used by calsticks archive
  'stick_replies',    // Used by automation execute-reminders
  'stick_reactions',  // Used by social-pads analytics
];

async function main() {
  try {
    console.log('🔄 Connecting to database...');
    await client.connect();
    console.log('✅ Connected!\n');

    // Get all existing tables
    const tablesResult = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `);

    const existingTables = new Set(tablesResult.rows.map(r => r.tablename));
    console.log(`📊 Total tables in database: ${existingTables.size}\n`);

    // Check potentially unused tables
    console.log('=' .repeat(70));
    console.log('🗑️  POTENTIALLY UNUSED TABLES (Zero code references)');
    console.log('=' .repeat(70));
    console.log('');

    for (const table of POTENTIALLY_UNUSED_TABLES) {
      if (existingTables.has(table)) {
        try {
          const countResult = await client.query(`SELECT COUNT(*) as count FROM "${table}"`);
          const count = parseInt(countResult.rows[0].count);
          const status = count === 0 ? '✅ EMPTY - Safe to drop' : `⚠️  HAS ${count} ROWS`;
          console.log(`  ${table.padEnd(25)} EXISTS    ${status}`);
        } catch (err: any) {
          console.log(`  ${table.padEnd(25)} EXISTS    ❌ Error counting: ${err.message}`);
        }
      } else {
        console.log(`  ${table.padEnd(25)} NOT FOUND (already deleted or never created)`);
      }
    }

    // Check tables we thought were unused but are actually used
    console.log('');
    console.log('=' .repeat(70));
    console.log('⚠️  TABLES THAT ARE STILL IN USE (Do NOT delete)');
    console.log('=' .repeat(70));
    console.log('');

    for (const table of TABLES_STILL_IN_USE) {
      if (existingTables.has(table)) {
        try {
          const countResult = await client.query(`SELECT COUNT(*) as count FROM "${table}"`);
          const count = parseInt(countResult.rows[0].count);
          console.log(`  ${table.padEnd(25)} EXISTS    ${count} rows`);
        } catch (err: any) {
          console.log(`  ${table.padEnd(25)} EXISTS    ❌ Error counting: ${err.message}`);
        }
      } else {
        console.log(`  ${table.padEnd(25)} NOT FOUND`);
      }
    }

    // Summary of tables safe to drop
    console.log('');
    console.log('=' .repeat(70));
    console.log('📋 SUMMARY - Tables safe to DROP');
    console.log('=' .repeat(70));
    console.log('');

    const safeToDrop: string[] = [];
    const notEmpty: string[] = [];
    const notFound: string[] = [];

    for (const table of POTENTIALLY_UNUSED_TABLES) {
      if (existingTables.has(table)) {
        try {
          const countResult = await client.query(`SELECT COUNT(*) as count FROM "${table}"`);
          const count = parseInt(countResult.rows[0].count);
          if (count === 0) {
            safeToDrop.push(table);
          } else {
            notEmpty.push(`${table} (${count} rows)`);
          }
        } catch {
          // Skip on error
        }
      } else {
        notFound.push(table);
      }
    }

    if (safeToDrop.length > 0) {
      console.log('✅ Safe to drop (empty tables):');
      safeToDrop.forEach(t => console.log(`   - ${t}`));
    }

    if (notEmpty.length > 0) {
      console.log('\n⚠️  Review before dropping (have data):');
      notEmpty.forEach(t => console.log(`   - ${t}`));
    }

    if (notFound.length > 0) {
      console.log('\n📭 Already gone (not in database):');
      notFound.forEach(t => console.log(`   - ${t}`));
    }

    // Generate DROP statements
    if (safeToDrop.length > 0) {
      console.log('\n');
      console.log('=' .repeat(70));
      console.log('🔧 SQL to drop empty unused tables:');
      console.log('=' .repeat(70));
      console.log('');
      safeToDrop.forEach(t => console.log(`DROP TABLE IF EXISTS "${t}" CASCADE;`));
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
