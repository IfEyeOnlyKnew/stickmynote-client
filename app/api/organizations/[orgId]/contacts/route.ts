import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

// GET /api/organizations/[orgId]/contacts - Get support contacts
export async function GET(request: NextRequest, { params }: { params: { orgId: string } }) {
  try {
    const supabase = await createClient()
    const authResult = await getCachedAuthUser(supabase)

    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }

    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { orgId } = params

    // Anyone can view contact info if they need to request access
    const { data: org, error } = await supabase
      .from("organizations")
      .select(`
        id,
        name,
        support_contact_1_email,
        support_contact_1_name,
        support_contact_2_email,
        support_contact_2_name
      `)
      .eq("id", orgId)
      .maybeSingle()

    if (error || !org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }

    return NextResponse.json({
      contacts: {
        contact1: {
          email: org.support_contact_1_email,
          name: org.support_contact_1_name,
        },
        contact2: {
          email: org.support_contact_2_email,
          name: org.support_contact_2_name,
        },
      },
    })
  } catch (err) {
    console.error("Unexpected error in GET /api/organizations/[orgId]/contacts:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH /api/organizations/[orgId]/contacts - Update support contacts
export async function PATCH(request: NextRequest, { params }: { params: { orgId: string } }) {
  try {
    const supabase = await createClient()
    const serviceClient = createServiceClient()
    const authResult = await getCachedAuthUser(supabase)

    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }

    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = authResult.user
    const { orgId } = params
    const body = await request.json()
    const { contact1, contact2 } = body

    // Verify user is owner of this organization
    const { data: membership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle()

    // Also check if user is the org owner
    const { data: org } = await supabase.from("organizations").select("owner_id").eq("id", orgId).maybeSingle()

    const isOwner = org?.owner_id === user.id || membership?.role === "owner"

    if (!isOwner) {
      return NextResponse.json({ error: "Only the organization owner can update support contacts" }, { status: 403 })
    }

    const { error: updateError } = await (serviceClient.from("organizations") as any)
      .update({
        support_contact_1_email: contact1?.email || null,
        support_contact_1_name: contact1?.name || null,
        support_contact_2_email: contact2?.email || null,
        support_contact_2_name: contact2?.name || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orgId)

    if (updateError) {
      console.error("Error updating contacts:", updateError)
      return NextResponse.json({ error: "Failed to update contacts" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Unexpected error in PATCH /api/organizations/[orgId]/contacts:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
