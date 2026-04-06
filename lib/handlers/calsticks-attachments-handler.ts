// Calsticks attachments handler logic - extracted for v1/v2 deduplication
import { db } from '@/lib/database/pg-client'

export interface AttachmentsUser {
  id: string
}

export interface AttachmentsOrgContext {
  orgId: string
}

// ============================================================================
// Ownership check
// ============================================================================

export async function verifyCalstickOwnership(
  calstickId: string,
  userId: string,
  orgId: string,
): Promise<boolean> {
  const result = await db.query(
    `SELECT user_id FROM calsticks WHERE id = $1 AND org_id = $2`,
    [calstickId, orgId],
  )
  return result.rows[0]?.user_id === userId
}

// ============================================================================
// GET: Get attachments for a calstick
// ============================================================================

export async function getAttachments(calstickId: string, orgId: string) {
  const result = await db.query(
    `SELECT * FROM calstick_attachments WHERE calstick_id = $1 AND org_id = $2 ORDER BY created_at DESC`,
    [calstickId, orgId],
  )
  return { attachments: result.rows }
}

// ============================================================================
// POST: Add attachment to a calstick
// ============================================================================

export interface CreateAttachmentInput {
  name: string
  url: string
  size: number
  type: string
  provider?: string
  provider_id?: string
  thumbnail_url?: string
}

export async function createAttachment(
  calstickId: string,
  orgId: string,
  userId: string,
  input: CreateAttachmentInput,
) {
  const { name, url, size, type, provider = 'local', provider_id, thumbnail_url } = input

  const result = await db.query(
    `INSERT INTO calstick_attachments (calstick_id, org_id, name, url, size, type, provider, provider_id, thumbnail_url, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [calstickId, orgId, name, url, size, type, provider, provider_id, thumbnail_url, userId],
  )

  return { attachment: result.rows[0] }
}

// ============================================================================
// DELETE: Delete attachment from a calstick
// ============================================================================

export async function deleteAttachment(attachmentId: string, orgId: string, userId: string) {
  if (!attachmentId) {
    throw new Error('Attachment ID required')
  }

  await db.query(
    `DELETE FROM calstick_attachments WHERE id = $1 AND org_id = $2 AND uploaded_by = $3`,
    [attachmentId, orgId, userId],
  )

  return { success: true }
}
