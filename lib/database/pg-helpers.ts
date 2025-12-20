// PostgreSQL Query Helpers for StickMyNote API Rewrite
import { db } from './pg-client'

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const result = await db.query(sql, params)
  return result.rows as T[]
}

export async function querySingle<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const result = await db.query(sql, params)
  return result.rows[0] || null
}

export async function transaction<T>(fn: () => Promise<T>): Promise<T> {
  await db.query('BEGIN')
  try {
    const result = await fn()
    await db.query('COMMIT')
    return result
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}

export async function count(sql: string, params?: any[]): Promise<number> {
  const result = await db.query(sql, params)
  return Number(result.rows[0]?.count || 0)
}
