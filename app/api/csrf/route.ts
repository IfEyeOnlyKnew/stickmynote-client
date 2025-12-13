import { type NextRequest, NextResponse } from "next/server"
import { generateCSRFToken } from "@/lib/csrf"

export async function GET(_request: NextRequest) {
  try {
    const token = await generateCSRFToken()

    const response = NextResponse.json({ token, csrfToken: token })

    response.cookies.set("csrf-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60, // 24 hours
      path: "/",
    })

    return response
  } catch (error) {
    console.error("CSRF token generation error:", error)
    return NextResponse.json({ error: "Failed to generate CSRF token" }, { status: 500 })
  }
}
