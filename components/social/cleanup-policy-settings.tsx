"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Archive, Trash2, Clock, Shield, Loader2, Save, RotateCcw } from "lucide-react"
import { toast } from "sonner"

type CleanupPolicy = {
  social_pad_id: string
  auto_archive_enabled: boolean
  archive_after_days: number
  archive_after_replies: number | null
  auto_delete_enabled: boolean
  delete_archived_after_days: number
  max_sticks_per_pad: number | null
  max_sticks_per_user: number | null
  auto_close_resolved_enabled: boolean
  close_resolved_after_days: number
  exempt_pinned_sticks: boolean
  exempt_workflow_active: boolean
}

type CleanupPolicySettingsProps = {
  padId: string
  padName: string
}

export function CleanupPolicySettings({ padId, padName }: CleanupPolicySettingsProps) {
  const [policy, setPolicy] = useState<CleanupPolicy | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    fetchPolicy()
  }, [padId])

  const fetchPolicy = async () => {
    try {
      const res = await fetch(`/api/social-pads/${padId}/cleanup-policy`)
      const data = await res.json()
      if (data.policy) {
        setPolicy(data.policy)
      }
    } catch (error) {
      toast.error("Failed to load cleanup policy")
    } finally {
      setIsLoading(false)
    }
  }

  const updatePolicy = (field: keyof CleanupPolicy, value: unknown) => {
    if (!policy) return
    setPolicy({ ...policy, [field]: value })
    setHasChanges(true)
  }

  const savePolicy = async () => {
    if (!policy) return
    setIsSaving(true)

    try {
      const res = await fetch(`/api/social-pads/${padId}/cleanup-policy`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policy),
      })

      if (!res.ok) {
        throw new Error("Failed to save")
      }

      toast.success("Cleanup policy saved successfully")
      setHasChanges(false)
    } catch (error) {
      toast.error("Failed to save cleanup policy")
    } finally {
      setIsSaving(false)
    }
  }

  const resetPolicy = async () => {
    if (!confirm("Reset cleanup policy to defaults? This will disable all automatic cleanup.")) return

    try {
      await fetch(`/api/social-pads/${padId}/cleanup-policy`, { method: "DELETE" })
      await fetchPolicy()
      toast.success("Policy reset to defaults")
      setHasChanges(false)
    } catch (error) {
      toast.error("Failed to reset policy")
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!policy) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Cleanup Policies</h2>
          <p className="text-muted-foreground">Configure automatic content management for {padName}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetPolicy} disabled={isSaving}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button onClick={savePolicy} disabled={!hasChanges || isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Auto-Archive Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" />
            Auto-Archive Inactive Sticks
          </CardTitle>
          <CardDescription>Automatically archive sticks that have been inactive for a specified period</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="auto-archive">Enable auto-archive</Label>
            <Switch
              id="auto-archive"
              checked={policy.auto_archive_enabled}
              onCheckedChange={(checked) => updatePolicy("auto_archive_enabled", checked)}
            />
          </div>

          {policy.auto_archive_enabled && (
            <div className="space-y-4 pl-4 border-l-2 border-muted">
              <div className="space-y-2">
                <Label htmlFor="archive-days">Archive after days of inactivity</Label>
                <Input
                  id="archive-days"
                  type="number"
                  min={1}
                  max={365}
                  value={policy.archive_after_days}
                  onChange={(e) => updatePolicy("archive_after_days", Number.parseInt(e.target.value) || 90)}
                  className="w-32"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-sticks">Maximum sticks in hub (optional)</Label>
                <Input
                  id="max-sticks"
                  type="number"
                  min={10}
                  placeholder="No limit"
                  value={policy.max_sticks_per_pad || ""}
                  onChange={(e) =>
                    updatePolicy("max_sticks_per_pad", e.target.value ? Number.parseInt(e.target.value) : null)
                  }
                  className="w-32"
                />
                <p className="text-xs text-muted-foreground">Oldest sticks will be archived when limit is exceeded</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auto-Delete Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Auto-Delete Archived Sticks
          </CardTitle>
          <CardDescription>Permanently delete archived sticks after a specified period</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertDescription>Deleted sticks cannot be recovered. Use with caution.</AlertDescription>
          </Alert>

          <div className="flex items-center justify-between">
            <Label htmlFor="auto-delete">Enable auto-delete</Label>
            <Switch
              id="auto-delete"
              checked={policy.auto_delete_enabled}
              onCheckedChange={(checked) => updatePolicy("auto_delete_enabled", checked)}
            />
          </div>

          {policy.auto_delete_enabled && (
            <div className="space-y-2 pl-4 border-l-2 border-destructive">
              <Label htmlFor="delete-days">Delete archived sticks after days</Label>
              <Input
                id="delete-days"
                type="number"
                min={30}
                max={730}
                value={policy.delete_archived_after_days}
                onChange={(e) => updatePolicy("delete_archived_after_days", Number.parseInt(e.target.value) || 180)}
                className="w-32"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Workflow Auto-Close */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Auto-Close Resolved Sticks
          </CardTitle>
          <CardDescription>Automatically archive workflow sticks marked as resolved</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="auto-close">Enable auto-close for resolved sticks</Label>
            <Switch
              id="auto-close"
              checked={policy.auto_close_resolved_enabled}
              onCheckedChange={(checked) => updatePolicy("auto_close_resolved_enabled", checked)}
            />
          </div>

          {policy.auto_close_resolved_enabled && (
            <div className="space-y-2 pl-4 border-l-2 border-muted">
              <Label htmlFor="close-days">Close resolved sticks after days</Label>
              <Input
                id="close-days"
                type="number"
                min={1}
                max={90}
                value={policy.close_resolved_after_days}
                onChange={(e) => updatePolicy("close_resolved_after_days", Number.parseInt(e.target.value) || 7)}
                className="w-32"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Exemptions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Exemptions
          </CardTitle>
          <CardDescription>Protect certain sticks from automatic cleanup</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="exempt-pinned">Exempt pinned sticks</Label>
              <p className="text-xs text-muted-foreground">Pinned sticks will never be auto-archived</p>
            </div>
            <Switch
              id="exempt-pinned"
              checked={policy.exempt_pinned_sticks}
              onCheckedChange={(checked) => updatePolicy("exempt_pinned_sticks", checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="exempt-workflow">Exempt active workflow sticks</Label>
              <p className="text-xs text-muted-foreground">Sticks with active workflow status will be protected</p>
            </div>
            <Switch
              id="exempt-workflow"
              checked={policy.exempt_workflow_active}
              onCheckedChange={(checked) => updatePolicy("exempt_workflow_active", checked)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
