import { db as pgClient } from "@/lib/database/pg-client"

/**
 * Get all badges for an organization
 */
export async function getOrgBadges(orgId: string, activeOnly = true) {
  const query = activeOnly
    ? `SELECT * FROM badges WHERE org_id = $1 AND is_active = true ORDER BY tier, sort_order, name`
    : `SELECT * FROM badges WHERE org_id = $1 ORDER BY tier, sort_order, name`

  const result = await pgClient.query(query, [orgId])
  return result.rows || []
}

/**
 * Get badges awarded to a specific user
 */
export async function getUserBadges(userId: string, orgId: string) {
  const result = await pgClient.query(
    `SELECT ba.*, b.name, b.description, b.icon, b.color, b.tier, b.category,
            u.full_name AS awarded_by_name
     FROM badge_awards ba
     JOIN badges b ON b.id = ba.badge_id
     LEFT JOIN users u ON u.id = ba.awarded_by
     WHERE ba.user_id = $1 AND ba.org_id = $2
     ORDER BY ba.created_at DESC`,
    [userId, orgId]
  )
  return result.rows || []
}

/**
 * Manually award a badge to a user (admin action)
 */
export async function awardBadge(params: {
  badgeId: string
  userId: string
  orgId: string
  awardedBy: string
  reason?: string
}): Promise<{ success: boolean; error?: string }> {
  const { badgeId, userId, orgId, awardedBy, reason } = params

  try {
    // Check badge exists and belongs to org
    const badgeResult = await pgClient.query(
      `SELECT id, name FROM badges WHERE id = $1 AND org_id = $2 AND is_active = true`,
      [badgeId, orgId]
    )
    if (!badgeResult.rows?.length) {
      return { success: false, error: "Badge not found" }
    }

    // Check not already awarded
    const existing = await pgClient.query(
      `SELECT id FROM badge_awards WHERE badge_id = $1 AND user_id = $2`,
      [badgeId, userId]
    )
    if (existing.rows?.length > 0) {
      return { success: false, error: "Badge already awarded to this user" }
    }

    await pgClient.query(
      `INSERT INTO badge_awards (badge_id, user_id, org_id, awarded_by, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [badgeId, userId, orgId, awardedBy, reason || null]
    )

    return { success: true }
  } catch (err) {
    console.error("[Recognition] Error awarding badge:", err)
    return { success: false, error: "Failed to award badge" }
  }
}

/**
 * Create a new badge definition (admin action)
 */
export async function createBadge(params: {
  orgId: string
  name: string
  description?: string
  icon?: string
  color?: string
  tier?: string
  category?: string
  criteriaType?: string
  criteriaThreshold?: number
  createdBy: string
}): Promise<{ badgeId: string; error?: string }> {
  try {
    const result = await pgClient.query(
      `INSERT INTO badges (org_id, name, description, icon, color, tier, category, criteria_type, criteria_threshold, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        params.orgId,
        params.name,
        params.description || null,
        params.icon || "award",
        params.color || "#8b5cf6",
        params.tier || "bronze",
        params.category || "general",
        params.criteriaType || "manual",
        params.criteriaThreshold || 0,
        params.createdBy,
      ]
    )
    return { badgeId: result.rows[0].id }
  } catch (err: any) {
    if (err?.code === "23505") {
      return { badgeId: "", error: "A badge with this name already exists" }
    }
    console.error("[Recognition] Error creating badge:", err)
    return { badgeId: "", error: "Failed to create badge" }
  }
}

/**
 * Seed default badges for a new organization
 */
export async function seedDefaultBadges(orgId: string, createdBy: string) {
  const defaults = [
    { name: "First Kudos", description: "Received your first kudos", icon: "sparkles", color: "#f59e0b", tier: "bronze", category: "milestone", criteria_type: "kudos_count", criteria_threshold: 1 },
    { name: "Rising Star", description: "Received 10 kudos", icon: "star", color: "#f59e0b", tier: "silver", category: "milestone", criteria_type: "kudos_count", criteria_threshold: 10 },
    { name: "Superstar", description: "Received 50 kudos", icon: "trophy", color: "#ffd700", tier: "gold", category: "milestone", criteria_type: "kudos_count", criteria_threshold: 50 },
    { name: "Legend", description: "Received 100 kudos", icon: "crown", color: "#e5e4e2", tier: "platinum", category: "milestone", criteria_type: "kudos_count", criteria_threshold: 100 },
    { name: "Generous Spirit", description: "Gave 10 kudos to others", icon: "heart", color: "#ef4444", tier: "bronze", category: "giving", criteria_type: "kudos_given", criteria_threshold: 10 },
    { name: "Champion of Others", description: "Gave 50 kudos to others", icon: "gift", color: "#8b5cf6", tier: "gold", category: "giving", criteria_type: "kudos_given", criteria_threshold: 50 },
    { name: "Streak Master", description: "Maintained a 7-day giving streak", icon: "flame", color: "#f97316", tier: "silver", category: "streak", criteria_type: "streak", criteria_threshold: 7 },
    { name: "Team Player", description: "A standout contributor and collaborator", icon: "users", color: "#3b82f6", tier: "gold", category: "general", criteria_type: "manual", criteria_threshold: 0 },
    { name: "Innovator", description: "Brought a fresh idea that made a real impact", icon: "lightbulb", color: "#10b981", tier: "gold", category: "general", criteria_type: "manual", criteria_threshold: 0 },
    { name: "Mentor", description: "Went above and beyond to help others grow", icon: "graduation-cap", color: "#6366f1", tier: "platinum", category: "general", criteria_type: "manual", criteria_threshold: 0 },
  ]

  for (const badge of defaults) {
    try {
      await pgClient.query(
        `INSERT INTO badges (org_id, name, description, icon, color, tier, category, criteria_type, criteria_threshold, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (org_id, name) DO NOTHING`,
        [orgId, badge.name, badge.description, badge.icon, badge.color, badge.tier, badge.category, badge.criteria_type, badge.criteria_threshold, createdBy]
      )
    } catch {
      // Skip duplicates
    }
  }
}

/**
 * Seed default recognition values for an organization
 */
export async function seedDefaultValues(orgId: string, createdBy: string) {
  const defaults = [
    { name: "Teamwork", description: "Great collaboration and team spirit", emoji: "🤝", color: "#3b82f6" },
    { name: "Innovation", description: "Creative thinking and new ideas", emoji: "💡", color: "#f59e0b" },
    { name: "Excellence", description: "Outstanding quality of work", emoji: "🌟", color: "#8b5cf6" },
    { name: "Leadership", description: "Leading by example and inspiring others", emoji: "🏆", color: "#ef4444" },
    { name: "Helpfulness", description: "Going above and beyond to help others", emoji: "💪", color: "#10b981" },
    { name: "Customer Focus", description: "Exceptional dedication to customer needs", emoji: "🎯", color: "#ec4899" },
  ]

  for (const value of defaults) {
    try {
      await pgClient.query(
        `INSERT INTO recognition_values (org_id, name, description, emoji, color, created_by, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (org_id, name) DO NOTHING`,
        [orgId, value.name, value.description, value.emoji, value.color, createdBy, defaults.indexOf(value)]
      )
    } catch {
      // Skip duplicates
    }
  }
}
