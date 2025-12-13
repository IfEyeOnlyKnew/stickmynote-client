import { createSupabaseServer } from "@/lib/supabase-server"
import { NextResponse, type NextRequest } from "next/server"
import { validateCSRFMiddleware } from "@/lib/csrf"

export async function POST(request: NextRequest) {
  try {
    const isCSRFValid = await validateCSRFMiddleware(request)
    if (!isCSRFValid) {
      return NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 })
    }

    const supabase = await createSupabaseServer()

    const { error } = await supabase.auth.signOut({ scope: "global" })

    if (error) {
      console.error("Logout error:", error)
      return NextResponse.json({ error: "Failed to logout" }, { status: 500 })
    }

    const response = NextResponse.json({ success: true })

    // Clear Supabase auth cookies
    const cookiesToClear = ["sb-access-token", "sb-refresh-token", "csrf-token"]

    cookiesToClear.forEach((cookieName) => {
      response.cookies.delete(cookieName)
    })

    return response
  } catch (error) {
    console.error("Logout error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
