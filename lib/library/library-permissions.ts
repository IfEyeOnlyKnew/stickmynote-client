import { db } from "@/lib/database/pg-client"

export type LibraryScopeType = "concur_user" | "alliance_pad" | "inference_pad"

export type LibraryPermission = "view" | "upload" | "delete_own" | "delete_any" | "manage"

interface PermissionResult {
  allowed: boolean
  permissions: LibraryPermission[]
  role?: string
}

/**
 * Check what library permissions a user has for a given scope.
 * Permissions inherit from the parent resource's role system.
 */
export async function checkLibraryPermissions(
  userId: string,
  orgId: string,
  scopeType: LibraryScopeType,
  scopeId: string,
): Promise<PermissionResult> {
  switch (scopeType) {
    case "concur_user":
      return checkConcurPermissions(userId, orgId, scopeId)
    case "alliance_pad":
      return checkAlliancePadPermissions(userId, orgId, scopeId)
    case "inference_pad":
      return checkInferencePadPermissions(userId, orgId, scopeId)
    default:
      return { allowed: false, permissions: [] }
  }
}

/**
 * Concur: Personal library (OneDrive-style)
 * - Owner (scopeId === userId): full control
 * - Same org member who shares a Concur group with the owner: view + download only
 */
async function checkConcurPermissions(
  userId: string,
  orgId: string,
  scopeId: string, // the library owner's user_id
): Promise<PermissionResult> {
  // User owns this library
  if (userId === scopeId) {
    return {
      allowed: true,
      permissions: ["view", "upload", "delete_own", "delete_any", "manage"],
      role: "owner",
    }
  }

  // Check if users share a Concur group in the same org
  const sharedGroup = await db.query(
    `SELECT 1 FROM concur_group_members gm1
     JOIN concur_group_members gm2 ON gm1.group_id = gm2.group_id
     WHERE gm1.user_id = $1 AND gm2.user_id = $2
       AND gm1.org_id = $3 AND gm1.accepted = true AND gm2.accepted = true
     LIMIT 1`,
    [userId, scopeId, orgId],
  )

  if (sharedGroup.rows.length > 0) {
    return {
      allowed: true,
      permissions: ["view"],
      role: "viewer",
    }
  }

  return { allowed: false, permissions: [] }
}

/**
 * Alliance Pad: Pad-level library
 * - Pad owner: full control
 * - Admin: full control
 * - Edit role: view + upload + delete own
 * - View role: view only
 */
async function checkAlliancePadPermissions(
  userId: string,
  orgId: string,
  scopeId: string, // pad_id
): Promise<PermissionResult> {
  // Check pad ownership
  const pad = await db.query(
    `SELECT owner_id FROM paks_pads WHERE id = $1 AND org_id = $2`,
    [scopeId, orgId],
  )

  if (pad.rows.length === 0) {
    return { allowed: false, permissions: [] }
  }

  if (pad.rows[0].owner_id === userId) {
    return {
      allowed: true,
      permissions: ["view", "upload", "delete_own", "delete_any", "manage"],
      role: "owner",
    }
  }

  // Check multi-pak membership
  const membership = await db.query(
    `SELECT mpm.role FROM multi_pak_members mpm
     JOIN paks_pads pp ON pp.multi_pak_id = mpm.multi_pak_id
     WHERE pp.id = $1 AND mpm.user_id = $2`,
    [scopeId, userId],
  )

  if (membership.rows.length > 0) {
    const role = membership.rows[0].role
    if (role === "admin") {
      return {
        allowed: true,
        permissions: ["view", "upload", "delete_own", "delete_any", "manage"],
        role: "admin",
      }
    }
    if (role === "edit") {
      return {
        allowed: true,
        permissions: ["view", "upload", "delete_own"],
        role: "editor",
      }
    }
    if (role === "view") {
      return {
        allowed: true,
        permissions: ["view"],
        role: "viewer",
      }
    }
  }

  return { allowed: false, permissions: [] }
}

/**
 * Inference Pad: Hub-level library
 * - Pad owner: full control
 * - Admin (admin_level='admin'): full control
 * - Editor: view + upload + delete own
 * - Contributor: view + upload
 * - Viewer: view only
 */
async function checkInferencePadPermissions(
  userId: string,
  orgId: string,
  scopeId: string, // social_pad_id
): Promise<PermissionResult> {
  // Check pad ownership
  const pad = await db.query(
    `SELECT owner_id FROM social_pads WHERE id = $1 AND org_id = $2`,
    [scopeId, orgId],
  )

  if (pad.rows.length === 0) {
    return { allowed: false, permissions: [] }
  }

  if (pad.rows[0].owner_id === userId) {
    return {
      allowed: true,
      permissions: ["view", "upload", "delete_own", "delete_any", "manage"],
      role: "owner",
    }
  }

  // Check social_pad_members
  const membership = await db.query(
    `SELECT role, admin_level FROM social_pad_members
     WHERE social_pad_id = $1 AND user_id = $2 AND accepted = true`,
    [scopeId, userId],
  )

  if (membership.rows.length > 0) {
    const { role, admin_level } = membership.rows[0]

    if (admin_level === "owner" || admin_level === "admin" || role === "admin") {
      return {
        allowed: true,
        permissions: ["view", "upload", "delete_own", "delete_any", "manage"],
        role: "admin",
      }
    }
    if (role === "editor") {
      return {
        allowed: true,
        permissions: ["view", "upload", "delete_own"],
        role: "editor",
      }
    }
    if (role === "contributor") {
      return {
        allowed: true,
        permissions: ["view", "upload"],
        role: "contributor",
      }
    }
    if (role === "viewer") {
      return {
        allowed: true,
        permissions: ["view"],
        role: "viewer",
      }
    }
  }

  return { allowed: false, permissions: [] }
}
