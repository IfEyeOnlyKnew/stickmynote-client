import { config } from "dotenv"
import { resolve } from "node:path"
import { Pool } from "pg"

// Load environment variables BEFORE doing anything else
const envPath = resolve(process.cwd(), ".env.local")
const envResult = config({ path: envPath })
if (envResult.error) {
  // Try .env if .env.local doesn't exist
  config({ path: resolve(process.cwd(), ".env") })
}

/**
 * PostgreSQL Connection Test Script
 * 
 * This script tests the connection to your remote PostgreSQL server
 * and verifies database configuration.
 * 
 * Run with: pnpm test:db
 */

interface TestResult {
  test: string
  status: "✓ PASS" | "✗ FAIL"
  message: string
  details?: any
}

async function testDatabaseConnection() {
  console.log("\n" + "=".repeat(70))
  console.log("PostgreSQL Connection Test - Remote Server")
  console.log("=".repeat(70) + "\n")

  const results: TestResult[] = []

  // Test 1: Environment Variables
  console.log("📋 Test 1: Checking environment variables...")
  const envVars = {
    POSTGRES_HOST: process.env.POSTGRES_HOST,
    POSTGRES_PORT: process.env.POSTGRES_PORT,
    POSTGRES_DATABASE: process.env.POSTGRES_DATABASE,
    POSTGRES_USER: process.env.POSTGRES_USER,
    POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD ? "***SET***" : undefined,
    POSTGRES_SSL: process.env.POSTGRES_SSL,
    POSTGRES_SSL_REJECT_UNAUTHORIZED: process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED,
  }

  const missingVars = Object.entries(envVars)
    .filter(([key, value]) => !value && key !== "POSTGRES_SSL" && key !== "POSTGRES_SSL_REJECT_UNAUTHORIZED")
    .map(([key]) => key)

  if (missingVars.length > 0) {
    results.push({
      test: "Environment Variables",
      status: "✗ FAIL",
      message: `Missing: ${missingVars.join(", ")}`,
      details: envVars,
    })
    
    // Exit early if env vars are missing
    console.log("\n" + "=".repeat(70))
    console.log("Test Results")
    console.log("=".repeat(70) + "\n")
    console.log("✗ FAIL Environment Variables")
    console.log(`   ${results[0].message}`)
    console.log("\n" + "=".repeat(70))
    console.log("Cannot proceed without environment variables. Please check your .env file.")
    console.log("=".repeat(70) + "\n")
    process.exit(1)
  }

  results.push({
    test: "Environment Variables",
    status: "✓ PASS",
    message: "All required environment variables are set",
    details: envVars,
  })

  // Create PostgreSQL pool with loaded env vars
  const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    port: Number.parseInt(process.env.POSTGRES_PORT || "5432"),
    database: process.env.POSTGRES_DATABASE,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    ssl: process.env.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  })

  console.log(`\n🔗 Attempting to connect to: ${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}\n`)

  // Test 2: Database Health Check
  console.log("🔌 Test 2: Testing database connection...")
  try {
    const result = await pool.query("SELECT NOW() as current_time")
    results.push({
      test: "Database Connection",
      status: "✓ PASS",
      message: `Connected to PostgreSQL at ${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}`,
      details: { currentTime: result.rows[0].current_time },
    })
  } catch (error) {
    results.push({
      test: "Database Connection",
      status: "✗ FAIL",
      message: error instanceof Error ? error.message : "Unknown error",
    })
  }

  // Test 3: Query Execution
  console.log("🔍 Test 3: Testing query execution...")
  try {
    const result = await pool.query("SELECT version(), current_database(), current_user")
    results.push({
      test: "Query Execution",
      status: "✓ PASS",
      message: "Successfully executed test query",
      details: result.rows[0],
    })
  } catch (error) {
    results.push({
      test: "Query Execution",
      status: "✗ FAIL",
      message: error instanceof Error ? error.message : "Unknown error",
    })
  }

  // Test 4: SSL/TLS Configuration
  console.log("🔒 Test 4: Checking SSL/TLS configuration...")
  const sslEnabled = process.env.POSTGRES_SSL === "true"
  results.push({
    test: "SSL/TLS Configuration",
    status: sslEnabled ? "✓ PASS" : "✗ FAIL",
    message: sslEnabled 
      ? "SSL is enabled (recommended for remote connections)"
      : "SSL is disabled (not recommended for remote connections)",
  })

  // Test 5: Connection Pool
  console.log("💧 Test 5: Testing connection pool...")
  try {
    const client = await pool.connect()
    await client.query("SELECT 1")
    client.release()
    results.push({
      test: "Connection Pool",
      status: "✓ PASS",
      message: "Successfully acquired and released client from pool",
    })
  } catch (error) {
    results.push({
      test: "Connection Pool",
      status: "✗ FAIL",
      message: error instanceof Error ? error.message : "Unknown error",
    })
  }

  // Test 6: Check Required Tables
  console.log("📊 Test 6: Checking database schema...")
  try {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `)
    
    const tableCount = result.rows.length
    const tables = result.rows.map((row: any) => row.table_name)
    
    results.push({
      test: "Database Schema",
      status: tableCount > 0 ? "✓ PASS" : "✗ FAIL",
      message: tableCount > 0 
        ? `Found ${tableCount} tables in database`
        : "No tables found - database may need initialization",
      details: tables.slice(0, 10), // Show first 10 tables
    })
  } catch (error) {
    results.push({
      test: "Database Schema",
      status: "✗ FAIL",
      message: error instanceof Error ? error.message : "Unknown error",
    })
  }

  // Print Results
  console.log("\n" + "=".repeat(70))
  console.log("Test Results")
  console.log("=".repeat(70) + "\n")

  results.forEach((result) => {
    console.log(`${result.status} ${result.test}`)
    console.log(`   ${result.message}`)
    if (result.details) {
      console.log(`   Details:`, JSON.stringify(result.details, null, 2))
    }
    console.log()
  })

  // Summary
  const passed = results.filter((r) => r.status === "✓ PASS").length
  const failed = results.filter((r) => r.status === "✗ FAIL").length

  console.log("=".repeat(70))
  console.log(`Summary: ${passed} passed, ${failed} failed out of ${results.length} tests`)
  console.log("=".repeat(70) + "\n")

  // Close connection
  await pool.end()

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0)
}

// Run tests
;(async () => {
  try {
    await testDatabaseConnection()
  } catch (error) {
    console.error("\n❌ Fatal Error:", error)
    process.exit(1)
  }
})()
