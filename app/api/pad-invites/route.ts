import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient, createServiceDatabaseClient, type DatabaseClient } from "@/lib/database/database-adapter"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

// Types
type DbRole = "admin" | "edit" | "view"

interface InviteResult {
  userId?: string
  email?: string
  reason?: string
}

interface InviteResults {
  success: InviteResult[]
  failed: InviteResult[]
  total: number
}

interface InviteEmailParams {
  toEmail: string
  toName: string
  padName: string
  role: string
  inviterName: string
  padLink: string
  isNewUser?: boolean
}

interface InviteInput {
  padId: string
  role: string
  userIds?: string[]
  emails?: string[]
}

interface OrgContext {
  orgId: string
}

// Constants
const VALID_ROLES = new Set(["admin", "editor", "viewer", "edit", "view"])
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

const ROLE_MAP: Record<string, DbRole> = {
  admin: "admin",
  editor: "edit",
  viewer: "view",
  edit: "edit",
  view: "view",
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: "manage members and have full access to all sticks",
  editor: "create and edit sticks",
  edit: "create and edit sticks",
  viewer: "view sticks and replies",
  view: "view sticks and replies",
}

// Helper functions
function mapRoleForDatabase(role: string): DbRole {
  return ROLE_MAP[role.toLowerCase()] || "view"
}

function getDisplayRole(role: string): string {
  const normalized = role.toLowerCase()
  if (normalized === "admin") return "Admin"
  if (normalized === "editor" || normalized === "edit") return "Editor"
  return "Viewer"
}

function createInviteResults(): InviteResults {
  return { success: [], failed: [], total: 0 }
}

function buildPadLink(padId: string, isNewUser = false): string {
  if (isNewUser) {
    return `${SITE_URL}/auth/login?redirect=/pads/${padId}`
  }
  return `${SITE_URL}/pads/${padId}`
}

function canInviteMembers(pad: any, userId: string): boolean {
  if (pad.owner_id === userId) return true
  
  const isAdmin = pad.pad_members?.some(
    (m: any) => m.user_id === userId && m.role === "admin" && m.accepted
  )
  const isAdminFromPaksPadMembers = pad.paks_pad_members?.some(
    (m: any) => m.user_id === userId && m.role === "admin" && m.accepted
  )
  
  return isAdmin || isAdminFromPaksPadMembers
}

async function checkExistingMember(
  db: DatabaseClient,
  padId: string,
  userId: string,
  orgId: string,
): Promise<{ exists: boolean; reason?: string; error?: string }> {
  const { data: existingMember, error } = await db
    .from("paks_pad_members")
    .select("*")
    .eq("pad_id", padId)
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .maybeSingle()

  if (error) return { exists: false, error: error.message }
  if (existingMember) {
    return {
      exists: true,
      reason: existingMember.accepted ? "Already a member" : "Invitation already sent",
    }
  }
  return { exists: false }
}

async function addMember(
  db: DatabaseClient,
  padId: string,
  userId: string,
  role: DbRole,
  invitedBy: string,
  orgId: string,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await db
    .from("paks_pad_members")
    .insert({
      pad_id: padId,
      user_id: userId,
      role,
      invited_by: invitedBy,
      invited_at: new Date().toISOString(),
      accepted: true,
      org_id: orgId,
    })
    .select()

  return error ? { success: false, error: error.message } : { success: true }
}

async function addPendingInvite(
  db: DatabaseClient,
  padId: string,
  email: string,
  role: DbRole,
  invitedBy: string,
  orgId: string,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await db
    .from("paks_pad_pending_invites")
    .insert({
      pad_id: padId,
      email,
      role,
      invited_by: invitedBy,
      invited_at: new Date().toISOString(),
      org_id: orgId,
    })
    .select()

  return error ? { success: false, error: error.message } : { success: true }
}

async function inviteByUserId(
  db: DatabaseClient,
  userId: string,
  padId: string,
  dbRole: DbRole,
  role: string,
  inviterId: string,
  inviterEmail: string,
  orgId: string,
  padName: string,
  results: InviteResults,
): Promise<void> {
  const memberCheck = await checkExistingMember(db, padId, userId, orgId)
  
  if (memberCheck.error) {
    results.failed.push({ userId, reason: memberCheck.error })
    return
  }
  
  if (memberCheck.exists) {
    results.failed.push({ userId, reason: memberCheck.reason })
    return
  }

  const addResult = await addMember(db, padId, userId, dbRole, inviterId, orgId)
  if (!addResult.success) {
    results.failed.push({ userId, reason: addResult.error })
    return
  }

  // Get user info for email
  const { data: invitedUser } = await db
    .from("users")
    .select("email, username, full_name")
    .eq("id", userId)
    .maybeSingle()

  if (invitedUser?.email) {
    await sendInvitationEmail({
      toEmail: invitedUser.email,
      toName: invitedUser.full_name || invitedUser.username || "User",
      padName,
      role,
      inviterName: inviterEmail || "A team member",
      padLink: buildPadLink(padId),
    })
  }

  results.success.push({ userId })
}

async function inviteByEmail(
  db: DatabaseClient,
  email: string,
  padId: string,
  dbRole: DbRole,
  role: string,
  inviterId: string,
  inviterEmail: string,
  orgId: string,
  padName: string,
  results: InviteResults,
): Promise<void> {
  // Check if user exists
  const { data: existingUser, error: userError } = await db
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle()

  if (userError) {
    results.failed.push({ email, reason: userError.message })
    return
  }

  if (existingUser) {
    // User exists - check if already member
    const memberCheck = await checkExistingMember(db, padId, existingUser.id, orgId)
    
    if (memberCheck.error) {
      results.failed.push({ email, reason: memberCheck.error })
      return
    }
    
    if (memberCheck.exists) {
      results.failed.push({ email, reason: memberCheck.reason?.replace("Already a member", "User already a member") })
      return
    }

    const addResult = await addMember(db, padId, existingUser.id, dbRole, inviterId, orgId)
    if (!addResult.success) {
      results.failed.push({ email, reason: addResult.error })
      return
    }

    await sendInvitationEmail({
      toEmail: email,
      toName: email.split("@")[0],
      padName,
      role,
      inviterName: inviterEmail || "A team member",
      padLink: buildPadLink(padId),
    })
    results.success.push({ email })
  } else {
    // New user - create pending invite
    const { data: existingPendingInvite } = await db
      .from("paks_pad_pending_invites")
      .select("id")
      .eq("pad_id", padId)
      .eq("email", email)
      .eq("org_id", orgId)
      .maybeSingle()

    if (existingPendingInvite) {
      results.failed.push({ email, reason: "Invitation already sent" })
      return
    }

    const pendingResult = await addPendingInvite(db, padId, email, dbRole, inviterId, orgId)
    if (!pendingResult.success) {
      results.failed.push({ email, reason: pendingResult.error })
      return
    }

    await sendInvitationEmail({
      toEmail: email,
      toName: email.split("@")[0],
      padName,
      role,
      inviterName: inviterEmail || "A team member",
      padLink: buildPadLink(padId, true),
      isNewUser: true,
    })
    results.success.push({ email })
  }
}

async function sendInvitationEmail(params: InviteEmailParams): Promise<void> {
  try {
    const { toEmail, toName, padName, role, inviterName, padLink, isNewUser = false } = params
    const normalizedRole = role.toLowerCase()
    const description = ROLE_DESCRIPTIONS[normalizedRole] || "access this pad"
    const displayRole = getDisplayRole(role)
    
    const padPath = "/pads/" + padLink.split("/").pop()
    const actionLink = isNewUser
      ? `${SITE_URL}/auth/login?redirect=${encodeURIComponent(padPath)}`
      : padLink

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">You've been invited to collaborate!</h2>
        <p>Hello ${toName},</p>
        <p>${inviterName} has invited you to join the pad "<strong>${padName}</strong>" with <strong>${displayRole}</strong> access.</p>
        ${isNewUser ? "<p>You'll need to create an account or log in first. After authenticating, you'll automatically be redirected to the pad.</p>" : "<p>Click the button below to access the pad. You may need to log in first.</p>"}
        <div style="margin: 30px 0;">
          <a href="${actionLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            ${isNewUser ? "Log In & Join Pad" : "Accept Invitation"}
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">
          <strong>Access level: ${displayRole}</strong><br>
          As a ${normalizedRole}, you can ${description}.
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 40px;">
          This invitation was sent from Stick My Note. If you weren't expecting this invitation, you can safely ignore this email.
        </p>
      </div>
    `

    await fetch(`${SITE_URL}/api/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: toEmail,
        subject: `Invitation to join "${padName}" pad`,
        html,
      }),
    })
  } catch (error) {
    console.error("Error sending invitation email:", error)
  }
}

// ============================================================================
// Error Responses
// ============================================================================

const Errors = {
  rateLimit: () =>
    NextResponse.json(
      { error: "Rate limit exceeded. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": "30" } }
    ),
  unauthorized: () =>
    NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  noOrgContext: () =>
    NextResponse.json({ error: "No organization context" }, { status: 403 }),
  missingFields: () =>
    NextResponse.json({ error: "Missing padId or role" }, { status: 400 }),
  invalidRole: () =>
    NextResponse.json({ error: "Invalid role. Must be admin, editor, or viewer" }, { status: 400 }),
  padNotFound: () =>
    NextResponse.json({ error: "Pad not found" }, { status: 404 }),
  notAuthorized: () =>
    NextResponse.json({ error: "Only pad owners or admins can invite members" }, { status: 403 }),
  internal: (details?: string) =>
    NextResponse.json(
      { error: "Failed to process invitations", details: details || "Unknown error" },
      { status: 500 }
    ),
} as const

// ============================================================================
// Validation Helpers
// ============================================================================

interface ValidationSuccess {
  valid: true
  dbRole: DbRole
}

interface ValidationError {
  valid: false
  response: NextResponse
}

function validateInviteInput(body: InviteInput): ValidationSuccess | ValidationError {
  const { padId, role } = body

  if (!padId || !role) {
    return { valid: false, response: Errors.missingFields() }
  }

  if (!VALID_ROLES.has(role.toLowerCase())) {
    return { valid: false, response: Errors.invalidRole() }
  }

  return { valid: true, dbRole: mapRoleForDatabase(role) }
}

// ============================================================================
// Invite Processing Helpers
// ============================================================================

async function processUserIdInvites(
  db: DatabaseClient,
  userIds: string[],
  context: {
    padId: string
    dbRole: DbRole
    role: string
    inviterId: string
    inviterEmail: string
    orgId: string
    padName: string
  },
  results: InviteResults
): Promise<void> {
  const { padId, dbRole, role, inviterId, inviterEmail, orgId, padName } = context

  for (const userId of userIds) {
    try {
      await inviteByUserId(db, userId, padId, dbRole, role, inviterId, inviterEmail, orgId, padName, results)
    } catch {
      results.failed.push({ userId, reason: "Unexpected error" })
    }
  }
}

async function processEmailInvites(
  db: DatabaseClient,
  emails: string[],
  context: {
    padId: string
    dbRole: DbRole
    role: string
    inviterId: string
    inviterEmail: string
    orgId: string
    padName: string
  },
  results: InviteResults
): Promise<void> {
  const { padId, dbRole, role, inviterId, inviterEmail, orgId, padName } = context

  for (const email of emails) {
    try {
      await inviteByEmail(db, email, padId, dbRole, role, inviterId, inviterEmail, orgId, padName, results)
    } catch {
      results.failed.push({ email, reason: "Unexpected error" })
    }
  }
}

// ============================================================================
// Route Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return Errors.rateLimit()
    }
    if (!authResult.user) {
      return Errors.unauthorized()
    }

    const user = authResult.user

    // Org context check
    const orgContext = await getOrgContext() as OrgContext | null
    if (!orgContext) {
      return Errors.noOrgContext()
    }

    // Validate input
    const body: InviteInput = await request.json()
    const validation = validateInviteInput(body)
    if (!validation.valid) {
      return validation.response
    }

    const { padId, role, userIds, emails } = body
    const { dbRole } = validation

    // Fetch and verify pad access
    const db = await createDatabaseClient()
    const serviceDb = await createServiceDatabaseClient()

    const { data: pad, error: padError } = await db
      .from("paks_pads")
      .select("*")
      .eq("id", padId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (padError || !pad) {
      return Errors.padNotFound()
    }

    // Fetch pad members separately
    const { data: padMembers } = await db
      .from("paks_pad_members")
      .select("*")
      .eq("pad_id", padId)
      .eq("org_id", orgContext.orgId)

    pad.paks_pad_members = padMembers || []

    if (!canInviteMembers(pad, user.id)) {
      return Errors.notAuthorized()
    }

    // Process invites
    const results = createInviteResults()
    const inviteContext = {
      padId,
      dbRole,
      role,
      inviterId: user.id,
      inviterEmail: user.email || "",
      orgId: orgContext.orgId,
      padName: pad.name,
    }

    if (userIds?.length) {
      await processUserIdInvites(serviceDb, userIds, inviteContext, results)
    }

    if (emails?.length) {
      await processEmailInvites(serviceDb, emails, inviteContext, results)
    }

    results.total = results.success.length + results.failed.length

    return NextResponse.json({ success: true, summary: results })
  } catch (error) {
    console.error("[PadInvites] POST error:", error)
    return Errors.internal(error instanceof Error ? error.message : undefined)
  }
}
