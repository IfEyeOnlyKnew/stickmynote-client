import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getStickTabs, upsertStickTab, deleteStickTab, deleteStickTabItem } from "@/lib/handlers/inference-sticks-tabs-handler"

export async function GET(request: NextRequest, { params }: { params: Promise<{ stickId: string }> }) {
  try {
    const { stickId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tabs = await getStickTabs(stickId)
    return NextResponse.json({ tabs })
  } catch (error) {
    console.error("[GET /api/inference-sticks/tabs] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ stickId: string }> }) {
  try {
    const { stickId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const tab = await upsertStickTab(stickId, body)
    return NextResponse.json({ tab })
  } catch (error) {
    console.error("[POST /api/inference-sticks/tabs] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ stickId: string }> }) {
  try {
    const { stickId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { tabId, tabType, itemId } = body

    if (tabId) {
      await deleteStickTab(tabId)
      return NextResponse.json({ success: true })
    }

    if (tabType && itemId) {
      const found = await deleteStickTabItem(stickId, tabType, itemId)
      if (!found) {
        return NextResponse.json({ error: "Tab not found" }, { status: 404 })
      }
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Either tabId or both tabType and itemId are required" }, { status: 400 })
  } catch (error) {
    console.error("[DELETE /api/inference-sticks/tabs] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
