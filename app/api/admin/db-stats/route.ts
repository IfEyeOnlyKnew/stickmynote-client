import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { db } from "@/lib/database/pg-client"

export const dynamic = "force-dynamic"

/**
 * GET /api/admin/db-stats
 * Returns database performance metrics, pool stats, index analysis,
 * and top queries from pg_stat_statements (if available).
 * Owner-only endpoint.
 */
export async function GET() {
  try {
    const authResult = await getCachedAuthUser()
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify user is an org owner
    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const supaDb = await createDatabaseClient()
    const { data: membership } = await supaDb
      .from("organization_members")
      .select("role")
      .eq("user_id", authResult.user.id)
      .eq("org_id", orgContext.orgId)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Synchronous metrics (no DB calls)
    const poolMetrics = db.getPoolMetrics()
    const queryStats = db.getQueryStats()

    // Async DB catalog queries in parallel
    const [
      topQueries,
      indexUsage,
      unusedIndexes,
      seqScanTables,
      tableSizes,
      tableBloat,
    ] = await Promise.all([
      getTopQueries(),
      getIndexUsage(),
      getUnusedIndexes(),
      getSeqScanTables(),
      getTableSizes(),
      getTableBloat(),
    ])

    return NextResponse.json({
      pool: poolMetrics,
      recentQueries: queryStats,
      topQueries,
      indexUsage,
      unusedIndexes,
      seqScanTables,
      tableSizes,
      tableBloat,
    })
  } catch (error) {
    console.error("[DB Stats] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * Top queries from pg_stat_statements (if extension is installed).
 * Returns the 20 slowest queries by total execution time.
 */
async function getTopQueries() {
  try {
    const result = await db.query(`
      SELECT
        queryid,
        LEFT(query, 200) AS query,
        calls,
        ROUND(total_exec_time::numeric, 2) AS total_time_ms,
        ROUND(mean_exec_time::numeric, 2) AS mean_time_ms,
        ROUND(max_exec_time::numeric, 2) AS max_time_ms,
        rows
      FROM pg_stat_statements
      WHERE userid = (SELECT usesysid FROM pg_user WHERE usename = current_user)
      ORDER BY total_exec_time DESC
      LIMIT 20
    `)
    return { available: true, queries: result.rows }
  } catch {
    return { available: false, message: "pg_stat_statements not installed (run migration 40)" }
  }
}

/**
 * Index usage statistics — shows how frequently each index is used.
 * High seq_tup_read with low idx_scan suggests the index isn't helping.
 */
async function getIndexUsage() {
  try {
    const result = await db.query(`
      SELECT
        schemaname,
        relname AS table_name,
        indexrelname AS index_name,
        idx_scan AS scans,
        idx_tup_read AS tuples_read,
        idx_tup_fetch AS tuples_fetched,
        pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
      FROM pg_stat_user_indexes
      ORDER BY idx_scan DESC
      LIMIT 30
    `)
    return result.rows
  } catch {
    return []
  }
}

/**
 * Indexes with zero scans since last stats reset.
 * These cost write performance with no read benefit.
 */
async function getUnusedIndexes() {
  try {
    const result = await db.query(`
      SELECT
        schemaname,
        relname AS table_name,
        indexrelname AS index_name,
        pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
        idx_scan AS scans
      FROM pg_stat_user_indexes
      WHERE idx_scan = 0
        AND indexrelname NOT LIKE '%_pkey'
      ORDER BY pg_relation_size(indexrelid) DESC
      LIMIT 20
    `)
    return result.rows
  } catch {
    return []
  }
}

/**
 * Tables where sequential scans outnumber index scans.
 * Candidates for new indexes or query optimization.
 */
async function getSeqScanTables() {
  try {
    const result = await db.query(`
      SELECT
        schemaname,
        relname AS table_name,
        seq_scan,
        idx_scan,
        CASE WHEN (seq_scan + idx_scan) > 0
          THEN ROUND(100.0 * seq_scan / (seq_scan + idx_scan), 1)
          ELSE 0
        END AS seq_scan_pct,
        seq_tup_read,
        idx_tup_fetch,
        n_live_tup AS live_rows
      FROM pg_stat_user_tables
      WHERE seq_scan > idx_scan
        AND n_live_tup > 100
      ORDER BY seq_scan - idx_scan DESC
      LIMIT 20
    `)
    return result.rows
  } catch {
    return []
  }
}

/**
 * Table sizes including indexes and TOAST data.
 */
async function getTableSizes() {
  try {
    const result = await db.query(`
      SELECT
        schemaname,
        relname AS table_name,
        pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
        pg_size_pretty(pg_relation_size(relid)) AS table_size,
        pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) AS index_size,
        n_live_tup AS live_rows
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(relid) DESC
      LIMIT 20
    `)
    return result.rows
  } catch {
    return []
  }
}

/**
 * Table bloat estimate — dead tuples vs live tuples.
 * High dead_tup count indicates VACUUM is needed.
 */
async function getTableBloat() {
  try {
    const result = await db.query(`
      SELECT
        schemaname,
        relname AS table_name,
        n_live_tup AS live_tuples,
        n_dead_tup AS dead_tuples,
        CASE WHEN n_live_tup > 0
          THEN ROUND(100.0 * n_dead_tup / n_live_tup, 1)
          ELSE 0
        END AS dead_pct,
        last_vacuum,
        last_autovacuum,
        last_analyze
      FROM pg_stat_user_tables
      WHERE n_dead_tup > 100
      ORDER BY n_dead_tup DESC
      LIMIT 20
    `)
    return result.rows
  } catch {
    return []
  }
}
