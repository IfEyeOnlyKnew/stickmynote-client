import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

let del: any
async function initializeBlobModule() {
  try {
    const blobModule = await import("@vercel/blob")
    del = blobModule.del
  } catch (error) {
    del = async () => ({})
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!del) {
      await initializeBlobModule()
    }

    const supabase = await createClient()
    const authResult = await getCachedAuthUser(supabase)
    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const user = authResult.user

    const body = await request.json()
    const { noteId, exportUrl, isTeamNote, isStick } = body

    if (!noteId || !exportUrl) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Delete from blob storage
    try {
      await del(exportUrl)
    } catch (blobError) {
      // Continue with database cleanup even if blob deletion fails
    }

    let tableName: string
    let noteIdField: string

    if (isStick) {
      tableName = "stick_tabs"
      noteIdField = "stick_id"
    } else if (isTeamNote) {
      tableName = "team_note_tabs"
      noteIdField = "team_note_id"
    } else {
      tableName = "note_tabs"
      noteIdField = "note_id"
    }

    const { data: detailsTabs, error: fetchError } = await supabase
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

    const detailsTab = detailsTabs[0] // Use the first one if multiple exist

    // Handle corrupted tab_data and extract exports properly
    let currentExports = []
    try {
      let tabData = detailsTab.tab_data

      // Handle corrupted tab_data that's stored as individual characters
      if (typeof tabData === "object" && tabData !== null && !Array.isArray(tabData)) {
        const keys = Object.keys(tabData)
        if (keys.length > 0 && keys.every((key) => !isNaN(Number(key)))) {
          // Reconstruct the JSON string from individual characters
          const jsonString = keys
            .sort((a, b) => Number(a) - Number(b))
            .map((key) => tabData[key])
            .join("")
          tabData = JSON.parse(jsonString)
        }
      } else if (typeof tabData === "string") {
        tabData = JSON.parse(tabData)
      }

      currentExports = tabData?.exports || []
    } catch (error) {
      currentExports = []
    }

    // Remove only the specific export link
    const updatedExports = currentExports.filter((exp: any) => exp.url !== exportUrl)

    // Update the details tab with proper object storage
    const { error: updateError } = await supabase
      .from(tableName)
      .update({
        tab_data: { exports: updatedExports }, // Store as object, not corrupted format
      })
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
