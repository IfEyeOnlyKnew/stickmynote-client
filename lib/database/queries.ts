/**
 * Database Queries - Direct PostgreSQL implementation
 * Type-safe query functions for the PostgreSQL database
 */

import { db, queryOne, queryMany, execute } from "./pg-client"
import type { QueryResultRow } from "pg"

// ==================== USERS ====================

export interface User extends QueryResultRow {
  id: string
  email: string
  username?: string
  hub_mode?: boolean
  organize_notes?: string
  created_at: string
  updated_at?: string
}

export async function getUserById(userId: string): Promise<User | null> {
  return queryOne<User>("SELECT * FROM users WHERE id = $1", [userId])
}

export async function getUserByEmail(email: string): Promise<User | null> {
  return queryOne<User>("SELECT * FROM users WHERE email = $1", [email])
}

export async function updateUser(userId: string, updates: Partial<User>): Promise<User | null> {
  const fields: string[] = []
  const values: any[] = []
  let paramIndex = 1

  Object.entries(updates).forEach(([key, value]) => {
    if (key !== "id" && value !== undefined) {
      fields.push(`${key} = $${paramIndex}`)
      values.push(value)
      paramIndex++
    }
  })

  if (fields.length === 0) return null

  values.push(userId)
  const query = `
    UPDATE users 
    SET ${fields.join(", ")}, updated_at = NOW()
    WHERE id = $${paramIndex}
    RETURNING *
  `
  return queryOne<User>(query, values)
}

// ==================== PERSONAL STICKS (NOTES) ====================

export interface PersonalStick extends QueryResultRow {
  id: string
  user_id: string
  title: string
  content?: string
  category?: string
  is_favorite?: boolean
  is_shared?: boolean
  color?: string
  position?: number
  created_at: string
  updated_at?: string
}

export async function getPersonalSticks(userId: string, options?: {
  limit?: number
  offset?: number
  orderBy?: string
}): Promise<PersonalStick[]> {
  const { limit = 100, offset = 0, orderBy = "created_at DESC" } = options || {}
  return queryMany<PersonalStick>(
    `SELECT * FROM personal_sticks 
     WHERE user_id = $1 
     ORDER BY ${orderBy}
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  )
}

export async function getPersonalStickById(id: string, userId: string): Promise<PersonalStick | null> {
  return queryOne<PersonalStick>(
    "SELECT * FROM personal_sticks WHERE id = $1 AND user_id = $2",
    [id, userId]
  )
}

type PersonalStickAutoFields = "id" | "created_at" | "updated_at"

export async function createPersonalStick(stick: Omit<PersonalStick, PersonalStickAutoFields>): Promise<PersonalStick | null> {
  const fields = Object.keys(stick)
  const values = Object.values(stick)
  const placeholders = values.map((_, i) => `$${i + 1}`).join(", ")

  return queryOne<PersonalStick>(
    `INSERT INTO personal_sticks (${fields.join(", ")})
     VALUES (${placeholders})
     RETURNING *`,
    values
  )
}

export async function updatePersonalStick(id: string, userId: string, updates: Partial<PersonalStick>): Promise<PersonalStick | null> {
  const fields: string[] = []
  const values: any[] = []
  let paramIndex = 1

  Object.entries(updates).forEach(([key, value]) => {
    if (key !== "id" && key !== "user_id" && value !== undefined) {
      fields.push(`${key} = $${paramIndex}`)
      values.push(value)
      paramIndex++
    }
  })

  if (fields.length === 0) return null

  values.push(id, userId)
  return queryOne<PersonalStick>(
    `UPDATE personal_sticks 
     SET ${fields.join(", ")}, updated_at = NOW()
     WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
     RETURNING *`,
    values
  )
}

export async function deletePersonalStick(id: string, userId: string): Promise<number> {
  return execute("DELETE FROM personal_sticks WHERE id = $1 AND user_id = $2", [id, userId])
}

export async function deleteAllPersonalSticks(userId: string): Promise<number> {
  return execute("DELETE FROM personal_sticks WHERE user_id = $1", [userId])
}

// ==================== PERSONAL STICKS REPLIES ====================

export interface PersonalStickReply extends QueryResultRow {
  id: string
  stick_id: string
  user_id: string
  content: string
  created_at: string
  updated_at?: string
}

export async function getStickReplies(stickId: string): Promise<PersonalStickReply[]> {
  return queryMany<PersonalStickReply>(
    "SELECT * FROM personal_sticks_replies WHERE stick_id = $1 ORDER BY created_at ASC",
    [stickId]
  )
}

export async function createStickReply(reply: Omit<PersonalStickReply, "id" | "created_at" | "updated_at">): Promise<PersonalStickReply | null> {
  return queryOne<PersonalStickReply>(
    `INSERT INTO personal_sticks_replies (stick_id, user_id, content)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [reply.stick_id, reply.user_id, reply.content]
  )
}

export async function updateStickReply(id: string, userId: string, content: string): Promise<PersonalStickReply | null> {
  return queryOne<PersonalStickReply>(
    `UPDATE personal_sticks_replies 
     SET content = $1, updated_at = NOW()
     WHERE id = $2 AND user_id = $3
     RETURNING *`,
    [content, id, userId]
  )
}

export async function deleteStickReply(id: string, userId: string): Promise<number> {
  return execute("DELETE FROM personal_sticks_replies WHERE id = $1 AND user_id = $2", [id, userId])
}

// ==================== PERSONAL STICKS TABS ====================

export interface PersonalStickTab extends QueryResultRow {
  id: string
  stick_id: string
  title: string
  content?: string
  position?: number
  created_at: string
  updated_at?: string
}

export async function getStickTabs(stickId: string): Promise<PersonalStickTab[]> {
  return queryMany<PersonalStickTab>(
    "SELECT * FROM personal_sticks_tabs WHERE stick_id = $1 ORDER BY position ASC",
    [stickId]
  )
}

export async function createStickTab(tab: Omit<PersonalStickTab, "id" | "created_at" | "updated_at">): Promise<PersonalStickTab | null> {
  return queryOne<PersonalStickTab>(
    `INSERT INTO personal_sticks_tabs (stick_id, title, content, position)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [tab.stick_id, tab.title, tab.content || "", tab.position || 0]
  )
}

export async function updateStickTab(id: string, updates: Partial<PersonalStickTab>): Promise<PersonalStickTab | null> {
  const fields: string[] = []
  const values: any[] = []
  let paramIndex = 1

  Object.entries(updates).forEach(([key, value]) => {
    if (key !== "id" && value !== undefined) {
      fields.push(`${key} = $${paramIndex}`)
      values.push(value)
      paramIndex++
    }
  })

  if (fields.length === 0) return null

  values.push(id)
  return queryOne<PersonalStickTab>(
    `UPDATE personal_sticks_tabs 
     SET ${fields.join(", ")}, updated_at = NOW()
     WHERE id = $${paramIndex}
     RETURNING *`,
    values
  )
}

export async function deleteStickTab(id: string): Promise<number> {
  return execute("DELETE FROM personal_sticks_tabs WHERE id = $1", [id])
}

// ==================== ORGANIZATION MEMBERS ====================

export interface OrganizationMember extends QueryResultRow {
  id: string
  org_id: string
  user_id: string
  role: string
  created_at: string
}

export async function getOrganizationMember(orgId: string, userId: string): Promise<OrganizationMember | null> {
  return queryOne<OrganizationMember>(
    "SELECT * FROM organization_members WHERE org_id = $1 AND user_id = $2",
    [orgId, userId]
  )
}

export async function getUserOrganizations(userId: string): Promise<OrganizationMember[]> {
  return queryMany<OrganizationMember>(
    "SELECT * FROM organization_members WHERE user_id = $1",
    [userId]
  )
}

export async function getUserOrganizationsWithDetails(userId: string): Promise<any[]> {
  return queryMany(`
    SELECT 
      om.id,
      om.org_id,
      om.user_id,
      om.role,
      om.invited_by,
      om.invited_at,
      om.joined_at,
      o.id as org_id,
      o.name as org_name,
      o.slug as org_slug,
      o.type as org_type,
      o.settings as org_settings,
      o.created_at as org_created_at,
      o.updated_at as org_updated_at
    FROM organization_members om
    JOIN organizations o ON om.org_id = o.id
    WHERE om.user_id = $1
    ORDER BY om.joined_at ASC
  `, [userId])
}

export async function createOrganizationMember(orgId: string, userId: string, role: string): Promise<OrganizationMember | null> {
  return queryOne<OrganizationMember>(
    `INSERT INTO organization_members (org_id, user_id, role)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [orgId, userId, role]
  )
}

// ==================== ORGANIZATIONS ====================

export interface Organization extends QueryResultRow {
  id: string
  name: string
  ai_enabled?: boolean
  ai_daily_limit?: number
  created_at: string
  updated_at?: string
}

export async function getOrganizationById(orgId: string): Promise<Organization | null> {
  return queryOne<Organization>("SELECT * FROM organizations WHERE id = $1", [orgId])
}

export async function createOrganization(org: Omit<Organization, "id" | "created_at" | "updated_at">): Promise<Organization | null> {
  return queryOne<Organization>(
    `INSERT INTO organizations (name, ai_enabled, ai_daily_limit)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [org.name, org.ai_enabled || false, org.ai_daily_limit || 0]
  )
}

// ==================== AI ANSWER SESSIONS ====================

export interface AIAnswerSession extends QueryResultRow {
  id: string
  user_id: string
  org_id?: string
  stick_id?: string
  stick_type?: string
  question: string
  answer: string
  created_at: string
}

export async function createAISession(session: Omit<AIAnswerSession, "id" | "created_at">): Promise<AIAnswerSession | null> {
  return queryOne<AIAnswerSession>(
    `INSERT INTO ai_answer_sessions (user_id, org_id, stick_id, stick_type, question, answer)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [session.user_id, session.org_id, session.stick_id, session.stick_type, session.question, session.answer]
  )
}

export async function countAISessionsToday(userId: string, orgId?: string): Promise<number> {
  const query = orgId
    ? `SELECT COUNT(*) as count FROM ai_answer_sessions 
       WHERE user_id = $1 AND org_id = $2 AND created_at >= CURRENT_DATE`
    : `SELECT COUNT(*) as count FROM ai_answer_sessions 
       WHERE user_id = $1 AND created_at >= CURRENT_DATE`

  const params = orgId ? [userId, orgId] : [userId]
  const result = await queryOne<{ count: string }>(query, params)
  return result ? Number.parseInt(result.count, 10) : 0
}

// ==================== USER PREFERENCES ====================

export interface UserPreference extends QueryResultRow {
  id: string
  user_id: string
  theme?: string
  notifications_enabled?: boolean
  created_at: string
  updated_at?: string
}

export async function getUserPreferences(userId: string): Promise<UserPreference | null> {
  return queryOne<UserPreference>("SELECT * FROM user_preferences WHERE user_id = $1", [userId])
}

export async function upsertUserPreferences(userId: string, prefs: Partial<UserPreference>): Promise<UserPreference | null> {
  const fields = Object.keys(prefs).filter((k) => k !== "id" && k !== "user_id")
  const values = fields.map((k) => prefs[k as keyof UserPreference])

  const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(", ")

  return queryOne<UserPreference>(
    `INSERT INTO user_preferences (user_id, ${fields.join(", ")})
     VALUES ($1, ${values.map((_, i) => `$${i + 2}`).join(", ")})
     ON CONFLICT (user_id) 
     DO UPDATE SET ${setClause}, updated_at = NOW()
     RETURNING *`,
    [userId, ...values]
  )
}

// ==================== SEARCH HISTORY ====================

export interface SearchHistory extends QueryResultRow {
  id: string
  user_id: string
  query: string
  filters?: any
  clicked_note_id?: string
  created_at: string
}

export async function createSearchHistory(search: Omit<SearchHistory, "id" | "created_at">): Promise<SearchHistory | null> {
  return queryOne<SearchHistory>(
    `INSERT INTO search_history (user_id, query, filters, clicked_note_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [search.user_id, search.query, JSON.stringify(search.filters), search.clicked_note_id]
  )
}

export async function getRecentSearchHistory(userId: string, limit = 10): Promise<SearchHistory[]> {
  return queryMany<SearchHistory>(
    `SELECT * FROM search_history 
     WHERE user_id = $1 
     ORDER BY created_at DESC 
     LIMIT $2`,
    [userId, limit]
  )
}

export async function updateSearchHistory(id: string, clickedNoteId: string): Promise<void> {
  await execute("UPDATE search_history SET clicked_note_id = $1 WHERE id = $2", [clickedNoteId, id])
}

// ==================== RATE LIMITING ====================

export interface RateLimit extends QueryResultRow {
  id: string
  identifier: string
  endpoint: string
  created_at: string
}

export async function getRateLimitCount(identifier: string, endpoint: string, windowStart: number): Promise<number> {
  const result = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM rate_limits 
     WHERE identifier = $1 AND endpoint = $2 AND created_at >= $3`,
    [identifier, endpoint, new Date(windowStart).toISOString()]
  )
  return result ? Number.parseInt(result.count, 10) : 0
}

export async function createRateLimit(identifier: string, endpoint: string): Promise<void> {
  await execute(
    "INSERT INTO rate_limits (identifier, endpoint) VALUES ($1, $2)",
    [identifier, endpoint]
  )
}

export async function cleanupOldRateLimits(windowStart: number): Promise<void> {
  await execute("DELETE FROM rate_limits WHERE created_at < $1", [new Date(windowStart).toISOString()])
}

// ==================== PERSONAL STICKS TAGS ====================

export interface PersonalStickTag extends QueryResultRow {
  id: string
  personal_stick_id: string
  tags: string | string[]
  tab_name?: string
}

export async function getStickTagTab(stickId: string): Promise<PersonalStickTag | null> {
  return queryOne<PersonalStickTag>(
    "SELECT * FROM personal_sticks_tabs WHERE personal_stick_id = $1 AND tab_name = 'Tags'",
    [stickId]
  )
}

export async function getStickTagTabs(stickIds: string[]): Promise<PersonalStickTag[]> {
  if (stickIds.length === 0) return []
  return queryMany<PersonalStickTag>(
    "SELECT personal_stick_id, tags FROM personal_sticks_tabs WHERE personal_stick_id = ANY($1) AND tab_name = 'Tags'",
    [stickIds]
  )
}

// ==================== PAGINATION ====================

export async function getPersonalSticksWithPagination(
  userId: string,
  limit = 20,
  offset = 0
): Promise<{ notes: PersonalStick[]; total: number }> {
  // Get paginated notes
  const notes = await queryMany<PersonalStick>(
    `SELECT id, topic, content, color, position_x, position_y, is_shared, created_at, updated_at, user_id
     FROM personal_sticks
     WHERE user_id = $1
     ORDER BY updated_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  )

  // Get total count
  const countResult = await queryOne<{ count: string }>(
    "SELECT COUNT(*) as count FROM personal_sticks WHERE user_id = $1",
    [userId]
  )
  const total = countResult ? Number.parseInt(countResult.count, 10) : 0

  return { notes, total }
}

export async function getBatchReplies(noteIds: string[]): Promise<PersonalStickReply[]> {
  if (noteIds.length === 0) return []
  return queryMany<PersonalStickReply>(
    `SELECT id, content, color, created_at, updated_at, user_id, stick_id as personal_stick_id
     FROM personal_sticks_replies
     WHERE stick_id = ANY($1)
     ORDER BY created_at ASC`,
    [noteIds]
  )
}

// ==================== TRANSACTIONS ====================

export async function createStickWithTabs(
  stick: Omit<PersonalStick, "id" | "created_at" | "updated_at">,
  tabs: Array<Omit<PersonalStickTab, "id" | "stick_id" | "created_at" | "updated_at">>
): Promise<{ stick: PersonalStick; tabs: PersonalStickTab[] } | null> {
  return db.transaction(async (client) => {
    // Create stick
    const stickResult = await client.query<PersonalStick>(
      `INSERT INTO personal_sticks (user_id, title, content, category, is_favorite, is_shared, color, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        stick.user_id,
        stick.title,
        stick.content || "",
        stick.category,
        stick.is_favorite || false,
        stick.is_shared || false,
        stick.color,
        stick.position || 0,
      ]
    )

    const createdStick = stickResult.rows[0]

    // Create tabs
    const createdTabs: PersonalStickTab[] = []
    for (const tab of tabs) {
      const tabResult = await client.query<PersonalStickTab>(
        `INSERT INTO personal_sticks_tabs (stick_id, title, content, position)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [createdStick.id, tab.title, tab.content || "", tab.position || 0]
      )
      createdTabs.push(tabResult.rows[0])
    }

    return { stick: createdStick, tabs: createdTabs }
  })
}
