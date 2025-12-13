import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { isDiagnosticAccessible } from "@/lib/is-production"

export async function GET() {
  if (!isDiagnosticAccessible()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const startedAt = Date.now()
  try {
    const supabase = createServiceClient()

    const results: Record<string, { ok: boolean; status?: number; error?: string }> = {}

    try {
      const notes = await supabase.from("notes").select("id", { head: true, count: "exact" })
      results.notes = { ok: !notes.error, status: notes.status, error: notes.error?.message }
    } catch (e) {
      results.notes = { ok: false, error: e instanceof Error ? e.message : String(e) }
    }

    try {
      const tabs = await supabase.from("note_tabs").select("id", { head: true, count: "exact" })
      results.note_tabs = { ok: !tabs.error, status: tabs.status, error: tabs.error?.message }
    } catch (e) {
      results.note_tabs = { ok: false, error: e instanceof Error ? e.message : String(e) }
    }

    const connectivityOk = Object.values(results).some((r) => typeof r.status === "number")
    const allOk = connectivityOk

    return NextResponse.json({
      ok: allOk,
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
