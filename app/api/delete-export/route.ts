import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/local-auth"
import { db } from "@/lib/database/pg-client"
import { unlink } from "fs/promises"
import { existsSync } from "fs"
import path from "path"

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

async function deleteLocalFile(exportUrl: string): Promise<void> {
  try {
    // exportUrl is like /exports/link-summary-xxx.docx
    const filename = exportUrl.replace(/^\/exports\//, "")
    const filePath = path.join(process.cwd(), "public", "exports", filename)

    if (existsSync(filePath)) {
      await unlink(filePath)
      console.log(`[delete-export] Deleted file: ${filePath}`)
    } else {
      console.log(`[delete-export] File not found (already deleted?): ${filePath}`)
    }
  } catch (error) {
    console.error("[delete-export] File deletion error:", error)
    // Continue with database cleanup even if file deletion fails
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { noteId, exportUrl, isStick, isTeamNote } = body

    if (!noteId || !exportUrl) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Delete the local file
    await deleteLocalFile(exportUrl)

    // Determine which table to use
    let tableName: string
    let idColumn: string

    if (isStick) {
      tableName = "stick_tabs"
      idColumn = "stick_id"
    } else if (isTeamNote) {
      tableName = "note_tabs"
      idColumn = "note_id"
    } else {
      // Personal sticks
      tableName = "personal_sticks_tabs"
      idColumn = "personal_stick_id"
    }

    // Get the details tab
    const detailsTabResult = await db.query(
      `SELECT id, tab_data FROM ${tableName}
       WHERE ${idColumn} = $1 AND tab_type = 'details'
       ORDER BY created_at DESC
       LIMIT 1`,
      [noteId]
    )

    if (detailsTabResult.rows.length === 0) {
      return NextResponse.json({ message: "Export already deleted or details tab not found" })
    }

    const detailsTab = detailsTabResult.rows[0]

    let currentExports: unknown[] = []
    try {
      currentExports = parseTabData(detailsTab.tab_data)
    } catch (error) {
      console.error("[delete-export] Parse error:", error)
      currentExports = []
    }

    const updatedExports = currentExports.filter((exp: any) => exp.url !== exportUrl)

    // Update the tab_data
    const currentData = detailsTab.tab_data && typeof detailsTab.tab_data === "object"
      ? detailsTab.tab_data
      : {}
    const newTabData = { ...currentData, exports: updatedExports }

    await db.query(
      `UPDATE ${tableName}
       SET tab_data = $1, updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(newTabData), detailsTab.id]
    )

    console.log(`[delete-export] Removed export ${exportUrl} from ${tableName}`)

    return NextResponse.json({ message: "Export deleted successfully" })
  } catch (error) {
    console.error("[delete-export] Error:", error)
    return NextResponse.json(
      { error: `Failed to delete export: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 }
    )
  }
}
