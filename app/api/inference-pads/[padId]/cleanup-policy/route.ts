import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { checkCleanupAccess, getCleanupPolicy, upsertCleanupPolicy, deleteCleanupPolicy } from "@/lib/handlers/inference-pads-cleanup-handler"

export async function GET(request: NextRequest, { params }: { params: Promise<{ padId: string }> }) {
  try {
    const { padId } = await params

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

    const { padExists, isOwner, isAdmin } = await checkCleanupAccess(padId, authResult.user.id)
    if (!padExists) {
      return NextResponse.json({ error: "Pad not found" }, { status: 404 })
    }
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const policy = await getCleanupPolicy(padId)
    return NextResponse.json({ policy })
  } catch (error) {
    console.error("Error fetching cleanup policy:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ padId: string }> }) {
  try {
    const { padId } = await params

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

    const { padExists, isOwner } = await checkCleanupAccess(padId, authResult.user.id)
    if (!padExists) {
      return NextResponse.json({ error: "Pad not found" }, { status: 404 })
    }
    if (!isOwner) {
      return NextResponse.json({ error: "Only pad owner can update cleanup policy" }, { status: 403 })
    }

    const body = await request.json()
    const policy = await upsertCleanupPolicy(padId, authResult.user.id, body)
    return NextResponse.json({ policy })
  } catch (error) {
    console.error("Error updating cleanup policy:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ padId: string }> }) {
  try {
    const { padId } = await params

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

    const { padExists, isOwner } = await checkCleanupAccess(padId, authResult.user.id)
    if (!padExists || !isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await deleteCleanupPolicy(padId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting cleanup policy:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
