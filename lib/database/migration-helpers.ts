/**
 * PostgreSQL Query Helper Functions
 * 
 * Common patterns for PostgreSQL queries with type-safe wrappers
 */

import { db } from "@/lib/database/pg-client"
import { getSession } from "@/lib/auth/local-auth"

// ============================================================================
// AUTHENTICATION HELPERS
// ============================================================================

/**
 * Get authenticated user from session
 */
export async function getAuthenticatedUser() {
  const session = await getSession()
  
  if (!session) {
    return { user: null, error: "Not authenticated" }
  }
  
  return { user: session.user, error: null }
}

/**
 * Require authenticated user - throws if not authenticated
 */
export async function requireAuth() {
  const { user, error } = await getAuthenticatedUser()
  
  if (!user) {
    throw new Error(error || "Authentication required")
  }
  
  return user
}

// ============================================================================
// QUERY HELPERS
// ============================================================================

/**
 * Execute a SELECT query with optional filtering
 * 
 * Example:
 * const data = await selectQuery("users", ["*"], { id: userId })
 */
export async function selectQuery<T = any>(
  table: string,
  columns: string[] = ["*"],
  where?: Record<string, any>,
  options?: {
    limit?: number
    offset?: number
    orderBy?: string
    orderDirection?: "ASC" | "DESC"
    single?: boolean
  }
): Promise<T[]> {
  const columnList = columns.join(", ")
  const whereClauses: string[] = []
  const values: any[] = []
  
  if (where) {
    let paramIndex = 1
    for (const [key, value] of Object.entries(where)) {
      whereClauses.push(`${key} = $${paramIndex}`)
      values.push(value)
      paramIndex++
    }
  }
  
  let query = `SELECT ${columnList} FROM ${table}`
  
  if (whereClauses.length > 0) {
    query += ` WHERE ${whereClauses.join(" AND ")}`
  }
  
  if (options?.orderBy) {
    query += ` ORDER BY ${options.orderBy} ${options.orderDirection || "ASC"}`
  }
  
  if (options?.limit) {
    query += ` LIMIT ${options.limit}`
  }
  
  if (options?.offset) {
    query += ` OFFSET ${options.offset}`
  }
  
  const result = await db.query(query, values)
  
  if (options?.single) {
    return result.rows[0]
  }
  
  return result.rows
}

/**
 * Insert record
 */
export async function insertQuery<T = any>(
  table: string,
  data: Record<string, any>
): Promise<T> {
  const columns = Object.keys(data)
  const values = Object.values(data)
  const placeholders = values.map((_, i) => `$${i + 1}`).join(", ")
  
  const query = `
    INSERT INTO ${table} (${columns.join(", ")})
    VALUES (${placeholders})
    RETURNING *
  `
  
  const result = await db.query(query, values)
  return result.rows[0]
}

/**
 * Update record
 */
export async function updateQuery<T = any>(
  table: string,
  data: Record<string, any>,
  where: Record<string, any>
): Promise<T[]> {
  const setClauses: string[] = []
  const values: any[] = []
  let paramIndex = 1
  
  for (const [key, value] of Object.entries(data)) {
    setClauses.push(`${key} = $${paramIndex}`)
    values.push(value)
    paramIndex++
  }
  
  const whereClauses: string[] = []
  for (const [key, value] of Object.entries(where)) {
    whereClauses.push(`${key} = $${paramIndex}`)
    values.push(value)
    paramIndex++
  }
  
  const query = `
    UPDATE ${table}
    SET ${setClauses.join(", ")}
    WHERE ${whereClauses.join(" AND ")}
    RETURNING *
  `
  
  const result = await db.query(query, values)
  return result.rows
}

/**
 * Delete record
 */
export async function deleteQuery(
  table: string,
  where: Record<string, any>
): Promise<number> {
  const whereClauses: string[] = []
  const values: any[] = []
  let paramIndex = 1
  
  for (const [key, value] of Object.entries(where)) {
    whereClauses.push(`${key} = $${paramIndex}`)
    values.push(value)
    paramIndex++
  }
  
  const query = `
    DELETE FROM ${table}
    WHERE ${whereClauses.join(" AND ")}
  `
  
  const result = await db.query(query, values)
  return result.rowCount || 0
}

/**
 * Count records
 */
export async function countQuery(
  table: string,
  where?: Record<string, any>
): Promise<number> {
  const whereClauses: string[] = []
  const values: any[] = []
  
  if (where) {
    let paramIndex = 1
    for (const [key, value] of Object.entries(where)) {
      whereClauses.push(`${key} = $${paramIndex}`)
      values.push(value)
      paramIndex++
    }
  }
  
  let query = `SELECT COUNT(*) as count FROM ${table}`
  
  if (whereClauses.length > 0) {
    query += ` WHERE ${whereClauses.join(" AND ")}`
  }
  
  const result = await db.query(query, values)
  return Number.parseInt(result.rows[0].count, 10)
}

// ============================================================================
// RLS HELPERS (Row Level Security)
// ============================================================================

/**
 * Execute query with user context for RLS
 * NOTE: This is a placeholder - actual RLS implementation should set session variables
 */
export async function queryWithRLS<T = any>(
  userId: string,
  queryText: string,
  params?: any[]
): Promise<T[]> {
  // Set RLS context and execute query
  await db.query(`SET LOCAL app.current_user_id = $1`, [userId])
  const result = await db.query(queryText, params)
  return result.rows
}

/**
 * Transaction with user context
 */
export async function transactionWithRLS<T>(
  userId: string,
  callback: (client: any) => Promise<T>
): Promise<T> {
  return db.transaction(async (client) => {
    await client.query(`SET LOCAL app.current_user_id = $1`, [userId])
    return callback(client)
  })
}
