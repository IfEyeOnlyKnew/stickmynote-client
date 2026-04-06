import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getEscalationRule, updateEscalationRule, deleteEscalationRule } from "@/lib/handlers/escalation-rules-detail-handler"

export async function GET(request: Request, { params }: { params: Promise<{ ruleId: string }> }) {
  try {
    const { ruleId } = await params

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

    const result = await getEscalationRule(ruleId, authResult.user.id)
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    console.error("Error fetching rule:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ ruleId: string }> }) {
  try {
    const { ruleId } = await params

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
    const result = await updateEscalationRule(ruleId, authResult.user.id, body)
    return NextResponse.json(result.body, { status: result.status })
  } catch (err) {
    console.error("Error updating rule:", err)
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ ruleId: string }> }) {
  try {
    const { ruleId } = await params

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

    await deleteEscalationRule(ruleId, authResult.user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting rule:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
