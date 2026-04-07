import "server-only"
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
    this.config = buildDatabaseConfig()
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
    return executeTransaction(() => this.getClient(), callback)
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    return performHealthCheck((text) => this.query(text), this.config)
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
  return queryOneHelper((t, p) => db.query<T>(t, p), text, params)
}

export async function queryMany<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<T[]> {
  return queryManyHelper((t, p) => db.query<T>(t, p), text, params)
}

export async function execute(text: string, params?: any[]): Promise<number> {
  return executeHelper((t, p) => db.query(t, p), text, params)
}
