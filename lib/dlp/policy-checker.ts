import "server-only"
import { db } from "@/lib/database/pg-client"
import { scanContent } from "./content-scanner"
import { logAuditEvent } from "@/lib/audit/audit-logger"
import type { DLPSettings } from "@/types/organization"

export type DLPAction =
  | "share_note"
  | "make_pad_public"
  | "create_webhook"
  | "generate_ical"
  | "invite_external"

export interface DLPCheckResult {
  allowed: boolean
  reason?: string
  warnings?: string[]
}

interface DLPCheckParams {
  orgId: string
  action: DLPAction
  userId?: string
  content?: string
  targetUrl?: string
  targetEmail?: string
  sensitivityLevel?: string
  ipAddress?: string
  userAgent?: string
}

/**
 * Load DLP settings from the organization's settings JSONB.
 * Returns null if no DLP settings are configured (everything allowed).
 */
async function loadDLPSettings(orgId: string): Promise<DLPSettings | null> {
  try {
    const result = await db.query(
      `SELECT settings->'dlp' as dlp FROM organizations WHERE id = $1`,
      [orgId],
    )
    if (result.rows.length === 0 || !result.rows[0].dlp) {
      return null
    }
    return result.rows[0].dlp as DLPSettings
  } catch (error) {
    console.error("[DLP] Failed to load settings:", error)
    return null
  }
}

/**
 * Extract domain from a URL.
 */
function extractDomainFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    return parsed.hostname.toLowerCase()
  } catch {
    return null
  }
}

/**
 * Extract domain from an email address.
 */
function extractDomainFromEmail(email: string): string | null {
  const parts = email.split("@")
  if (parts.length !== 2) return null
  return parts[1].toLowerCase()
}

/**
 * Check if a domain matches any in the allowed list.
 * Supports exact match and subdomain match (e.g., "hooks.slack.com" matches "slack.com").
 */
function isDomainAllowed(domain: string, allowedDomains: string[]): boolean {
  const lowerDomain = domain.toLowerCase()
  return allowedDomains.some((allowed) => {
    const lowerAllowed = allowed.toLowerCase().trim()
    return lowerDomain === lowerAllowed || lowerDomain.endsWith(`.${lowerAllowed}`)
  })
}

/**
 * Central DLP policy check.
 *
 * Loads org DLP settings and evaluates whether the requested action is allowed.
 * Logs audit events for blocks and warnings automatically.
 *
 * If no DLP settings are configured, everything is allowed (opt-in model).
 */
export async function checkDLPPolicy(params: DLPCheckParams): Promise<DLPCheckResult> {
  const dlp = await loadDLPSettings(params.orgId)

  // No DLP settings = everything allowed
  if (!dlp) {
    return { allowed: true }
  }

  const warnings: string[] = []

  // --- Sharing Controls ---
  if (params.action === "share_note" && dlp.block_community_sharing) {
    await logDLPEvent("dlp.share_blocked", params, "Community note sharing is disabled by your organization")
    return { allowed: false, reason: "Community note sharing is disabled by your organization's data loss prevention policy." }
  }

  if (params.action === "make_pad_public" && dlp.block_public_pads) {
    await logDLPEvent("dlp.public_pad_blocked", params, "Public pads are disabled")
    return { allowed: false, reason: "Public pads are disabled by your organization's data loss prevention policy." }
  }

  if (params.action === "generate_ical" && dlp.block_ical_feeds) {
    await logDLPEvent("dlp.ical_blocked", params, "iCal feeds are disabled")
    return { allowed: false, reason: "Calendar feed generation is disabled by your organization's data loss prevention policy." }
  }

  if (params.action === "create_webhook" && dlp.block_external_webhooks) {
    await logDLPEvent("dlp.webhook_blocked", params, "External webhooks are disabled")
    return { allowed: false, reason: "External webhooks are disabled by your organization's data loss prevention policy." }
  }

  if (params.action === "invite_external" && dlp.block_video_external_invite) {
    await logDLPEvent("dlp.invite_blocked", params, "External video invites are disabled")
    return { allowed: false, reason: "External video invitations are disabled by your organization's data loss prevention policy." }
  }

  // --- Domain Controls ---
  if (params.action === "create_webhook" && params.targetUrl && dlp.allowed_webhook_domains && dlp.allowed_webhook_domains.length > 0) {
    const domain = extractDomainFromUrl(params.targetUrl)
    if (!domain || !isDomainAllowed(domain, dlp.allowed_webhook_domains)) {
      await logDLPEvent("dlp.webhook_blocked", params, `Webhook domain not allowed: ${domain}`)
      return {
        allowed: false,
        reason: `Webhook destination "${domain}" is not in your organization's allowed domains list.`,
      }
    }
  }

  if (params.action === "invite_external" && params.targetEmail && dlp.allowed_invite_domains && dlp.allowed_invite_domains.length > 0) {
    const domain = extractDomainFromEmail(params.targetEmail)
    if (!domain || !isDomainAllowed(domain, dlp.allowed_invite_domains)) {
      await logDLPEvent("dlp.invite_blocked", params, `Invite domain not allowed: ${domain}`)
      return {
        allowed: false,
        reason: `Invitations to "${domain}" are not allowed by your organization's domain policy.`,
      }
    }
  }

  // --- Classification Controls ---
  if (params.sensitivityLevel && ["confidential", "restricted"].includes(params.sensitivityLevel)) {
    if (params.action === "share_note" || params.action === "make_pad_public") {
      await logDLPEvent("dlp.share_blocked", params, `Cannot share ${params.sensitivityLevel} content externally`)
      return {
        allowed: false,
        reason: `Content classified as "${params.sensitivityLevel}" cannot be shared externally.`,
      }
    }
  }

  if (dlp.require_classification && !params.sensitivityLevel) {
    if (params.action === "share_note" || params.action === "make_pad_public") {
      return {
        allowed: false,
        reason: "Content must have a sensitivity classification before it can be shared.",
      }
    }
  }

  // --- Content Scanning ---
  if (dlp.content_scanning_enabled && params.content) {
    const scanResult = scanContent(params.content, dlp.scan_patterns)

    if (scanResult.hasSensitiveData) {
      const matchSummary = scanResult.matches
        .map((m) => `${m.count} ${m.label}`)
        .join(", ")

      if (dlp.scan_action === "block") {
        await logDLPEvent("dlp.sensitive_data_detected", params, `Blocked: ${matchSummary}`)
        return {
          allowed: false,
          reason: `Sensitive data detected: ${matchSummary}. Sharing is blocked by your organization's DLP policy.`,
        }
      }

      // Default to warn
      await logDLPEvent("dlp.share_warned", params, `Warning: ${matchSummary}`)
      warnings.push(`Sensitive data detected: ${matchSummary}`)
    }
  }

  return {
    allowed: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}

/**
 * Fire-and-forget DLP audit log.
 */
async function logDLPEvent(
  action: string,
  params: DLPCheckParams,
  detail: string,
): Promise<void> {
  try {
    await logAuditEvent({
      userId: params.userId || null,
      action: action as any,
      resourceType: "dlp_policy",
      metadata: {
        orgId: params.orgId,
        dlpAction: params.action,
        detail,
        targetUrl: params.targetUrl,
        targetEmail: params.targetEmail,
        sensitivityLevel: params.sensitivityLevel,
      },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    })
  } catch {
    // Never break the main operation
  }
}
