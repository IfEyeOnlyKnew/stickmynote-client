import { type NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { isDiagnosticAccessible } from "@/lib/is-production"

export async function GET(_request: NextRequest) {
  if (!isDiagnosticAccessible()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    const db = await createServiceDatabaseClient()

    // Test basic connection
    const { data: _connectionTest, error: connectionError } = await db.from("users").select("count").limit(1)

    if (connectionError) {
      return NextResponse.json(
        {
          status: "error",
          message: "Database connection failed",
          error: connectionError.message,
        },
        { status: 500 },
      )
    }

    // Test RLS performance on notes table
    const startTime = Date.now()

    const { data: notesData, error: notesError } = await db
      .from("notes")
      .select("id, topic, created_at")
      .limit(10)

    const queryTime = Date.now() - startTime

    if (notesError) {
      return NextResponse.json(
        {
          status: "error",
          message: "Notes query failed",
          error: notesError.message,
          queryTime,
        },
        { status: 500 },
      )
    }

    // Test user table access
    const { data: usersData, error: usersError } = await db.from("users").select("id, email, username").limit(5)

    return NextResponse.json({
      status: "success",
      message: "RLS performance test completed",
      results: {
        queryTime: `${queryTime}ms`,
        notesCount: notesData?.length || 0,
        usersCount: usersData?.length || 0,
        connectionStatus: "healthy",
      },
      errors: usersError ? { usersError: usersError.message } : null,
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: "Performance test failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
