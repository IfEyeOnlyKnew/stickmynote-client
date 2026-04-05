import { db as pgClient } from "@/lib/database/pg-client"
import { publishToUser } from "@/lib/ws/publish-event"
import type { RecognitionSettings } from "@/types/recognition"

/**
 * Get recognition settings for an organization (from organizations.settings JSONB)
 */
export async function getRecognitionSettings(orgId: string): Promise<RecognitionSettings> {
  const defaults: RecognitionSettings = {
    enabled: true,
    points_per_kudos: 1,
    max_kudos_per_day: 10,
    leaderboard_enabled: true,
    leaderboard_opt_in: false,
    manager_notifications: true,
    allow_self_kudos: false,
    require_value: false,
  }

  try {
    const result = await pgClient.query(
      `SELECT COALESCE(settings->'recognition', '{}') AS recognition FROM organizations WHERE id = $1`,
      [orgId]
    )
    if (result.rows?.[0]?.recognition) {
      return { ...defaults, ...result.rows[0].recognition }
    }
  } catch {
    // Table might not have settings column yet
  }
  return defaults
}

/**
 * Check how many kudos a user has given today
 */
export async function getKudosGivenToday(userId: string, orgId: string): Promise<number> {
  const result = await pgClient.query(
    `SELECT COUNT(*) AS cnt FROM kudos
     WHERE giver_id = $1 AND org_id = $2
     AND created_at >= CURRENT_DATE AND created_at < CURRENT_DATE + INTERVAL '1 day'`,
    [userId, orgId]
  )
  return Number.parseInt(result.rows?.[0]?.cnt || "0", 10)
}

/**
 * Create a new kudos entry with recipients
 */
export async function createKudos(params: {
  orgId: string
  giverId: string
  recipientIds: string[]
  message: string
  valueId?: string | null
  isPublic?: boolean
  points?: number
}): Promise<{ kudosId: string; error?: string }> {
  const { orgId, giverId, recipientIds, message, valueId, isPublic = true, points = 1 } = params

  // Get settings
  const settings = await getRecognitionSettings(orgId)

  if (!settings.enabled) {
    return { kudosId: "", error: "Recognition is not enabled for this organization" }
  }

  // Check self-kudos
  if (!settings.allow_self_kudos && recipientIds.includes(giverId)) {
    return { kudosId: "", error: "You cannot give kudos to yourself" }
  }

  // Check daily limit
  const todayCount = await getKudosGivenToday(giverId, orgId)
  if (todayCount >= settings.max_kudos_per_day) {
    return { kudosId: "", error: `You have reached your daily kudos limit (${settings.max_kudos_per_day})` }
  }

  // Check value requirement
  if (settings.require_value && !valueId) {
    return { kudosId: "", error: "A recognition value must be selected" }
  }

  try {
    // Insert kudos
    const kudosResult = await pgClient.query(
      `INSERT INTO kudos (org_id, giver_id, message, value_id, is_public, points)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [orgId, giverId, message, valueId || null, isPublic, points]
    )

    const kudosId = kudosResult.rows[0].id

    // Insert recipients
    for (const recipientId of recipientIds) {
      await pgClient.query(
        `INSERT INTO kudos_recipients (kudos_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [kudosId, recipientId]
      )
    }

    // Update streaks
    await updateStreak(giverId, orgId, "giving")
    for (const recipientId of recipientIds) {
      await updateStreak(recipientId, orgId, "receiving")
    }

    // Check and award automatic badges
    await checkAutoBadges(recipientIds, orgId)
    await checkAutoBadges([giverId], orgId)

    // Get giver name for notifications
    const giverResult = await pgClient.query(
      `SELECT full_name FROM users WHERE id = $1`,
      [giverId]
    )
    const giverName = giverResult.rows?.[0]?.full_name || "Someone"

    // Send real-time notifications to recipients
    for (const recipientId of recipientIds) {
      // Create notification record
      await pgClient.query(
        `INSERT INTO notifications (user_id, org_id, type, title, message, metadata)
         VALUES ($1, $2, 'kudos_received', $3, $4, $5)`,
        [
          recipientId,
          orgId,
          `${giverName} gave you kudos!`,
          message.substring(0, 200),
          JSON.stringify({ kudos_id: kudosId, giver_id: giverId }),
        ]
      )

      // WebSocket notification
      publishToUser(recipientId, {
        type: "notification.new",
        payload: {
          type: "kudos_received",
          title: `${giverName} gave you kudos!`,
          message: message.substring(0, 200),
          kudos_id: kudosId,
          giver_id: giverId,
        },
        timestamp: Date.now(),
      })
    }

    // Notify managers if enabled
    if (settings.manager_notifications) {
      await notifyManagers(recipientIds, orgId, giverId, giverName, message, kudosId)
    }

    return { kudosId }
  } catch (err) {
    console.error("[Recognition] Error creating kudos:", err)
    return { kudosId: "", error: "Failed to create kudos" }
  }
}

/**
 * Update recognition streak for a user
 */
async function updateStreak(userId: string, orgId: string, streakType: "giving" | "receiving") {
  try {
    await pgClient.query(
      `INSERT INTO recognition_streaks (user_id, org_id, streak_type, current_streak, longest_streak, last_activity_date)
       VALUES ($1, $2, $3, 1, 1, CURRENT_DATE)
       ON CONFLICT (user_id, org_id, streak_type) DO UPDATE SET
         current_streak = CASE
           WHEN recognition_streaks.last_activity_date = CURRENT_DATE THEN recognition_streaks.current_streak
           WHEN recognition_streaks.last_activity_date = CURRENT_DATE - INTERVAL '1 day' THEN recognition_streaks.current_streak + 1
           ELSE 1
         END,
         longest_streak = GREATEST(
           recognition_streaks.longest_streak,
           CASE
             WHEN recognition_streaks.last_activity_date = CURRENT_DATE THEN recognition_streaks.current_streak
             WHEN recognition_streaks.last_activity_date = CURRENT_DATE - INTERVAL '1 day' THEN recognition_streaks.current_streak + 1
             ELSE 1
           END
         ),
         last_activity_date = CURRENT_DATE,
         updated_at = NOW()`,
      [userId, orgId, streakType]
    )
  } catch (err) {
    console.error("[Recognition] Error updating streak:", err)
  }
}

/**
 * Check and auto-award badges based on criteria
 */
async function checkAutoBadges(userIds: string[], orgId: string) {
  try {
    const badgesResult = await pgClient.query(
      `SELECT * FROM badges WHERE org_id = $1 AND is_active = true AND criteria_type != 'manual'`,
      [orgId]
    )

    for (const badge of badgesResult.rows || []) {
      for (const userId of userIds) {
        // Check if already awarded
        const existing = await pgClient.query(
          `SELECT id FROM badge_awards WHERE badge_id = $1 AND user_id = $2`,
          [badge.id, userId]
        )
        if (existing.rows?.length > 0) continue

        let shouldAward = false

        if (badge.criteria_type === "kudos_count") {
          const countResult = await pgClient.query(
            `SELECT COUNT(*) AS cnt FROM kudos_recipients kr
             JOIN kudos k ON k.id = kr.kudos_id
             WHERE kr.user_id = $1 AND k.org_id = $2`,
            [userId, orgId]
          )
          shouldAward = Number.parseInt(countResult.rows[0].cnt, 10) >= badge.criteria_threshold
        } else if (badge.criteria_type === "kudos_given") {
          const countResult = await pgClient.query(
            `SELECT COUNT(*) AS cnt FROM kudos WHERE giver_id = $1 AND org_id = $2`,
            [userId, orgId]
          )
          shouldAward = Number.parseInt(countResult.rows[0].cnt, 10) >= badge.criteria_threshold
        } else if (badge.criteria_type === "streak") {
          const streakResult = await pgClient.query(
            `SELECT current_streak FROM recognition_streaks
             WHERE user_id = $1 AND org_id = $2 AND streak_type = 'giving'`,
            [userId, orgId]
          )
          shouldAward = (streakResult.rows?.[0]?.current_streak || 0) >= badge.criteria_threshold
        }

        if (shouldAward) {
          await pgClient.query(
            `INSERT INTO badge_awards (badge_id, user_id, org_id, reason)
             VALUES ($1, $2, $3, 'Auto-awarded for meeting criteria')
             ON CONFLICT DO NOTHING`,
            [badge.id, userId, orgId]
          )

          // Notify the user about their new badge
          publishToUser(userId, {
            type: "notification.new",
            payload: {
              type: "badge_awarded",
              title: `You earned the "${badge.name}" badge!`,
              message: badge.description || "Congratulations on your achievement!",
              badge_id: badge.id,
            },
            timestamp: Date.now(),
          })

          await pgClient.query(
            `INSERT INTO notifications (user_id, org_id, type, title, message, metadata)
             VALUES ($1, $2, 'badge_awarded', $3, $4, $5)`,
            [
              userId,
              orgId,
              `You earned the "${badge.name}" badge!`,
              badge.description || "Congratulations on your achievement!",
              JSON.stringify({ badge_id: badge.id }),
            ]
          )
        }
      }
    }
  } catch (err) {
    console.error("[Recognition] Error checking auto badges:", err)
  }
}

/**
 * Notify managers when their team members receive kudos
 */
async function notifyManagers(
  recipientIds: string[],
  orgId: string,
  giverId: string,
  giverName: string,
  message: string,
  kudosId: string
) {
  try {
    // Find managers of teams that include the recipients
    const managersResult = await pgClient.query(
      `SELECT DISTINCT tm_mgr.user_id AS manager_id, u.full_name AS recipient_name
       FROM team_members tm
       JOIN team_members tm_mgr ON tm_mgr.team_id = tm.team_id AND tm_mgr.role IN ('owner', 'admin')
       JOIN users u ON u.id = tm.user_id
       WHERE tm.user_id = ANY($1::uuid[])
       AND tm_mgr.user_id != $2
       AND tm_mgr.user_id != ALL($1::uuid[])`,
      [recipientIds, giverId]
    )

    for (const row of managersResult.rows || []) {
      publishToUser(row.manager_id, {
        type: "notification.new",
        payload: {
          type: "team_kudos",
          title: `${giverName} recognized ${row.recipient_name}`,
          message: message.substring(0, 200),
          kudos_id: kudosId,
        },
        timestamp: Date.now(),
      })
    }
  } catch (err) {
    // Teams table may not exist yet — silently skip
    console.error("[Recognition] Error notifying managers:", err)
  }
}
