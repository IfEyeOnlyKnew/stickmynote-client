import { Client } from 'pg';
import * as path from 'node:path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const client = new Client({
  host: process.env.POSTGRES_HOST,
  port: Number.parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DATABASE || process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// Tables that are DEFINITELY in use (core functionality)
const CORE_TABLES = new Set([
  'users',
  'organizations',
  'organization_members',
  'organization_domains',
  'organization_invites',
  'personal_sticks',
  'personal_sticks_tabs',
  'personal_sticks_replies',
  'personal_sticks_reactions',
  'personal_sticks_reply_reactions',
  'personal_sticks_tags',
  'personal_sticks_activities',
  'personal_sticks_attachments',
  'personal_sticks_bookmarks',
  'personal_sticks_comments',
  'personal_sticks_favorites',
  'personal_sticks_history',
  'personal_sticks_locks',
  'personal_sticks_notifications',
  'personal_sticks_presence',
  'personal_sticks_shares',
  'personal_sticks_tasks',
  'personal_sticks_versions',
  'personal_sticks_views',
  'stick_chats',
  'stick_chat_messages',
  'stick_chat_members',
  'chat_requests',
  'user_preferences',
  'user_settings',
  'search_history',
  'ai_answer_sessions',
  'ai_answer_attachments',
  'rate_limits',
  'error_logs',
  'login_attempts',
  'account_lockouts',
  'audit_logs',
  'presence_status',
]);

async function main() {
  try {
    console.log('🔄 Connecting to database...');
    await client.connect();
    console.log('✅ Connected!\n');

    // Get all tables with row counts
    const tablesResult = await client.query(`
      SELECT
        relname as tablename,
        n_live_tup as row_count
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY relname;
    `);

    const tables = tablesResult.rows;
    console.log(`📊 Total tables in database: ${tables.length}\n`);

    // Categorize tables
    const coreTables: { name: string; rows: number }[] = [];
    const emptyTables: string[] = [];
    const tablesWithData: { name: string; rows: number }[] = [];

    for (const table of tables) {
      const name = table.tablename;
      const rows = Number.parseInt(table.row_count) || 0;

      if (CORE_TABLES.has(name)) {
        coreTables.push({ name, rows });
      } else if (rows === 0) {
        emptyTables.push(name);
      } else {
        tablesWithData.push({ name, rows });
      }
    }

    // Print core tables
    console.log('=' .repeat(70));
    console.log('✅ CORE TABLES (definitely in use)');
    console.log('=' .repeat(70));
    coreTables.sort((a, b) => b.rows - a.rows);
    for (const t of coreTables) {
      console.log(`  ${t.name.padEnd(40)} ${t.rows} rows`);
    }

    // Print tables with data that are NOT core
    console.log('\n');
    console.log('=' .repeat(70));
    console.log('⚠️  NON-CORE TABLES WITH DATA (review these)');
    console.log('=' .repeat(70));
    tablesWithData.sort((a, b) => b.rows - a.rows);
    for (const t of tablesWithData) {
      console.log(`  ${t.name.padEnd(40)} ${t.rows} rows`);
    }

    // Print empty non-core tables
    console.log('\n');
    console.log('=' .repeat(70));
    console.log('🗑️  EMPTY NON-CORE TABLES (candidates for deletion)');
    console.log('=' .repeat(70));
    emptyTables.sort((a, b) => a.localeCompare(b));
    for (const name of emptyTables) {
      console.log(`  ${name}`);
    }

    // Summary
    console.log('\n');
    console.log('=' .repeat(70));
    console.log('📋 SUMMARY');
    console.log('=' .repeat(70));
    console.log(`  Core tables:                    ${coreTables.length}`);
    console.log(`  Non-core tables with data:      ${tablesWithData.length}`);
    console.log(`  Empty non-core tables:          ${emptyTables.length}`);
    console.log(`  Total:                          ${tables.length}`);

    // Generate DROP statements for empty tables
    if (emptyTables.length > 0) {
      console.log('\n');
      console.log('=' .repeat(70));
      console.log('🔧 SQL to drop EMPTY non-core tables:');
      console.log('=' .repeat(70));
      console.log('-- Review carefully before running!\n');
      for (const name of emptyTables) {
        console.log(`DROP TABLE IF EXISTS "${name}" CASCADE;`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
