import { NextResponse } from "next/server"
import { createServiceDatabaseClient, type DatabaseClient } from "@/lib/database/database-adapter"
import { validateCSRFMiddleware } from "@/lib/csrf"
import type { NextRequest } from "next/server"

// Tables to delete in order (respects foreign key constraints)
const TABLES_TO_DELETE = ["note_tabs", "replies", "notes", "users"] as const
type TableName = (typeof TABLES_TO_DELETE)[number]

// Placeholder UUID that won't exist - used for "delete all" pattern
const DUMMY_UUID = "00000000-0000-0000-0000-000000000000"

interface DeletionDetails {
  noteTabs: number
  replies: number
  notes: number
  publicUsers: number
  authUsers: number
}

interface CleanupResults {
  publicDataCleared: boolean
  authUsersDeleted: boolean
  errors: string[]
  details: DeletionDetails
}

function createInitialResults(): CleanupResults {
  return {
    publicDataCleared: false,
    authUsersDeleted: false,
    errors: [],
    details: {
      noteTabs: 0,
      replies: 0,
      notes: 0,
      publicUsers: 0,
      authUsers: 0,
    },
  }
}

function getDetailsKey(table: TableName): keyof DeletionDetails {
  const mapping: Record<TableName, keyof DeletionDetails> = {
    note_tabs: "noteTabs",
    replies: "replies",
    notes: "notes",
    users: "publicUsers",
  }
  return mapping[table]
}

async function deleteFromTable(
  db: DatabaseClient,
  table: TableName,
  results: CleanupResults,
): Promise<void> {
  const { error, count } = await db
    .from(table)
    .delete()
    .neq("id", DUMMY_UUID)

  if (error) {
    results.errors.push(`${table} deletion error: ${error.message}`)
  } else {
    const key = getDetailsKey(table)
    results.details[key] = count || 0

    // For local auth, users table is the auth table
    if (table === "users") {
      results.details.authUsers = count || 0
    }
  }
}

function calculateTotalDeleted(details: DeletionDetails): number {
  return details.noteTabs + details.replies + details.notes + details.publicUsers
}

function buildResponse(results: CleanupResults) {
  const success = results.publicDataCleared && results.authUsersDeleted && results.errors.length === 0

  return NextResponse.json({
    success,
    message: "Complete user cleanup attempted",
    results,
    summary: {
      totalDeleted: calculateTotalDeleted(results.details),
      errorsCount: results.errors.length,
    },
  })
}

export async function DELETE(request: NextRequest) {
  const isCSRFValid = await validateCSRFMiddleware(request)
  if (!isCSRFValid) {
    return NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 })
  }

  try {
    const db = await createServiceDatabaseClient()
    const results = createInitialResults()

    try {
      for (const table of TABLES_TO_DELETE) {
        await deleteFromTable(db, table, results)
      }

      results.publicDataCleared = true
      results.authUsersDeleted = true
    } catch (error) {
      results.errors.push(`Public data cleanup error: ${error instanceof Error ? error.message : "Unknown error"}`)
    }

    return buildResponse(results)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to complete user cleanup",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
