import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { updateMemberAdminLevel, removeMember } from "@/lib/handlers/inference-pads-member-handler"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ padId: string; memberId: string }> }) {
  try {
    const { padId, memberId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: { "Retry-After": "30" } })
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const result = await updateMemberAdminLevel(padId, memberId, authResult.user.id, body.admin_level)
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    console.error("Error updating member:", error)
    return NextResponse.json({ error: "Failed to update member" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ padId: string; memberId: string }> }) {
  try {
    const { padId, memberId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: { "Retry-After": "30" } })
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await removeMember(padId, memberId, authResult.user.id)
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    console.error("Error removing member:", error)
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 })
  }
}
