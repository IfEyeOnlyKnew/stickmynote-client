"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Loader2,
  ClipboardCheck,
  Save,
  CheckCircle2,
  XCircle,
  Info,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Shield,
  Globe,
  Heart,
  Building2,
  Gavel,
  Download,
} from "lucide-react"
import { getCsrfToken } from "@/lib/client-csrf"
import { useToast } from "@/hooks/use-toast"
import type { ComplianceSettings } from "@/types/organization"
import type { LegalHold } from "@/types/legal-hold"

interface ComplianceTabProps {
  currentOrgId: string
}

interface ControlStatus {
  id: string
  name: string
  description: string
  status: "pass" | "fail" | "info"
  settingsTab?: string
}

interface FrameworkStatus {
  id: string
  name: string
  description: string
  controls: ControlStatus[]
  passCount: number
  totalCount: number
  readinessPercent: number
}

interface OrgMember {
  user_id: string
  email: string
  full_name?: string
  role: string
}

const DEFAULT_COMPLIANCE: ComplianceSettings = {}

const FRAMEWORK_ICONS: Record<string, typeof Shield> = {
  soc2: Shield,
  iso27001: Building2,
  gdpr: Globe,
  hipaa: Heart,
}

const RETENTION_OPTIONS = [
  { value: "__none", label: "Not configured" },
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" },
  { value: "180", label: "180 days" },
  { value: "365", label: "1 year" },
  { value: "0", label: "Indefinite" },
]

const RESIDENCY_OPTIONS = [
  { value: "on-premise", label: "On-Premise (Self-Hosted)" },
  { value: "us-east", label: "US East" },
  { value: "us-west", label: "US West" },
  { value: "eu-west", label: "EU West" },
  { value: "eu-central", label: "EU Central" },
  { value: "ap-southeast", label: "Asia Pacific" },
]

function getReadinessBadge(percent: number) {
  if (percent >= 80) {
    return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">{percent}%</Badge>
  }
  if (percent >= 50) {
    return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">{percent}%</Badge>
  }
  return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">{percent}%</Badge>
}

function ControlRow({ control }: Readonly<{ control: ControlStatus }>) {
  return (
    <div className="flex items-start gap-3 py-2">
      {control.status === "pass" && <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />}
      {control.status === "fail" && <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />}
      {control.status === "info" && <Info className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{control.name}</p>
        <p className="text-xs text-muted-foreground">{control.description}</p>
      </div>
      {control.status === "fail" && control.settingsTab && control.settingsTab !== "compliance" && (
        <span className="text-xs text-blue-600 flex items-center gap-1 shrink-0">
          <ExternalLink className="h-3 w-3" />
          {control.settingsTab.replace("-", " ")}
        </span>
      )}
    </div>
  )
}

function FrameworkCard({ framework }: Readonly<{ framework: FrameworkStatus }>) {
  const [expanded, setExpanded] = useState(false)
  const Icon = FRAMEWORK_ICONS[framework.id] || Shield

  return (
    <Card>
      <CardHeader className="pb-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-base">{framework.name}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {getReadinessBadge(framework.readinessPercent)}
            {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </div>
        </div>
        <CardDescription className="text-xs">
          {framework.description} &mdash; {framework.passCount} of {framework.totalCount} controls passing
        </CardDescription>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0">
          <div className="divide-y">
            {framework.controls.map((control) => (
              <ControlRow key={control.id} control={control} />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

export function ComplianceTab({ currentOrgId }: Readonly<ComplianceTabProps>) {
  const [frameworks, setFrameworks] = useState<FrameworkStatus[]>([])
  const [compliance, setCompliance] = useState<ComplianceSettings>(DEFAULT_COMPLIANCE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [holds, setHolds] = useState<LegalHold[]>([])
  const [members, setMembers] = useState<OrgMember[]>([])
  const [creatingHold, setCreatingHold] = useState(false)
  const [holdForm, setHoldForm] = useState({ userId: "", holdName: "", description: "" })
  const [exporting, setExporting] = useState(false)
  const [exportForm, setExportForm] = useState({ userId: "", dateFrom: "", dateTo: "" })
  const { toast } = useToast()

  const loadData = useCallback(async () => {
    try {
      setLoading(true)

      const [statusRes, orgRes, holdsRes, membersRes] = await Promise.all([
        fetch(`/api/organizations/${currentOrgId}/compliance/status`),
        fetch(`/api/organizations/${currentOrgId}`),
        fetch(`/api/organizations/${currentOrgId}/legal-holds`),
        fetch(`/api/organizations/${currentOrgId}/members`),
      ])

      if (statusRes.ok) {
        const data = await statusRes.json()
        setFrameworks(data.frameworks || [])
      }

      if (orgRes.ok) {
        const data = await orgRes.json()
        const settings = data.organization?.settings || {}
        if (settings.compliance) {
          setCompliance(settings.compliance)
        }
      }

      if (holdsRes.ok) {
        const data = await holdsRes.json()
        setHolds(data.holds || [])
      }

      if (membersRes.ok) {
        const data = await membersRes.json()
        const mapped: OrgMember[] = (data.members || []).map((m: { user_id: string; role: string; users?: { email?: string; full_name?: string } | null }) => ({
          user_id: m.user_id,
          role: m.role,
          email: m.users?.email || "",
          full_name: m.users?.full_name,
        }))
        setMembers(mapped)
      }
    } catch (error) {
      console.error("[Compliance] Load error:", error)
      toast({ title: "Error", description: "Failed to load compliance data", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [currentOrgId, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const updateCompliance = (updates: Partial<ComplianceSettings>) => {
    setCompliance((prev) => ({ ...prev, ...updates }))
    setHasChanges(true)
  }

  const saveSettings = async () => {
    try {
      setSaving(true)
      const csrfToken = await getCsrfToken()

      // Fetch latest org to get current settings for safe merge
      const orgRes = await fetch(`/api/organizations/${currentOrgId}`)
      if (!orgRes.ok) throw new Error("Failed to fetch org")
      const orgData = await orgRes.json()
      const currentSettings = orgData.organization?.settings || {}

      const mergedSettings = { ...currentSettings, compliance }

      const res = await fetch(`/api/organizations/${currentOrgId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
        },
        body: JSON.stringify({ settings: mergedSettings }),
      })
      if (!res.ok) throw new Error("Failed to save")

      setHasChanges(false)
      toast({ title: "Saved", description: "Compliance settings updated successfully" })

      // Reload compliance status to reflect changes
      const statusRes = await fetch(`/api/organizations/${currentOrgId}/compliance/status`)
      if (statusRes.ok) {
        const data = await statusRes.json()
        setFrameworks(data.frameworks || [])
      }
    } catch (error) {
      console.error("[Compliance] Save error:", error)
      toast({ title: "Error", description: "Failed to save compliance settings", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const createHold = async () => {
    if (!holdForm.userId || !holdForm.holdName.trim()) {
      toast({ title: "Error", description: "Select a member and enter a hold name", variant: "destructive" })
      return
    }
    try {
      setCreatingHold(true)
      const csrfToken = await getCsrfToken()
      const res = await fetch(`/api/organizations/${currentOrgId}/legal-holds`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
        },
        body: JSON.stringify({
          userId: holdForm.userId,
          holdName: holdForm.holdName.trim(),
          description: holdForm.description.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to create hold")
      }
      setHoldForm({ userId: "", holdName: "", description: "" })
      toast({ title: "Legal Hold Created", description: "The user's content is now protected from deletion" })
      // Reload holds
      const holdsRes = await fetch(`/api/organizations/${currentOrgId}/legal-holds`)
      if (holdsRes.ok) {
        const data = await holdsRes.json()
        setHolds(data.holds || [])
      }
    } catch (error) {
      console.error("[LegalHold] Create error:", error)
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to create legal hold", variant: "destructive" })
    } finally {
      setCreatingHold(false)
    }
  }

  const releaseHold = async (holdId: string) => {
    try {
      const csrfToken = await getCsrfToken()
      const res = await fetch(`/api/organizations/${currentOrgId}/legal-holds/${holdId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
        },
        body: JSON.stringify({ action: "release" }),
      })
      if (!res.ok) throw new Error("Failed to release hold")
      toast({ title: "Hold Released", description: "The legal hold has been released" })
      // Reload holds
      const holdsRes = await fetch(`/api/organizations/${currentOrgId}/legal-holds`)
      if (holdsRes.ok) {
        const data = await holdsRes.json()
        setHolds(data.holds || [])
      }
    } catch (error) {
      console.error("[LegalHold] Release error:", error)
      toast({ title: "Error", description: "Failed to release legal hold", variant: "destructive" })
    }
  }

  const runExport = async () => {
    if (!exportForm.userId) {
      toast({ title: "Error", description: "Select a member to export", variant: "destructive" })
      return
    }
    try {
      setExporting(true)
      const csrfToken = await getCsrfToken()
      const res = await fetch(`/api/organizations/${currentOrgId}/ediscovery/export`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
        },
        body: JSON.stringify({
          userId: exportForm.userId,
          dateFrom: exportForm.dateFrom || undefined,
          dateTo: exportForm.dateTo || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to export")
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `ediscovery-${exportForm.userId}-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast({ title: "Export Complete", description: "eDiscovery data has been downloaded" })
    } catch (error) {
      console.error("[eDiscovery] Export error:", error)
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to export data", variant: "destructive" })
    } finally {
      setExporting(false)
    }
  }

  const activeHolds = holds.filter((h) => h.status === "active")
  const releasedHolds = holds.filter((h) => h.status === "released")

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const retentionValue =
    compliance.data_retention_days !== undefined && compliance.data_retention_days !== null
      ? String(compliance.data_retention_days)
      : "__none"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Compliance Certifications
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Readiness assessment across SOC 2, ISO 27001, GDPR, and HIPAA frameworks.
          </p>
        </div>
        {hasChanges && (
          <Button onClick={saveSettings} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        )}
      </div>

      {/* Framework Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {frameworks.map((fw) => (
          <FrameworkCard key={fw.id} framework={fw} />
        ))}
      </div>

      {/* GDPR Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4 text-blue-600" />
            GDPR Settings
          </CardTitle>
          <CardDescription>EU General Data Protection Regulation controls</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Data Retention Policy */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Data Retention Period</Label>
              <p className="text-xs text-muted-foreground">
                How long user content is retained before eligible for cleanup
              </p>
            </div>
            <Select
              value={retentionValue}
              onValueChange={(val) => {
                if (val === "__none") {
                  const { data_retention_days, ...rest } = compliance
                  setCompliance(rest)
                } else {
                  updateCompliance({ data_retention_days: Number(val) })
                }
                setHasChanges(true)
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RETENTION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* DPA */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Data Processing Agreement (DPA)</Label>
              <p className="text-xs text-muted-foreground">
                Acknowledge that a DPA is in place for this organization
              </p>
              {compliance.dpa_accepted && compliance.dpa_accepted_at && (
                <p className="text-xs text-green-600">
                  Accepted on {new Date(compliance.dpa_accepted_at).toLocaleDateString()}
                  {compliance.dpa_accepted_by ? ` by ${compliance.dpa_accepted_by}` : ""}
                </p>
              )}
            </div>
            <Switch
              checked={compliance.dpa_accepted ?? false}
              onCheckedChange={(checked) => {
                if (checked) {
                  updateCompliance({
                    dpa_accepted: true,
                    dpa_accepted_at: new Date().toISOString(),
                  })
                } else {
                  updateCompliance({
                    dpa_accepted: false,
                    dpa_accepted_at: undefined,
                    dpa_accepted_by: undefined,
                  })
                }
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* HIPAA Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Heart className="h-4 w-4 text-red-500" />
            HIPAA Settings
          </CardTitle>
          <CardDescription>Health Insurance Portability and Accountability Act controls</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Business Associate Agreement (BAA)</Label>
              <p className="text-xs text-muted-foreground">
                Acknowledge that a BAA has been signed for this organization
              </p>
              {compliance.hipaa_baa_signed && compliance.hipaa_baa_signed_at && (
                <p className="text-xs text-green-600">
                  Signed on {new Date(compliance.hipaa_baa_signed_at).toLocaleDateString()}
                  {compliance.hipaa_baa_signed_by ? ` by ${compliance.hipaa_baa_signed_by}` : ""}
                </p>
              )}
            </div>
            <Switch
              checked={compliance.hipaa_baa_signed ?? false}
              onCheckedChange={(checked) => {
                if (checked) {
                  updateCompliance({
                    hipaa_baa_signed: true,
                    hipaa_baa_signed_at: new Date().toISOString(),
                  })
                } else {
                  updateCompliance({
                    hipaa_baa_signed: false,
                    hipaa_baa_signed_at: undefined,
                    hipaa_baa_signed_by: undefined,
                  })
                }
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Data Residency */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-indigo-600" />
            Data Residency
          </CardTitle>
          <CardDescription>Where your organization data is physically stored</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Data Storage Region</Label>
              <p className="text-xs text-muted-foreground">
                Select the region that matches your deployment
              </p>
            </div>
            <Select
              value={compliance.data_residency_region || "on-premise"}
              onValueChange={(val) => updateCompliance({ data_residency_region: val })}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESIDENCY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              This is a self-hosted deployment. Database is on HOL-DC3-PGSQL and application files are on HOL-DC2-IIS.
              All data remains within your network infrastructure.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Legal Holds */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Gavel className="h-4 w-4 text-orange-600" />
            Legal Holds
          </CardTitle>
          <CardDescription>
            Place litigation holds on users to prevent deletion of their content
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Create hold form */}
          <div className="border rounded-lg p-4 space-y-3">
            <Label className="text-sm font-medium">Create New Hold</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Custodian</Label>
                <Select
                  value={holdForm.userId || "__none"}
                  onValueChange={(val) => setHoldForm((prev) => ({ ...prev, userId: val === "__none" ? "" : val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select member" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Select member...</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.full_name || m.email} ({m.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Hold Name</Label>
                <Input
                  placeholder="e.g. Smith v. Company 2026"
                  value={holdForm.holdName}
                  onChange={(e) => setHoldForm((prev) => ({ ...prev, holdName: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Description (optional)</Label>
              <Textarea
                placeholder="Details about the legal matter..."
                value={holdForm.description}
                onChange={(e) => setHoldForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>
            <Button onClick={createHold} disabled={creatingHold} size="sm">
              {creatingHold ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Gavel className="h-4 w-4 mr-2" />}
              Place Hold
            </Button>
          </div>

          {/* Active holds */}
          {activeHolds.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Active Holds ({activeHolds.length})</Label>
              <div className="border rounded-lg divide-y">
                {activeHolds.map((hold) => (
                  <div key={hold.id} className="flex items-center justify-between p-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{hold.hold_name}</p>
                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300 text-xs">Active</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {hold.user_email || hold.user_full_name || hold.user_id}
                        {" \u2022 "}Created {new Date(hold.created_at).toLocaleDateString()}
                        {hold.created_by_email ? ` by ${hold.created_by_email}` : ""}
                      </p>
                      {hold.description && (
                        <p className="text-xs text-muted-foreground mt-1">{hold.description}</p>
                      )}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => releaseHold(hold.id)}>
                      Release
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Released holds */}
          {releasedHolds.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Released Holds ({releasedHolds.length})</Label>
              <div className="border rounded-lg divide-y opacity-60">
                {releasedHolds.map((hold) => (
                  <div key={hold.id} className="p-3">
                    <div className="flex items-center gap-2">
                      <p className="text-sm">{hold.hold_name}</p>
                      <Badge variant="outline" className="text-xs">Released</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {hold.user_email || hold.user_id}
                      {" \u2022 "}Released {hold.released_at ? new Date(hold.released_at).toLocaleDateString() : ""}
                      {hold.released_by_email ? ` by ${hold.released_by_email}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {holds.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No legal holds have been created yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* eDiscovery Export */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="h-4 w-4 text-purple-600" />
            eDiscovery Export
          </CardTitle>
          <CardDescription>
            Export all content for a specific user for legal discovery or compliance purposes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">User</Label>
              <Select
                value={exportForm.userId || "__none"}
                onValueChange={(val) => setExportForm((prev) => ({ ...prev, userId: val === "__none" ? "" : val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Select member...</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.full_name || m.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">From Date (optional)</Label>
              <Input
                type="date"
                value={exportForm.dateFrom}
                onChange={(e) => setExportForm((prev) => ({ ...prev, dateFrom: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">To Date (optional)</Label>
              <Input
                type="date"
                value={exportForm.dateTo}
                onChange={(e) => setExportForm((prev) => ({ ...prev, dateTo: e.target.value }))}
              />
            </div>
          </div>
          <Button onClick={runExport} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Export Data
          </Button>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Exports include personal sticks, pad sticks, social sticks, replies, social pads,
              messages, calendar events, and audit trail entries. Maximum 10,000 records per category.
              All exports are logged in the audit trail.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}
