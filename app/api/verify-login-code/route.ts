import { NextResponse } from "next/server"
import { applyRateLimit } from "@/lib/rate-limiter-enhanced"

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= (a.codePointAt(i) ?? 0) ^ (b.codePointAt(i) ?? 0)
  }
  return result === 0
}

export async function POST(request: Request) {
  try {
    const rateLimitResult = await applyRateLimit(request, undefined, "auth_login")
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { ok: false, message: "Too many login attempts. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": "300",
            ...rateLimitResult.headers,
          },
        },
      )
    }

    const { code } = await request.json().catch(() => ({ code: "" }))
    const configured = process.env.LOGIN_ACCESS_CODE

    if (!configured) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Login access code is not configured. Set the LOGIN_ACCESS_CODE environment variable in your Vercel project.",
        },
        { status: 500 },
      )
    }

    const provided = String(code ?? "").trim()
    if (!provided) {
      return NextResponse.json({ ok: false, message: "Access code is required." }, { status: 400 })
    }

    const isValid = timingSafeEqual(provided, configured)

    if (!isValid) {
      return NextResponse.json({ ok: false, message: "Invalid access code." }, { status: 401 })
    }

    const response = NextResponse.json({ ok: true })

    // Set httpOnly cookie that expires in 30 days
    response.cookies.set("access_code_verified", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    })

    return response
  } catch (err) {
    console.error("verify-login-code - Error:", err)
    return NextResponse.json({ ok: false, message: "Failed to verify access code." }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie") || ""
    const isVerified = cookieHeader.includes("access_code_verified=true")

    return NextResponse.json({ verified: isVerified })
  } catch (err) {
    console.error("verify-login-code GET - Error:", err)
    return NextResponse.json({ verified: false }, { status: 500 })
  }
}
