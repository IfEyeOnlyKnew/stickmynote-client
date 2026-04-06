// Inference Sticks Members handler - shared logic between v1 and v2 API routes
import { db } from '@/lib/database/pg-client'

// ============================================================================
// Types
// ============================================================================

interface EmailContext {
  siteUrl: string
  stickId: string
  stickTopic: string
  padName: string
}

// ============================================================================
// Email Helpers
// ============================================================================

function buildEmailHtml(
  type: 'added' | 'invited',
  stickTopic: string,
  padName: string,
  actionUrl: string
): string {
  const isAdded = type === 'added'
  const heading = isAdded ? "You've been added to a Stick!" : "You've been invited to a Stick!"
  const description = isAdded
    ? `You've been added to the stick "<strong>${stickTopic}</strong>" in the pad "<strong>${padName}</strong>" on Stick My Note.`
    : `You've been invited to access the stick "<strong>${stickTopic}</strong>" in the pad "<strong>${padName}</strong>" on Stick My Note.`
  const callToAction = isAdded
    ? 'You can now access this stick:'
    : 'To accept this invitation, please sign up for Stick My Note:'
  const buttonText = isAdded ? `View ${stickTopic}` : `Sign Up & View ${stickTopic}`
  const footer = isAdded
    ? '<p>Happy collaborating!</p>'
    : "<p>After signing up, you'll be able to access this stick and collaborate with other members.</p><p>If you need an access code, please contact the person who invited you.</p>"

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>${heading}</h2>
      <p>${description}</p>
      <p>${callToAction}</p>
      <a href="${actionUrl}"
         style="background-color: #9333ea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 16px 0;">
        ${buttonText}
      </a>
      ${footer}
    </div>
  `
}

async function sendNotificationEmail(
  email: string,
  type: 'added' | 'invited',
  ctx: EmailContext
): Promise<void> {
  const stickUrl = `${ctx.siteUrl}/social/sticks/${ctx.stickId}`
  const actionUrl = `${ctx.siteUrl}/auth/login?email=${encodeURIComponent(email)}&redirectTo=${encodeURIComponent(stickUrl)}`
  const subject =
    type === 'added'
      ? `You've been added to "${ctx.stickTopic}" in ${ctx.padName}`
      : `You've been invited to "${ctx.stickTopic}" in ${ctx.padName}`
  const textAction = type === 'added' ? 'access it' : 'sign up'

  await fetch(`${ctx.siteUrl}/api/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: email,
      subject,
      html: buildEmailHtml(type, ctx.stickTopic, ctx.padName, actionUrl),
      text: `You've been ${type === 'added' ? 'added to' : 'invited to'} the stick "${ctx.stickTopic}" in the pad "${ctx.padName}" on Stick My Note. You can ${textAction} at: ${actionUrl}`,
    }),
  })
}

// ============================================================================
// Shared Helpers
// ============================================================================

async function getStickWithPad(stickId: string) {
  const stickResult = await db.query(
    `SELECT ss.social_pad_id, ss.topic, sp.owner_id as pad_owner_id, sp.name as pad_name
     FROM social_sticks ss
     LEFT JOIN social_pads sp ON ss.social_pad_id = sp.id
     WHERE ss.id = $1`,
    [stickId]
  )

  if (stickResult.rows.length === 0) return null
  return stickResult.rows[0]
}

async function checkManagePermission(padId: string, userId: string) {
  const memberResult = await db.query(
    `SELECT role FROM social_pad_members
     WHERE social_pad_id = $1 AND user_id = $2`,
    [padId, userId]
  )
  return memberResult.rows[0]?.role === 'admin'
}

// ============================================================================
// GET: List stick members
// ============================================================================

export async function listStickMembers(
  stickId: string,
  _userId: string
): Promise<{ status: number; body: any }> {
  const result = await db.query(
    `SELECT m.*, u.id as uid, u.full_name, u.username, u.email, u.avatar_url
     FROM social_stick_members m
     LEFT JOIN users u ON m.user_id = u.id
     WHERE m.social_stick_id = $1
     ORDER BY m.granted_at DESC`,
    [stickId]
  )

  const members = result.rows.map((m: any) => ({
    ...m,
    users: {
      id: m.uid || m.user_id,
      full_name: m.full_name,
      username: m.username,
      email: m.email,
      avatar_url: m.avatar_url,
    },
  }))

  return { status: 200, body: { members } }
}

// ============================================================================
// POST: Add stick member
// ============================================================================

export async function addStickMember(
  stickId: string,
  email: string,
  userId: string
): Promise<{ status: number; body: any }> {
  if (!email?.trim()) {
    return { status: 400, body: { error: 'Email is required' } }
  }

  const stick = await getStickWithPad(stickId)
  if (!stick) {
    return { status: 404, body: { error: 'Stick not found' } }
  }

  // Check permission
  const isOwner = stick.pad_owner_id === userId
  if (!isOwner) {
    const isAdmin = await checkManagePermission(stick.social_pad_id, userId)
    if (!isAdmin) {
      return { status: 403, body: { error: 'Only pad owners and admins can manage stick members' } }
    }
  }

  // Look up target user
  const targetResult = await db.query(
    `SELECT id, email, full_name FROM users WHERE email = $1`,
    [email.trim()]
  )

  if (targetResult.rows.length > 0) {
    const targetUser = targetResult.rows[0]

    // Check if already a member
    const existingResult = await db.query(
      `SELECT id FROM social_stick_members
       WHERE social_stick_id = $1 AND user_id = $2`,
      [stickId, targetUser.id]
    )

    if (existingResult.rows.length > 0) {
      return { status: 400, body: { error: 'User is already a member of this stick' } }
    }

    // Add as member
    await db.query(
      `INSERT INTO social_stick_members (social_stick_id, user_id, role, granted_by)
       VALUES ($1, $2, $3, $4)`,
      [stickId, targetUser.id, 'member', userId]
    )

    // Send notification email (fire-and-forget)
    try {
      const ctx: EmailContext = {
        siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        stickId,
        stickTopic: stick.topic,
        padName: stick.pad_name,
      }
      await sendNotificationEmail(email, 'added', ctx)
    } catch (emailError) {
      console.error('Failed to send notification email:', emailError)
    }

    return { status: 200, body: { message: 'Member added successfully', userExists: true } }
  } else {
    // User doesn't exist - send invitation email
    try {
      const ctx: EmailContext = {
        siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        stickId,
        stickTopic: stick.topic,
        padName: stick.pad_name,
      }
      await sendNotificationEmail(email, 'invited', ctx)
      return {
        status: 200,
        body: {
          message: 'Invitation email sent successfully. User will be added when they sign up.',
          userExists: false,
        },
      }
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError)
      return { status: 500, body: { error: 'Failed to send invitation email' } }
    }
  }
}

// ============================================================================
// POST: Bulk add stick members
// ============================================================================

type ProcessResult = { status: 'added' | 'invited' | 'skipped'; error?: string }

async function processEmail(
  email: string,
  stickId: string,
  grantedBy: string,
  ctx: EmailContext
): Promise<ProcessResult> {
  const targetResult = await db.query(
    `SELECT id, email, full_name FROM users WHERE email = $1`,
    [email]
  )

  if (targetResult.rows.length > 0) {
    const targetUser = targetResult.rows[0]

    // Check if already member
    const existingResult = await db.query(
      `SELECT id FROM social_stick_members WHERE social_stick_id = $1 AND user_id = $2`,
      [stickId, targetUser.id]
    )

    if (existingResult.rows.length > 0) {
      return { status: 'skipped' }
    }

    // Add member
    await db.query(
      `INSERT INTO social_stick_members (social_stick_id, user_id, role, granted_by)
       VALUES ($1, $2, $3, $4)`,
      [stickId, targetUser.id, 'member', grantedBy]
    )

    try {
      await sendNotificationEmail(email, 'added', ctx)
    } catch (emailError) {
      console.error(`Failed to send notification to ${email}:`, emailError)
    }

    return { status: 'added' }
  }

  // User doesn't exist - send invitation
  try {
    await sendNotificationEmail(email, 'invited', ctx)
    return { status: 'invited' }
  } catch (emailError) {
    console.error(`Failed to send invitation to ${email}:`, emailError)
    return { status: 'skipped', error: `Failed to send invitation to ${email}` }
  }
}

export async function bulkAddStickMembers(
  stickId: string,
  emails: string[],
  userId: string
): Promise<{ status: number; body: any }> {
  if (!Array.isArray(emails) || emails.length === 0) {
    return { status: 400, body: { error: 'Emails array is required' } }
  }

  const stick = await getStickWithPad(stickId)
  if (!stick) {
    return { status: 404, body: { error: 'Stick not found' } }
  }

  // Check permission
  const isOwner = stick.pad_owner_id === userId
  if (!isOwner) {
    const isAdmin = await checkManagePermission(stick.social_pad_id, userId)
    if (!isAdmin) {
      return { status: 403, body: { error: 'Only pad owners and admins can manage stick members' } }
    }
  }

  const ctx: EmailContext = {
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    stickId,
    stickTopic: stick.topic,
    padName: stick.pad_name,
  }

  // Process all emails
  const results = await Promise.all(
    emails.map(async (email: string): Promise<ProcessResult> => {
      try {
        return await processEmail(email, stickId, userId, ctx)
      } catch (error) {
        console.error(`Error processing ${email}:`, error)
        return { status: 'skipped', error: `Error processing ${email}` }
      }
    })
  )

  const added = results.filter((r) => r.status === 'added').length
  const invited = results.filter((r) => r.status === 'invited').length
  const skipped = results.filter((r) => r.status === 'skipped').length
  const errors = results.map((r) => r.error).filter((e): e is string => !!e)

  const addedText = `Added ${added} existing user${added === 1 ? '' : 's'}`
  const invitedText = `invited ${invited} new user${invited === 1 ? '' : 's'}`
  const skippedText = skipped > 0 ? `, ${skipped} skipped` : ''

  return {
    status: 200,
    body: {
      added,
      invited,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      message: `${addedText}, ${invitedText}${skippedText}`,
    },
  }
}
