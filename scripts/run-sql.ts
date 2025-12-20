import { config } from "dotenv"
import { resolve } from "node:path"
import { Pool } from "pg"
import { readFileSync, existsSync } from "node:fs"

// Load environment variables
const envPath = resolve(process.cwd(), ".env.local")
const envResult = config({ path: envPath })
if (envResult.error) {
  config({ path: resolve(process.cwd(), ".env") })
}

/**
 * SQL Script Runner
 * 
 * Execute SQL scripts against your PostgreSQL database.
 * 
 * Usage:
 *   pnpm sql:run path/to/script.sql
 *   pnpm sql:run "SELECT * FROM users LIMIT 5"
 */

async function runSQL() {
  const args = process.argv.slice(2)
  
  if (args.length === 0) {
    console.error("\n❌ Error: No SQL provided")
    console.log("\nUsage:")
    console.log("  pnpm sql:run path/to/script.sql")
    console.log('  pnpm sql:run "SELECT * FROM users LIMIT 5"')
    console.log("\nExamples:")
    console.log("  pnpm sql:run scripts/migrations/001_add_column.sql")
    console.log('  pnpm sql:run "SELECT COUNT(*) FROM users"')
    process.exit(1)
  }

  const sqlInput = args.join(" ")
  let sqlQuery: string

  // Check if it's a file path
  if (existsSync(sqlInput)) {
    console.log(`\n📄 Reading SQL from file: ${sqlInput}`)
    sqlQuery = readFileSync(sqlInput, "utf-8")
  } else {
    sqlQuery = sqlInput
  }

  console.log("\n" + "=".repeat(70))
  console.log("SQL Script Runner")
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
    console.log(`🔗 Connected to: ${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}`)
    console.log(`📊 Database: ${process.env.POSTGRES_DATABASE}\n`)

    // Display the SQL (truncate if too long)
    const displaySQL = sqlQuery.length > 200 ? sqlQuery.substring(0, 200) + "..." : sqlQuery
    console.log("🔍 Executing SQL:")
    console.log("-".repeat(70))
    console.log(displaySQL)
    console.log("-".repeat(70) + "\n")

    const startTime = Date.now()
    const result = await pool.query(sqlQuery)
    const duration = Date.now() - startTime

    console.log("✅ Success!")
    console.log(`⏱️  Execution time: ${duration}ms`)

    if (result.command === "SELECT") {
      console.log(`📊 Rows returned: ${result.rowCount}`)
      
      if (result.rows.length > 0) {
        console.log("\n" + "=".repeat(70))
        console.log("Results:")
        console.log("=".repeat(70))
        
        // Display up to 20 rows
        const displayRows = result.rows.slice(0, 20)
        console.table(displayRows)
        
        if (result.rows.length > 20) {
          console.log(`\n... and ${result.rows.length - 20} more rows`)
        }
      } else {
        console.log("\n(No rows returned)")
      }
    } else if (result.command === "INSERT" || result.command === "UPDATE" || result.command === "DELETE") {
      console.log(`📝 Rows affected: ${result.rowCount}`)
    } else {
      console.log(`📝 Command: ${result.command}`)
      if (result.rowCount) {
        console.log(`📊 Rows affected: ${result.rowCount}`)
      }
    }

    console.log("\n✅ Done!\n")
    await pool.end()
    process.exit(0)
  } catch (error: any) {
    console.error("\n❌ Error executing SQL:")
    console.error(error.message)
    
    if (error.position) {
      console.error(`\nError at position ${error.position} in query`)
    }
    
    if (error.detail) {
      console.error(`Detail: ${error.detail}`)
    }
    
    if (error.hint) {
      console.error(`Hint: ${error.hint}`)
    }
    
    await pool.end()
    process.exit(1)
  }
}

// Run SQL
;(async () => {
  await runSQL()
})()
