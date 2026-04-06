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

// Tables that appear to have ZERO code references (candidates for deletion)
const POTENTIALLY_UNUSED_TABLES = [
  'note_shares',
  'note_attachments',
  'note_favorites',
  'note_versions',
  'note_views',
  'note_tags',
  'reply_reactions',
];

// Tables we initially thought were unused but ARE actually used
const TABLES_STILL_IN_USE = [
  'chat_messages',
  'notes',
  'note_tabs',
  'replies',
  'sticks',
  'stick_replies',
  'stick_reactions',
];

// ============================================================================
// Table inspection helpers
// ============================================================================

async function getRowCount(table: string): Promise<{ count: number; error?: string }> {
  try {
    const countResult = await client.query(`SELECT COUNT(*) as count FROM "${table}"`);
    return { count: Number.parseInt(countResult.rows[0].count) };
  } catch (err: any) {
    return { count: -1, error: err.message };
  }
}

interface TableInspection {
  table: string
  exists: boolean
  count: number
  error?: string
}

async function inspectTable(table: string, existingTables: Set<string>): Promise<TableInspection> {
  if (!existingTables.has(table)) {
    return { table, exists: false, count: 0 };
  }
  const { count, error } = await getRowCount(table);
  return { table, exists: true, count, error };
}

async function inspectTables(tables: string[], existingTables: Set<string>): Promise<TableInspection[]> {
  const results: TableInspection[] = [];
  for (const table of tables) {
    results.push(await inspectTable(table, existingTables));
  }
  return results;
}

function printUnusedTable(info: TableInspection): void {
  if (!info.exists) {
    console.log(`  ${info.table.padEnd(25)} NOT FOUND (already deleted or never created)`);
    return;
  }
  if (info.error) {
    console.log(`  ${info.table.padEnd(25)} EXISTS    Error counting: ${info.error}`);
    return;
  }
  const status = info.count === 0 ? 'EMPTY - Safe to drop' : `HAS ${info.count} ROWS`;
  console.log(`  ${info.table.padEnd(25)} EXISTS    ${status}`);
}

function printInUseTable(info: TableInspection): void {
  if (!info.exists) {
    console.log(`  ${info.table.padEnd(25)} NOT FOUND`);
    return;
  }
  if (info.error) {
    console.log(`  ${info.table.padEnd(25)} EXISTS    Error counting: ${info.error}`);
    return;
  }
  console.log(`  ${info.table.padEnd(25)} EXISTS    ${info.count} rows`);
}

function categorizeTables(inspections: TableInspection[]): { safeToDrop: string[]; notEmpty: string[]; notFound: string[] } {
  const safeToDrop: string[] = [];
  const notEmpty: string[] = [];
  const notFound: string[] = [];

  for (const info of inspections) {
    if (!info.exists) { notFound.push(info.table); continue; }
    if (info.error) continue;
    if (info.count === 0) safeToDrop.push(info.table);
    else notEmpty.push(`${info.table} (${info.count} rows)`);
  }

  return { safeToDrop, notEmpty, notFound };
}

function printSummary(safeToDrop: string[], notEmpty: string[], notFound: string[]): void {
  console.log('');
  console.log('=' .repeat(70));
  console.log('SUMMARY - Tables safe to DROP');
  console.log('=' .repeat(70));
  console.log('');

  if (safeToDrop.length > 0) {
    console.log('Safe to drop (empty tables):');
    safeToDrop.forEach(t => console.log(`   - ${t}`));
  }

  if (notEmpty.length > 0) {
    console.log('\nReview before dropping (have data):');
    notEmpty.forEach(t => console.log(`   - ${t}`));
  }

  if (notFound.length > 0) {
    console.log('\nAlready gone (not in database):');
    notFound.forEach(t => console.log(`   - ${t}`));
  }

  if (safeToDrop.length > 0) {
    console.log('\n');
    console.log('=' .repeat(70));
    console.log('SQL to drop empty unused tables:');
    console.log('=' .repeat(70));
    console.log('');
    safeToDrop.forEach(t => console.log(`DROP TABLE IF EXISTS "${t}" CASCADE;`));
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected!\n');

    const tablesResult = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `);

    const existingTables = new Set(tablesResult.rows.map(r => r.tablename));
    console.log(`Total tables in database: ${existingTables.size}\n`);

    // Check potentially unused tables
    console.log('=' .repeat(70));
    console.log('POTENTIALLY UNUSED TABLES (Zero code references)');
    console.log('=' .repeat(70));
    console.log('');

    const unusedInspections = await inspectTables(POTENTIALLY_UNUSED_TABLES, existingTables);
    unusedInspections.forEach(printUnusedTable);

    // Check tables that are still in use
    console.log('');
    console.log('=' .repeat(70));
    console.log('TABLES THAT ARE STILL IN USE (Do NOT delete)');
    console.log('=' .repeat(70));
    console.log('');

    const inUseInspections = await inspectTables(TABLES_STILL_IN_USE, existingTables);
    inUseInspections.forEach(printInUseTable);

    // Summary
    const { safeToDrop, notEmpty, notFound } = categorizeTables(unusedInspections);
    printSummary(safeToDrop, notEmpty, notFound);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
