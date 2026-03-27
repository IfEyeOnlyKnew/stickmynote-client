import { db } from "@/lib/database/pg-client"

export type LibraryScopeType = "stick"

export type StickType = "personal" | "concur" | "alliance" | "inference"

export type LibraryPermission = "view" | "upload" | "delete_own" | "delete_any" | "manage"

interface PermissionResult {
  allowed: boolean
  permissions: LibraryPermission[]
  role: "owner" | "viewer" | "none"
}

const OWNER_PERMISSIONS: LibraryPermission[] = ["view", "upload", "delete_own", "delete_any", "manage"]
const VIEWER_PERMISSIONS: LibraryPermission[] = ["view"]

/**
 * Check library permissions for a stick's folder.
 * Simple model: Owner = full Edit, everyone else with access = Read-only.
 */
export async function checkStickLibraryPermissions(
  userId: string,
  orgId: string,
  stickId: string,
  stickType: StickType,
): Promise<PermissionResult> {
  switch (stickType) {
    case "personal":
      return checkPersonalStickPermissions(userId, orgId, stickId)
    case "concur":
      return checkConcurStickPermissions(userId, orgId, stickId)
    case "alliance":
      return checkAllianceStickPermissions(userId, orgId, stickId)
    case "inference":
      return checkInferenceStickPermissions(userId, orgId, stickId)
    default:
      return { allowed: false, permissions: [], role: "none" }
  }
}

/**
 * Personal sticks: Owner = Edit, shared users = Read-only
 */
async function checkPersonalStickPermissions(
  userId: string,
  orgId: string,
  stickId: string,
): Promise<PermissionResult> {
  const stick = await db.query(
    `SELECT user_id, is_shared FROM personal_sticks WHERE id = $1`,
    [stickId],
  )

  if (stick.rows.length === 0) return { allowed: false, permissions: [], role: "none" }

  // Owner gets full Edit
  if (stick.rows[0].user_id === userId) {
    return { allowed: true, permissions: OWNER_PERMISSIONS, role: "owner" }
  }

  // Shared users get Read-only
  if (stick.rows[0].is_shared) {
    const share = await db.query(
      `SELECT 1 FROM personal_sticks_shares WHERE stick_id = $1 AND shared_with_user_id = $2 LIMIT 1`,
      [stickId, userId],
    )
    if (share.rows.length > 0) {
      return { allowed: true, permissions: VIEWER_PERMISSIONS, role: "viewer" }
    }
  }

  return { allowed: false, permissions: [], role: "none" }
}

/**
 * Concur sticks: Stick author = Edit, group members = Read-only
 */
async function checkConcurStickPermissions(
  userId: string,
  orgId: string,
  stickId: string,
): Promise<PermissionResult> {
  const stick = await db.query(
    `SELECT cs.user_id, cs.group_id FROM concur_sticks cs WHERE cs.id = $1`,
    [stickId],
  )

  if (stick.rows.length === 0) return { allowed: false, permissions: [], role: "none" }

  // Stick author gets full Edit
  if (stick.rows[0].user_id === userId) {
    return { allowed: true, permissions: OWNER_PERMISSIONS, role: "owner" }
  }

  // Group owner also gets Edit
  const groupOwner = await db.query(
    `SELECT 1 FROM concur_group_members
     WHERE group_id = $1 AND user_id = $2 AND role = 'owner' AND accepted = true`,
    [stick.rows[0].group_id, userId],
  )
  if (groupOwner.rows.length > 0) {
    return { allowed: true, permissions: OWNER_PERMISSIONS, role: "owner" }
  }

  // Group members get Read-only
  const member = await db.query(
    `SELECT 1 FROM concur_group_members
     WHERE group_id = $1 AND user_id = $2 AND accepted = true`,
    [stick.rows[0].group_id, userId],
  )
  if (member.rows.length > 0) {
    return { allowed: true, permissions: VIEWER_PERMISSIONS, role: "viewer" }
  }

  return { allowed: false, permissions: [], role: "none" }
}

/**
 * Alliance sticks: Stick creator or pad owner = Edit, pad members = Read-only
 */
async function checkAllianceStickPermissions(
  userId: string,
  orgId: string,
  stickId: string,
): Promise<PermissionResult> {
  const stick = await db.query(
    `SELECT s.user_id, s.pad_id, p.owner_id as pad_owner_id
     FROM paks_pad_sticks s
     JOIN paks_pads p ON s.pad_id = p.id
     WHERE s.id = $1`,
    [stickId],
  )

  if (stick.rows.length === 0) return { allowed: false, permissions: [], role: "none" }

  const { user_id, pad_owner_id } = stick.rows[0]

  // Stick creator or pad owner gets Edit
  if (userId === user_id || userId === pad_owner_id) {
    return { allowed: true, permissions: OWNER_PERMISSIONS, role: "owner" }
  }

  // Pad members get Read-only
  const member = await db.query(
    `SELECT 1 FROM multi_pak_members mpm
     JOIN paks_pads pp ON pp.multi_pak_id = mpm.multi_pak_id
     WHERE pp.id = $1 AND mpm.user_id = $2`,
    [stick.rows[0].pad_id, userId],
  )
  if (member.rows.length > 0) {
    return { allowed: true, permissions: VIEWER_PERMISSIONS, role: "viewer" }
  }

  return { allowed: false, permissions: [], role: "none" }
}

/**
 * Inference sticks: Stick creator or pad owner = Edit, pad members = Read-only
 */
async function checkInferenceStickPermissions(
  userId: string,
  orgId: string,
  stickId: string,
): Promise<PermissionResult> {
  const stick = await db.query(
    `SELECT ss.user_id, ss.social_pad_id, sp.owner_id as pad_owner_id
     FROM social_sticks ss
     JOIN social_pads sp ON ss.social_pad_id = sp.id
     WHERE ss.id = $1`,
    [stickId],
  )

  if (stick.rows.length === 0) return { allowed: false, permissions: [], role: "none" }

  const { user_id, pad_owner_id } = stick.rows[0]

  // Stick creator or pad owner gets Edit
  if (userId === user_id || userId === pad_owner_id) {
    return { allowed: true, permissions: OWNER_PERMISSIONS, role: "owner" }
  }

  // Pad members get Read-only
  const member = await db.query(
    `SELECT 1 FROM social_pad_members
     WHERE social_pad_id = $1 AND user_id = $2 AND accepted = true`,
    [stick.rows[0].social_pad_id, userId],
  )
  if (member.rows.length > 0) {
    return { allowed: true, permissions: VIEWER_PERMISSIONS, role: "viewer" }
  }

  return { allowed: false, permissions: [], role: "none" }
}
