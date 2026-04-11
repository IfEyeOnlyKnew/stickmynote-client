export interface DigestNotification {
  id: string
  type: string
  title: string
  message: string
  created_at: string
  action_url?: string
  metadata?: Record<string, unknown>
}

export interface PadDigestSummary {
  padId: string
  padName: string
  newSticks: number
  statusChanges: number
  unresolvedBlockers: number
  mentions: number
  replies: number
  notifications: DigestNotification[]
}

export interface DigestEmailData {
  userName: string
  frequency: "daily" | "weekly"
  periodStart: string
  periodEnd: string
  totalNotifications: number
  padSummaries: PadDigestSummary[]
  siteUrl: string
}

function plural(count: number): string {
  return count > 1 ? "s" : ""
}

function replyLabel(count: number): string {
  return count > 1 ? "replies" : "reply"
}

export function generateDigestEmailHtml(data: DigestEmailData): string {
  const { userName, frequency, periodStart, periodEnd, totalNotifications, padSummaries, siteUrl } = data

  const periodLabel = frequency === "daily" ? "Daily" : "Weekly"
  const greeting = userName ? `Hi ${userName.split(" ")[0]},` : "Hi there,"

  const padSummaryHtml = padSummaries
    .map(
      (pad) => `
    <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
      <h3 style="margin: 0 0 12px 0; color: #1f2937; font-size: 16px;">
        <a href="${siteUrl}/social?pad=${pad.padId}" style="color: #4f46e5; text-decoration: none;">
          ${escapeHtml(pad.padName)}
        </a>
      </h3>
      <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 12px;">
        ${pad.newSticks > 0 ? `<span style="background: #dbeafe; color: #1e40af; padding: 4px 8px; border-radius: 4px; font-size: 12px;">📝 ${pad.newSticks} new stick${plural(pad.newSticks)}</span>` : ""}
        ${pad.replies > 0 ? `<span style="background: #e0e7ff; color: #3730a3; padding: 4px 8px; border-radius: 4px; font-size: 12px;">💬 ${pad.replies} ${replyLabel(pad.replies)}</span>` : ""}
        ${pad.statusChanges > 0 ? `<span style="background: #fef3c7; color: #92400e; padding: 4px 8px; border-radius: 4px; font-size: 12px;">🔄 ${pad.statusChanges} status change${plural(pad.statusChanges)}</span>` : ""}
        ${pad.unresolvedBlockers > 0 ? `<span style="background: #fee2e2; color: #991b1b; padding: 4px 8px; border-radius: 4px; font-size: 12px;">⚠️ ${pad.unresolvedBlockers} blocker${plural(pad.unresolvedBlockers)}</span>` : ""}
        ${pad.mentions > 0 ? `<span style="background: #f3e8ff; color: #6b21a8; padding: 4px 8px; border-radius: 4px; font-size: 12px;">@ ${pad.mentions} mention${plural(pad.mentions)}</span>` : ""}
      </div>
      ${pad.notifications
        .slice(0, 5)
        .map(
          (n) => `
        <div style="border-left: 3px solid #e5e7eb; padding-left: 12px; margin: 8px 0; font-size: 14px;">
          <div style="color: #374151; margin-bottom: 2px;">${escapeHtml(n.title)}</div>
          <div style="color: #6b7280; font-size: 12px;">${escapeHtml(n.message)}</div>
        </div>
      `,
        )
        .join("")}
      ${pad.notifications.length > 5 ? `<p style="color: #6b7280; font-size: 12px; margin: 8px 0 0 0;">+ ${pad.notifications.length - 5} more updates</p>` : ""}
    </div>
  `,
    )
    .join("")

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${periodLabel} Digest - Stick My Note</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f3f4f6;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 22px;">📋 Your ${periodLabel} Digest</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">
            ${formatDate(periodStart)} - ${formatDate(periodEnd)}
          </p>
        </div>
        
        <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="color: #4b5563; font-size: 16px; margin-top: 0;">
            ${greeting}
          </p>
          
          <p style="color: #4b5563; font-size: 16px;">
            Here's what happened across your pads ${frequency === "daily" ? "today" : "this week"}:
          </p>
          
          <div style="background: #eef2ff; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
            <span style="font-size: 32px; font-weight: bold; color: #4f46e5;">${totalNotifications}</span>
            <p style="margin: 4px 0 0 0; color: #6366f1; font-size: 14px;">total update${totalNotifications === 1 ? "" : "s"}</p>
          </div>
          
          ${padSummaryHtml || '<p style="color: #6b7280; text-align: center;">No activity to report.</p>'}
          
          <div style="text-align: center; margin: 24px 0;">
            <a href="${siteUrl}/social" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
              View All Activity
            </a>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
          
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            <a href="${siteUrl}/settings/notifications" style="color: #6366f1;">Manage digest preferences</a> · 
            <a href="${siteUrl}/settings/notifications?unsubscribe=digest" style="color: #6366f1;">Unsubscribe</a>
          </p>
        </div>
        
        <div style="text-align: center; padding: 16px; color: #9ca3af; font-size: 12px;">
          <p>&copy; ${new Date().getFullYear()} Stick My Note. All rights reserved.</p>
        </div>
      </body>
    </html>
  `
}

// Build the plain-text counter lines for one pad (new sticks, replies,
// etc.). Returns an array of already-indented strings, or [] if the pad
// has zero of every category.
function formatPadCounters(pad: PadDigestSummary): string[] {
  const lines: string[] = []
  if (pad.newSticks > 0) lines.push(`  • ${pad.newSticks} new stick(s)`)
  if (pad.replies > 0) lines.push(`  • ${pad.replies} reply/replies`)
  if (pad.statusChanges > 0) lines.push(`  • ${pad.statusChanges} status change(s)`)
  if (pad.unresolvedBlockers > 0) lines.push(`  • ${pad.unresolvedBlockers} blocker(s)`)
  if (pad.mentions > 0) lines.push(`  • ${pad.mentions} mention(s)`)
  return lines
}

// Format the first 5 notification items for one pad, plus an optional
// "+N more" line. Returns an array of strings; empty if there are no
// notifications.
function formatPadNotifications(notifications: DigestNotification[]): string[] {
  const lines = notifications.slice(0, 5).map((n) => `  - ${n.title}: ${n.message}`)
  if (notifications.length > 5) {
    lines.push(`  + ${notifications.length - 5} more updates`)
  }
  return lines
}

// Render the full plain-text block for a single pad: header, counters,
// notification excerpts, and a trailing blank line.
function renderPadBlock(pad: PadDigestSummary): string {
  const parts: string[] = [`--- ${pad.padName} ---`]
  parts.push(...formatPadCounters(pad))
  parts.push("") // blank line between counters and notifications
  parts.push(...formatPadNotifications(pad.notifications))
  parts.push("") // trailing blank line between pads
  return parts.join("\n")
}

export function generateDigestPlainText(data: DigestEmailData): string {
  const { userName, frequency, periodStart, periodEnd, totalNotifications, padSummaries, siteUrl } = data

  const periodLabel = frequency === "daily" ? "Daily" : "Weekly"
  const greeting = userName ? `Hi ${userName.split(" ")[0]},` : "Hi there,"
  const periodPhrase = frequency === "daily" ? "today" : "this week"

  const header = [
    `${periodLabel} Digest - Stick My Note`,
    `${formatDate(periodStart)} - ${formatDate(periodEnd)}`,
    "",
    greeting,
    "",
    `Here's what happened across your pads ${periodPhrase}:`,
    "",
    `Total updates: ${totalNotifications}`,
    "",
  ].join("\n")

  const padBlocks = padSummaries.map(renderPadBlock).join("")

  const footer = [
    `View all activity: ${siteUrl}/social`,
    "",
    `Manage preferences: ${siteUrl}/settings/notifications`,
    "",
  ].join("\n")

  return header + padBlocks + footer
}

function escapeHtml(str: string): string {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}
