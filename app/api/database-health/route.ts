import { NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { isDiagnosticAccessible } from "@/lib/is-production"

export async function GET() {
  if (!isDiagnosticAccessible()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const startedAt = Date.now()
  try {
    const db = await createServiceDatabaseClient()

    const results: Record<string, { ok: boolean; count?: number; error?: string }> = {}

    try {
      const notes = await db.from("notes").select("id", { head: true, count: "exact" })
      results.notes = { ok: !notes.error, count: notes.count ?? undefined, error: notes.error?.message }
    } catch (e) {
      results.notes = { ok: false, error: e instanceof Error ? e.message : String(e) }
    }

    try {
      const tabs = await db.from("note_tabs").select("id", { head: true, count: "exact" })
      results.note_tabs = { ok: !tabs.error, count: tabs.count ?? undefined, error: tabs.error?.message }
    } catch (e) {
      results.note_tabs = { ok: false, error: e instanceof Error ? e.message : String(e) }
    }

    const connectivityOk = Object.values(results).every((r) => r.ok)

    return NextResponse.json({
      ok: connectivityOk,
      connectivityOk,
      results,
      tookMs: Date.now() - startedAt,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Database health check failed",
        details: error instanceof Error ? error.message : String(error),
        tookMs: Date.now() - startedAt,
      },
      { status: 500 },
    )
  }
}
