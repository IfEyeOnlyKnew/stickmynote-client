// Shared handler logic for stick [id] routes (v1 + v2 deduplication)
// Covers: PUT (full update), PATCH (partial update), DELETE

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
