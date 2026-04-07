import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg"
import {
  type DatabaseConfig,
  buildDatabaseConfig,
  createPool,
  executeTransaction,
  performHealthCheck,
  queryOneHelper,
  queryManyHelper,
  executeHelper,
} from "./pg-shared"

class PostgresDatabase {
  private pool: Pool | null = null
  private readonly config: DatabaseConfig

  constructor() {
    this.config = buildDatabaseConfig(20)
  }

  private getPool(): Pool {
    this.pool ??= createPool(this.config)
    return this.pool
  }

  async query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const pool = this.getPool()
    try {
      const start = Date.now()
      const result = await pool.query<T>(text, params)
      const duration = Date.now() - start
      console.log("[PostgreSQL] Query executed", { text: text.substring(0, 100), duration, rows: result.rowCount })
      return result
    } catch (error) {
      console.error("[PostgreSQL] Query error:", error)
      throw error
    }
  }

  async getClient(): Promise<PoolClient> {
    const pool = this.getPool()
    return pool.connect()
  }

  /**
   * Execute a query with user context for RLS.
   * Sets the app.current_user_id session variable before executing the query.
   */
  async queryWithUser<T extends QueryResultRow = any>(
    userId: string | null,
    text: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    const client = await this.getClient()
    try {
      if (userId) {
        await client.query(`SET LOCAL app.current_user_id = '${userId}'`)
      }
      const result = await client.query<T>(text, params)
      return result
    } finally {
      client.release()
    }
  }

  /**
   * Execute a transaction with user context for RLS.
   */
  async transactionWithUser<T>(
    userId: string | null,
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const setUserContext = userId
      ? async (client: PoolClient) => { await client.query(`SET LOCAL app.current_user_id = '${userId}'`) }
      : undefined
    return executeTransaction(() => this.getClient(), callback, setUserContext)
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    return executeTransaction(() => this.getClient(), callback)
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    return performHealthCheck((text) => this.query(text), this.config)
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end()
      this.pool = null
      console.log("[PostgreSQL] Connection pool closed")
    }
  }
}

// Singleton instance
export const db = new PostgresDatabase()

// Helper functions for common operations
export async function queryOne<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<T | null> {
  return queryOneHelper((t, p) => db.query<T>(t, p), text, params)
}

export async function queryMany<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<T[]> {
  return queryManyHelper((t, p) => db.query<T>(t, p), text, params)
}

export async function execute(text: string, params?: any[]): Promise<number> {
  return executeHelper((t, p) => db.query(t, p), text, params)
}

/**
 * Helper functions with user context for RLS
 */
export async function queryOneWithUser<T extends QueryResultRow = any>(
  userId: string | null,
  text: string,
  params?: any[]
): Promise<T | null> {
  const result = await db.queryWithUser<T>(userId, text, params)
  return result.rows[0] || null
}

export async function queryManyWithUser<T extends QueryResultRow = any>(
  userId: string | null,
  text: string,
  params?: any[]
): Promise<T[]> {
  const result = await db.queryWithUser<T>(userId, text, params)
  return result.rows
}

export async function executeWithUser(
  userId: string | null,
  text: string,
  params?: any[]
): Promise<number> {
  const result = await db.queryWithUser(userId, text, params)
  return result.rowCount || 0
}
