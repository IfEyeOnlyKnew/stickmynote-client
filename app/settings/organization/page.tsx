"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Users,
  Settings,
  User,
  Shield,
  ShieldCheck,
  Loader2,
  Phone,
  Crown,
  Eye,
  ArrowLeft,
  Palette,
  UserPlus,
  Sparkles,
  Terminal,
  KeyRound,
  ScrollText,
  ShieldAlert,
  Lock,
  ClipboardCheck,
  BarChart3,
} from "lucide-react"
import { useUser } from "@/contexts/user-context"
import { useOrganization } from "@/contexts/organization-context"
import { useToast } from "@/hooks/use-toast"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { UserMenu } from "@/components/user-menu"
import { OrgDisplay } from "@/components/organization/org-display"
import type { OrganizationAccessRequest } from "@/types/organization"
import {
  GeneralTab,
  BrandingTab,
  ContactsTab,
  RequestsTab,
  OrgSettingsTab,
  AutomationTab,
  MembersTab,
  AccountTab,
  SSOTab,
  AuditLogTab,
  DLPTab,
  EncryptionTab,
  ComplianceTab,
  PMHubTab,
} from "./_components"
import { ComplianceDashboard } from "@/components/auth/ComplianceDashboard"

interface OrgMember {
  id: string
  org_id: string
  user_id: string
  role: string
  status?: string
  joined_at: string
  users?: {
    id: string
    email: string
    full_name?: string
    avatar_url?: string
  }
}

interface OrgInvite {
  id: string
  email: string
  role: string
  invited_at: string
  status: string
}

const ROLE_CONFIG = {
  owner: { icon: Crown, iconColor: "text-yellow-600", badgeColor: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  admin: { icon: Shield, iconColor: "text-blue-600", badgeColor: "bg-blue-100 text-blue-800 border-blue-300" },
  member: { icon: Users, iconColor: "text-green-600", badgeColor: "bg-green-100 text-green-800 border-green-300" },
  viewer: { icon: Eye, iconColor: "text-gray-600", badgeColor: "bg-gray-100 text-gray-800 border-gray-300" },
  personal: { icon: User, iconColor: "text-purple-600", badgeColor: "bg-purple-100 text-purple-800 border-purple-300" },
  team: { icon: Users, iconColor: "text-blue-600", badgeColor: "bg-blue-100 text-blue-800 border-blue-300" },
  enterprise: { icon: Shield, iconColor: "text-indigo-600", badgeColor: "bg-indigo-100 text-indigo-800 border-indigo-300" },
} as const

const getRoleIcon = (role: string) => {
  const config = ROLE_CONFIG[role as keyof typeof ROLE_CONFIG]
  if (!config) return <Users className="h-4 w-4 text-gray-600" />
  const IconComponent = config.icon
  return <IconComponent className={`h-4 w-4 ${config.iconColor}`} />
}

const getRoleBadgeColor = (role: string) => {
  const config = ROLE_CONFIG[role as keyof typeof ROLE_CONFIG]
  return config?.badgeColor || "bg-gray-100 text-gray-800 border-gray-300"
}

function OrganizationSettingsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { user, loading: userLoading } = useUser()
  const { currentOrg, currentOrgRole, refreshOrganizations, isPersonalOrg, canManage } = useOrganization()

  const [members, setMembers] = useState<OrgMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">("member")
  const [inviting, setInviting] = useState(false)
  const [orgName, setOrgName] = useState("")
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const [pendingInvites, setPendingInvites] = useState<OrgInvite[]>([])

  const [supportContact1Email, setSupportContact1Email] = useState("")
  const [supportContact1Name, setSupportContact1Name] = useState("")
  const [supportContact2Email, setSupportContact2Email] = useState("")
  const [supportContact2Name, setSupportContact2Name] = useState("")
  const [savingContacts, setSavingContacts] = useState(false)

  const [accessRequests, setAccessRequests] = useState<OrganizationAccessRequest[]>([])
  const [loadingRequests, setLoadingRequests] = useState(true)
  const [processingRequest, setProcessingRequest] = useState<string | null>(null)

  // ADDED: Removed csvImportOpen state - no longer using dialog
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvFileName, setCsvFileName] = useState("")
  const [importing, setImporting] = useState(false)
  const [requirePreregistration, setRequirePreregistration] = useState(false)
  const [savingPreregSetting, setSavingPreregSetting] = useState(false)

  const [brandingSettings, setBrandingSettings] = useState({
    logo_url: "",
    logo_dark_url: "",
    favicon_url: "",
    page_logo_url: "",
    primary_color: "#4F46E5",
    secondary_color: "#7C3AED",
    accent_color: "#06B6D4",
    organization_display_name: "",
  })
  const [uploadingLogo, setUploadingLogo] = useState(false)

  const [aiSessionsPerDay, setAiSessionsPerDay] = useState(2)
  const [savingAiSettings, setSavingAiSettings] = useState(false)
  const [maxFailedAttempts, setMaxFailedAttempts] = useState(5)
  const [lockoutDurationMinutes, setLockoutDurationMinutes] = useState(15)
  const [savingLockoutSettings, setSavingLockoutSettings] = useState(false)

  // Automation settings
  const [disableManualHubCreation, setDisableManualHubCreation] = useState(false)
  const [savingAutomationSettings, setSavingAutomationSettings] = useState(false)

  // REMOVED: Domain migration state at the top (oldDomain, newDomain, newOrgName, migrationPreview, migrationLoading, migrationResult)

  const [searchEmail, setSearchEmail] = useState("")
  const [searchedUser, setSearchedUser] = useState<{
    id: string
    email: string
    full_name: string | null
    avatar_url: string | null
    created_at: string
    updated_at: string | null
    phone: string | null
    hub_mode: string | null
    region: string | null
    division: string | null
    email_verified: boolean
    lockout_info?: {
      is_locked_out: boolean
      failed_attempt_count: number
      max_failed_attempts: number
      lockout_duration_minutes: number
      lockout_expires_at: string | null
      last_failed_attempt: string | null
    }
  } | null>(null)
  const [searchedPreregInfo, setSearchedPreregInfo] = useState<{
    is_preregistered: boolean
    status: string | null
    role: string | null
    invited_at: string | null
    record_exists: boolean
  } | null>(null)
  const [searchedMembershipInfo, setSearchedMembershipInfo] = useState<{
    is_member: boolean
    role: string | null
    status: string | null
    joined_at: string | null
  } | null>(null)
  const [searchedOrgInfo, setSearchedOrgInfo] = useState<{
    org_id: string
    org_name: string
    require_preregistration: boolean
    domain: string | null
    allowed_domains?: string[]
  } | null>(null)
  const [searchedEmail, setSearchedEmail] = useState<string | null>(null)
  const [searchedMessage, setSearchedMessage] = useState<string | null>(null)
  const [searchingUser, setSearchingUser] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchAllowedDomains, setSearchAllowedDomains] = useState<string[]>([])
  const [unlockingAccount, setUnlockingAccount] = useState(false)

  const userEmail = user?.email || ""
  const isOwner = currentOrgRole === "owner"
  const isSupportContact =
    currentOrg?.support_contact_1_email === userEmail || currentOrg?.support_contact_2_email === userEmail
  const canManageSettings = isOwner || isSupportContact

  const canAddMembers = isOwner || isSupportContact

  useEffect(() => {
    if (currentOrg) {
      setOrgName(currentOrg.name || "")
      setRequirePreregistration((currentOrg as any).require_preregistration ?? false)
      if (currentOrg.settings?.branding) {
        setBrandingSettings({
          logo_url: currentOrg.settings.branding.logo_url || "",
          logo_dark_url: currentOrg.settings.branding.logo_dark_url || "",
          favicon_url: currentOrg.settings.branding.favicon_url || "",
          page_logo_url: currentOrg.settings.branding.page_logo_url || "",
          primary_color: currentOrg.settings.branding.primary_color || "#4F46E5",
          secondary_color: currentOrg.settings.branding.secondary_color || "#7C3AED",
          accent_color: currentOrg.settings.branding.accent_color || "#06B6D4",
          organization_display_name: currentOrg.settings.branding.organization_display_name || "",
        })
      }
      setSupportContact1Email(currentOrg.support_contact_1_email || "")
      setSupportContact1Name(currentOrg.support_contact_1_name || "")
      setSupportContact2Email(currentOrg.support_contact_2_email || "")
      setSupportContact2Name(currentOrg.support_contact_2_name || "")

      if ((currentOrg as any).ai_sessions_per_day) {
        setAiSessionsPerDay((currentOrg as any).ai_sessions_per_day)
      }
      if ((currentOrg as any).max_failed_attempts !== undefined) {
        setMaxFailedAttempts((currentOrg as any).max_failed_attempts ?? 5)
      }
      if ((currentOrg as any).lockout_duration_minutes !== undefined) {
        setLockoutDurationMinutes((currentOrg as any).lockout_duration_minutes ?? 15)
      }
      // Initialize automation setting
      if (currentOrg.settings?.disable_manual_hub_creation !== undefined) {
        setDisableManualHubCreation(currentOrg.settings.disable_manual_hub_creation)
      }
    }
  }, [currentOrg])

  useEffect(() => {
    if (currentOrg) {
      fetchMembers()
      fetchInvites()
      fetchAccessRequests()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg])

  const fetchMembers = async () => {
    if (!currentOrg) return
    setLoadingMembers(true)
    try {
      const res = await fetch(`/api/organizations/${currentOrg.id}/members`)
      if (res.ok) {
        const data = await res.json()
        setMembers(data.members || [])
      }
    } catch (error) {
      console.error("Error fetching members:", error)
    } finally {
      setLoadingMembers(false)
    }
  }

  const fetchInvites = async () => {
    if (!currentOrg || !canManage) return
    try {
      const res = await fetch(`/api/organizations/${currentOrg.id}/invites`)
      if (res.ok) {
        const data = await res.json()
        setPendingInvites(data.invites || [])
      }
    } catch (error) {
      console.error("Error fetching invites:", error)
    }
  }

  const fetchAccessRequests = async () => {
    if (!currentOrg || !canManage) return
    setLoadingRequests(true)
    try {
      const res = await fetch(`/api/organizations/${currentOrg.id}/access-requests`)
      if (res.ok) {
        const data = await res.json()
        setAccessRequests(data.requests || [])
      }
    } catch (error) {
      console.error("Error fetching access requests:", error)
    } finally {
      setLoadingRequests(false)
    }
  }

  const handleInvite = async () => {
    if (!currentOrg || !inviteEmail.trim()) return
    setInviting(true)
    try {
      const res = await fetch(`/api/organizations/${currentOrg.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      if (res.ok) {
        toast({ title: "Invitation sent", description: `Invited ${inviteEmail} as ${inviteRole}` })
        setInviteEmail("")

        const membersRes = await fetch(`/api/organizations/${currentOrg.id}/members`)
        if (membersRes.ok) {
          const data = await membersRes.json()
          setMembers(data.members || [])
        }

        const invitesRes = await fetch(`/api/organizations/${currentOrg.id}/invites`)
        if (invitesRes.ok) {
          const data = await invitesRes.json()
          setPendingInvites(data.invites || [])
        }
      } else {
        const error = await res.json()
        toast({ title: "Error", description: error.error || "Failed to send invitation", variant: "destructive" })
      }
    } catch (error) {
      console.error("Failed to send invitation:", error)
      toast({ title: "Error", description: "Failed to send invitation", variant: "destructive" })
    } finally {
      setInviting(false)
    }
  }

  const handleCancelInvite = async (inviteId: string) => {
    if (!currentOrg) return
    try {
      const res = await fetch(`/api/organizations/${currentOrg.id}/invites?inviteId=${inviteId}`, {
        method: "DELETE",
      })
      if (res.ok) {
        toast({ title: "Invitation cancelled" })
        setPendingInvites((prev) => prev.filter((i) => i.id !== inviteId))
      }
    } catch (error) {
      console.error("Failed to cancel invitation:", error)
      toast({ title: "Error", description: "Failed to cancel invitation", variant: "destructive" })
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!currentOrg) return
    try {
      const res = await fetch(`/api/organizations/${currentOrg.id}/members/${memberId}`, {
        method: "DELETE",
      })
      if (res.ok) {
        toast({ title: "Member removed" })

        const membersRes = await fetch(`/api/organizations/${currentOrg.id}/members`)
        if (membersRes.ok) {
          const data = await membersRes.json()
          setMembers(data.members || [])
        }
      }
    } catch (error) {
      console.error("Failed to remove member:", error)
      toast({ title: "Error", description: "Failed to remove member", variant: "destructive" })
    }
  }

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    if (!currentOrg) return
    try {
      const res = await fetch(`/api/organizations/${currentOrg.id}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      })
      if (res.ok) {
        toast({ title: "Role updated" })
        setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)))
      }
    } catch (error) {
      console.error("Failed to update role:", error)
      toast({ title: "Error", description: "Failed to update role", variant: "destructive" })
    }
  }

  const handleTransferOwnership = async (newOwnerEmail: string): Promise<boolean> => {
    if (!currentOrg) return false
    try {
      const res = await fetch(`/api/organizations/${currentOrg.id}/transfer-ownership`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newOwnerEmail }),
      })
      if (res.ok) {
        const data = await res.json()
        toast({ 
          title: "Ownership transferred", 
          description: `${data.newOwner?.email || newOwnerEmail} is now the owner. You are now an admin.` 
        })
        
        // Refresh members list
        const membersRes = await fetch(`/api/organizations/${currentOrg.id}/members`)
        if (membersRes.ok) {
          const membersData = await membersRes.json()
          setMembers(membersData.members || [])
        }
        
        // Refresh organization context
        await refreshOrganizations()
        
        return true
      } else {
        const error = await res.json()
        toast({ 
          title: "Error", 
          description: error.error || "Failed to transfer ownership", 
          variant: "destructive" 
        })
        return false
      }
    } catch (error) {
      console.error("Failed to transfer ownership:", error)
      toast({ title: "Error", description: "Failed to transfer ownership", variant: "destructive" })
      return false
    }
  }

  const handleSaveName = async () => {
    if (!currentOrg) return
    setSaving(true)
    try {
      const res = await fetch(`/api/organizations/${currentOrg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orgName }),
      })
      if (res.ok) {
        toast({ title: "Organization name updated" })
        refreshOrganizations()
      }
    } catch (error) {
      console.error("Failed to update name:", error)
      toast({ title: "Error", description: "Failed to update name", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveContacts = async () => {
    if (!currentOrg) return
    setSavingContacts(true)
    try {
      const res = await fetch(`/api/organizations/${currentOrg.id}/contacts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact1: { email: supportContact1Email, name: supportContact1Name },
          contact2: { email: supportContact2Email, name: supportContact2Name },
        }),
      })
      if (res.ok) {
        toast({ title: "Support contacts updated" })
        refreshOrganizations()
      } else {
        const error = await res.json()
        toast({ title: "Error", description: error.error || "Failed to update contacts", variant: "destructive" })
      }
    } catch (error) {
      console.error("Failed to update contacts:", error)
      toast({ title: "Error", description: "Failed to update contacts", variant: "destructive" })
    } finally {
      setSavingContacts(false)
    }
  }

  const handleAccessRequest = async (requestId: string, action: "approve" | "reject", role = "member") => {
    if (!currentOrg) return
    setProcessingRequest(requestId)
    try {
      const res = await fetch(`/api/organizations/${currentOrg.id}/access-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, role }),
      })
      if (res.ok) {
        toast({
          title: action === "approve" ? "Access approved" : "Access rejected",
          description: action === "approve" ? "User has been added to the organization" : "Access request was rejected",
        })
        setAccessRequests((prev) => prev.filter((r) => r.id !== requestId))
        if (action === "approve") {
          fetchMembers()
        }
      } else {
        const error = await res.json()
        toast({ title: "Error", description: error.error || "Failed to process request", variant: "destructive" })
      }
    } catch (error) {
      console.error("Failed to process request:", error)
      toast({ title: "Error", description: "Failed to process request", variant: "destructive" })
    } finally {
      setProcessingRequest(null)
    }
  }

  const handleTogglePreregistration = async () => {
    if (!currentOrg) return
    setSavingPreregSetting(true)
    try {
      const newValue = !requirePreregistration
      const res = await fetch(`/api/organizations/${currentOrg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ require_preregistration: newValue }),
      })
      if (res.ok) {
        setRequirePreregistration(newValue)
        toast({
          title: newValue ? "Pre-registration enabled" : "Pre-registration disabled",
          description: newValue
            ? "New users must be pre-registered to join your organization"
            : "Users with your domain can join automatically",
        })
        refreshOrganizations()
      } else {
        toast({ title: "Error", description: "Failed to update setting", variant: "destructive" })
      }
    } catch (error) {
      console.error("Failed to update setting:", error)
      toast({ title: "Error", description: "Failed to update setting", variant: "destructive" })
    } finally {
      setSavingPreregSetting(false)
    }
  }

  // Updated to handle file upload instead of textarea
  const handleCsvFileUpload = async () => {
    if (!currentOrg || !csvFile) return
    setImporting(true)
    try {
      const text = await csvFile.text()
      const lines = text.trim().split("\n")
      const members = lines
        .filter((line) => line.trim())
        .map((line) => {
          const parts = line.split(",").map((p) => p.trim().replaceAll(/(^["'])|(["']$)/g, ""))
          return {
            email: parts[0],
            name: parts[1] || "",
          }
        })
        .filter((m) => m.email?.includes("@"))

      if (members.length === 0) {
        toast({
          title: "No valid emails",
          description: "CSV file must contain valid email addresses",
          variant: "destructive",
        })
        setImporting(false)
        return
      }

      const res = await fetch(`/api/organizations/${currentOrg.id}/members/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members }),
      })

      const data = await res.json()

      if (res.ok) {
        const parts: string[] = []
        if (data.success > 0) parts.push(`${data.success} pre-registered`)
        if (data.alreadyMember > 0) parts.push(`${data.alreadyMember} already members`)
        if (data.alreadyPreRegistered > 0) parts.push(`${data.alreadyPreRegistered} already pre-registered`)
        if (data.failed > 0) parts.push(`${data.failed} failed`)

        toast({
          title: "Import complete",
          description: parts.join(", ") || "No changes made",
        })
        setCsvFile(null) // Clear the file state
        setCsvFileName("") // Clear the file name state
        // This state was previously removed but is now needed for the Dialog. // REMOVED: Removed setCsvImportOpen(false) reference since dialog is gone
        fetchMembers()
        fetchInvites()
      } else {
        toast({
          title: "Import failed",
          description: data.error || "Failed to import members",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("CSV Import error:", error)
      toast({
        title: "Import failed",
        description: "An error occurred while importing",
        variant: "destructive",
      })
    } finally {
      setImporting(false)
    }
  }

  const handleBrandingChange = async (type: string) => {
    if (!currentOrg) return
    try {
      const res = await fetch(`/api/organizations/${currentOrg.id}/branding/${type}`, {
        method: "DELETE",
      })
      if (res.ok) {
        toast({ title: `${type} removed` })
        refreshOrganizations()
      }
    } catch (error) {
      console.error(`Failed to remove ${type}:`, error)
      toast({ title: "Error", description: `Failed to remove ${type}`, variant: "destructive" })
    }
  }

  const handleLogoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "logo" | "logo_dark" | "favicon" | "page_logo",
  ) => {
    const file = e.target.files?.[0]
    if (!file || !currentOrg) return

    setUploadingLogo(true)

    const formData = new FormData()
    formData.append("file", file)
    formData.append("type", type)

    try {
      const response = await fetch(`/api/organizations/${currentOrg.id}/branding/upload`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        toast({
          title: "Upload failed",
          description: error.error || "Failed to upload image",
          variant: "destructive",
        })
        return
      }

      toast({ title: "Upload successful", description: `${type.replace("_", " ")} has been updated` })
      await refreshOrganizations()
    } catch (error) {
      console.error("Logo upload error:", error)
      toast({
        title: "Upload failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleBrandingSettingsUpdate = async () => {
    if (!currentOrg) return
    setSaving(true)
    try {
      const response = await fetch(`/api/organizations/${currentOrg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            ...currentOrg.settings,
            branding: brandingSettings,
          },
        }),
      })
      if (response.ok) {
        toast({ title: "Branding settings updated" })
        await refreshOrganizations()
      } else {
        toast({ title: "Error", description: "Failed to update branding settings", variant: "destructive" })
      }
    } catch (error) {
      console.error("Failed to update branding settings:", error)
      toast({ title: "Error", description: "Failed to update branding settings", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAiSettings = async () => {
    if (!currentOrg) return
    setSavingAiSettings(true)
    try {
      const response = await fetch(`/api/organizations/${currentOrg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ai_sessions_per_day: aiSessionsPerDay }),
      })
      if (!response.ok) throw new Error("Failed to save")
      toast({ title: "AI settings saved successfully" }) // Changed toast.success to toast({ title: ... })
      refreshOrganizations()
    } catch (error) {
      console.error("Failed to save AI settings:", error)
      toast({ title: "Failed to save AI settings", variant: "destructive" }) // Changed toast.error to toast({ title: ..., variant: "destructive" })
    } finally {
      setSavingAiSettings(false)
    }
  }

  const handleSaveLockoutSettings = async () => {
    if (!currentOrg) return
    setSavingLockoutSettings(true)
    try {
      const response = await fetch(`/api/organizations/${currentOrg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          max_failed_attempts: maxFailedAttempts,
          lockout_duration_minutes: lockoutDurationMinutes,
        }),
      })
      if (!response.ok) throw new Error("Failed to save")
      toast({ title: "Security settings saved successfully" })
      refreshOrganizations()
    } catch (error) {
      console.error("Failed to save security settings:", error)
      toast({ title: "Failed to save security settings", variant: "destructive" })
    } finally {
      setSavingLockoutSettings(false)
    }
  }

  const handleSaveAutomationSettings = async () => {
    if (!currentOrg) return
    setSavingAutomationSettings(true)
    try {
      // Merge with existing settings to preserve branding and other settings
      const updatedSettings = {
        ...currentOrg.settings,
        disable_manual_hub_creation: disableManualHubCreation,
      }
      const response = await fetch(`/api/organizations/${currentOrg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: updatedSettings }),
      })
      if (!response.ok) throw new Error("Failed to save")
      toast({ title: "Automation settings saved successfully" })
      refreshOrganizations()
    } catch (error) {
      console.error("Failed to save automation settings:", error)
      toast({ title: "Failed to save automation settings", variant: "destructive" })
    } finally {
      setSavingAutomationSettings(false)
    }
  }

  // ADDED: Domain migration handlers
  // The domain migration handlers have been removed from the organization settings

  const handleUserSearch = async () => {
    if (!searchEmail.trim()) return
    setSearchingUser(true)
    setSearchError(null)
    setSearchedUser(null)
    setSearchedPreregInfo(null)
    setSearchedMembershipInfo(null)
    setSearchedOrgInfo(null)
    setSearchedEmail(null)
    setSearchedMessage(null)
    setSearchAllowedDomains([])

    try {
      const res = await fetch(`/api/admin/user-lookup?email=${encodeURIComponent(searchEmail.trim())}`)
      const data = await res.json()

      if (!res.ok) {
        if (data.allowed_domains) {
          setSearchAllowedDomains(data.allowed_domains)
        }
        setSearchError(data.error || "Failed to search user")
        return
      }

      setSearchedUser(data.user)
      setSearchedPreregInfo(data.preregistration_info)
      setSearchedMembershipInfo(data.membership_info)
      setSearchedOrgInfo(data.organization_info)
      setSearchedEmail(data.email || data.user?.email)
      setSearchedMessage(data.message)
    } catch (error) {
      console.error("User search error:", error)
      setSearchError("An error occurred while searching")
    } finally {
      setSearchingUser(false)
    }
  }

  const handleUnlockAccount = async () => {
    if (!searchedUser?.email) return

    setUnlockingAccount(true)
    try {
      const response = await fetch("/api/admin/unlock-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: searchedUser.email }),
      })

      if (response.ok) {
        // Refresh user data to show updated lockout status
        await handleUserSearch()
      } else {
        const data = await response.json()
        setSearchError(data.error || "Failed to unlock account")
      }
    } catch (error) {
      console.error("Failed to unlock account:", error)
      setSearchError("Failed to unlock account")
    } finally {
      setUnlockingAccount(false)
    }
  }

  const copyOrgId = () => {
    if (currentOrg) {
      navigator.clipboard.writeText(currentOrg.id)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (userLoading || !currentOrg) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <BreadcrumbNav
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Organization Settings", current: true },
          ]}
        />
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <OrgDisplay />
          </div>
          <UserMenu />
        </div>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Organization Settings</h1>
          <p className="text-gray-600 mt-1">Manage your organization, members, and permissions</p>
        </div>
        <Tabs defaultValue="general" orientation="vertical" className="flex gap-6">
          <TabsList className="flex flex-col h-auto w-56 shrink-0 items-stretch bg-white border rounded-lg shadow-sm p-2 sticky top-8 self-start">
            <TabsTrigger value="general" className="justify-start gap-2 px-3 py-2 text-sm rounded-md data-[state=active]:bg-gray-100 data-[state=active]:shadow-none">
              <Settings className="h-4 w-4" />
              General
            </TabsTrigger>
            {!isPersonalOrg && (
              <TabsTrigger value="branding" className="justify-start gap-2 px-3 py-2 text-sm rounded-md data-[state=active]:bg-gray-100 data-[state=active]:shadow-none">
                <Palette className="h-4 w-4" />
                Branding
              </TabsTrigger>
            )}
            <TabsTrigger value="members" className="justify-start gap-2 px-3 py-2 text-sm rounded-md data-[state=active]:bg-gray-100 data-[state=active]:shadow-none">
              <Users className="h-4 w-4" />
              Members ({members.length})
            </TabsTrigger>
            {isOwner && !isPersonalOrg && (
              <TabsTrigger value="org-settings" className="justify-start gap-2 px-3 py-2 text-sm rounded-md data-[state=active]:bg-gray-100 data-[state=active]:shadow-none">
                <Sparkles className="h-4 w-4" />
                Org Settings
              </TabsTrigger>
            )}
            {isOwner && !isPersonalOrg && (
              <TabsTrigger value="account" className="justify-start gap-2 px-3 py-2 text-sm rounded-md data-[state=active]:bg-gray-100 data-[state=active]:shadow-none">
                <User className="h-4 w-4" />
                Account
              </TabsTrigger>
            )}
            {isOwner && !isPersonalOrg && (
              <TabsTrigger value="contacts" className="justify-start gap-2 px-3 py-2 text-sm rounded-md data-[state=active]:bg-gray-100 data-[state=active]:shadow-none">
                <Phone className="h-4 w-4" />
                Contacts
              </TabsTrigger>
            )}
            {canManage && !isPersonalOrg && accessRequests.length > 0 && (
              <TabsTrigger value="requests" className="justify-start gap-2 px-3 py-2 text-sm rounded-md data-[state=active]:bg-gray-100 data-[state=active]:shadow-none">
                <UserPlus className="h-4 w-4" />
                Requests ({accessRequests.length})
              </TabsTrigger>
            )}
            {isOwner && !isPersonalOrg && (
              <TabsTrigger value="automation" className="justify-start gap-2 px-3 py-2 text-sm rounded-md data-[state=active]:bg-gray-100 data-[state=active]:shadow-none">
                <Terminal className="h-4 w-4" />
                Automation
              </TabsTrigger>
            )}
            {isOwner && !isPersonalOrg && (
              <TabsTrigger value="pm-hub" className="justify-start gap-2 px-3 py-2 text-sm rounded-md data-[state=active]:bg-gray-100 data-[state=active]:shadow-none">
                <BarChart3 className="h-4 w-4" />
                PM Hub
              </TabsTrigger>
            )}

            {/* Security section divider */}
            {!isPersonalOrg && (
              <div className="border-t my-2 mx-1" />
            )}

            {(isOwner || currentOrgRole === "admin") && !isPersonalOrg && (
              <TabsTrigger value="2fa-compliance" className="justify-start gap-2 px-3 py-2 text-sm rounded-md data-[state=active]:bg-gray-100 data-[state=active]:shadow-none">
                <ShieldCheck className="h-4 w-4" />
                2FA Compliance
              </TabsTrigger>
            )}
            {isOwner && !isPersonalOrg && (
              <TabsTrigger value="sso" className="justify-start gap-2 px-3 py-2 text-sm rounded-md data-[state=active]:bg-gray-100 data-[state=active]:shadow-none">
                <KeyRound className="h-4 w-4" />
                SSO
              </TabsTrigger>
            )}
            {(isOwner || currentOrgRole === "admin") && !isPersonalOrg && (
              <TabsTrigger value="audit-log" className="justify-start gap-2 px-3 py-2 text-sm rounded-md data-[state=active]:bg-gray-100 data-[state=active]:shadow-none">
                <ScrollText className="h-4 w-4" />
                Audit Log
              </TabsTrigger>
            )}
            {isOwner && !isPersonalOrg && (
              <TabsTrigger value="dlp" className="justify-start gap-2 px-3 py-2 text-sm rounded-md data-[state=active]:bg-gray-100 data-[state=active]:shadow-none">
                <ShieldAlert className="h-4 w-4" />
                DLP
              </TabsTrigger>
            )}
            {isOwner && !isPersonalOrg && (
              <TabsTrigger value="encryption" className="justify-start gap-2 px-3 py-2 text-sm rounded-md data-[state=active]:bg-gray-100 data-[state=active]:shadow-none">
                <Lock className="h-4 w-4" />
                Encryption
              </TabsTrigger>
            )}
            {isOwner && !isPersonalOrg && (
              <TabsTrigger value="compliance" className="justify-start gap-2 px-3 py-2 text-sm rounded-md data-[state=active]:bg-gray-100 data-[state=active]:shadow-none">
                <ClipboardCheck className="h-4 w-4" />
                Compliance
              </TabsTrigger>
            )}
          </TabsList>

          {/* Content Area */}
          <div className="flex-1 min-w-0">

          {/* General Settings */}
          <TabsContent value="general">
            <GeneralTab
              currentOrg={currentOrg}
              orgName={orgName}
              setOrgName={setOrgName}
              copied={copied}
              copyOrgId={copyOrgId}
              canManageSettings={canManageSettings}
              isPersonalOrg={isPersonalOrg}
              saving={saving}
              handleSaveName={handleSaveName}
              getRoleBadgeColor={getRoleBadgeColor}
            />
          </TabsContent>

          {/* Branding Settings */}
          {!isPersonalOrg && (
            <TabsContent value="branding">
              <BrandingTab
                brandingSettings={brandingSettings}
                uploadingLogo={uploadingLogo}
                canManageSettings={canManageSettings}
                saving={saving}
                handleLogoUpload={handleLogoUpload}
                handleBrandingChange={handleBrandingChange}
                handleBrandingSettingsUpdate={handleBrandingSettingsUpdate}
              />
            </TabsContent>
          )}

          {/* Support Contacts */}
          <TabsContent value="contacts">
            <ContactsTab
              supportContact1Email={supportContact1Email}
              setSupportContact1Email={setSupportContact1Email}
              supportContact1Name={supportContact1Name}
              setSupportContact1Name={setSupportContact1Name}
              supportContact2Email={supportContact2Email}
              setSupportContact2Email={setSupportContact2Email}
              supportContact2Name={supportContact2Name}
              setSupportContact2Name={setSupportContact2Name}
              savingContacts={savingContacts}
              handleSaveContacts={handleSaveContacts}
            />
          </TabsContent>

          {/* Access Requests */}
          {canManage && !isPersonalOrg && (
            <TabsContent value="requests">
              <RequestsTab
                accessRequests={accessRequests}
                loadingRequests={loadingRequests}
                processingRequest={processingRequest}
                currentOrgRole={currentOrgRole}
                handleAccessRequest={handleAccessRequest}
              />
            </TabsContent>
          )}

          {/* Members */}
          <TabsContent value="members" className="space-y-6">
            <MembersTab
              members={members}
              loadingMembers={loadingMembers}
              pendingInvites={pendingInvites}
              inviteEmail={inviteEmail}
              setInviteEmail={setInviteEmail}
              inviteRole={inviteRole}
              setInviteRole={setInviteRole}
              inviting={inviting}
              handleInvite={handleInvite}
              handleCancelInvite={handleCancelInvite}
              handleRemoveMember={handleRemoveMember}
              handleUpdateRole={handleUpdateRole}
              handleTransferOwnership={handleTransferOwnership}
              canManage={canManage}
              canAddMembers={canAddMembers}
              currentOrgRole={currentOrgRole}
              user={user}
              isPersonalOrg={isPersonalOrg}
              requirePreregistration={requirePreregistration}
              savingPreregSetting={savingPreregSetting}
              handleTogglePreregistration={handleTogglePreregistration}
              csvFile={csvFile}
              setCsvFile={setCsvFile}
              csvFileName={csvFileName}
              setCsvFileName={setCsvFileName}
              importing={importing}
              handleCsvFileUpload={handleCsvFileUpload}
              getRoleIcon={getRoleIcon}
              getRoleBadgeColor={getRoleBadgeColor}
            />
          </TabsContent>

          {/* Org Settings Tab */}
          {isOwner && !isPersonalOrg && (
            <TabsContent value="org-settings">
              <OrgSettingsTab
                currentOrgId={currentOrg.id}
                aiSessionsPerDay={aiSessionsPerDay}
                setAiSessionsPerDay={setAiSessionsPerDay}
                savingAiSettings={savingAiSettings}
                handleSaveAiSettings={handleSaveAiSettings}
                maxFailedAttempts={maxFailedAttempts}
                setMaxFailedAttempts={setMaxFailedAttempts}
                lockoutDurationMinutes={lockoutDurationMinutes}
                setLockoutDurationMinutes={setLockoutDurationMinutes}
                savingLockoutSettings={savingLockoutSettings}
                handleSaveLockoutSettings={handleSaveLockoutSettings}
              />
            </TabsContent>
          )}

          {/* Account Tab */}
          <TabsContent value="account">
            <AccountTab
              requirePreregistration={requirePreregistration}
              savingPreregSetting={savingPreregSetting}
              handleTogglePreregistration={handleTogglePreregistration}
              searchEmail={searchEmail}
              setSearchEmail={setSearchEmail}
              searchingUser={searchingUser}
              handleUserSearch={handleUserSearch}
              searchError={searchError}
              searchAllowedDomains={searchAllowedDomains}
              searchedUser={searchedUser}
              searchedPreregInfo={searchedPreregInfo}
              searchedMembershipInfo={searchedMembershipInfo}
              searchedOrgInfo={searchedOrgInfo}
              searchedEmail={searchedEmail}
              searchedMessage={searchedMessage}
              unlockingAccount={unlockingAccount}
              handleUnlockAccount={handleUnlockAccount}
              getRoleIcon={getRoleIcon}
            />
          </TabsContent>

          {/* Automation Tab */}
          {isOwner && !isPersonalOrg && (
            <TabsContent value="automation">
              <AutomationTab
                disableManualHubCreation={disableManualHubCreation}
                setDisableManualHubCreation={setDisableManualHubCreation}
                savingAutomationSettings={savingAutomationSettings}
                handleSaveAutomationSettings={handleSaveAutomationSettings}
              />
            </TabsContent>
          )}

          {/* 2FA Compliance Tab */}
          {(isOwner || currentOrgRole === "admin") && !isPersonalOrg && currentOrg && (
            <TabsContent value="2fa-compliance">
              <ComplianceDashboard orgId={currentOrg.id} />
            </TabsContent>
          )}

          {/* SSO Tab */}
          {isOwner && !isPersonalOrg && currentOrg && (
            <TabsContent value="sso">
              <SSOTab currentOrgId={currentOrg.id} />
            </TabsContent>
          )}

          {/* Audit Log Tab */}
          {(isOwner || currentOrgRole === "admin") && !isPersonalOrg && currentOrg && (
            <TabsContent value="audit-log">
              <AuditLogTab currentOrgId={currentOrg.id} />
            </TabsContent>
          )}

          {/* DLP Tab */}
          {isOwner && !isPersonalOrg && currentOrg && (
            <TabsContent value="dlp">
              <DLPTab currentOrgId={currentOrg.id} />
            </TabsContent>
          )}

          {/* Encryption Tab */}
          {isOwner && !isPersonalOrg && currentOrg && (
            <TabsContent value="encryption">
              <EncryptionTab currentOrgId={currentOrg.id} />
            </TabsContent>
          )}

          {/* Compliance Tab */}
          {isOwner && !isPersonalOrg && currentOrg && (
            <TabsContent value="compliance">
              <ComplianceTab currentOrgId={currentOrg.id} />
            </TabsContent>
          )}

          {/* PM Hub Tab */}
          {isOwner && !isPersonalOrg && (
            <TabsContent value="pm-hub">
              <PMHubTab />
            </TabsContent>
          )}
          </div>
        </Tabs>
      </div>
    </div>
  )
}

export default OrganizationSettingsPage

