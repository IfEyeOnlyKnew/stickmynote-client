import { Pool, type PoolClient, type QueryResult } from "pg"

interface DatabaseConfig {
  host: string
  port: number
  database: string
  user: string
  password: string
  ssl?: boolean
  max?: number
  idleTimeoutMillis?: number
  connectionTimeoutMillis?: number
}

class PostgresDatabase {
  private pool: Pool | null = null
  private config: DatabaseConfig

  constructor() {
    this.config = {
      host: process.env.POSTGRES_HOST || "localhost",
      port: Number.parseInt(process.env.POSTGRES_PORT || "5432"),
      database: process.env.POSTGRES_DATABASE || "stickmynote",
      user: process.env.POSTGRES_USER || "stickmynote_user",
      password: process.env.POSTGRES_PASSWORD || "",
      ssl: process.env.POSTGRES_SSL === "true",
      max: 20, // Maximum pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    }
  }

  private getPool(): Pool {
    if (!this.pool) {
      this.pool = new Pool(this.config)

      this.pool.on("error", (err) => {
        console.error("[PostgreSQL] Unexpected pool error:", err)
      })

      this.pool.on("connect", () => {
        console.log("[PostgreSQL] New client connected to pool")
      })
    }
    return this.pool
  }

  async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
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

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient()
    try {
      await client.query("BEGIN")
      const result = await callback(client)
      await client.query("COMMIT")
      return result
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      const result = await this.query("SELECT NOW()")
      return {
        healthy: true,
        message: `Connected to PostgreSQL at ${this.config.host}:${this.config.port}`,
      }
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : "Unknown database error",
      }
    }
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
export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const result = await db.query<T>(text, params)
  return result.rows[0] || null
}

export async function queryMany<T = any>(text: string, params?: any[]): Promise<T[]> {
  const result = await db.query<T>(text, params)
  return result.rows
}

export async function execute(text: string, params?: any[]): Promise<number> {
  const result = await db.query(text, params)
  return result.rowCount || 0
}
