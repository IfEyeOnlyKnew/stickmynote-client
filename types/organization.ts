export interface Organization {
  id: string
  name: string
  slug: string
  type: "personal" | "team" | "enterprise"
  domain?: string // Added domain field for email domain matching
  owner_id?: string
  settings: OrganizationSettings
  support_contact_1_email?: string
  support_contact_1_name?: string
  support_contact_2_email?: string
  support_contact_2_name?: string
  require_membership_approval?: boolean
  auto_approve_domain_users?: boolean
  created_at: string
  updated_at: string
}

export interface DLPSettings {
  // Sharing Controls (all default false = unrestricted)
  block_community_sharing?: boolean
  block_public_pads?: boolean
  block_ical_feeds?: boolean
  block_external_webhooks?: boolean
  block_video_external_invite?: boolean

  // Domain Controls
  allowed_webhook_domains?: string[]
  allowed_invite_domains?: string[]

  // Content Scanning
  content_scanning_enabled?: boolean
  scan_patterns?: string[]
  scan_action?: "warn" | "block"

  // Classification
  require_classification?: boolean
  default_sensitivity?: "public" | "internal" | "confidential" | "restricted"
}

export interface EncryptionSettings {
  // Per-org toggle: when true + master key configured, new uploads are encrypted
  file_encryption_enabled?: boolean
  // Timestamp of when encryption was first enabled
  enabled_at?: string
  // Email of the user who enabled it
  enabled_by?: string
}

export interface ComplianceSettings {
  data_retention_days?: number       // 0 = indefinite, else 30/60/90/180/365
  dpa_accepted?: boolean             // GDPR Data Processing Agreement
  dpa_accepted_at?: string
  dpa_accepted_by?: string
  data_residency_region?: string     // "on-premise", "us-east", "eu-west"
  hipaa_baa_signed?: boolean         // HIPAA Business Associate Agreement
  hipaa_baa_signed_at?: string
  hipaa_baa_signed_by?: string
}

export interface OrganizationSettings {
  allow_public_pads?: boolean
  max_members?: number
  features?: string[]
  disable_manual_hub_creation?: boolean // When true, hides "Create Social Pad" button (automation-only mode)
  branding?: {
    logo_url?: string
    logo_dark_url?: string
    page_logo_url?: string // Added page_logo_url for UserMenu avatar
    primary_color?: string
    secondary_color?: string
    accent_color?: string
    organization_display_name?: string
    favicon_url?: string
  }
  dlp?: DLPSettings
  encryption?: EncryptionSettings
  compliance?: ComplianceSettings
}

export interface OrganizationMember {
  id: string
  org_id: string
  organization_id?: string // Kept for backward compatibility
  user_id: string
  role: "owner" | "admin" | "member" | "viewer"
  status?: "pending" | "active" | "suspended" | "rejected"
  approved_by?: string
  approved_at?: string
  request_message?: string
  rejection_reason?: string
  invited_by?: string
  invited_at?: string
  joined_at?: string
  organization?: Organization
  user?: {
    id: string
    email: string
    full_name?: string
    avatar_url?: string
  }
}

export interface OrganizationInvite {
  id: string
  org_id: string
  organization_id?: string // Kept for backward compatibility
  email: string
  role: "admin" | "member" | "viewer"
  invited_by: string
  expires_at: string
  created_at: string
}

export interface OrganizationAccessRequest {
  id: string
  org_id: string
  user_id: string
  email: string
  full_name?: string
  request_message?: string
  status: "pending" | "approved" | "rejected" | "cancelled"
  reviewed_by?: string
  reviewed_at?: string
  rejection_reason?: string
  created_at: string
  updated_at: string
  organization?: Organization
  user?: {
    id: string
    email: string
    full_name?: string
    avatar_url?: string
  }
}

export type OrgRole = "owner" | "admin" | "member" | "viewer"

export function canManageOrg(role: OrgRole): boolean {
  return role === "owner" || role === "admin"
}

export function canInviteMembers(role: OrgRole): boolean {
  return role === "owner" || role === "admin"
}

export function canRemoveMembers(role: OrgRole, targetRole: OrgRole): boolean {
  if (role === "owner") return targetRole !== "owner"
  if (role === "admin") return targetRole === "member" || targetRole === "viewer"
  return false
}

export function canCreateContent(role: OrgRole): boolean {
  return role !== "viewer"
}

export function canEditContent(role: OrgRole): boolean {
  return role !== "viewer"
}

export function canDeleteContent(role: OrgRole, isOwner: boolean): boolean {
  if (isOwner) return true
  return role === "owner" || role === "admin"
}

export function isSupportContact(org: Organization, userEmail: string): boolean {
  return org.support_contact_1_email === userEmail || org.support_contact_2_email === userEmail
}

export function canManageOrgSettings(org: Organization, role: OrgRole, userEmail: string): boolean {
  if (role === "owner") return true
  if (isSupportContact(org, userEmail)) return true
  return false
}
