"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Users,
  Settings,
  Trash2,
  Mail,
  User,
  Shield,
  CheckCircle,
  XCircle,
  Loader2,
  Phone,
  Clock,
  Search,
  Lock,
  Unlock,
  Crown,
  Eye,
  ArrowLeft,
  Palette,
  UserPlus,
  Sparkles,
  Check,
  Copy,
  Upload,
  FileSpreadsheet,
  X,
  AlertCircle,
  Server,
  Database,
  HardDrive,
  Globe,
} from "lucide-react"
import { useUser } from "@/contexts/user-context"
import { useOrganization } from "@/contexts/organization-context"
import { useToast } from "@/hooks/use-toast"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { UserMenu } from "@/components/user-menu"
import { OrgDisplay } from "@/components/organization/org-display"
import type { OrganizationAccessRequest } from "@/types/organization"
import { DomainManager } from "@/components/organization/domain-manager"

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

const getRoleIcon = (role: string) => {
  switch (role) {
    case "owner":
      return <Crown className="h-4 w-4 text-yellow-600" />
    case "admin":
      return <Shield className="h-4 w-4 text-blue-600" />
    case "member":
      return <Users className="h-4 w-4 text-green-600" />
    case "viewer":
      return <Eye className="h-4 w-4 text-gray-600" />
    default:
      return <Users className="h-4 w-4 text-gray-600" />
  }
}

const getRoleBadgeColor = (role: string) => {
  switch (role) {
    case "owner":
      return "bg-yellow-100 text-yellow-800 border-yellow-300"
    case "admin":
      return "bg-blue-100 text-blue-800 border-blue-300"
    case "member":
      return "bg-green-100 text-green-800 border-green-300"
    case "viewer":
      return "bg-gray-100 text-gray-800 border-gray-300"
    case "personal":
      return "bg-purple-100 text-purple-800 border-purple-300"
    case "team":
      return "bg-blue-100 text-blue-800 border-blue-300"
    case "enterprise":
      return "bg-indigo-100 text-indigo-800 border-indigo-300"
    default:
      return "bg-gray-100 text-gray-800 border-gray-300"
  }
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
  const [loadingInvites, setLoadingInvites] = useState(true)

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
  const [uploadingDarkLogo, setUploadingDarkLogo] = useState(false)
  const [uploadingFavicon, setUploadingFavicon] = useState(false)
  const [uploadingPageLogo, setUploadingPageLogo] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const darkLogoInputRef = useRef<HTMLInputElement>(null)
  const faviconInputRef = useRef<HTMLInputElement>(null)
  const pageLogoInputRef = useRef<HTMLInputElement>(null)

  const [aiSessionsPerDay, setAiSessionsPerDay] = useState(2)
  const [savingAiSettings, setSavingAiSettings] = useState(false)
  const [maxFailedAttempts, setMaxFailedAttempts] = useState(5)
  const [lockoutDurationMinutes, setLockoutDurationMinutes] = useState(15)
  const [savingLockoutSettings, setSavingLockoutSettings] = useState(false)

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

  // ADDED: Server Configuration state
  const [serverConfig, setServerConfig] = useState({
    // Database (HOL-DC3-PGSQL - PostgreSQL Server)
    use_local_postgres: true,
    postgres_host: "192.168.50.30", // HOL-DC3-PGSQL.stickmynote.com
    postgres_port: 5432,
    postgres_database: "stickmynote",
    postgres_user: "",
    postgres_password: "",

    // Email (HOL-DC4-EXCH - Exchange Server)
    smtp_host: "192.168.50.40", // HOL-DC4-EXCH.stickmynote.com
    smtp_port: 587,
    smtp_use_tls: true,
    smtp_user: "",
    smtp_password: "",
    smtp_from_email: "",
    smtp_from_name: "Stick My Note",

    // Redis (HOL-DC5-REDIS - Redis Server)
    use_local_redis: true,
    redis_host: "192.168.50.50", // HOL-DC5-REDIS.stickmynote.com
    redis_port: 6379,
    redis_password: "",
    redis_database: 0,

    // File Storage (HOL-DC2-IIS - Web Server)
    use_local_storage: true,
    storage_path: "C:\\StickyNote\\uploads", // Updated from IIS path to service path
    storage_max_file_size_mb: 10,

    // Application
    app_name: "Stick My Note",
    app_url: "https://www.stickmynote.com", // Updated URL
    timezone: "America/New_York",
  })
  const [savingServerConfig, setSavingServerConfig] = useState(false)
  const [loadingServerConfig, setLoadingServerConfig] = useState(false)

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
    }
  }, [currentOrg])

  // ADDED: Load server configuration on mount
  useEffect(() => {
    if (isOwner && currentOrg && !isPersonalOrg) {
      loadServerConfiguration()
    }
  }, [isOwner, currentOrg, isPersonalOrg])

  useEffect(() => {
    if (currentOrg) {
      fetchMembers()
      fetchInvites()
      fetchAccessRequests()
    }
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
    setLoadingInvites(true)
    try {
      const res = await fetch(`/api/organizations/${currentOrg.id}/invites`)
      if (res.ok) {
        const data = await res.json()
        setPendingInvites(data.invites || [])
      }
    } catch (error) {
      console.error("Error fetching invites:", error)
    } finally {
      setLoadingInvites(false)
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
      toast({ title: "Error", description: "Failed to update role", variant: "destructive" })
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
      toast({ title: "Error", description: "Failed to update setting", variant: "destructive" })
    } finally {
      setSavingPreregSetting(false)
    }
  }

  // REMOVED: Remove old handleCsvImport function that used textarea
  // const handleCsvImport = async () => {
  //   if (!currentOrg || !csvData.trim()) return
  //   setImporting(true)
  //   try {
  //     // Parse CSV - expects email,name format (one per line)
  //     const lines = csvData.trim().split("\n")
  //     const members = lines
  //       .filter((line) => line.trim())
  //       .map((line) => {
  //         // Handle various separators and clean up whitespace
  //         const parts = line.split(",").map((p) => p.trim().replace(/^["']|["']$/g, ""))
  //         return {
  //           email: parts[0],
  //           name: parts[1] || "",
  //         }
  //       })
  //       .filter((m) => m.email && m.email.includes("@")) // Only valid emails

  //     console.log("[v0] CSV Import: Parsed members:", members)

  //     if (members.length === 0) {
  //       toast({
  //         title: "No valid emails",
  //         description: "Please enter at least one valid email address",
  //         variant: "destructive",
  //       })
  //       setImporting(false)
  //       return
  //     }

  //     const res = await fetch(`/api/organizations/${currentOrg.id}/members/import`, {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({ members }),
  //     })

  //     console.log("[v0] CSV Import: Response status:", res.status)

  //     const data = await res.json()
  //     console.log("[v0] CSV Import: Response data:", data)

  //     if (res.ok) {
  //       toast({
  //         title: "Import complete",
  //         description: `Pre-registered ${data.success || 0} member(s)${data.failed ? `, ${data.failed} failed` : ""}`,
  //       })
  //       setCsvData("")
  //       setCsvImportOpen(false)
  //       fetchMembers()
  //       fetchInvites()
  //     } else {
  //       toast({ title: "Error", description: data.error || "Failed to import members", variant: "destructive" })
  //     }
  //   } catch (error) {
  //     console.error("[v0] CSV Import error:", error)
  //     toast({ title: "Error", description: "Failed to import members", variant: "destructive" })
  //   } finally {
  //     setImporting(false)
  //   }
  // }

  // ADDED: Updated to handle file upload instead of textarea
  const handleCsvFileUpload = async () => {
    if (!currentOrg || !csvFile) return
    setImporting(true)
    try {
      const text = await csvFile.text()
      const lines = text.trim().split("\n")
      const members = lines
        .filter((line) => line.trim())
        .map((line) => {
          const parts = line.split(",").map((p) => p.trim().replace(/^["']|["']$/g, ""))
          return {
            email: parts[0],
            name: parts[1] || "",
          }
        })
        .filter((m) => m.email && m.email.includes("@"))

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
      toast({ title: "Error", description: `Failed to remove ${type}`, variant: "destructive" })
    }
  }

  const handleLogoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "logo" | "logo_dark" | "favicon" | "page_logo",
  ) => {
    const file = e.target.files?.[0]
    if (!file || !currentOrg) return

    const setUploading = {
      logo: setUploadingLogo,
      logo_dark: setUploadingDarkLogo,
      favicon: setUploadingFavicon,
      page_logo: setUploadingPageLogo,
    }[type]

    setUploading(true)

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
      toast({
        title: "Upload failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
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
      toast({ title: "Failed to save security settings", variant: "destructive" })
    } finally {
      setSavingLockoutSettings(false)
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

  const handleRefresh = async () => {
    // This function is intended to refresh the organization data, similar to refreshOrganizations
    // but potentially with additional local state updates if needed.
    // For now, it just calls the context's refreshOrganizations.
    await refreshOrganizations()
    // You might add local state refreshes here if any local state depends directly on org data
    // and needs to be updated immediately after refreshOrganizations.
    // For example, if orgName was not reactive enough:
    // if (currentOrg) {
    //   setOrgName(currentOrg.name || "");
    // }
  }

  // ADDED: Load server configuration handler
  const loadServerConfiguration = async () => {
    setLoadingServerConfig(true)
    try {
      const response = await fetch(`/api/organizations/${currentOrg.id}/server-config`)
      if (response.ok) {
        const data = await response.json()
        if (data.config) {
          setServerConfig((prev) => ({ ...prev, ...data.config }))
        }
      }
    } catch (error) {
      console.error("[v0] Failed to load server configuration:", error)
    } finally {
      setLoadingServerConfig(false)
    }
  }

  // ADDED: Save server configuration handler
  const handleSaveServerConfig = async () => {
    setSavingServerConfig(true)
    try {
      const response = await fetch(`/api/organizations/${currentOrg.id}/server-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serverConfig),
      })

      if (response.ok) {
        toast({
          title: "Server configuration saved",
          description: "Your Windows Server settings have been updated.",
        })
      } else {
        throw new Error("Failed to save server configuration")
      }
    } catch (error) {
      console.error("[v0] Failed to save server configuration:", error)
      toast({
        title: "Error",
        description: "Failed to save server configuration. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSavingServerConfig(false)
    }
  }

  // ADDED: Test server connection handler
  const handleTestServerConnection = async (type: "database" | "smtp" | "redis") => {
    try {
      const response = await fetch(`/api/organizations/${currentOrg.id}/test-connection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, config: serverConfig }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Connection successful",
          description: `Successfully connected to ${type}.`,
        })
      } else {
        toast({
          title: "Connection failed",
          description: data.error || `Failed to connect to ${type}.`,
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Connection test failed",
        description: `Unable to test ${type} connection.`,
        variant: "destructive",
      })
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
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {" "}
        {/* Changed max-w-4xl to max-w-5xl in update, reverting to original for consistency. If original needed to be max-w-5xl, change it back here */}
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
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList>
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              General
            </TabsTrigger>
            {!isPersonalOrg && (
              <TabsTrigger value="branding" className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Branding
              </TabsTrigger>
            )}
            <TabsTrigger value="members" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Members ({members.length})
            </TabsTrigger>
            {isOwner && !isPersonalOrg && (
              <TabsTrigger value="org-settings" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Org Settings
              </TabsTrigger>
            )}
            {isOwner && !isPersonalOrg && (
              <TabsTrigger value="account" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Account
              </TabsTrigger>
            )}
            {isOwner && !isPersonalOrg && (
              <TabsTrigger value="contacts" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Support Contacts
              </TabsTrigger>
            )}
            {canManage && !isPersonalOrg && accessRequests.length > 0 && (
              <TabsTrigger value="requests" className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Requests ({accessRequests.length})
              </TabsTrigger>
            )}
            {/* ADDED: Server Configuration tab for owners */}
            {isOwner && !isPersonalOrg && (
              <TabsTrigger value="server-config" className="flex items-center gap-2">
                <Server className="h-4 w-4" />
                Server Config
              </TabsTrigger>
            )}
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>Organization Details</CardTitle>
                <CardDescription>
                  {isPersonalOrg
                    ? "This is your personal organization. It cannot be deleted."
                    : "Manage your organization settings and information."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="org-name">Organization Name</Label>
                  <Input
                    id="org-name"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    disabled={!canManageSettings || isPersonalOrg}
                    placeholder="My Organization"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Organization ID</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-gray-100 rounded-md text-sm font-mono">{currentOrg.id}</code>
                    <Button variant="outline" size="sm" onClick={copyOrgId}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Organization Type</Label>
                  <div className="flex items-center gap-2">
                    <Badge className={getRoleBadgeColor(currentOrg.type)}>{currentOrg.type}</Badge>
                  </div>
                </div>

                {canManageSettings && !isPersonalOrg && (
                  <Button onClick={handleSaveName} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Save Changes
                  </Button>
                )}
              </CardContent>
            </Card>

            {!isPersonalOrg && (
              <div className="mt-6">
                <DomainManager orgId={currentOrg.id} canManage={canManageSettings} />
              </div>
            )}
          </TabsContent>

          {/* Branding Settings */}
          {!isPersonalOrg && (
            <TabsContent value="branding">
              <Card>
                <CardHeader>
                  <CardTitle>Branding</CardTitle>
                  <CardDescription>
                    {isPersonalOrg
                      ? "Branding is not available for personal organizations"
                      : "Customize how your organization appears across the platform"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Logo upload sections... keeping existing code */}
                  <div className="space-y-4">
                    <div>
                      <Label>Logo (Light Mode)</Label>
                      <div className="flex items-center gap-4 mt-2">
                        {brandingSettings.logo_url ? (
                          <img
                            src={brandingSettings.logo_url || "/placeholder.svg"}
                            alt="Logo"
                            className="h-12 w-auto rounded border bg-white p-1"
                          />
                        ) : (
                          <div className="h-12 w-24 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-sm">
                            No logo
                          </div>
                        )}
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleLogoUpload(e, "logo")}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => logoInputRef.current?.click()}
                          disabled={uploadingLogo || !canManageSettings}
                        >
                          {uploadingLogo ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                          <span className="ml-2">Upload</span>
                        </Button>
                        {brandingSettings.logo_url && canManageSettings && (
                          <Button variant="ghost" size="sm" onClick={() => handleBrandingChange("logo")}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <Button onClick={handleBrandingSettingsUpdate} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Save Branding
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="contacts">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Support Contacts
                </CardTitle>
                <CardDescription>
                  Designate up to 2 support contacts who can help manage organization access requests. Support contacts
                  can also access organization settings.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Contact 1 */}
                  <div className="space-y-4 p-4 border rounded-lg">
                    <h4 className="font-medium">Primary Contact</h4>
                    <div className="space-y-2">
                      <Label htmlFor="contact1-name">Name</Label>
                      <Input
                        id="contact1-name"
                        value={supportContact1Name}
                        onChange={(e) => setSupportContact1Name(e.target.value)}
                        placeholder="John Doe"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact1-email">Email</Label>
                      <Input
                        id="contact1-email"
                        type="email"
                        value={supportContact1Email}
                        onChange={(e) => setSupportContact1Email(e.target.value)}
                        placeholder="john@company.com"
                      />
                    </div>
                  </div>

                  {/* Contact 2 */}
                  <div className="space-y-4 p-4 border rounded-lg">
                    <h4 className="font-medium">Secondary Contact</h4>
                    <div className="space-y-2">
                      <Label htmlFor="contact2-name">Name</Label>
                      <Input
                        id="contact2-name"
                        value={supportContact2Name}
                        onChange={(e) => setSupportContact2Name(e.target.value)}
                        placeholder="Jane Smith"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact2-email">Email</Label>
                      <Input
                        id="contact2-email"
                        type="email"
                        value={supportContact2Email}
                        onChange={(e) => setSupportContact2Email(e.target.value)}
                        placeholder="jane@company.com"
                      />
                    </div>
                  </div>
                </div>

                <Button onClick={handleSaveContacts} disabled={savingContacts}>
                  {savingContacts ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save Contacts
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {canManage && !isPersonalOrg && (
            <TabsContent value="requests">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5" />
                    Access Requests ({accessRequests.length})
                  </CardTitle>
                  <CardDescription>
                    Users from the same domain who want to join your organization. Review and approve or reject their
                    requests.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingRequests ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : accessRequests.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No pending access requests</p>
                  ) : (
                    <div className="space-y-4">
                      {accessRequests.map((request) => (
                        <div
                          key={request.id}
                          className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-200"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={request.user?.avatar_url || "/placeholder.svg"} />
                              <AvatarFallback className="bg-yellow-200 text-yellow-700">
                                {request.email.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-gray-900">{request.full_name || request.email}</p>
                              <p className="text-sm text-gray-500">{request.email}</p>
                              {request.request_message && (
                                <p className="text-sm text-gray-600 mt-1 italic">
                                  &quot;{request.request_message}&quot;
                                </p>
                              )}
                              <p className="text-xs text-gray-400 mt-1">
                                Requested {new Date(request.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Select
                              defaultValue="member"
                              onValueChange={(role) => handleAccessRequest(request.id, "approve", role)}
                              disabled={processingRequest === request.id}
                            >
                              <SelectTrigger className="w-28">
                                <SelectValue placeholder="Role" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="viewer">Viewer</SelectItem>
                                <SelectItem value="member">Member</SelectItem>
                                {currentOrgRole === "owner" && <SelectItem value="admin">Admin</SelectItem>}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              onClick={() => handleAccessRequest(request.id, "approve")}
                              disabled={processingRequest === request.id}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              {processingRequest === request.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleAccessRequest(request.id, "reject")}
                              disabled={processingRequest === request.id}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="members" className="space-y-6">
            {/* Access Security */}
            {canManage && !isPersonalOrg && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Access Security
                  </CardTitle>
                  <CardDescription>Control how new users can join your organization</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">Require Pre-registration</p>
                      <p className="text-sm text-muted-foreground">
                        {requirePreregistration
                          ? "Only pre-registered emails can join your organization"
                          : "Anyone with your domain email can automatically join"}
                      </p>
                    </div>
                    <Button
                      variant={requirePreregistration ? "default" : "outline"}
                      onClick={handleTogglePreregistration}
                      disabled={savingPreregSetting}
                    >
                      {savingPreregSetting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : requirePreregistration ? (
                        <>
                          <Lock className="h-4 w-4 mr-2" />
                          Enabled
                        </>
                      ) : (
                        <>
                          <Unlock className="h-4 w-4 mr-2" />
                          Disabled
                        </>
                      )}
                    </Button>
                  </div>
                  {requirePreregistration && (
                    <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                      <AlertCircle className="h-4 w-4 inline mr-2" />
                      Users must be pre-registered via CSV import before they can log in. No invitation emails are sent.
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {canAddMembers && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <UserPlus className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Invite New Members</CardTitle>
                        <CardDescription>Send an invitation email to add new members</CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <Input
                        type="email"
                        placeholder="colleague@company.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                      />
                    </div>
                    <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as typeof inviteRole)}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">Viewer</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                        {currentOrgRole === "owner" && <SelectItem value="admin">Admin</SelectItem>}
                      </SelectContent>
                    </Select>
                    <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
                      {inviting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                      Invite
                    </Button>
                  </div>

                  {/* CSV file upload section */}
                  <div className="border-t pt-4 mt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Import from CSV File</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Upload a CSV file with email addresses and names. Format: email,name (one per line)
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label
                          htmlFor="csv-upload"
                          className="flex items-center justify-center gap-2 h-10 px-4 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
                        >
                          <Upload className="h-4 w-4" />
                          {csvFileName || "Choose CSV file..."}
                        </label>
                        <input
                          id="csv-upload"
                          type="file"
                          accept=".csv,text/csv"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              setCsvFile(file)
                              setCsvFileName(file.name)
                            }
                          }}
                        />
                      </div>
                      <Button onClick={handleCsvFileUpload} disabled={importing || !csvFile}>
                        {importing ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <FileSpreadsheet className="h-4 w-4 mr-2" />
                        )}
                        Import
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Pending Invites */}
            {canManage && pendingInvites.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Pending Invitations ({pendingInvites.length})
                  </CardTitle>
                  <CardDescription>These users have been invited but haven&apos;t signed up yet.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {pendingInvites.map((invite) => (
                      <div
                        key={invite.id}
                        className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-yellow-200 text-yellow-700">
                              {invite.email.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-gray-900">{invite.email}</p>
                            <p className="text-sm text-gray-500">
                              Invited {new Date(invite.invited_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                            {invite.role}
                          </Badge>
                          <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
                            Pending
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelInvite(invite.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Members List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Members ({members.length})
                </CardTitle>
                <CardDescription>People with access to this organization</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingMembers ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : members.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No members found</p>
                ) : (
                  <div className="space-y-3">
                    {members.map((member) => (
                      <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>
                              {member.users?.full_name?.charAt(0) ||
                                member.users?.email?.charAt(0)?.toUpperCase() ||
                                "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-gray-900">
                              {member.users?.full_name || member.users?.email || "Unknown User"}
                            </p>
                            <p className="text-sm text-gray-500">{member.users?.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {getRoleIcon(member.role)}
                          {canManage && member.role !== "owner" && member.user_id !== user?.id ? (
                            <Select value={member.role} onValueChange={(value) => handleUpdateRole(member.id, value)}>
                              <SelectTrigger className="w-28">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="viewer">Viewer</SelectItem>
                                <SelectItem value="member">Member</SelectItem>
                                {currentOrgRole === "owner" && <SelectItem value="admin">Admin</SelectItem>}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge className={getRoleBadgeColor(member.role)}>{member.role}</Badge>
                          )}
                          {canManage && member.role !== "owner" && member.user_id !== user?.id && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove Member</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to remove {member.users?.email} from this organization?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleRemoveMember(member.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Remove
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Org Settings Tab Content */}
          {isOwner && !isPersonalOrg && (
            <TabsContent value="org-settings">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                    AI Settings
                  </CardTitle>
                  <CardDescription>Configure AI-powered features for your organization</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="ai-sessions">AI Answer Sessions Per Day</Label>
                      <p className="text-sm text-muted-foreground">
                        Set the maximum number of AI question sessions each user can have per day. Users can ask
                        questions about their sticks using the AI assistant.
                      </p>
                      <div className="flex items-center gap-4">
                        <Input
                          id="ai-sessions"
                          type="number"
                          min={0}
                          max={100}
                          value={aiSessionsPerDay}
                          onChange={(e) =>
                            setAiSessionsPerDay(Math.max(0, Math.min(100, Number.parseInt(e.target.value) || 0)))
                          }
                          className="w-24"
                        />
                        <span className="text-sm text-muted-foreground">sessions per user per day</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Default is 2. Set to 0 to disable AI questions for all users.
                      </p>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button onClick={handleSaveAiSettings} disabled={savingAiSettings}>
                    {savingAiSettings ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save AI Settings"
                    )}
                  </Button>
                </CardFooter>
              </Card>

              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-blue-600" />
                    Account Lockout Settings
                  </CardTitle>
                  <CardDescription>
                    Configure security settings to protect against brute force login attempts
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="max-attempts">Maximum Failed Login Attempts</Label>
                      <p className="text-sm text-muted-foreground">
                        Number of failed login attempts before an account is temporarily locked.
                      </p>
                      <div className="flex items-center gap-4">
                        <Input
                          id="max-attempts"
                          type="number"
                          min={1}
                          max={20}
                          value={maxFailedAttempts}
                          onChange={(e) =>
                            setMaxFailedAttempts(Math.max(1, Math.min(20, Number.parseInt(e.target.value) || 5)))
                          }
                          className="w-24"
                        />
                        <span className="text-sm text-muted-foreground">attempts before lockout</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Default is 5. Minimum 1, maximum 20.</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="lockout-duration">Lockout Duration</Label>
                      <p className="text-sm text-muted-foreground">
                        How long an account remains locked after exceeding failed attempts.
                      </p>
                      <div className="flex items-center gap-4">
                        <Input
                          id="lockout-duration"
                          type="number"
                          min={1}
                          max={1440}
                          value={lockoutDurationMinutes}
                          onChange={(e) =>
                            setLockoutDurationMinutes(
                              Math.max(1, Math.min(1440, Number.parseInt(e.target.value) || 15)),
                            )
                          }
                          className="w-24"
                        />
                        <span className="text-sm text-muted-foreground">minutes</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Default is 15 minutes. Maximum 1440 minutes (24 hours).
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-4 border border-blue-200 dark:border-blue-800">
                    <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">How Account Lockout Works</h4>
                    <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                      <li>
                        - After {maxFailedAttempts} failed login attempts, the account is locked for{" "}
                        {lockoutDurationMinutes} minutes
                      </li>
                      <li>- Users see remaining attempts after each failed login</li>
                      <li>- Successful login resets the failed attempt counter</li>
                      <li>- Organization owners can manually unlock accounts from the Account tab</li>
                    </ul>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button onClick={handleSaveLockoutSettings} disabled={savingLockoutSettings}>
                    {savingLockoutSettings ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Security Settings"
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="account">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-indigo-600" />
                  Pre-Registration Security
                </CardTitle>
                <CardDescription>
                  Control who can access your organization by requiring pre-registration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Current Status */}
                <div
                  className={`p-4 rounded-lg border ${requirePreregistration ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {requirePreregistration ? (
                        <Lock className="h-6 w-6 text-green-600" />
                      ) : (
                        <Unlock className="h-6 w-6 text-amber-600" />
                      )}
                      <div>
                        <h4 className={`font-semibold ${requirePreregistration ? "text-green-900" : "text-amber-900"}`}>
                          {requirePreregistration ? "Pre-Registration Required" : "Open Registration"}
                        </h4>
                        <p className={`text-sm ${requirePreregistration ? "text-green-700" : "text-amber-700"}`}>
                          {requirePreregistration
                            ? "Only pre-registered emails can join your organization"
                            : "Anyone with your domain email can join automatically"}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={handleTogglePreregistration}
                      disabled={savingPreregSetting}
                      variant={requirePreregistration ? "outline" : "default"}
                    >
                      {savingPreregSetting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : requirePreregistration ? (
                        "Disable"
                      ) : (
                        "Enable"
                      )}
                    </Button>
                  </div>
                </div>

                {/* Security Flow Explanation */}
                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-4 border border-blue-200 dark:border-blue-800">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-3">
                    How Pre-Registration Security Works
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center text-sm font-medium text-blue-800 dark:text-blue-200">
                        1
                      </div>
                      <div>
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Admin imports email list</p>
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          Go to Members tab → Import from CSV File → Upload CSV with approved emails
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center text-sm font-medium text-blue-800 dark:text-blue-200">
                        2
                      </div>
                      <div>
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                          Emails are pre-registered (no invitation sent)
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          User is added to the allowed list without notification
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center text-sm font-medium text-blue-800 dark:text-blue-200">
                        3
                      </div>
                      <div>
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">User attempts to sign up</p>
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          System checks if their email is in the pre-registered list
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-200 dark:bg-green-800 flex items-center justify-center text-sm font-medium text-green-800 dark:text-green-200">
                        ✓
                      </div>
                      <div>
                        <p className="text-sm font-medium text-green-900 dark:text-green-100">
                          Pre-registered: Access granted
                        </p>
                        <p className="text-xs text-green-700 dark:text-green-300">
                          User is automatically added as organization member
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-200 dark:bg-red-800 flex items-center justify-center text-sm font-medium text-red-800 dark:text-red-200">
                        ✗
                      </div>
                      <div>
                        <p className="text-sm font-medium text-red-900 dark:text-red-100">
                          Not pre-registered: Access denied
                        </p>
                        <p className="text-xs text-red-700 dark:text-red-300">
                          User sees "Access Denied" page with instructions to contact admin
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-blue-600" />
                  User Access Troubleshooting
                </CardTitle>
                <CardDescription>
                  Search for a user by email to check their access status and troubleshoot issues
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Enter email address..."
                      value={searchEmail}
                      onChange={(e) => setSearchEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleUserSearch()}
                    />
                  </div>
                  <Button onClick={handleUserSearch} disabled={searchingUser}>
                    {searchingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    <span className="ml-2">Search</span>
                  </Button>
                </div>

                {searchError && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-3">
                    <p className="text-red-700">{searchError}</p>
                    {searchAllowedDomains.length > 0 && (
                      <div className="pt-2 border-t border-red-200">
                        <p className="text-sm text-red-600 font-medium mb-2">
                          You can only search for users with these domains:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {searchAllowedDomains.map((domain) => (
                            <Badge key={domain} variant="outline" className="bg-white text-red-700 border-red-300">
                              @{domain}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {searchAllowedDomains.length === 0 && searchError.includes("No domains configured") && (
                      <div className="pt-2 border-t border-red-200">
                        <p className="text-sm text-red-600">
                          Go to the <strong>General</strong> tab and add your organization&apos;s email domains in the
                          &quot;Organization Domains&quot; section.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {(searchedUser || searchedPreregInfo || searchedMessage) && (
                  <div className="space-y-6">
                    {/* Access Status Summary */}
                    <div
                      className={`p-4 rounded-lg border ${
                        searchedUser && searchedMembershipInfo?.is_member
                          ? "bg-green-50 border-green-200"
                          : searchedPreregInfo?.is_preregistered
                            ? "bg-blue-50 border-blue-200"
                            : "bg-red-50 border-red-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {searchedUser && searchedMembershipInfo?.is_member ? (
                            <CheckCircle className="h-6 w-6 text-green-600" />
                          ) : searchedPreregInfo?.is_preregistered ? (
                            <Clock className="h-6 w-6 text-blue-600" />
                          ) : (
                            <XCircle className="h-6 w-6 text-red-600" />
                          )}
                          <div>
                            <h3
                              className={`font-semibold ${
                                searchedUser && searchedMembershipInfo?.is_member
                                  ? "text-green-900"
                                  : searchedPreregInfo?.is_preregistered
                                    ? "text-blue-900"
                                    : "text-red-900"
                              }`}
                            >
                              {searchedUser && searchedMembershipInfo?.is_member
                                ? "Active Member"
                                : searchedPreregInfo?.is_preregistered
                                  ? "Pre-Registered (Awaiting Sign-up)"
                                  : searchedOrgInfo?.require_preregistration
                                    ? "Not Pre-Registered - Access Will Be Denied"
                                    : "Not Pre-Registered - Can Join Freely"}
                            </h3>
                            <p
                              className={`text-sm ${
                                searchedUser && searchedMembershipInfo?.is_member
                                  ? "text-green-700"
                                  : searchedPreregInfo?.is_preregistered
                                    ? "text-blue-700"
                                    : "text-red-700"
                              }`}
                            >
                              {searchedEmail}
                            </p>
                            {searchedMessage && <p className="text-xs mt-1 text-gray-600">{searchedMessage}</p>}
                          </div>
                        </div>
                        {/* Action button for unlocking might go here if applicable */}
                      </div>
                    </div>

                    {/* Pre-Registration Status Card */}
                    {searchedPreregInfo && (
                      <Card className="border-2">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <FileSpreadsheet className="h-4 w-4 text-indigo-600" />
                            Pre-Registration Status
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid gap-3">
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <span className="text-sm text-gray-600">Record Exists</span>
                              <Badge variant={searchedPreregInfo.record_exists ? "default" : "secondary"}>
                                {searchedPreregInfo.record_exists ? "Yes" : "No"}
                              </Badge>
                            </div>
                            {searchedPreregInfo.record_exists && (
                              <>
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                  <span className="text-sm text-gray-600">Status</span>
                                  <Badge
                                    variant={
                                      searchedPreregInfo.status === "pre_registered"
                                        ? "default"
                                        : searchedPreregInfo.status === "accepted"
                                          ? "default"
                                          : "secondary"
                                    }
                                    className={
                                      searchedPreregInfo.status === "pre_registered"
                                        ? "bg-blue-500"
                                        : searchedPreregInfo.status === "accepted"
                                          ? "bg-green-500"
                                          : ""
                                    }
                                  >
                                    {searchedPreregInfo.status?.replace("_", " ") || "Unknown"}
                                  </Badge>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                  <span className="text-sm text-gray-600">Assigned Role</span>
                                  <span className="text-sm font-medium capitalize">
                                    {searchedPreregInfo.role || "member"}
                                  </span>
                                </div>
                                {searchedPreregInfo.invited_at && (
                                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <span className="text-sm text-gray-600">Pre-Registered On</span>
                                    <span className="text-sm">
                                      {new Date(searchedPreregInfo.invited_at).toLocaleDateString()}
                                    </span>
                                  </div>
                                )}
                              </>
                            )}
                            {!searchedPreregInfo.record_exists && searchedOrgInfo?.require_preregistration && (
                              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <p className="text-sm text-amber-800">
                                  <strong>Action Required:</strong> This email needs to be pre-registered before the
                                  user can access the organization. Use the "Import Members" feature in the Members tab
                                  to add this email.
                                </p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Organization Membership Card */}
                    {searchedMembershipInfo && (
                      <Card className="border-2">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Users className="h-4 w-4 text-green-600" />
                            Organization Membership
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid gap-3">
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <span className="text-sm text-gray-600">Is Member</span>
                              <Badge variant={searchedMembershipInfo.is_member ? "default" : "secondary"}>
                                {searchedMembershipInfo.is_member ? "Yes" : "No"}
                              </Badge>
                            </div>
                            {searchedMembershipInfo.is_member && (
                              <>
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                  <span className="text-sm text-gray-600">Role</span>
                                  <div className="flex items-center gap-2">
                                    {getRoleIcon(searchedMembershipInfo.role || "member")}
                                    <span className="text-sm font-medium capitalize">
                                      {searchedMembershipInfo.role}
                                    </span>
                                  </div>
                                </div>
                                {searchedMembershipInfo.joined_at && (
                                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <span className="text-sm text-gray-600">Joined</span>
                                    <span className="text-sm">
                                      {new Date(searchedMembershipInfo.joined_at).toLocaleDateString()}
                                    </span>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Organization Settings Context */}
                    {searchedOrgInfo && (
                      <Card className="border-2">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Settings className="h-4 w-4 text-gray-600" />
                            Organization Access Settings
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid gap-3">
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <span className="text-sm text-gray-600">Organization</span>
                              <span className="text-sm font-medium">{searchedOrgInfo.org_name}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <span className="text-sm text-gray-600">Domain</span>
                              <span className="text-sm">{searchedOrgInfo.domain || "Not set"}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <span className="text-sm text-gray-600">Pre-Registration Required</span>
                              <Badge variant={searchedOrgInfo.require_preregistration ? "default" : "secondary"}>
                                {searchedOrgInfo.require_preregistration ? "Yes" : "No"}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Existing User Details (only if user exists) */}
                    {searchedUser && (
                      <>
                        {searchedUser.lockout_info && (
                          <div
                            className={`p-4 rounded-lg border ${
                              searchedUser.lockout_info.is_locked_out
                                ? "bg-red-50 border-red-200"
                                : "bg-green-50 border-green-200"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {searchedUser.lockout_info.is_locked_out ? (
                                  <Lock className="h-6 w-6 text-red-600" />
                                ) : (
                                  <Unlock className="h-6 w-6 text-green-600" />
                                )}
                                <div>
                                  <h4
                                    className={`font-semibold ${
                                      searchedUser.lockout_info.is_locked_out ? "text-red-900" : "text-green-900"
                                    }`}
                                  >
                                    {searchedUser.lockout_info.is_locked_out ? "Account Locked" : "Account Active"}
                                  </h4>
                                  <p
                                    className={`text-sm ${
                                      searchedUser.lockout_info.is_locked_out ? "text-red-700" : "text-green-700"
                                    }`}
                                  >
                                    {searchedUser.lockout_info.is_locked_out
                                      ? `Locked due to ${searchedUser.lockout_info.failed_attempt_count} failed login attempts`
                                      : searchedUser.lockout_info.failed_attempt_count > 0
                                        ? `${searchedUser.lockout_info.failed_attempt_count} of ${searchedUser.lockout_info.max_failed_attempts} failed attempts`
                                        : "No recent failed login attempts"}
                                  </p>
                                  {searchedUser.lockout_info.is_locked_out &&
                                    searchedUser.lockout_info.lockout_expires_at && (
                                      <p className="text-xs text-red-600 mt-1">
                                        Auto-unlocks at:{" "}
                                        {new Date(searchedUser.lockout_info.lockout_expires_at).toLocaleString()}
                                      </p>
                                    )}
                                </div>
                              </div>
                              {searchedUser.lockout_info.is_locked_out && (
                                <Button
                                  onClick={handleUnlockAccount}
                                  disabled={unlockingAccount}
                                  variant="destructive"
                                  size="sm"
                                >
                                  {unlockingAccount ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Unlocking...
                                    </>
                                  ) : (
                                    <>
                                      <Unlock className="h-4 w-4 mr-2" />
                                      Unlock Account
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Account Information */}
                        <div className="p-6 bg-gray-50 border rounded-lg space-y-4">
                          <h4 className="font-semibold text-gray-900">Account Information</h4>

                          <div className="p-4 bg-white border rounded-lg flex items-center gap-3">
                            <User className="h-5 w-5 text-gray-400" />
                            <div>
                              <p className="text-xs text-gray-500">User ID</p>
                              <p className="font-mono text-sm">{searchedUser.id}</p>
                            </div>
                          </div>

                          <div className="p-4 bg-white border rounded-lg flex items-center gap-3">
                            <Mail className="h-5 w-5 text-gray-400" />
                            <div>
                              <p className="text-xs text-gray-500">Email</p>
                              <p className="text-sm">{searchedUser.email}</p>
                            </div>
                          </div>

                          <div className="p-4 bg-white border rounded-lg flex items-center gap-3">
                            <Clock className="h-5 w-5 text-gray-400" />
                            <div>
                              <p className="text-xs text-gray-500">Email Verified</p>
                              <p
                                className={`text-sm font-medium ${searchedUser.email_verified ? "text-green-600" : "text-orange-500"}`}
                              >
                                {searchedUser.email_verified ? "Verified" : "Not verified"}
                              </p>
                            </div>
                          </div>

                          {searchedUser.full_name && (
                            <div className="p-4 bg-white border rounded-lg flex items-center gap-3">
                              <User className="h-5 w-5 text-gray-400" />
                              <div>
                                <p className="text-xs text-gray-500">Full Name</p>
                                <p className="text-sm">{searchedUser.full_name}</p>
                              </div>
                            </div>
                          )}

                          <div className="p-4 bg-white border rounded-lg flex items-center gap-3">
                            <Clock className="h-5 w-5 text-gray-400" />
                            <div>
                              <p className="text-xs text-gray-500">Account Created</p>
                              <p className="text-sm">
                                {new Date(searchedUser.created_at).toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Security Info Cards - Keep existing */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-600" />
                  Authentication Security (Supabase Auth)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 bg-white rounded-lg border border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <h5 className="font-medium text-gray-900">Password Security</h5>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                        Provided by Supabase
                      </span>
                    </div>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Passwords hashed with bcrypt automatically</li>
                      <li>• Salt generated per password</li>
                      <li>• Plain text passwords never stored</li>
                    </ul>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <h5 className="font-medium text-gray-900">JWT Authentication</h5>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                        Provided by Supabase
                      </span>
                    </div>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Access tokens issued on login</li>
                      <li>• Refresh tokens for session renewal</li>
                      <li>• Configurable expiration times</li>
                    </ul>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <h5 className="font-medium text-gray-900">Row Level Security</h5>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                        Provided by Supabase
                      </span>
                    </div>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Database-level access control</li>
                      <li>• Policies enforce data ownership</li>
                      <li>• Users only see their own data</li>
                    </ul>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-indigo-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Lock className="h-4 w-4 text-indigo-600" />
                      <h5 className="font-medium text-gray-900">Pre-Registration Control</h5>
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
                        Custom Implementation
                      </span>
                    </div>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• CSV import for bulk pre-registration</li>
                      <li>• Email whitelist before sign-up</li>
                      <li>• Domain-based organization matching</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ADDED: New Server Configuration tab */}
          {isOwner && !isPersonalOrg && (
            <TabsContent value="server-config" className="space-y-6">
              {/* Database Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-blue-600" />
                    Database Configuration
                  </CardTitle>
                  <CardDescription>
                    Configure PostgreSQL database connection for Windows Server deployment
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="use_local_postgres"
                      checked={serverConfig.use_local_postgres}
                      onChange={(e) => setServerConfig((prev) => ({ ...prev, use_local_postgres: e.target.checked }))}
                      className="rounded"
                    />
                    <Label htmlFor="use_local_postgres">Use Local PostgreSQL (recommended)</Label>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="postgres_host">Host</Label>
                      <Input
                        id="postgres_host"
                        value={serverConfig.postgres_host}
                        onChange={(e) => setServerConfig((prev) => ({ ...prev, postgres_host: e.target.value }))}
                        placeholder="localhost"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="postgres_port">Port</Label>
                      <Input
                        id="postgres_port"
                        type="number"
                        value={serverConfig.postgres_port}
                        onChange={(e) =>
                          setServerConfig((prev) => ({ ...prev, postgres_port: Number.parseInt(e.target.value) }))
                        }
                        placeholder="5432"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="postgres_database">Database Name</Label>
                    <Input
                      id="postgres_database"
                      value={serverConfig.postgres_database}
                      onChange={(e) => setServerConfig((prev) => ({ ...prev, postgres_database: e.target.value }))}
                      placeholder="stickmynote"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="postgres_user">Username</Label>
                      <Input
                        id="postgres_user"
                        value={serverConfig.postgres_user}
                        onChange={(e) => setServerConfig((prev) => ({ ...prev, postgres_user: e.target.value }))}
                        placeholder="stickmynote_user"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="postgres_password">Password</Label>
                      <Input
                        id="postgres_password"
                        type="password"
                        value={serverConfig.postgres_password}
                        onChange={(e) => setServerConfig((prev) => ({ ...prev, postgres_password: e.target.value }))}
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <Button variant="outline" size="sm" onClick={() => handleTestServerConnection("database")}>
                    Test Database Connection
                  </Button>
                </CardContent>
              </Card>

              {/* SMTP Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5 text-green-600" />
                    Email Configuration (Exchange SMTP)
                  </CardTitle>
                  <CardDescription>Configure Exchange Server SMTP for sending emails</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="smtp_host">SMTP Host</Label>
                      <Input
                        id="smtp_host"
                        value={serverConfig.smtp_host}
                        onChange={(e) => setServerConfig((prev) => ({ ...prev, smtp_host: e.target.value }))}
                        placeholder="mail.yourdomain.local"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtp_port">SMTP Port</Label>
                      <Input
                        id="smtp_port"
                        type="number"
                        value={serverConfig.smtp_port}
                        onChange={(e) =>
                          setServerConfig((prev) => ({ ...prev, smtp_port: Number.parseInt(e.target.value) }))
                        }
                        placeholder="587"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="smtp_use_tls"
                      checked={serverConfig.smtp_use_tls}
                      onChange={(e) => setServerConfig((prev) => ({ ...prev, smtp_use_tls: e.target.checked }))}
                      className="rounded"
                    />
                    <Label htmlFor="smtp_use_tls">Use TLS/STARTTLS</Label>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="smtp_user">SMTP Username</Label>
                      <Input
                        id="smtp_user"
                        value={serverConfig.smtp_user}
                        onChange={(e) => setServerConfig((prev) => ({ ...prev, smtp_user: e.target.value }))}
                        placeholder="stickmynote@yourdomain.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtp_password">SMTP Password</Label>
                      <Input
                        id="smtp_password"
                        type="password"
                        value={serverConfig.smtp_password}
                        onChange={(e) => setServerConfig((prev) => ({ ...prev, smtp_password: e.target.value }))}
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="smtp_from_email">From Email Address</Label>
                      <Input
                        id="smtp_from_email"
                        type="email"
                        value={serverConfig.smtp_from_email}
                        onChange={(e) => setServerConfig((prev) => ({ ...prev, smtp_from_email: e.target.value }))}
                        placeholder="noreply@stickmynote.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtp_from_name">From Name</Label>
                      <Input
                        id="smtp_from_name"
                        value={serverConfig.smtp_from_name}
                        onChange={(e) => setServerConfig((prev) => ({ ...prev, smtp_from_name: e.target.value }))}
                        placeholder="Stick My Note"
                      />
                    </div>
                  </div>

                  <Button variant="outline" size="sm" onClick={() => handleTestServerConnection("smtp")}>
                    Test Email Connection
                  </Button>
                </CardContent>
              </Card>

              {/* Redis Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-red-600" />
                    Redis Configuration
                  </CardTitle>
                  <CardDescription>Configure Redis for caching and rate limiting</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="use_local_redis"
                      checked={serverConfig.use_local_redis}
                      onChange={(e) => setServerConfig((prev) => ({ ...prev, use_local_redis: e.target.checked }))}
                      className="rounded"
                    />
                    <Label htmlFor="use_local_redis">Use Local Redis (recommended)</Label>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="redis_host">Host</Label>
                      <Input
                        id="redis_host"
                        value={serverConfig.redis_host}
                        onChange={(e) => setServerConfig((prev) => ({ ...prev, redis_host: e.target.value }))}
                        placeholder="localhost"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="redis_port">Port</Label>
                      <Input
                        id="redis_port"
                        type="number"
                        value={serverConfig.redis_port}
                        onChange={(e) =>
                          setServerConfig((prev) => ({ ...prev, redis_port: Number.parseInt(e.target.value) }))
                        }
                        placeholder="6379"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="redis_database">Database</Label>
                      <Input
                        id="redis_database"
                        type="number"
                        value={serverConfig.redis_database}
                        onChange={(e) =>
                          setServerConfig((prev) => ({ ...prev, redis_database: Number.parseInt(e.target.value) }))
                        }
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="redis_password">Password (optional)</Label>
                    <Input
                      id="redis_password"
                      type="password"
                      value={serverConfig.redis_password}
                      onChange={(e) => setServerConfig((prev) => ({ ...prev, redis_password: e.target.value }))}
                      placeholder="••••••••"
                    />
                  </div>

                  <Button variant="outline" size="sm" onClick={() => handleTestServerConnection("redis")}>
                    Test Redis Connection
                  </Button>
                </CardContent>
              </Card>

              {/* File Storage Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HardDrive className="h-5 w-5 text-purple-600" />
                    File Storage Configuration
                  </CardTitle>
                  <CardDescription>Configure local Windows Server file storage paths</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="use_local_storage"
                      checked={serverConfig.use_local_storage}
                      onChange={(e) => setServerConfig((prev) => ({ ...prev, use_local_storage: e.target.checked }))}
                      className="rounded"
                    />
                    <Label htmlFor="use_local_storage">Use Local File Storage (recommended)</Label>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="storage_path">Storage Path</Label>
                    <Input
                      id="storage_path"
                      value={serverConfig.storage_path}
                      onChange={(e) => setServerConfig((prev) => ({ ...prev, storage_path: e.target.value }))}
                      placeholder="C:\inetpub\stickmynote\uploads"
                    />
                    <p className="text-xs text-muted-foreground">
                      Ensure IIS_IUSRS has modify permissions on this directory
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="storage_max_file_size_mb">Max File Size (MB)</Label>
                    <Input
                      id="storage_max_file_size_mb"
                      type="number"
                      value={serverConfig.storage_max_file_size_mb}
                      onChange={(e) =>
                        setServerConfig((prev) => ({
                          ...prev,
                          storage_max_file_size_mb: Number.parseInt(e.target.value),
                        }))
                      }
                      placeholder="10"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Application Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-indigo-600" />
                    Application Settings
                  </CardTitle>
                  <CardDescription>General application configuration for Windows Server deployment</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="app_name">Application Name</Label>
                    <Input
                      id="app_name"
                      value={serverConfig.app_name}
                      onChange={(e) => setServerConfig((prev) => ({ ...prev, app_name: e.target.value }))}
                      placeholder="Stick My Note"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="app_url">Application URL</Label>
                    <Input
                      id="app_url"
                      type="url"
                      value={serverConfig.app_url}
                      onChange={(e) => setServerConfig((prev) => ({ ...prev, app_url: e.target.value }))}
                      placeholder="https://www.stickmynote.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Input
                      id="timezone"
                      value={serverConfig.timezone}
                      onChange={(e) => setServerConfig((prev) => ({ ...prev, timezone: e.target.value }))}
                      placeholder="America/New_York"
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button onClick={handleSaveServerConfig} disabled={savingServerConfig}>
                    {savingServerConfig ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Server Configuration"
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  )
}

export default OrganizationSettingsPage
