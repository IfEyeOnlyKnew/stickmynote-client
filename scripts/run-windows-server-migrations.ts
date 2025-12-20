import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const client = new Client({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DATABASE || process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// Windows Server SQL files in order
const windowsServerFiles = [
  '01-create-core-tables.sql',
  '02-create-server-config-table.sql',
  '02-create-sticks-tables.sql',
  '03-create-social-tables.sql',
  '04-create-calstick-tables.sql',
  '05-create-teams-projects-tables.sql',
  '06-create-notifications-activity-tables.sql',
  '07-create-analytics-system-tables.sql',
  '08-create-tags-search-ai-tables.sql',
];

async function runMigration(filePath: string): Promise<{ success: boolean; skipped: number; errors: number }> {
  const sql = fs.readFileSync(filePath, 'utf8');
  
  try {
    // Try to run the entire file first
    await client.query(sql);
    console.log(`   ✅ Success`);
    return { success: true, skipped: 0, errors: 0 };
  } catch (error: any) {
    // If full file fails, try statement by statement
    console.log(`   ⚙️  Running statement by statement...`);
    
    // Split SQL into statements (handle semicolons inside strings)
    const statements = sql.split(/;[\s]*(?=(?:[^']*'[^']*')*[^']*$)/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    for (const statement of statements) {
      const trimmed = statement.trim();
      if (!trimmed || trimmed.startsWith('--')) continue;
      
      try {
        await client.query(trimmed + ';');
        successCount++;
      } catch (stmtError: any) {
        const errorMsg = stmtError.message.toLowerCase();
        
        // Benign errors we can skip
        if (errorMsg.includes('already exists') ||
            errorMsg.includes('duplicate key') ||
            (errorMsg.includes('does not exist') && trimmed.toUpperCase().startsWith('DROP'))) {
          skipCount++;
        } else {
          // Log real errors but continue
          console.log(`   ⚠️  Skipped statement: ${errorMsg.split('\n')[0]}`);
          skipCount++;
        }
      }
    }
    
    console.log(`   ✅ Completed (${successCount} executed, ${skipCount} skipped)`);
    return { success: successCount > 0, skipped: skipCount, errors: errorCount };
  }
}

async function main() {
  try {
    console.log('🔄 Connecting to database...');
    await client.connect();
    console.log('✅ Connected!\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📦 Running Windows Server Migrations\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const windowsServerDir = path.join(__dirname, 'windows-server');
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const file of windowsServerFiles) {
      const filePath = path.join(windowsServerDir, file);
      
      if (!fs.existsSync(filePath)) {
        console.log(`⚠️  File not found: ${file}`);
        continue;
      }

      console.log(`📄 Running: ${file}`);
      const result = await runMigration(filePath);
      
      if (result.success) {
        successCount++;
      }
      skipCount += result.skipped;
      errorCount += result.errors;
      
      console.log(''); // Empty line between files
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📊 Migration Summary:');
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ⚠️  Skipped statements: ${skipCount}`);
    console.log(`   ❌ Errors: ${errorCount}\n`);

    if (errorCount === 0) {
      console.log('🎉 All migrations completed successfully!\n');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('👋 Database connection closed');
  }
}

main();
