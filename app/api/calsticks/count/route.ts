import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"

export const dynamic = "force-dynamic"

export async function GET(_request: NextRequest) {
  try {
    const authResult = await getCachedAuthUser()
    if (!authResult.user) {
      return NextResponse.json({ count: 0 })
    }

    const user = authResult.user
    const orgContext = await getOrgContext()

    if (!orgContext) {
      return NextResponse.json({ count: 0 })
    }

    const db = await createDatabaseClient()

    // Fetch open calsticks for the org
    const { data: calsticks, error } = await db
      .from("paks_pad_stick_replies")
      .select("id, user_id, stick_id")
      .eq("is_calstick", true)
      .eq("calstick_completed", false)
      .eq("org_id", orgContext.orgId)

    if (error) {
      console.error("[CalSticks Count API] Error:", error)
      return NextResponse.json({ count: 0 })
    }

    if (!calsticks || calsticks.length === 0) {
      return NextResponse.json({ count: 0 })
    }

    // Get the stick IDs to check ownership
    const stickIds = [...new Set(calsticks.map((cs: any) => cs.stick_id).filter(Boolean))]

    // Fetch sticks to check user ownership
    const { data: sticks } = stickIds.length > 0
      ? await db.from("paks_pad_sticks").select("id, user_id").in("id", stickIds)
      : { data: [] }

    const stickOwnerMap = Object.fromEntries((sticks || []).map((s: any) => [s.id, s.user_id]))

    // Filter by user ownership: calstick created by user OR stick owned by user
    const userCalsticks = calsticks.filter((cs: any) =>
      cs.user_id === user.id || stickOwnerMap[cs.stick_id] === user.id
    )

    return NextResponse.json({ count: userCalsticks.length })
  } catch (error) {
    console.error("[CalSticks Count API] Error:", error)
    return NextResponse.json({ count: 0 })
  }
}
