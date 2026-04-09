import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { createSafeAction, success, error } from "@/lib/safe-action"
import { createPadSchema } from "@/types/schemas"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { requireAuthAndOrg } from "@/lib/api/route-helpers"

const createPadAction = createSafeAction(
  {
    input: createPadSchema,
    rateLimit: "pads_create",
  },
  async (input, { user, db }) => {
    if (!user) {
      return error("Unauthorized", 401)
    }

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return error("No organization context", 403)
    }

    const { data: newPad, error: dbError } = await db
      .from("paks_pads")
      .insert({
        name: input.name || "Untitled Pad",
        description: input.description || "",
        owner_id: user.id,
        org_id: orgContext.orgId,
      })
      .select()
      .single()

    if (dbError) {
      console.error("Error creating Pad:", dbError)
      return error(`Failed to create Pad: ${dbError.message}`, 500)
    }

    return success({ pad: newPad })
  },
)

export async function POST(request: NextRequest) {
  return createPadAction(request)
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthAndOrg()
    if ("response" in auth) return auth.response
    const { user, orgContext } = auth

    const db = await createDatabaseClient()

    const { data: calstickReplies, error: repliesError } = await db
      .from("paks_pad_stick_replies")
      .select("stick_id")
      .eq("is_calstick", true)
      .eq("org_id", orgContext.orgId)
      .not("calstick_date", "is", null)

    if (repliesError) {
      console.error("Error fetching calstick replies:", repliesError)
      return NextResponse.json({ error: "Failed to fetch calstick replies" }, { status: 500 })
    }

    const stickIds = [...new Set(calstickReplies?.map((r) => r.stick_id) || [])]

    if (stickIds.length === 0) {
      return NextResponse.json({ pads: [] })
    }

    const { data: sticks, error: sticksError } = await db
      .from("paks_pad_sticks")
      .select("pad_id")
      .in("id", stickIds)
      .eq("org_id", orgContext.orgId)

    if (sticksError) {
      console.error("Error fetching sticks:", sticksError)
      return NextResponse.json({ error: "Failed to fetch sticks" }, { status: 500 })
    }

    const padIdsWithCalSticks = [...new Set(sticks?.map((s) => s.pad_id).filter(Boolean) || [])]

    if (padIdsWithCalSticks.length === 0) {
      return NextResponse.json({ pads: [] })
    }

    const { data: membershipData, error: membershipError } = await db
      .from("paks_pad_members")
      .select("pad_id")
      .eq("user_id", user.id)
      .eq("org_id", orgContext.orgId)

    if (membershipError) {
      console.warn("Error fetching pad memberships:", membershipError)
    }

    const memberPadIds = membershipData?.map((m) => m.pad_id) || []

    let query = db
      .from("paks_pads")
      .select("id, name, owner_id, org_id")
      .in("id", padIdsWithCalSticks)
      .eq("org_id", orgContext.orgId)
      .order("updated_at", { ascending: false })

    if (memberPadIds.length > 0) {
      const accessiblePadIds = padIdsWithCalSticks.filter((padId) => memberPadIds.includes(padId))
      query = query.or(`owner_id.eq.${user.id},id.in.(${accessiblePadIds.join(",")})`)
    } else {
      query = query.eq("owner_id", user.id)
    }

    const { data: pads, error } = await query

    if (error) {
      console.error("Error fetching pads:", error)
      return NextResponse.json({ error: "Failed to fetch pads" }, { status: 500 })
    }

    return NextResponse.json({ pads })
  } catch (error) {
    console.error("Error in pads GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
