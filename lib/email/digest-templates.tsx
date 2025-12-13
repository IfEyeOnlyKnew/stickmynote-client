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
        ${pad.newSticks > 0 ? `<span style="background: #dbeafe; color: #1e40af; padding: 4px 8px; border-radius: 4px; font-size: 12px;">📝 ${pad.newSticks} new stick${pad.newSticks > 1 ? "s" : ""}</span>` : ""}
        ${pad.replies > 0 ? `<span style="background: #e0e7ff; color: #3730a3; padding: 4px 8px; border-radius: 4px; font-size: 12px;">💬 ${pad.replies} repl${pad.replies > 1 ? "ies" : "y"}</span>` : ""}
        ${pad.statusChanges > 0 ? `<span style="background: #fef3c7; color: #92400e; padding: 4px 8px; border-radius: 4px; font-size: 12px;">🔄 ${pad.statusChanges} status change${pad.statusChanges > 1 ? "s" : ""}</span>` : ""}
        ${pad.unresolvedBlockers > 0 ? `<span style="background: #fee2e2; color: #991b1b; padding: 4px 8px; border-radius: 4px; font-size: 12px;">⚠️ ${pad.unresolvedBlockers} blocker${pad.unresolvedBlockers > 1 ? "s" : ""}</span>` : ""}
        ${pad.mentions > 0 ? `<span style="background: #f3e8ff; color: #6b21a8; padding: 4px 8px; border-radius: 4px; font-size: 12px;">@ ${pad.mentions} mention${pad.mentions > 1 ? "s" : ""}</span>` : ""}
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
            <p style="margin: 4px 0 0 0; color: #6366f1; font-size: 14px;">total update${totalNotifications !== 1 ? "s" : ""}</p>
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

export function generateDigestPlainText(data: DigestEmailData): string {
  const { userName, frequency, periodStart, periodEnd, totalNotifications, padSummaries, siteUrl } = data

  const periodLabel = frequency === "daily" ? "Daily" : "Weekly"
  const greeting = userName ? `Hi ${userName.split(" ")[0]},` : "Hi there,"

  let text = `${periodLabel} Digest - Stick My Note\n`
  text += `${formatDate(periodStart)} - ${formatDate(periodEnd)}\n\n`
  text += `${greeting}\n\n`
  text += `Here's what happened across your pads ${frequency === "daily" ? "today" : "this week"}:\n\n`
  text += `Total updates: ${totalNotifications}\n\n`

  for (const pad of padSummaries) {
    text += `--- ${pad.padName} ---\n`
    if (pad.newSticks > 0) text += `  • ${pad.newSticks} new stick(s)\n`
    if (pad.replies > 0) text += `  • ${pad.replies} reply/replies\n`
    if (pad.statusChanges > 0) text += `  • ${pad.statusChanges} status change(s)\n`
    if (pad.unresolvedBlockers > 0) text += `  • ${pad.unresolvedBlockers} blocker(s)\n`
    if (pad.mentions > 0) text += `  • ${pad.mentions} mention(s)\n`
    text += `\n`

    for (const n of pad.notifications.slice(0, 5)) {
      text += `  - ${n.title}: ${n.message}\n`
    }
    if (pad.notifications.length > 5) {
      text += `  + ${pad.notifications.length - 5} more updates\n`
    }
    text += `\n`
  }

  text += `View all activity: ${siteUrl}/social\n\n`
  text += `Manage preferences: ${siteUrl}/settings/notifications\n`

  return text
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}
