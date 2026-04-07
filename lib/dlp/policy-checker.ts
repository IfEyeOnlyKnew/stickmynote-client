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

  // --- Sharing Controls ---
  const sharingBlock = checkSharingControls(params.action, dlp)
  if (sharingBlock) {
    await logDLPEvent(sharingBlock.event, params, sharingBlock.detail)
    return { allowed: false, reason: sharingBlock.reason }
  }

  // --- Domain Controls ---
  const domainBlock = checkDomainControls(params, dlp)
  if (domainBlock) {
    await logDLPEvent(domainBlock.event, params, domainBlock.detail)
    return { allowed: false, reason: domainBlock.reason }
  }

  // --- Classification Controls ---
  const classificationBlock = checkClassificationControls(params, dlp)
  if (classificationBlock) {
    if (classificationBlock.event) {
      await logDLPEvent(classificationBlock.event, params, classificationBlock.detail ?? "")
    }
    return { allowed: false, reason: classificationBlock.reason }
  }

  // --- Content Scanning ---
  const scanResult = checkContentScanning(params, dlp)
  if (scanResult) return scanResult

  return { allowed: true }
}

interface DLPBlock {
  event: string
  detail: string
  reason: string
}

const SHARING_RULES: Array<{ action: DLPAction; settingKey: keyof DLPSettings; event: string; detail: string; reason: string }> = [
  { action: "share_note", settingKey: "block_community_sharing", event: "dlp.share_blocked", detail: "Community note sharing is disabled by your organization", reason: "Community note sharing is disabled by your organization's data loss prevention policy." },
  { action: "make_pad_public", settingKey: "block_public_pads", event: "dlp.public_pad_blocked", detail: "Public pads are disabled", reason: "Public pads are disabled by your organization's data loss prevention policy." },
  { action: "generate_ical", settingKey: "block_ical_feeds", event: "dlp.ical_blocked", detail: "iCal feeds are disabled", reason: "Calendar feed generation is disabled by your organization's data loss prevention policy." },
  { action: "create_webhook", settingKey: "block_external_webhooks", event: "dlp.webhook_blocked", detail: "External webhooks are disabled", reason: "External webhooks are disabled by your organization's data loss prevention policy." },
  { action: "invite_external", settingKey: "block_video_external_invite", event: "dlp.invite_blocked", detail: "External video invites are disabled", reason: "External video invitations are disabled by your organization's data loss prevention policy." },
]

function checkSharingControls(action: DLPAction, dlp: DLPSettings): DLPBlock | null {
  const rule = SHARING_RULES.find(r => r.action === action && dlp[r.settingKey])
  if (!rule) return null
  return { event: rule.event, detail: rule.detail, reason: rule.reason }
}

function checkDomainControls(params: DLPCheckParams, dlp: DLPSettings): DLPBlock | null {
  if (params.action === "create_webhook" && params.targetUrl && dlp.allowed_webhook_domains?.length) {
    const domain = extractDomainFromUrl(params.targetUrl)
    if (!domain || !isDomainAllowed(domain, dlp.allowed_webhook_domains)) {
      return { event: "dlp.webhook_blocked", detail: `Webhook domain not allowed: ${domain}`, reason: `Webhook destination "${domain}" is not in your organization's allowed domains list.` }
    }
  }

  if (params.action === "invite_external" && params.targetEmail && dlp.allowed_invite_domains?.length) {
    const domain = extractDomainFromEmail(params.targetEmail)
    if (!domain || !isDomainAllowed(domain, dlp.allowed_invite_domains)) {
      return { event: "dlp.invite_blocked", detail: `Invite domain not allowed: ${domain}`, reason: `Invitations to "${domain}" are not allowed by your organization's domain policy.` }
    }
  }

  return null
}

function checkClassificationControls(params: DLPCheckParams, dlp: DLPSettings): DLPBlock | null {
  const isSharingAction = params.action === "share_note" || params.action === "make_pad_public"
  if (!isSharingAction) return null

  if (params.sensitivityLevel && ["confidential", "restricted"].includes(params.sensitivityLevel)) {
    return { event: "dlp.share_blocked", detail: `Cannot share ${params.sensitivityLevel} content externally`, reason: `Content classified as "${params.sensitivityLevel}" cannot be shared externally.` }
  }

  if (dlp.require_classification && !params.sensitivityLevel) {
    return { event: "", detail: "", reason: "Content must have a sensitivity classification before it can be shared." }
  }

  return null
}

function checkContentScanning(params: DLPCheckParams, dlp: DLPSettings): DLPCheckResult | null {
  if (!dlp.content_scanning_enabled || !params.content) return null

  const scanResult = scanContent(params.content, dlp.scan_patterns)
  if (!scanResult.hasSensitiveData) return null

  const matchSummary = scanResult.matches.map((m) => `${m.count} ${m.label}`).join(", ")

  if (dlp.scan_action === "block") {
    logDLPEvent("dlp.sensitive_data_detected", params, `Blocked: ${matchSummary}`)
    return { allowed: false, reason: `Sensitive data detected: ${matchSummary}. Sharing is blocked by your organization's DLP policy.` }
  }

  // Default to warn
  logDLPEvent("dlp.share_warned", params, `Warning: ${matchSummary}`)
  return { allowed: true, warnings: [`Sensitive data detected: ${matchSummary}`] }
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
