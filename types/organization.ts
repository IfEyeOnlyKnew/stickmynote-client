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
