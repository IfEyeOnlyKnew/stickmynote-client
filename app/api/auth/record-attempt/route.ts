import { type NextRequest, NextResponse } from "next/server"
import { recordLoginAttempt } from "@/lib/handlers/auth-handler"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = await recordLoginAttempt(body)

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json(result.data)
  } catch (error) {
    console.error("Error recording attempt:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
