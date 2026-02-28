import "server-only"
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg"

interface DatabaseConfig {
  host: string
  port: number
  database: string
  user: string
  password: string
  ssl?: boolean | { rejectUnauthorized: boolean }
  max?: number
  idleTimeoutMillis?: number
  connectionTimeoutMillis?: number
}

interface QueryStat {
  sql: string
  duration: number
  rowCount: number | null
  timestamp: number
  slow: boolean
}

const SLOW_QUERY_THRESHOLD = Number(process.env.POSTGRES_SLOW_QUERY_MS) || 500
const MAX_QUERY_STATS = 100

class PostgresDatabase {
  private pool: Pool | null = null
  private readonly config: DatabaseConfig
  private readonly queryStats: QueryStat[] = []

  constructor() {
    // Configure SSL
    let sslConfig: boolean | { rejectUnauthorized: boolean } = false
    if (process.env.POSTGRES_SSL === "true") {
      // For self-signed certificates, set rejectUnauthorized to false
      sslConfig = { rejectUnauthorized: process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED !== "false" }
    }

    const maxPool = Number(process.env.POSTGRES_MAX_POOL) || 20

    this.config = {
      host: process.env.POSTGRES_HOST || "localhost",
      port: Number.parseInt(process.env.POSTGRES_PORT || "5432"),
      database: process.env.POSTGRES_DATABASE || "stickmynote",
      user: process.env.POSTGRES_USER || "stickmynote_user",
      password: process.env.POSTGRES_PASSWORD || "",
      ssl: sslConfig,
      max: maxPool,
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

  async query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const pool = this.getPool()
    try {
      const start = Date.now()
      const result = await pool.query<T>(text, params)
      const duration = Date.now() - start
      const slow = duration > SLOW_QUERY_THRESHOLD

      if (slow) {
        console.warn("[PostgreSQL] SLOW QUERY", { text, duration, rows: result.rowCount })
      } else {
        console.log("[PostgreSQL] Query executed", { text: text.substring(0, 100), duration, rows: result.rowCount })
      }

      // Record query stats
      this.queryStats.push({
        sql: text.substring(0, 200),
        duration,
        rowCount: result.rowCount,
        timestamp: Date.now(),
        slow,
      })
      if (this.queryStats.length > MAX_QUERY_STATS) {
        this.queryStats.shift()
      }

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
      await this.query("SELECT NOW()")
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

  /**
   * Get pool connection metrics.
   * Uses built-in pg Pool properties: totalCount, idleCount, waitingCount.
   */
  getPoolMetrics(): { totalCount: number; idleCount: number; waitingCount: number; maxPool: number } {
    const pool = this.getPool()
    return {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
      maxPool: this.config.max ?? 20,
    }
  }

  /**
   * Get recent query statistics (last 100 queries).
   * Includes slow query detection based on POSTGRES_SLOW_QUERY_MS threshold.
   */
  getQueryStats(): { queries: readonly QueryStat[]; slowQueryThresholdMs: number; slowCount: number } {
    return {
      queries: this.queryStats,
      slowQueryThresholdMs: SLOW_QUERY_THRESHOLD,
      slowCount: this.queryStats.filter((q) => q.slow).length,
    }
  }

  /**
   * Refresh materialized views concurrently (non-blocking).
   */
  async refreshMaterializedViews(): Promise<void> {
    try {
      await this.query("REFRESH MATERIALIZED VIEW CONCURRENTLY social_kb_with_metrics")
      console.log("[PostgreSQL] Materialized view social_kb_with_metrics refreshed")
    } catch (error) {
      // View may not exist or may not have a UNIQUE index for CONCURRENTLY
      // Fall back to non-concurrent refresh
      try {
        await this.query("REFRESH MATERIALIZED VIEW social_kb_with_metrics")
        console.log("[PostgreSQL] Materialized view social_kb_with_metrics refreshed (non-concurrent)")
      } catch {
        console.warn("[PostgreSQL] Could not refresh materialized view:", error instanceof Error ? error.message : error)
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
export async function queryOne<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<T | null> {
  const result = await db.query<T>(text, params)
  return result.rows[0] || null
}

export async function queryMany<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<T[]> {
  const result = await db.query<T>(text, params)
  return result.rows
}

export async function execute(text: string, params?: any[]): Promise<number> {
  const result = await db.query(text, params)
  return result.rowCount || 0
}
