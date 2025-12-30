import { createDatabaseClient } from "@/lib/database/database-adapter"
import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function GET(request: NextRequest, { params }: { params: Promise<{ stickId: string }> }) {
  try {
    const { stickId } = await params
    const db = await createDatabaseClient()

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }
    const user = authResult.user
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const query = db.from("social_stick_tabs").select("*").eq("social_stick_id", stickId)

    const { data: tabs, error } = await query

    if (error) {
      console.error("[GET /api/social-sticks/tabs] Error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Sort by tab_order if it exists, otherwise by created_at
    const sortedTabs = tabs?.sort((a, b) => {
      if (a.tab_order !== undefined && b.tab_order !== undefined) {
        return a.tab_order - b.tab_order
      }
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })

    return NextResponse.json({ tabs: sortedTabs || [] })
  } catch (error) {
    console.error("[GET /api/social-sticks/tabs] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ stickId: string }> }) {
  try {
    const { stickId } = await params
    const db = await createDatabaseClient()

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }
    const user = authResult.user
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { tabType, tabName, title, tabData, items, tabOrder = 0 } = body

    // Determine the actual tab data to save
    let finalTabData = tabData
    if (items) {
      finalTabData = { [tabType]: items }
    }

    const tabTitle = title || tabName || tabType

    const { data: existingTabs } = await db
      .from("social_stick_tabs")
      .select("*")
      .eq("social_stick_id", stickId)
      .eq("tab_type", tabType)
      .maybeSingle()

    if (existingTabs) {
      // Update existing tab
      const { data: tab, error } = await db
        .from("social_stick_tabs")
        .update({
          tab_data: finalTabData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingTabs.id)
        .select()
        .single()

      if (error) {
        console.error("[POST /api/social-sticks/tabs] Update Error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ tab })
    } else {
      const insertData: Record<string, unknown> = {
        social_stick_id: stickId,
        tab_type: tabType,
        title: tabTitle,
        tab_data: finalTabData,
        tab_order: tabOrder,
      }

      const { data: tab, error } = await db.from("social_stick_tabs").insert(insertData).select().single()

      if (error) {
        console.error("[POST /api/social-sticks/tabs] Insert Error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ tab })
    }
  } catch (error) {
    console.error("[POST /api/social-sticks/tabs] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ stickId: string }> }) {
  try {
    const { stickId } = await params
    const db = await createDatabaseClient()

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }
    const user = authResult.user
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { tabId, tabType, itemId } = body

    if (tabId) {
      // Delete entire tab
      const { error } = await db.from("social_stick_tabs").delete().eq("id", tabId)

      if (error) {
        console.error("[DELETE /api/social-sticks/tabs] Error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    } else if (tabType && itemId) {
      // Delete specific item from tab
      const { data: existingTab, error: selectError } = await db
        .from("social_stick_tabs")
        .select("*")
        .eq("social_stick_id", stickId)
        .eq("tab_type", tabType)
        .maybeSingle()

      if (selectError) {
        console.error("[DELETE /api/social-sticks/tabs] Select Error:", selectError)
        return NextResponse.json({ error: selectError.message }, { status: 500 })
      }

      if (!existingTab) {
        return NextResponse.json({ error: "Tab not found" }, { status: 404 })
      }

      const tabData = existingTab.tab_data as Record<string, unknown[]>
      const items = tabData?.[tabType] || []
      const updatedItems = items.filter((item: unknown) => (item as Record<string, unknown>).id !== itemId)

      const { error } = await db
        .from("social_stick_tabs")
        .update({
          tab_data: { [tabType]: updatedItems },
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingTab.id)

      if (error) {
        console.error("[DELETE /api/social-sticks/tabs] Error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: "Either tabId or both tabType and itemId are required" }, { status: 400 })
    }
  } catch (error) {
    console.error("[DELETE /api/social-sticks/tabs] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
