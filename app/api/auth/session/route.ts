import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth/local-auth"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ user: null }, { status: 200 })
    }

    return NextResponse.json({
      user: {
        id: session.user.id,
        email: session.user.email,
        full_name: session.user.full_name,
        avatar_url: session.user.avatar_url,
        email_verified: session.user.email_verified,
      },
      expiresAt: session.expiresAt,
    })
  } catch (error) {
    console.error("[API] Error fetching session:", error)
    return NextResponse.json({ user: null }, { status: 200 })
  }
}
