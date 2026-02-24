import "server-only"
import { db } from "@/lib/database/pg-client"
import { isEncryptionEnabled } from "@/lib/encryption"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ControlStatus {
  id: string
  name: string
  description: string
  status: "pass" | "fail" | "info"
  settingsTab?: string // Tab value to link to in org settings
}

export interface FrameworkStatus {
  id: string
  name: string
  description: string
  controls: ControlStatus[]
  passCount: number
  totalCount: number
  readinessPercent: number
}

export interface ComplianceStatusResult {
  frameworks: FrameworkStatus[]
  lastCheckedAt: string
}

// ---------------------------------------------------------------------------
// Detection helpers
// ---------------------------------------------------------------------------

interface OrgRow {
  settings: Record<string, unknown> | null
  max_failed_attempts: number | null
  lockout_duration_minutes: number | null
}

async function getOrgRow(orgId: string): Promise<OrgRow> {
  const result = await db.query(
    `SELECT settings, max_failed_attempts, lockout_duration_minutes
     FROM organizations WHERE id = $1`,
    [orgId],
  )
  if (result.rows.length === 0) {
    return { settings: null, max_failed_attempts: null, lockout_duration_minutes: null }
  }
  return result.rows[0]
}

async function hasSSOProviders(orgId: string): Promise<boolean> {
  try {
    const result = await db.query(
      `SELECT COUNT(*)::int as cnt FROM identity_providers
       WHERE org_id = $1 AND status = 'active'`,
      [orgId],
    )
    return (result.rows[0]?.cnt ?? 0) > 0
  } catch {
    // Table may not exist if migration not run
    return false
  }
}

async function has2FAEnforcement(orgId: string): Promise<boolean> {
  try {
    const result = await db.query(
      `SELECT require_2fa FROM organization_2fa_policies
       WHERE org_id = $1 LIMIT 1`,
      [orgId],
    )
    return result.rows.length > 0 && result.rows[0].require_2fa === true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Control builders
// ---------------------------------------------------------------------------

function buildControls(
  orgRow: OrgRow,
  ssoEnabled: boolean,
  twoFAEnforced: boolean,
  encryptionEnabled: boolean,
) {
  const settings = orgRow.settings || {}
  const dlp = (settings.dlp || {}) as Record<string, unknown>
  const compliance = (settings.compliance || {}) as Record<string, unknown>

  const dlpAnyEnabled =
    dlp.block_community_sharing === true ||
    dlp.block_public_pads === true ||
    dlp.block_ical_feeds === true ||
    dlp.block_external_webhooks === true ||
    dlp.block_video_external_invite === true ||
    dlp.content_scanning_enabled === true ||
    dlp.require_classification === true

  const dlpClassification = dlp.require_classification === true

  const dataRetentionConfigured =
    compliance.data_retention_days !== undefined && compliance.data_retention_days !== null

  const dpaAccepted = compliance.dpa_accepted === true
  const baaAccepted = compliance.hipaa_baa_signed === true

  return {
    sso: {
      id: "sso_enabled",
      name: "Single Sign-On (SSO)",
      description: "OIDC/SAML identity provider configured",
      status: ssoEnabled ? "pass" : "fail",
      settingsTab: "sso",
    } as ControlStatus,

    twoFA: {
      id: "2fa_enforcement",
      name: "2FA Enforcement",
      description: "Organization-wide two-factor authentication required",
      status: twoFAEnforced ? "pass" : "fail",
      settingsTab: "org-settings",
    } as ControlStatus,

    encryption: {
      id: "encryption_at_rest",
      name: "Encryption at Rest",
      description: "AES-256-GCM file encryption enabled",
      status: encryptionEnabled ? "pass" : "fail",
      settingsTab: "encryption",
    } as ControlStatus,

    auditLog: {
      id: "audit_logging",
      name: "Audit Logging",
      description: "Centralized audit trail for all security events",
      status: "pass",
      settingsTab: "audit-log",
    } as ControlStatus,

    dlp: {
      id: "dlp_enabled",
      name: "Data Loss Prevention",
      description: "Sharing restrictions and content scanning controls",
      status: dlpAnyEnabled ? "pass" : "fail",
      settingsTab: "dlp",
    } as ControlStatus,

    dlpClassification: {
      id: "dlp_classification",
      name: "Information Classification",
      description: "Data classification labels required on content",
      status: dlpClassification ? "pass" : "fail",
      settingsTab: "dlp",
    } as ControlStatus,

    lockout: {
      id: "lockout_protection",
      name: "Brute-Force Protection",
      description: "Account lockout after failed login attempts",
      status: "pass",
      settingsTab: "org-settings",
    } as ControlStatus,

    https: {
      id: "https",
      name: "Encryption in Transit",
      description: "All connections use HTTPS/TLS",
      status: "pass",
    } as ControlStatus,

    dataExport: {
      id: "data_export",
      name: "Right to Access / Data Export",
      description: "Users can download all their personal data",
      status: "pass",
    } as ControlStatus,

    accountDeletion: {
      id: "account_deletion",
      name: "Right to Erasure",
      description: "Users can delete their account and all data",
      status: "pass",
    } as ControlStatus,

    cookieConsent: {
      id: "cookie_consent",
      name: "Cookie Consent",
      description: "Granular cookie consent banner with opt-in/opt-out",
      status: "pass",
    } as ControlStatus,

    privacyPolicy: {
      id: "privacy_policy",
      name: "Privacy Policy",
      description: "Published privacy policy with GDPR/CCPA rights",
      status: "pass",
    } as ControlStatus,

    dataRetention: {
      id: "data_retention",
      name: "Data Retention Policy",
      description: "Configured retention period for user content",
      status: dataRetentionConfigured ? "pass" : "fail",
      settingsTab: "compliance",
    } as ControlStatus,

    dpa: {
      id: "dpa_accepted",
      name: "Data Processing Agreement",
      description: "DPA acknowledged by organization owner",
      status: dpaAccepted ? "pass" : "fail",
      settingsTab: "compliance",
    } as ControlStatus,

    baa: {
      id: "hipaa_baa",
      name: "Business Associate Agreement",
      description: "HIPAA BAA acknowledged by organization owner",
      status: baaAccepted ? "pass" : "fail",
      settingsTab: "compliance",
    } as ControlStatus,

    dataBackup: {
      id: "data_backup",
      name: "Data Backup",
      description: "Managed by database administrator (PostgreSQL)",
      status: "info",
    } as ControlStatus,

    legalHold: {
      id: "legal_hold",
      name: "Legal Hold / Litigation Hold",
      description: "Ability to prevent deletion of user content during legal proceedings",
      status: "pass",
      settingsTab: "compliance",
    } as ControlStatus,

    ediscovery: {
      id: "ediscovery",
      name: "eDiscovery Export",
      description: "Admin-level cross-user data export for legal and compliance purposes",
      status: "pass",
      settingsTab: "compliance",
    } as ControlStatus,
  }
}

// ---------------------------------------------------------------------------
// Framework assembly
// ---------------------------------------------------------------------------

function buildFramework(
  id: string,
  name: string,
  description: string,
  controls: ControlStatus[],
): FrameworkStatus {
  // Exclude "info" controls from pass/total count
  const scorable = controls.filter((c) => c.status !== "info")
  const passCount = scorable.filter((c) => c.status === "pass").length
  const totalCount = scorable.length
  const readinessPercent = totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 0

  return { id, name, description, controls, passCount, totalCount, readinessPercent }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function getComplianceStatus(orgId: string): Promise<ComplianceStatusResult> {
  const [orgRow, ssoEnabled, twoFAEnforced] = await Promise.all([
    getOrgRow(orgId),
    hasSSOProviders(orgId),
    has2FAEnforcement(orgId),
  ])

  const encSettings = (orgRow.settings?.encryption || {}) as Record<string, unknown>
  const encryptionEnabled =
    isEncryptionEnabled() && encSettings.file_encryption_enabled === true

  const c = buildControls(orgRow, ssoEnabled, twoFAEnforced, encryptionEnabled)

  const frameworks: FrameworkStatus[] = [
    buildFramework(
      "soc2",
      "SOC 2 Type II",
      "Service organization controls for security, availability, and confidentiality",
      [c.sso, c.twoFA, c.encryption, c.auditLog, c.dlp, c.lockout, c.legalHold, c.ediscovery],
    ),
    buildFramework(
      "iso27001",
      "ISO 27001",
      "International standard for information security management",
      [c.sso, c.encryption, c.auditLog, c.dlpClassification, c.https],
    ),
    buildFramework(
      "gdpr",
      "GDPR",
      "EU General Data Protection Regulation compliance",
      [c.dataExport, c.accountDeletion, c.cookieConsent, c.privacyPolicy, c.dataRetention, c.dpa, c.encryption],
    ),
    buildFramework(
      "hipaa",
      "HIPAA",
      "Health Insurance Portability and Accountability Act readiness",
      [c.sso, c.twoFA, c.auditLog, c.encryption, c.baa, c.dataBackup, c.legalHold],
    ),
  ]

  return {
    frameworks,
    lastCheckedAt: new Date().toISOString(),
  }
}
