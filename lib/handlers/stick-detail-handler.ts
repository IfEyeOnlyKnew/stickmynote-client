// Shared handler logic for stick [id] routes (v1 + v2 deduplication)
// Covers: PUT (full update), PATCH (partial update), DELETE
import { NextResponse } from "next/server"
import { query, querySingle } from "@/lib/database/pg-helpers"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { validateUUID } from "@/lib/input-validation-enhanced"
import { isUnderLegalHold } from "@/lib/legal-hold/check-hold"

export interface StickEditPermission {
  hasPermission: boolean
  notFound?: boolean
  stick?: {
    user_id: string
    pad_id: string
    pad_owner_id?: string
    org_id?: string
  }
}

// Fields allowed in PATCH partial updates
export const PATCH_ALLOWED_FIELDS = ['topic', 'content', 'details', 'color', 'is_quickstick'] as const

// Build partial update data from body, only including defined fields
export function buildPatchUpdateData(body: Record<string, unknown>): Record<string, unknown> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  for (const field of PATCH_ALLOWED_FIELDS) {
    if (body[field] !== undefined) {
      updateData[field] = body[field]
    }
  }

  return updateData
}

// Check if user can edit a stick (owner, pad owner, or admin/edit member)
export function canEditStick(
  stickUserId: string,
  padOwnerId: string | undefined,
  memberRole: string | undefined,
  userId: string,
): boolean {
  if (stickUserId === userId) return true
  if (padOwnerId === userId) return true
  if (memberRole === 'admin' || memberRole === 'edit') return true
  return false
}

// Check if user can delete a stick (owner, pad owner, or admin member only)
export function canDeleteStick(
  stickUserId: string,
  padOwnerId: string | undefined,
  memberRole: string | undefined,
  userId: string,
): boolean {
  if (stickUserId === userId) return true
  if (padOwnerId === userId) return true
  if (memberRole === 'admin') return true
  return false
}

// Shared auth + org + validation guard
async function getAuthOrgAndStickId(stickId: string): Promise<
  { error: NextResponse } | { user: { id: string; email?: string }; orgId: string }
> {
  const authResult = await getCachedAuthUser()
  if (authResult.rateLimited) {
    return {
      error: NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      ),
    }
  }
  if (!authResult.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const orgContext = await getOrgContext()
  if (!orgContext) {
    return { error: NextResponse.json({ error: "No organization context" }, { status: 403 }) }
  }

  if (!validateUUID(stickId)) {
    return { error: NextResponse.json({ error: "Invalid Stick ID" }, { status: 400 }) }
  }

  return { user: authResult.user, orgId: orgContext.orgId }
}

// Check edit permission via stick + pad + membership lookup
async function checkEditPermission(stickId: string, userId: string, orgId: string) {
  const stick = await querySingle(
    `SELECT s.user_id, s.pad_id, p.owner_id as pad_owner_id
     FROM paks_pad_sticks s
     LEFT JOIN paks_pads p ON s.pad_id = p.id
     WHERE s.id = $1 AND s.org_id = $2`,
    [stickId, orgId],
  )

  if (!stick) {
    return { hasPermission: false as const, notFound: true as const }
  }

  // Check membership
  const member = await querySingle(
    `SELECT role FROM paks_pad_members
     WHERE pad_id = $1 AND user_id = $2 AND accepted = true AND org_id = $3`,
    [stick.pad_id, userId, orgId],
  )

  const hasPermission = canEditStick(stick.user_id, stick.pad_owner_id, member?.role, userId)

  return { hasPermission, stick }
}

// PUT - Full update of a stick
export async function handlePutStick(request: Request, stickId: string): Promise<NextResponse> {
  try {
    const auth = await getAuthOrgAndStickId(stickId)
    if ("error" in auth) return auth.error

    const { hasPermission, notFound } = await checkEditPermission(stickId, auth.user.id, auth.orgId)
    if (notFound) {
      return NextResponse.json({ error: "Stick not found" }, { status: 404 })
    }
    if (!hasPermission) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const body = await request.json()
    const { topic, content, details, color } = body

    const stick = await querySingle(
      `UPDATE paks_pad_sticks
       SET topic = $1, content = $2, details = $3, color = $4, updated_at = NOW()
       WHERE id = $5 AND org_id = $6
       RETURNING *`,
      [topic, content, details, color, stickId, auth.orgId],
    )

    return NextResponse.json({ stick })
  } catch (error) {
    console.error("PUT /api/sticks/[id] error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH - Partial update of a stick
export async function handlePatchStick(request: Request, stickId: string): Promise<NextResponse> {
  try {
    const auth = await getAuthOrgAndStickId(stickId)
    if ("error" in auth) return auth.error

    const { hasPermission, notFound } = await checkEditPermission(stickId, auth.user.id, auth.orgId)
    if (notFound) {
      return NextResponse.json({ error: "Stick not found" }, { status: 404 })
    }
    if (!hasPermission) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const body = await request.json()
    const patchData = buildPatchUpdateData(body)

    // Build dynamic update query
    const updates: string[] = ["updated_at = NOW()"]
    const values: any[] = []
    let paramCount = 0

    for (const [key, value] of Object.entries(patchData)) {
      if (key === "updated_at") continue
      paramCount++
      updates.push(`${key} = $${paramCount}`)
      values.push(value)
    }

    paramCount++
    values.push(stickId)
    paramCount++
    values.push(auth.orgId)

    const stick = await querySingle(
      `UPDATE paks_pad_sticks
       SET ${updates.join(", ")}
       WHERE id = $${paramCount - 1} AND org_id = $${paramCount}
       RETURNING *`,
      values,
    )

    return NextResponse.json({ stick })
  } catch (error) {
    console.error("PATCH /api/sticks/[id] error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE - Delete a stick
export async function handleDeleteStick(stickId: string): Promise<NextResponse> {
  try {
    const auth = await getAuthOrgAndStickId(stickId)
    if ("error" in auth) return auth.error

    // Get stick with pad info
    const stick = await querySingle(
      `SELECT s.user_id, s.pad_id, p.owner_id as pad_owner_id
       FROM paks_pad_sticks s
       LEFT JOIN paks_pads p ON s.pad_id = p.id
       WHERE s.id = $1 AND s.org_id = $2`,
      [stickId, auth.orgId],
    )

    if (!stick) {
      return NextResponse.json({ error: "Stick not found" }, { status: 404 })
    }

    // Check delete permission - only need membership if not owner
    let memberRole: string | undefined
    if (stick.user_id !== auth.user.id && stick.pad_owner_id !== auth.user.id) {
      const member = await querySingle(
        `SELECT role FROM paks_pad_members
         WHERE pad_id = $1 AND user_id = $2 AND accepted = true AND org_id = $3`,
        [stick.pad_id, auth.user.id, auth.orgId],
      )
      memberRole = member?.role
    }

    if (!canDeleteStick(stick.user_id, stick.pad_owner_id, memberRole, auth.user.id)) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    if (await isUnderLegalHold(auth.user.id, auth.orgId)) {
      return NextResponse.json({ error: "Content cannot be deleted: active legal hold" }, { status: 403 })
    }

    await query(
      `DELETE FROM paks_pad_sticks WHERE id = $1 AND org_id = $2`,
      [stickId, auth.orgId],
    )

    return NextResponse.json({ message: "Stick deleted successfully" })
  } catch (error) {
    console.error("DELETE /api/sticks/[id] error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
