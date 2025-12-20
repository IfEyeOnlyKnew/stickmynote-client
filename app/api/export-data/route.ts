import { createDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"

export async function GET() {
  try {
    const db = await createDatabaseClient()

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
    const user = authResult.user

    const orgContext = await getOrgContext(user.id)
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const userId = user.id

    const [profileData, notesData, repliesData, tagsData, padsData, sticksData] = await Promise.all([
      db.from("users").select("*").eq("id", userId).maybeSingle(),
      db.from("notes").select("*").eq("user_id", userId).eq("org_id", orgContext.orgId),
      db.from("replies").select("*").eq("user_id", userId).eq("org_id", orgContext.orgId),
      db.from("tags").select("*").eq("user_id", userId).eq("org_id", orgContext.orgId),
      db.from("paks_pads").select("*").eq("owner_id", userId).eq("org_id", orgContext.orgId),
      db.from("paks_pad_sticks").select("*").eq("owner_id", userId).eq("org_id", orgContext.orgId),
    ])

    const exportData = {
      export_date: new Date().toISOString(),
      user_id: userId,
      org_id: orgContext.orgId,
      profile: profileData.data || null,
      notes: notesData.data || [],
      replies: repliesData.data || [],
      tags: tagsData.data || [],
      pads: padsData.data || [],
      sticks: sticksData.data || [],
      metadata: {
        total_notes: notesData.data?.length || 0,
        total_replies: repliesData.data?.length || 0,
        total_tags: tagsData.data?.length || 0,
        total_pads: padsData.data?.length || 0,
        total_sticks: sticksData.data?.length || 0,
      },
    }

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="stickmynote-data-export-${userId}-${Date.now()}.json"`,
      },
    })
  } catch (error) {
    console.error("Error exporting data:", error)
    return NextResponse.json(
      {
        error: "Failed to export data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
