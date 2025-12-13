/**
 * Database Adapter - Unified interface for Supabase and PostgreSQL
 *
 * This adapter provides a single API that works with both cloud (Supabase)
 * and local (PostgreSQL) deployments. The application code doesn't need to
 * know which backend is being used.
 *
 * Usage:
 * import { createDatabaseClient } from '@/lib/database/database-adapter'
 * const db = await createDatabaseClient()
 * const { data, error } = await db.from('users').select('*')
 */

import { cookies } from "next/headers"
import { createServerClient as createSupabaseClient } from "@supabase/ssr"
import { db as pgClient } from "./pg-client"
import { getSession } from "../auth/local-auth"

// Detect which database mode to use
const USE_LOCAL_DATABASE = process.env.USE_LOCAL_DATABASE === "true"

export interface DatabaseClient {
  from: (table: string) => QueryBuilder
  rpc: (fn: string, params?: any) => Promise<{ data: any; error: any }>
  auth: AuthClient
}

export interface QueryBuilder {
  select: (columns?: string) => QueryBuilder
  insert: (data: any) => QueryBuilder
  update: (data: any) => QueryBuilder
  delete: () => QueryBuilder
  eq: (column: string, value: any) => QueryBuilder
  neq: (column: string, value: any) => QueryBuilder
  in: (column: string, values: any[]) => QueryBuilder
  is: (column: string, value: any) => QueryBuilder
  like: (column: string, pattern: string) => QueryBuilder
  ilike: (column: string, pattern: string) => QueryBuilder
  gte: (column: string, value: any) => QueryBuilder
  lte: (column: string, value: any) => QueryBuilder
  gt: (column: string, value: any) => QueryBuilder
  lt: (column: string, value: any) => QueryBuilder
  or: (condition: string) => QueryBuilder
  order: (column: string, options?: { ascending?: boolean }) => QueryBuilder
  limit: (count: number) => QueryBuilder
  single: () => Promise<{ data: any; error: any }>
  maybeSingle: () => Promise<{ data: any; error: any }>
  then: (resolve: (value: { data: any; error: any }) => void) => Promise<{ data: any; error: any }>
}

export interface AuthClient {
  getUser: () => Promise<{ data: { user: any }; error: any }>
  signUp: (credentials: { email: string; password: string; options?: any }) => Promise<{ data: any; error: any }>
  signInWithPassword: (credentials: {
    email: string
    password: string
  }) => Promise<{ data: any; error: any }>
  signOut: (options?: any) => Promise<{ error: any }>
}

// PostgreSQL Query Builder Implementation
class PostgreSQLQueryBuilder implements QueryBuilder {
  private table: string
  private selectColumns = "*"
  private whereConditions: string[] = []
  private whereValues: any[] = []
  private orderByClause = ""
  private limitValue: number | null = null
  private insertData: any = null
  private updateData: any = null
  private isDelete = false
  private paramIndex = 1

  constructor(table: string) {
    this.table = table
  }

  select(columns?: string): QueryBuilder {
    this.selectColumns = columns || "*"
    return this
  }

  insert(data: any): QueryBuilder {
    this.insertData = data
    return this
  }

  update(data: any): QueryBuilder {
    this.updateData = data
    return this
  }

  delete(): QueryBuilder {
    this.isDelete = true
    return this
  }

  eq(column: string, value: any): QueryBuilder {
    this.whereConditions.push(`${column} = $${this.paramIndex++}`)
    this.whereValues.push(value)
    return this
  }

  neq(column: string, value: any): QueryBuilder {
    this.whereConditions.push(`${column} != $${this.paramIndex++}`)
    this.whereValues.push(value)
    return this
  }

  in(column: string, values: any[]): QueryBuilder {
    const placeholders = values.map(() => `$${this.paramIndex++}`).join(", ")
    this.whereConditions.push(`${column} IN (${placeholders})`)
    this.whereValues.push(...values)
    return this
  }

  is(column: string, value: any): QueryBuilder {
    if (value === null) {
      this.whereConditions.push(`${column} IS NULL`)
    } else {
      this.whereConditions.push(`${column} IS $${this.paramIndex++}`)
      this.whereValues.push(value)
    }
    return this
  }

  like(column: string, pattern: string): QueryBuilder {
    this.whereConditions.push(`${column} LIKE $${this.paramIndex++}`)
    this.whereValues.push(pattern)
    return this
  }

  ilike(column: string, pattern: string): QueryBuilder {
    this.whereConditions.push(`${column} ILIKE $${this.paramIndex++}`)
    this.whereValues.push(pattern)
    return this
  }

  gte(column: string, value: any): QueryBuilder {
    this.whereConditions.push(`${column} >= $${this.paramIndex++}`)
    this.whereValues.push(value)
    return this
  }

  lte(column: string, value: any): QueryBuilder {
    this.whereConditions.push(`${column} <= $${this.paramIndex++}`)
    this.whereValues.push(value)
    return this
  }

  gt(column: string, value: any): QueryBuilder {
    this.whereConditions.push(`${column} > $${this.paramIndex++}`)
    this.whereValues.push(value)
    return this
  }

  lt(column: string, value: any): QueryBuilder {
    this.whereConditions.push(`${column} < $${this.paramIndex++}`)
    this.whereValues.push(value)
    return this
  }

  or(condition: string): QueryBuilder {
    // Parse Supabase OR syntax: "column1.eq.value1,column2.eq.value2"
    const orConditions = condition.split(",").map((cond) => {
      const parts = cond.split(".")
      if (parts.length >= 3) {
        const [col, op, val] = parts
        switch (op) {
          case "eq":
            return `${col} = '${val}'`
          case "neq":
            return `${col} != '${val}'`
          case "gt":
            return `${col} > '${val}'`
          case "lt":
            return `${col} < '${val}'`
          case "gte":
            return `${col} >= '${val}'`
          case "lte":
            return `${col} <= '${val}'`
          case "like":
            return `${col} LIKE '${val}'`
          case "ilike":
            return `${col} ILIKE '${val}'`
          default:
            return cond
        }
      }
      return cond
    })
    this.whereConditions.push(`(${orConditions.join(" OR ")})`)
    return this
  }

  order(column: string, options?: { ascending?: boolean }): QueryBuilder {
    const direction = options?.ascending === false ? "DESC" : "ASC"
    this.orderByClause = `ORDER BY ${column} ${direction}`
    return this
  }

  limit(count: number): QueryBuilder {
    this.limitValue = count
    return this
  }

  private buildQuery(): string {
    let query = ""

    if (this.insertData) {
      const keys = Object.keys(this.insertData)
      const values = Object.values(this.insertData)
      const placeholders = values.map((_, i) => `$${i + 1}`).join(", ")
      query = `INSERT INTO ${this.table} (${keys.join(", ")}) VALUES (${placeholders}) RETURNING *`
      this.whereValues = values
    } else if (this.updateData) {
      const keys = Object.keys(this.updateData)
      const values = Object.values(this.updateData)
      const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(", ")
      query = `UPDATE ${this.table} SET ${setClause}`
      this.whereValues = [...values, ...this.whereValues]
      // Adjust paramIndex for WHERE clause
      this.whereConditions = this.whereConditions.map((cond) => {
        return cond.replace(/\$(\d+)/g, (_, num) => `$${Number.parseInt(num) + values.length}`)
      })
    } else if (this.isDelete) {
      query = `DELETE FROM ${this.table}`
    } else {
      query = `SELECT ${this.selectColumns} FROM ${this.table}`
    }

    if (this.whereConditions.length > 0) {
      query += ` WHERE ${this.whereConditions.join(" AND ")}`
    }

    if (this.orderByClause) {
      query += ` ${this.orderByClause}`
    }

    if (this.limitValue !== null) {
      query += ` LIMIT ${this.limitValue}`
    }

    return query
  }

  async single(): Promise<{ data: any; error: any }> {
    try {
      const query = this.buildQuery()
      const result = await pgClient.query(query, this.whereValues)
      return {
        data: result.rows[0] || null,
        error: result.rows.length === 0 ? { message: "No rows found" } : null,
      }
    } catch (error: any) {
      return { data: null, error: { message: error.message } }
    }
  }

  async maybeSingle(): Promise<{ data: any; error: any }> {
    try {
      const query = this.buildQuery()
      const result = await pgClient.query(query, this.whereValues)
      return { data: result.rows[0] || null, error: null }
    } catch (error: any) {
      return { data: null, error: { message: error.message } }
    }
  }

  async then(resolve: (value: { data: any; error: any }) => void): Promise<{ data: any; error: any }> {
    try {
      const query = this.buildQuery()
      const result = await pgClient.query(query, this.whereValues)
      const response = { data: result.rows, error: null }
      resolve(response)
      return response
    } catch (error: any) {
      const response = { data: null, error: { message: error.message } }
      resolve(response)
      return response
    }
  }
}

// PostgreSQL Auth Client Implementation
class PostgreSQLAuthClient implements AuthClient {
  async getUser(): Promise<{ data: { user: any }; error: any }> {
    try {
      const session = await getSession()
      if (!session) {
        return { data: { user: null }, error: { message: "No session found" } }
      }
      return { data: { user: session.user }, error: null }
    } catch (error: any) {
      return { data: { user: null }, error: { message: error.message } }
    }
  }

  async signUp(credentials: { email: string; password: string; options?: any }): Promise<{ data: any; error: any }> {
    const { signUp } = await import("../auth/local-auth")
    const result = await signUp(credentials.email, credentials.password, credentials.options?.data?.full_name)
    if (result.error) {
      return { data: null, error: { message: result.error } }
    }
    return { data: { user: result.user, session: null }, error: null }
  }

  async signInWithPassword(credentials: {
    email: string
    password: string
  }): Promise<{ data: any; error: any }> {
    const { signIn, setSessionCookie } = await import("../auth/local-auth")
    const result = await signIn(credentials.email, credentials.password)
    if (result.error) {
      return { data: null, error: { message: result.error } }
    }
    await setSessionCookie(result.token)
    return { data: { user: result.user, session: { access_token: result.token } }, error: null }
  }

  async signOut(options?: any): Promise<{ error: any }> {
    const { clearSession } = await import("../auth/local-auth")
    await clearSession()
    return { error: null }
  }
}

// PostgreSQL Database Client Implementation
class PostgreSQLDatabaseClient implements DatabaseClient {
  from(table: string): QueryBuilder {
    return new PostgreSQLQueryBuilder(table)
  }

  async rpc(fn: string, params?: any): Promise<{ data: any; error: any }> {
    try {
      // Call PostgreSQL stored procedure
      const paramValues = params ? Object.values(params) : []
      const paramPlaceholders = paramValues.map((_, i) => `$${i + 1}`).join(", ")
      const query = `SELECT * FROM ${fn}(${paramPlaceholders})`
      const result = await pgClient.query(query, paramValues)
      return { data: result.rows, error: null }
    } catch (error: any) {
      return { data: null, error: { message: error.message } }
    }
  }

  auth: AuthClient = new PostgreSQLAuthClient()
}

/**
 * Create a database client based on environment configuration
 *
 * If USE_LOCAL_DATABASE=true, returns PostgreSQL adapter
 * Otherwise, returns Supabase client
 */
export async function createDatabaseClient(): Promise<DatabaseClient> {
  if (USE_LOCAL_DATABASE) {
    return new PostgreSQLDatabaseClient()
  }

  // Return Supabase client with standard interface
  const cookieStore = await cookies()
  return createSupabaseClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            const secureOptions = {
              ...options,
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: "lax" as const,
              path: "/",
              domain: undefined,
            }
            cookieStore.set(name, value, secureOptions)
          })
        } catch (error) {
          console.error("[Database] Error setting cookies:", error)
        }
      },
    },
  }) as unknown as DatabaseClient
}

/**
 * Create a service/admin database client
 */
export async function createServiceDatabaseClient(): Promise<DatabaseClient> {
  if (USE_LOCAL_DATABASE) {
    // For local database, use the same client (already has admin access)
    return new PostgreSQLDatabaseClient()
  }

  const { createClient } = await import("@supabase/supabase-js")
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }) as unknown as DatabaseClient
}
