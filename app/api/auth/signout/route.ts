import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getSession } from "@/lib/auth/local-auth"
import { logAuditEvent } from "@/lib/audit/audit-logger"
import { getRequestContext } from "@/lib/audit/request-context"

export async function POST(request: NextRequest) {
  try {
    // Get user before clearing session for audit logging
    const session = await getSession()
    const { ipAddress, userAgent } = getRequestContext(request)

    const cookieStore = cookies()

    // Clear the JWT session cookie
    cookieStore.delete("jwt_session")

    // Also clear any other auth-related cookies
    cookieStore.delete("session")
    cookieStore.delete("sb-access-token")
    cookieStore.delete("sb-refresh-token")

    if (session?.user) {
      logAuditEvent({
        userId: session.user.id,
        action: "user.logout",
        resourceType: "user",
        resourceId: session.user.id,
        ipAddress,
        userAgent,
        metadata: { email: session.user.email },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Signout error:", error)
    return NextResponse.json({ success: true }) // Still return success to clear client state
  }
}
