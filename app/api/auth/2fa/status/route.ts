// API Route: Get 2FA Status
// GET /api/auth/2fa/status

import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/local-auth"
import { get2FAStatus } from "@/lib/auth/2fa"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const status = await get2FAStatus(session.user.id)

    return NextResponse.json(status)
  } catch (error) {
    console.error("[2FA Status] Error:", error)
    return NextResponse.json({ error: "Failed to get 2FA status" }, { status: 500 })
  }
}
