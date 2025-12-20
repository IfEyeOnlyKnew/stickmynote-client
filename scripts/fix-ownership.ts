import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Connect as postgres superuser
const client = new Client({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DATABASE,
  user: 'postgres',  // Use postgres superuser
  password: process.env.POSTGRES_PASSWORD, // Use the same password or provide postgres password
  ssl: process.env.POSTGRES_SSL === 'true' ? {
    rejectUnauthorized: process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED !== 'false'
  } : false
});

async function fixOwnership() {
  console.log('🔧 Fixing table ownership...\n');
  console.log(`📦 Database: ${process.env.POSTGRES_DATABASE}`);
  console.log(`🖥️  Host: ${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}`);
  console.log(`👤 User: postgres (superuser)\n`);
  console.log('━'.repeat(60));
  
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    const sqlFile = path.join(__dirname, 'fix-table-ownership.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    console.log('⚙️  Executing ownership transfer...\n');
    await client.query(sql);
    
    console.log('\n✅ Ownership and privileges successfully transferred to stickmynote_user');
    console.log('\n' + '━'.repeat(60));
    console.log('\n🎉 Table ownership fixed! You can now run migrations.');
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.message.includes('password authentication failed')) {
      console.error('\n💡 Tip: Make sure you have the correct postgres superuser password.');
      console.error('   You may need to update POSTGRES_PASSWORD in .env or set POSTGRES_SUPERUSER_PASSWORD');
    }
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n👋 Database connection closed');
  }
}

fixOwnership();
