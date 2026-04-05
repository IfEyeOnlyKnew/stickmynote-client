"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Loader2,
  ShieldAlert,
  Save,
  Globe,
  Scan,
  Tag,
  X,
  Plus,
  Info,
} from "lucide-react"
import { getCsrfToken } from "@/lib/client-csrf"
import { useToast } from "@/hooks/use-toast"
import type { DLPSettings } from "@/types/organization"

interface DLPTabProps {
  currentOrgId: string
}

const DEFAULT_DLP: DLPSettings = {
  block_community_sharing: false,
  block_public_pads: false,
  block_ical_feeds: false,
  block_external_webhooks: false,
  block_video_external_invite: false,
  allowed_webhook_domains: [],
  allowed_invite_domains: [],
  content_scanning_enabled: false,
  scan_patterns: [],
  scan_action: "warn",
  require_classification: false,
  default_sensitivity: "internal",
}

export function DLPTab({ currentOrgId }: Readonly<DLPTabProps>) {
  const [dlp, setDlp] = useState<DLPSettings>(DEFAULT_DLP)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [newWebhookDomain, setNewWebhookDomain] = useState("")
  const [newInviteDomain, setNewInviteDomain] = useState("")
  const [newCustomPattern, setNewCustomPattern] = useState("")
  const { toast } = useToast()

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/organizations/${currentOrgId}`)
      if (!res.ok) throw new Error("Failed to load")
      const data = await res.json()
      const orgSettings = data.organization?.settings || data.settings || {}
      setDlp({ ...DEFAULT_DLP, ...orgSettings.dlp })
    } catch (error) {
      console.error("[DLP] Load error:", error)
      toast({ title: "Error", description: "Failed to load DLP settings", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [currentOrgId, toast])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const updateDLP = (updates: Partial<DLPSettings>) => {
    setDlp((prev) => ({ ...prev, ...updates }))
    setHasChanges(true)
  }

  const saveSettings = async () => {
    try {
      setSaving(true)
      const csrfToken = await getCsrfToken()
      const res = await fetch(`/api/organizations/${currentOrgId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
        },
        body: JSON.stringify({ settings: { dlp } }),
      })
      if (!res.ok) throw new Error("Failed to save")
      setHasChanges(false)
      toast({ title: "Saved", description: "DLP settings updated successfully" })
    } catch (error) {
      console.error("[DLP] Save error:", error)
      toast({ title: "Error", description: "Failed to save DLP settings", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const addDomain = (type: "webhook" | "invite") => {
    const value = type === "webhook" ? newWebhookDomain.trim().toLowerCase() : newInviteDomain.trim().toLowerCase()
    if (!value) return

    const key = type === "webhook" ? "allowed_webhook_domains" : "allowed_invite_domains"
    const current = dlp[key] || []
    if (current.includes(value)) return

    updateDLP({ [key]: [...current, value] })
    if (type === "webhook") setNewWebhookDomain("")
    else setNewInviteDomain("")
  }

  const removeDomain = (type: "webhook" | "invite", domain: string) => {
    const key = type === "webhook" ? "allowed_webhook_domains" : "allowed_invite_domains"
    const current = dlp[key] || []
    updateDLP({ [key]: current.filter((d) => d !== domain) })
  }

  const addCustomPattern = () => {
    const value = newCustomPattern.trim()
    if (!value) return

    // Validate regex
    try {
      new RegExp(value)
    } catch {
      toast({ title: "Invalid Pattern", description: "Please enter a valid regular expression", variant: "destructive" })
      return
    }

    const current = dlp.scan_patterns || []
    if (current.includes(value)) return

    updateDLP({ scan_patterns: [...current, value] })
    setNewCustomPattern("")
  }

  const removeCustomPattern = (pattern: string) => {
    const current = dlp.scan_patterns || []
    updateDLP({ scan_patterns: current.filter((p) => p !== pattern) })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            Data Loss Prevention
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Control how data leaves your organization. All controls are off by default.
          </p>
        </div>
        {hasChanges && (
          <Button onClick={saveSettings} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        )}
      </div>

      {/* Sharing Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Sharing Controls
          </CardTitle>
          <CardDescription>
            Block specific types of external data sharing across your organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Block Community Note Sharing</Label>
              <p className="text-sm text-muted-foreground">Prevent members from sharing notes publicly to the community.</p>
            </div>
            <Switch
              checked={dlp.block_community_sharing || false}
              onCheckedChange={(checked) => updateDLP({ block_community_sharing: checked })}
            />
          </div>

          <div className="border-t pt-4 flex items-center justify-between">
            <div>
              <Label>Block Public Pads</Label>
              <p className="text-sm text-muted-foreground">Prevent social pads from being made publicly accessible.</p>
            </div>
            <Switch
              checked={dlp.block_public_pads || false}
              onCheckedChange={(checked) => updateDLP({ block_public_pads: checked })}
            />
          </div>

          <div className="border-t pt-4 flex items-center justify-between">
            <div>
              <Label>Block iCal Feed Generation</Label>
              <p className="text-sm text-muted-foreground">Prevent members from creating calendar feed tokens for external apps.</p>
            </div>
            <Switch
              checked={dlp.block_ical_feeds || false}
              onCheckedChange={(checked) => updateDLP({ block_ical_feeds: checked })}
            />
          </div>

          <div className="border-t pt-4 flex items-center justify-between">
            <div>
              <Label>Block External Webhooks</Label>
              <p className="text-sm text-muted-foreground">Prevent members from sending data to external webhook URLs.</p>
            </div>
            <Switch
              checked={dlp.block_external_webhooks || false}
              onCheckedChange={(checked) => updateDLP({ block_external_webhooks: checked })}
            />
          </div>

          <div className="border-t pt-4 flex items-center justify-between">
            <div>
              <Label>Block External Video Invites</Label>
              <p className="text-sm text-muted-foreground">Prevent members from inviting external email addresses to video rooms.</p>
            </div>
            <Switch
              checked={dlp.block_video_external_invite || false}
              onCheckedChange={(checked) => updateDLP({ block_video_external_invite: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Domain Whitelists */}
      {(!dlp.block_external_webhooks || !dlp.block_video_external_invite) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Domain Whitelists
            </CardTitle>
            <CardDescription>
              When sharing is allowed, restrict destinations to approved domains only. Leave empty to allow all domains.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Webhook domains */}
            {!dlp.block_external_webhooks && (
              <div className="space-y-3">
                <Label>Allowed Webhook Domains</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. slack.com"
                    value={newWebhookDomain}
                    onChange={(e) => setNewWebhookDomain(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addDomain("webhook")}
                  />
                  <Button variant="outline" size="sm" onClick={() => addDomain("webhook")}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(dlp.allowed_webhook_domains || []).map((domain) => (
                    <Badge key={domain} variant="secondary" className="gap-1">
                      {domain}
                      <button onClick={() => removeDomain("webhook", domain)} className="ml-1 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {(dlp.allowed_webhook_domains || []).length === 0 && (
                    <span className="text-sm text-muted-foreground">No restrictions — all domains allowed</span>
                  )}
                </div>
              </div>
            )}

            {/* Invite domains */}
            {!dlp.block_video_external_invite && (
              <div className="space-y-3">
                <Label>Allowed Invite Domains</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. partner.com"
                    value={newInviteDomain}
                    onChange={(e) => setNewInviteDomain(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addDomain("invite")}
                  />
                  <Button variant="outline" size="sm" onClick={() => addDomain("invite")}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(dlp.allowed_invite_domains || []).map((domain) => (
                    <Badge key={domain} variant="secondary" className="gap-1">
                      {domain}
                      <button onClick={() => removeDomain("invite", domain)} className="ml-1 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {(dlp.allowed_invite_domains || []).length === 0 && (
                    <span className="text-sm text-muted-foreground">No restrictions — all domains allowed</span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Content Scanning */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Scan className="h-4 w-4" />
            Content Scanning
          </CardTitle>
          <CardDescription>
            Scan content for sensitive data patterns (SSN, credit cards, API keys) before allowing external sharing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Content Scanning</Label>
              <p className="text-sm text-muted-foreground">Automatically detect sensitive data when members share content.</p>
            </div>
            <Switch
              checked={dlp.content_scanning_enabled || false}
              onCheckedChange={(checked) => updateDLP({ content_scanning_enabled: checked })}
            />
          </div>

          {dlp.content_scanning_enabled && (
            <>
              <div className="border-t pt-4 space-y-3">
                <Label>Action on Detection</Label>
                <Select
                  value={dlp.scan_action || "warn"}
                  onValueChange={(value) => updateDLP({ scan_action: value as "warn" | "block" })}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warn">Warn User</SelectItem>
                    <SelectItem value="block">Block Sharing</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {dlp.scan_action === "block"
                    ? "Content with detected sensitive data will be blocked from sharing."
                    : "Users will see a warning but can choose to proceed."}
                </p>
              </div>

              <div className="border-t pt-4 space-y-3">
                <Label>Built-in Patterns</Label>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>The following patterns are always checked when scanning is enabled:</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge variant="outline">Social Security Numbers</Badge>
                    <Badge variant="outline">Credit Card Numbers</Badge>
                    <Badge variant="outline">Phone Numbers</Badge>
                    <Badge variant="outline">API Keys / Secrets</Badge>
                    <Badge variant="outline">IP Addresses</Badge>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <Label>Custom Patterns (Regex)</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. PROJ-\d{4}"
                    value={newCustomPattern}
                    onChange={(e) => setNewCustomPattern(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addCustomPattern()}
                    className="font-mono text-sm"
                  />
                  <Button variant="outline" size="sm" onClick={addCustomPattern}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(dlp.scan_patterns || []).map((pattern) => (
                    <Badge key={pattern} variant="secondary" className="gap-1 font-mono text-xs">
                      {pattern}
                      <button onClick={() => removeCustomPattern(pattern)} className="ml-1 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Classification */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Content Classification
          </CardTitle>
          <CardDescription>
            Require members to classify content sensitivity before sharing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Require Classification Before Sharing</Label>
              <p className="text-sm text-muted-foreground">Members must set a sensitivity level before sharing notes or making pads public.</p>
            </div>
            <Switch
              checked={dlp.require_classification || false}
              onCheckedChange={(checked) => updateDLP({ require_classification: checked })}
            />
          </div>

          <div className="border-t pt-4 space-y-3">
            <Label>Default Sensitivity Level</Label>
            <Select
              value={dlp.default_sensitivity || "internal"}
              onValueChange={(value) => updateDLP({ default_sensitivity: value as DLPSettings["default_sensitivity"] })}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="internal">Internal</SelectItem>
                <SelectItem value="confidential">Confidential</SelectItem>
                <SelectItem value="restricted">Restricted</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Content classified as <strong>Confidential</strong> or <strong>Restricted</strong> is automatically blocked from external sharing, regardless of other settings.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Save button (bottom) */}
      {hasChanges && (
        <div className="flex justify-end">
          <Button onClick={saveSettings} disabled={saving} size="lg">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save DLP Settings
          </Button>
        </div>
      )}
    </div>
  )
}
