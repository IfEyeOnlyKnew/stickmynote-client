import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg"

export interface DatabaseConfig {
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

/**
 * Build the shared database config from environment variables.
 * Used by both the main pg-client and the RLS-enabled variant.
 */
export function buildDatabaseConfig(maxPoolOverride?: number): DatabaseConfig {
  let sslConfig: boolean | { rejectUnauthorized: boolean } = false
  if (process.env.POSTGRES_SSL === "true") {
    sslConfig = { rejectUnauthorized: process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED !== "false" }
  }

  const maxPool = maxPoolOverride ?? (Number(process.env.POSTGRES_MAX_POOL) || 20)

  return {
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

/**
 * Create a pool with standard event handlers.
 */
export function createPool(config: DatabaseConfig): Pool {
  const pool = new Pool(config)

  pool.on("error", (err) => {
    console.error("[PostgreSQL] Unexpected pool error:", err)
  })

  pool.on("connect", () => {
    console.log("[PostgreSQL] New client connected to pool")
  })

  return pool
}

/**
 * Shared transaction logic: BEGIN, callback, COMMIT/ROLLBACK.
 */
export async function executeTransaction<T>(
  getClient: () => Promise<PoolClient>,
  callback: (client: PoolClient) => Promise<T>,
  preQueryHook?: (client: PoolClient) => Promise<void>,
): Promise<T> {
  const client = await getClient()
  try {
    await client.query("BEGIN")
    if (preQueryHook) {
      await preQueryHook(client)
    }
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

/**
 * Shared health check logic.
 */
export async function performHealthCheck(
  queryFn: (text: string) => Promise<QueryResult>,
  config: DatabaseConfig,
): Promise<{ healthy: boolean; message: string }> {
  try {
    await queryFn("SELECT NOW()")
    return {
      healthy: true,
      message: `Connected to PostgreSQL at ${config.host}:${config.port}`,
    }
  } catch (error) {
    return {
      healthy: false,
      message: error instanceof Error ? error.message : "Unknown database error",
    }
  }
}

/**
 * Shared helper: query and return first row or null.
 */
export async function queryOneHelper<T extends QueryResultRow>(
  queryFn: (text: string, params?: any[]) => Promise<QueryResult<T>>,
  text: string,
  params?: any[],
): Promise<T | null> {
  const result = await queryFn(text, params)
  return result.rows[0] || null
}

/**
 * Shared helper: query and return all rows.
 */
export async function queryManyHelper<T extends QueryResultRow>(
  queryFn: (text: string, params?: any[]) => Promise<QueryResult<T>>,
  text: string,
  params?: any[],
): Promise<T[]> {
  const result = await queryFn(text, params)
  return result.rows
}

/**
 * Shared helper: execute and return affected row count.
 */
export async function executeHelper(
  queryFn: (text: string, params?: any[]) => Promise<QueryResult>,
  text: string,
  params?: any[],
): Promise<number> {
  const result = await queryFn(text, params)
  return result.rowCount || 0
}
