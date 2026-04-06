// Saved emails handler logic - extracted for v1/v2 deduplication
import { db } from '@/lib/database/pg-client'

export interface SavedEmailsUser {
  id: string
  email?: string
}

// ============================================================================
// GET: Fetch saved emails
// ============================================================================

export interface GetSavedEmailsParams {
  teamId: string | null
  search: string | null
}

export async function getSavedEmails(user: SavedEmailsUser, params: GetSavedEmailsParams) {
  const actualTeamId = params.teamId === 'global-multipaks' ? null : params.teamId

  let queryStr = `SELECT * FROM saved_emails WHERE user_id = $1`
  const queryParams: any[] = [user.id]
  let paramIndex = 2

  if (actualTeamId) {
    queryStr += ` AND team_id = $${paramIndex}`
    queryParams.push(actualTeamId)
    paramIndex++
  } else if (params.teamId === 'global-multipaks') {
    queryStr += ` AND team_id IS NULL`
  }

  if (params.search) {
    queryStr += ` AND (email ILIKE $${paramIndex} OR name ILIKE $${paramIndex})`
    queryParams.push(`%${params.search}%`)
    paramIndex++
  }

  queryStr += ` ORDER BY created_at DESC LIMIT 100`

  const result = await db.query(queryStr, queryParams)
  return { savedEmails: result.rows }
}

// ============================================================================
// POST: Create saved emails
// ============================================================================

export interface CreateSavedEmailsInput {
  emails: any[]
  teamId?: string | null
  source?: string
}

export interface CreateSavedEmailsResult {
  success: boolean
  savedCount: number
  skipped: number
  message?: string
  savedEmails: any[]
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateAndParseEmails(emails: any[]): { email: string; name: string | null }[] {
  return emails
    .filter((emailData: any) => {
      const email = typeof emailData === 'string' ? emailData : emailData.email
      return email && EMAIL_REGEX.test(email)
    })
    .map((emailData: any) => {
      const email = typeof emailData === 'string' ? emailData : emailData.email
      const name = typeof emailData === 'string' ? null : emailData.name || null
      return { email: email.toLowerCase().trim(), name: name?.trim() || null }
    })
}

export async function createSavedEmails(
  user: SavedEmailsUser,
  input: CreateSavedEmailsInput,
): Promise<CreateSavedEmailsResult> {
  const { emails, teamId, source = 'manual' } = input
  const actualTeamId = teamId === 'global-multipaks' ? null : teamId

  if (!emails || !Array.isArray(emails) || emails.length === 0) {
    throw new Error('Invalid emails array')
  }

  const emailsToInsert = validateAndParseEmails(emails)

  if (emailsToInsert.length === 0) {
    throw new Error('No valid emails provided')
  }

  // Check for existing emails
  const existingResult = await db.query(
    `SELECT email FROM saved_emails WHERE user_id = $1 AND email = ANY($2) AND ${actualTeamId ? 'team_id = $3' : 'team_id IS NULL'}`,
    actualTeamId
      ? [user.id, emailsToInsert.map((e) => e.email), actualTeamId]
      : [user.id, emailsToInsert.map((e) => e.email)],
  )
  const existingEmailSet = new Set(existingResult.rows.map((e: any) => e.email))

  const newEmails = emailsToInsert.filter((e) => !existingEmailSet.has(e.email))
  const duplicateCount = emailsToInsert.length - newEmails.length

  if (newEmails.length === 0) {
    return {
      success: true,
      savedCount: 0,
      skipped: duplicateCount,
      message: 'All emails already exist',
      savedEmails: [],
    }
  }

  // Insert new emails
  const insertValues = newEmails
    .map((_, i) => `($1, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4}, $${i * 4 + 5})`)
    .join(', ')
  const insertParams: any[] = [user.id]
  newEmails.forEach((e) => {
    insertParams.push(actualTeamId, e.email, e.name, source)
  })

  const insertResult = await db.query(
    `INSERT INTO saved_emails (user_id, team_id, email, name, source)
     VALUES ${insertValues}
     RETURNING *`,
    insertParams,
  )

  return {
    success: true,
    savedCount: insertResult.rows.length,
    skipped: duplicateCount,
    savedEmails: insertResult.rows,
  }
}

// ============================================================================
// DELETE: Delete a saved email
// ============================================================================

export interface DeleteSavedEmailParams {
  emailId: string | null
  email: string | null
  teamId: string | null
}

export async function deleteSavedEmail(user: SavedEmailsUser, params: DeleteSavedEmailParams) {
  const { emailId, email, teamId } = params

  if (!emailId && !email) {
    throw new Error('Email ID or email address required')
  }

  if (emailId) {
    await db.query(`DELETE FROM saved_emails WHERE id = $1 AND user_id = $2`, [emailId, user.id])
  } else if (email) {
    if (teamId) {
      await db.query(
        `DELETE FROM saved_emails WHERE email = $1 AND user_id = $2 AND team_id = $3`,
        [email.toLowerCase().trim(), user.id, teamId],
      )
    } else {
      await db.query(`DELETE FROM saved_emails WHERE email = $1 AND user_id = $2`, [
        email.toLowerCase().trim(),
        user.id,
      ])
    }
  }

  return { success: true }
}

// ============================================================================
// BULK DELETE: Delete multiple saved emails
// ============================================================================

export async function bulkDeleteSavedEmails(
  user: SavedEmailsUser,
  emailIds: string[],
  teamId?: string,
) {
  if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
    throw new Error('Invalid email IDs array')
  }

  if (teamId) {
    await db.query(
      `DELETE FROM saved_emails WHERE user_id = $1 AND id = ANY($2) AND team_id = $3`,
      [user.id, emailIds, teamId],
    )
  } else {
    await db.query(`DELETE FROM saved_emails WHERE user_id = $1 AND id = ANY($2)`, [
      user.id,
      emailIds,
    ])
  }

  return { success: true, deletedCount: emailIds.length }
}

// ============================================================================
// BULK ADD: CSV or JSON bulk add
// ============================================================================

export async function parseCSVEmails(
  file: File,
): Promise<{ email: string; name: string | null }[]> {
  const fileText = await file.text()

  if (!fileText.trim()) {
    throw new Error('CSV file is empty')
  }

  const lines = fileText.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length === 0) {
    throw new Error('No valid lines found in CSV file')
  }

  const emails = lines
    .map((line) => {
      const trimmedLine = line.trim().replaceAll(/^["']|["']$/g, '')
      if (trimmedLine.includes(',')) {
        const [email, name] = trimmedLine
          .split(',')
          .map((s) => s.trim().replaceAll(/^["']|["']$/g, ''))
        return { email: email?.toLowerCase(), name: name || null }
      }
      return { email: trimmedLine.toLowerCase(), name: null }
    })
    .filter((item) => item.email && EMAIL_REGEX.test(item.email))

  if (emails.length === 0) {
    throw new Error('No valid email addresses found in CSV file. Please check the format.')
  }

  return emails as { email: string; name: string | null }[]
}

export async function bulkAddSavedEmails(
  user: SavedEmailsUser,
  emailsToInsert: { email: string; name: string | null }[],
  source: string,
): Promise<{ added: number; skipped: number; message?: string }> {
  if (emailsToInsert.length === 0) {
    throw new Error('No valid email addresses found')
  }

  // Check for existing emails
  const existingResult = await db.query(
    `SELECT email FROM saved_emails WHERE user_id = $1 AND email = ANY($2) AND team_id IS NULL`,
    [user.id, emailsToInsert.map((e) => e.email)],
  )
  const existingEmailSet = new Set(existingResult.rows.map((e: any) => e.email))

  const newEmails = emailsToInsert.filter((e) => !existingEmailSet.has(e.email))
  const duplicateCount = emailsToInsert.length - newEmails.length

  if (newEmails.length === 0) {
    return { added: 0, skipped: duplicateCount, message: 'All emails already exist' }
  }

  // Insert new emails
  const insertValues = newEmails
    .map((_, i) => `($1, $${i * 3 + 2}, $${i * 3 + 3}, $${i * 3 + 4})`)
    .join(', ')
  const insertParams: any[] = [user.id]
  newEmails.forEach((e) => {
    insertParams.push(e.email, e.name, source)
  })

  const insertResult = await db.query(
    `INSERT INTO saved_emails (user_id, email, name, source)
     VALUES ${insertValues}
     RETURNING *`,
    insertParams,
  )

  return { added: insertResult.rows.length, skipped: duplicateCount }
}
