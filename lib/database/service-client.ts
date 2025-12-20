/**
 * Service Database Client - re-exports from database-adapter
 * 
 * This module provides convenience exports for the service/admin database client.
 * Use this when you need database access without user-level RLS restrictions.
 */

export { createServiceDatabaseClient } from "./database-adapter"
export type { DatabaseClient, QueryBuilder, QueryResult } from "./database-adapter"
