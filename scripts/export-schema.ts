import { config } from "dotenv"
import { resolve } from "node:path"
import { Pool } from "pg"
import { writeFileSync } from "node:fs"

// Load environment variables
const envPath = resolve(process.cwd(), ".env.local")
const envResult = config({ path: envPath })
if (envResult.error) {
  config({ path: resolve(process.cwd(), ".env") })
}

/**
 * PostgreSQL Schema Export Script
 * 
 * Exports database schema information to a JSON file for documentation and troubleshooting.
 * 
 * Run with: pnpm export:schema
 */

interface TableInfo {
  tableName: string
  columns: ColumnInfo[]
  primaryKeys: string[]
  foreignKeys: ForeignKeyInfo[]
  indexes: IndexInfo[]
  rowCount?: number
}

interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  default: string | null
  description?: string
}

interface ForeignKeyInfo {
  constraintName: string
  column: string
  referencedTable: string
  referencedColumn: string
}

interface IndexInfo {
  indexName: string
  columns: string[]
  unique: boolean
  type: string
}

async function exportSchema() {
  console.log("\n" + "=".repeat(70))
  console.log("PostgreSQL Schema Export")
  console.log("=".repeat(70) + "\n")

  // Create connection pool
  const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    port: Number.parseInt(process.env.POSTGRES_PORT || "5432"),
    database: process.env.POSTGRES_DATABASE,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    ssl: process.env.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : false,
  })

  try {
    console.log(`🔗 Connected to: ${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}\n`)

    // Get all tables
    console.log("📋 Fetching tables...")
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `)

    const tables = tablesResult.rows.map((row: any) => row.table_name)
    console.log(`   Found ${tables.length} tables\n`)

    const schema: { [key: string]: TableInfo } = {}

    // Process each table
    for (const tableName of tables) {
      process.stdout.write(`📊 Processing ${tableName}...`)

      // Get columns
      const columnsResult = await pool.query(
        `
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          is_nullable,
          column_default,
          udt_name
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = $1
        ORDER BY ordinal_position
      `,
        [tableName],
      )

      const columns: ColumnInfo[] = columnsResult.rows.map((col: any) => ({
        name: col.column_name,
        type:
          col.character_maximum_length
            ? `${col.data_type}(${col.character_maximum_length})`
            : col.data_type,
        nullable: col.is_nullable === "YES",
        default: col.column_default,
      }))

      // Get primary keys
      const pkResult = await pool.query(
        `
        SELECT a.attname
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = $1::regclass
        AND i.indisprimary
      `,
        [tableName],
      )

      const primaryKeys = pkResult.rows.map((row: any) => row.attname)

      // Get foreign keys
      const fkResult = await pool.query(
        `
        SELECT
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = $1
      `,
        [tableName],
      )

      const foreignKeys: ForeignKeyInfo[] = fkResult.rows.map((row: any) => ({
        constraintName: row.constraint_name,
        column: row.column_name,
        referencedTable: row.foreign_table_name,
        referencedColumn: row.foreign_column_name,
      }))

      // Get indexes
      const indexResult = await pool.query(
        `
        SELECT
          i.relname AS index_name,
          array_agg(a.attname ORDER BY a.attnum) AS column_names,
          ix.indisunique AS is_unique,
          am.amname AS index_type
        FROM pg_class t
        JOIN pg_index ix ON t.oid = ix.indrelid
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_am am ON i.relam = am.oid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
        WHERE t.relname = $1
        AND t.relkind = 'r'
        GROUP BY i.relname, ix.indisunique, am.amname
        ORDER BY i.relname
      `,
        [tableName],
      )

      const indexes: IndexInfo[] = indexResult.rows.map((row: any) => ({
        indexName: row.index_name,
        columns: row.column_names,
        unique: row.is_unique,
        type: row.index_type,
      }))

      // Get approximate row count (fast)
      const countResult = await pool.query(
        `
        SELECT reltuples::bigint AS estimate 
        FROM pg_class 
        WHERE relname = $1
      `,
        [tableName],
      )

      const rowCount = countResult.rows[0]?.estimate || 0

      schema[tableName] = {
        tableName,
        columns,
        primaryKeys,
        foreignKeys,
        indexes,
        rowCount,
      }

      console.log(` ✓`)
    }

    // Get database info
    const dbInfoResult = await pool.query(`
      SELECT 
        version() as version,
        current_database() as database,
        current_user as user,
        pg_database_size(current_database()) as size_bytes,
        (SELECT count(*) FROM pg_stat_user_tables) as table_count
    `)

    const dbInfo = dbInfoResult.rows[0]

    // Create export object
    const exportData = {
      exportedAt: new Date().toISOString(),
      database: {
        name: dbInfo.database,
        version: dbInfo.version,
        user: dbInfo.user,
        sizeBytes: Number.parseInt(dbInfo.size_bytes),
        sizeMB: Math.round(Number.parseInt(dbInfo.size_bytes) / 1024 / 1024),
        tableCount: Number.parseInt(dbInfo.table_count),
      },
      tables: schema,
    }

    // Write to file
    const outputPath = resolve(process.cwd(), "database-schema.json")
    writeFileSync(outputPath, JSON.stringify(exportData, null, 2), "utf-8")

    console.log("\n" + "=".repeat(70))
    console.log("Export Complete")
    console.log("=".repeat(70))
    console.log(`\n📁 Schema exported to: ${outputPath}`)
    console.log(`\n📊 Database Statistics:`)
    console.log(`   Version: ${dbInfo.version.split(',')[0]}`)
    console.log(`   Tables: ${tables.length}`)
    console.log(`   Size: ${Math.round(Number.parseInt(dbInfo.size_bytes) / 1024 / 1024)} MB`)
    console.log(`\n✅ Done!\n`)

    await pool.end()
    process.exit(0)
  } catch (error) {
    console.error("\n❌ Error exporting schema:", error)
    await pool.end()
    process.exit(1)
  }
}

// Run export
;(async () => {
  await exportSchema()
})()
