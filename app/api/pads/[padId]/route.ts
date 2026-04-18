import { type NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { validateUUID } from "@/lib/input-validation-enhanced"
import { requireAuthAndOrg, safeRateLimit } from "@/lib/api/route-helpers"
import { isUnderLegalHold } from "@/lib/legal-hold/check-hold"

export async function DELETE(request: NextRequest, context: { params: Promise<{ padId: string }> }) {
  try {
    const auth = await requireAuthAndOrg()
    if ("response" in auth) return auth.response
    const { user, orgContext } = auth

    const db = await createServiceDatabaseClient()

    const params = await context.params
    const padId = params.padId
    if (!validateUUID(padId)) return NextResponse.json({ error: "Invalid Pad ID" }, { status: 400 })

    if (!(await safeRateLimit(request, user.id, "pads_delete"))) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": "60" } })
    }

    const { data: pad, error: fetchError } = await db
      .from("paks_pads")
      .select("id, owner_id, multi_pak_id, org_id")
      .eq("id", padId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (fetchError) {
      console.error("Error fetching Pad:", fetchError)
      return NextResponse.json({ error: "Failed to fetch Pad" }, { status: 500 })
    }

    if (!pad) {
      return NextResponse.json({ error: "Pad not found" }, { status: 404 })
    }

    const isPadOwner = pad.owner_id === user.id

    const { data: multiPak } = await db
      .from("multi_paks")
      .select("owner_id")
      .eq("id", pad.multi_pak_id)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    const isMultiPakOwner = multiPak?.owner_id === user.id

    const { data: membership } = await db
      .from("multi_pak_members")
      .select("role")
      .eq("multi_pak_id", pad.multi_pak_id)
      .eq("user_id", user.id)
      .eq("accepted", true)
      .maybeSingle()

    const isMultiPakAdmin = membership?.role === "admin"

    if (!isPadOwner && !isMultiPakOwner && !isMultiPakAdmin) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    if (await isUnderLegalHold(user.id, orgContext.orgId)) {
      return NextResponse.json({ error: "Content cannot be deleted: active legal hold" }, { status: 403 })
    }

    const { error } = await db.from("paks_pads").delete().eq("id", padId).eq("org_id", orgContext.orgId)

    if (error) {
      console.error("Error deleting Pad:", error)
      return NextResponse.json({ error: "Failed to delete Pad" }, { status: 500 })
    }

    return NextResponse.json({ message: "Pad deleted successfully" })
  } catch (err) {
    console.error("DELETE /api/pads/[padId] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ padId: string }> }) {
  try {
    const auth = await requireAuthAndOrg()
    if ("response" in auth) return auth.response
    const { user } = auth

    const db = await createServiceDatabaseClient()

    const params = await context.params
    const padId = params.padId
    if (!validateUUID(padId)) return NextResponse.json({ error: "Invalid Pad ID" }, { status: 400 })

    if (!(await safeRateLimit(request, user.id, "pads_update"))) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": "60" } })
    }

    const body = await request.json()
    const name = typeof body.name === "string" ? body.name.trim() : undefined
    if (name === undefined) {
      return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 })
    }
    if (!name) {
      return NextResponse.json({ error: "Pad name cannot be empty" }, { status: 400 })
    }
    if (name.length > 200) {
      return NextResponse.json({ error: "Pad name is too long" }, { status: 400 })
    }

    // Fetch by id only — mirrors lib/data/pads-data.ts and app/pads/[padId]/page.tsx
    // which authorize by pad ownership/membership rather than org_id. Standalone
    // pads (multi_pak_id NULL) and legacy pads without org_id both need to work.
    const { data: pad, error: fetchError } = await db
      .from("paks_pads")
      .select("id, owner_id")
      .eq("id", padId)
      .maybeSingle()

    if (fetchError) {
      console.error("PATCH /api/pads/[padId] fetch error:", fetchError)
      return NextResponse.json({ error: "Failed to fetch Pad" }, { status: 500 })
    }
    if (!pad) return NextResponse.json({ error: "Pad not found" }, { status: 404 })

    // Pad owner can always rename
    let canEdit = pad.owner_id === user.id

    // Pad admin members can rename
    if (!canEdit) {
      const { data: membership } = await db
        .from("paks_pad_members")
        .select("role")
        .eq("pad_id", padId)
        .eq("user_id", user.id)
        .eq("accepted", true)
        .maybeSingle()

      canEdit = membership?.role === "admin"
    }

    if (!canEdit) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const { data: updated, error: updateError } = await db
      .from("paks_pads")
      .update({ name })
      .eq("id", padId)
      .select()
      .single()

    if (updateError) {
      console.error("PATCH /api/pads/[padId] update error:", updateError)
      return NextResponse.json({ error: "Failed to update Pad" }, { status: 500 })
    }

    return NextResponse.json({ pad: updated })
  } catch (err) {
    console.error("PATCH /api/pads/[padId] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ padId: string }> }) {
  try {
    const auth = await requireAuthAndOrg()
    if ("response" in auth) return auth.response
    const { user, orgContext } = auth

    const db = await createServiceDatabaseClient()

    const params = await context.params
    const padId = params.padId
    if (!validateUUID(padId)) return NextResponse.json({ error: "Invalid Pad ID" }, { status: 400 })

    if (!(await safeRateLimit(request, user.id, "pads_create"))) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": "60" } })
    }

    const body = await request.json()

    const { data: restoredPad, error } = await db
      .from("paks_pads")
      .insert({
        id: padId,
        multi_pak_id: body.multi_pak_id,
        name: body.name,
        description: body.description,
        owner_id: body.owner_id,
        created_at: body.created_at,
        org_id: orgContext.orgId,
      })
      .select()
      .single()

    if (error) {
      console.error("Error restoring Pad:", error)
      return NextResponse.json({ error: "Failed to restore Pad" }, { status: 500 })
    }

    return NextResponse.json({ pad: restoredPad })
  } catch (err) {
    console.error("POST /api/pads/[padId] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
