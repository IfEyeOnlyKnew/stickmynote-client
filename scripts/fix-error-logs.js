const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  port: parseInt(process.env.POSTGRES_PORT || '5432')
});

async function run() {
  try {
    // Check columns
    const cols = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'error_logs'
    `);
    console.log('Current columns:', cols.rows.map(x => x.column_name));
    
    // Add level column if missing
    if (!cols.rows.find(x => x.column_name === 'level')) {
      console.log('Adding level column...');
      await pool.query(`ALTER TABLE error_logs ADD COLUMN level VARCHAR(20) DEFAULT 'error'`);
      console.log('Level column added');
    }
    
    // Add indexes
    console.log('Adding indexes...');
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_error_logs_level ON error_logs(level)`);
    console.log('Indexes created successfully');
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

run();
