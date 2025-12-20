import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export const dynamic = "force-dynamic"

export async function GET(_request: NextRequest) {
  try {
    const user = await getCachedAuthUser()
    if (!user) {
      return NextResponse.json({ count: 0 })
    }

    const db = await createDatabaseClient()
    const { count, error } = await db
      .from("paks_pad_stick_replies")
      .select("*", { count: "exact", head: true })
      .eq("is_calstick", true)
      .eq("calstick_completed", false)

    if (error) {
      console.error("[CalSticks Count API] Error:", error)
      return NextResponse.json({ count: 0 })
    }

    return NextResponse.json({ count: count ?? 0 })
  } catch (error) {
    console.error("[CalSticks Count API] Error:", error)
    return NextResponse.json({ count: 0 })
  }
}
