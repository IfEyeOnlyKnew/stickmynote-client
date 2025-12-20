import { Client } from 'pg';
import * as fs from 'fs';
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

    const sqlPath = path.join(__dirname, 'setup-rls-for-local-auth.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📦 Setting up RLS helper functions...\n');
    await client.query(sql);

    console.log('\n✅ RLS setup complete!');
    console.log('\n📝 Next steps:');
    console.log('1. Use the new pg-client-with-rls.ts in your application');
    console.log('2. Example usage:');
    console.log('   import { db } from "@/lib/database/pg-client-with-rls"');
    console.log('   const userId = session.user.id');
    console.log('   await db.queryWithUser(userId, "SELECT * FROM personal_sticks WHERE user_id = $1", [userId])');
    console.log('\n   Or in transactions:');
    console.log('   await db.transactionWithUser(userId, async (client) => {');
    console.log('     // All queries here will have RLS context');
    console.log('   })');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
