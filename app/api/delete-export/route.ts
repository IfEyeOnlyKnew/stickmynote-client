import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

let del: any
async function initializeBlobModule() {
  try {
    const blobModule = await import("@vercel/blob")
    del = blobModule.del
  } catch {
    del = async () => ({})
  }
}

function getTableConfig(isStick: boolean): { tableName: string; noteIdField: string } {
  if (isStick) return { tableName: "stick_tabs", noteIdField: "stick_id" }
  return { tableName: "note_tabs", noteIdField: "note_id" }
}

function parseTabData(tabData: unknown): unknown[] {
  if (tabData === null || tabData === undefined) return []

  // Handle corrupted tab_data stored as individual characters
  if (typeof tabData === "object" && !Array.isArray(tabData)) {
    const keys = Object.keys(tabData as Record<string, unknown>)
    const isCharacterArray = keys.length > 0 && keys.every((key) => !Number.isNaN(Number(key)))
    if (isCharacterArray) {
      const sortedKeys = [...keys].sort((a, b) => Number(a) - Number(b))
      const jsonString = sortedKeys
        .map((key) => (tabData as Record<string, string>)[key])
        .join("")
      const parsed = JSON.parse(jsonString)
      return parsed?.exports || []
    }
    return (tabData as { exports?: unknown[] })?.exports || []
  }

  if (typeof tabData === "string") {
    const parsed = JSON.parse(tabData)
    return parsed?.exports || []
  }

  return []
}

async function deleteFromBlobStorage(exportUrl: string): Promise<void> {
  try {
    await del(exportUrl)
  } catch (error) {
    console.error("[delete-export] Blob deletion error:", error)
    // Continue with database cleanup even if blob deletion fails
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!del) await initializeBlobModule()

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { noteId, exportUrl, isStick } = body

    if (!noteId || !exportUrl) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    await deleteFromBlobStorage(exportUrl)

    const db = await createDatabaseClient()
    const { tableName, noteIdField } = getTableConfig(isStick)

    const { data: detailsTabs, error: fetchError } = await db
      .from(tableName)
      .select("*")
      .eq(noteIdField, noteId)
      .eq("tab_type", "details")

    if (fetchError) {
      return NextResponse.json({ error: "Failed to fetch details tab" }, { status: 500 })
    }

    if (!detailsTabs || detailsTabs.length === 0) {
      return NextResponse.json({ message: "Export already deleted or details tab not found" })
    }

    let currentExports: unknown[] = []
    try {
      currentExports = parseTabData(detailsTabs[0].tab_data)
    } catch (error) {
      console.error("[delete-export] Parse error:", error)
      currentExports = []
    }

    const updatedExports = currentExports.filter((exp: any) => exp.url !== exportUrl)

    const { error: updateError } = await db
      .from(tableName)
      .update({ tab_data: { exports: updatedExports } })
      .eq(noteIdField, noteId)
      .eq("tab_type", "details")

    if (updateError) {
      return NextResponse.json({ error: "Failed to update details tab" }, { status: 500 })
    }

    return NextResponse.json({ message: "Export deleted successfully" })
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to delete export: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 },
    )
  }
}
