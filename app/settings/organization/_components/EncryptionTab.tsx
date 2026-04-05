"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Loader2,
  Lock,
  Save,
  CheckCircle2,
  XCircle,
  Shield,
  Key,
  HardDrive,
  Info,
} from "lucide-react"
import { getCsrfToken } from "@/lib/client-csrf"
import { useToast } from "@/hooks/use-toast"
import type { EncryptionSettings } from "@/types/organization"

interface EncryptionTabProps {
  currentOrgId: string
}

const DEFAULT_ENCRYPTION: EncryptionSettings = {
  file_encryption_enabled: false,
}

export function EncryptionTab({ currentOrgId }: Readonly<EncryptionTabProps>) {
  const [encryption, setEncryption] = useState<EncryptionSettings>(DEFAULT_ENCRYPTION)
  const [masterKeyConfigured, setMasterKeyConfigured] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const { toast } = useToast()

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true)

      // Fetch org settings and encryption status in parallel
      const [orgRes, statusRes] = await Promise.all([
        fetch(`/api/organizations/${currentOrgId}`),
        fetch(`/api/organizations/${currentOrgId}/encryption/status`),
      ])

      if (orgRes.ok) {
        const data = await orgRes.json()
        const orgSettings = data.organization?.settings || data.settings || {}
        setEncryption({ ...DEFAULT_ENCRYPTION, ...orgSettings.encryption })
      }

      if (statusRes.ok) {
        const status = await statusRes.json()
        setMasterKeyConfigured(status.masterKeyConfigured)
      }
    } catch (error) {
      console.error("[Encryption] Load error:", error)
      toast({ title: "Error", description: "Failed to load encryption settings", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [currentOrgId, toast])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const updateEncryption = (updates: Partial<EncryptionSettings>) => {
    setEncryption((prev) => ({ ...prev, ...updates }))
    setHasChanges(true)
  }

  const saveSettings = async () => {
    try {
      setSaving(true)
      const csrfToken = await getCsrfToken()

      const settingsToSave: EncryptionSettings = { ...encryption }

      // Record who enabled it and when, if toggling on
      if (encryption.file_encryption_enabled && !encryption.enabled_at) {
        settingsToSave.enabled_at = new Date().toISOString()
      }

      const res = await fetch(`/api/organizations/${currentOrgId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
        },
        body: JSON.stringify({ settings: { encryption: settingsToSave } }),
      })
      if (!res.ok) throw new Error("Failed to save")
      setEncryption(settingsToSave)
      setHasChanges(false)
      toast({ title: "Saved", description: "Encryption settings updated successfully" })
    } catch (error) {
      console.error("[Encryption] Save error:", error)
      toast({ title: "Error", description: "Failed to save encryption settings", variant: "destructive" })
    } finally {
      setSaving(false)
    }
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
            <Lock className="h-5 w-5" />
            Encryption at Rest
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Protect stored data with AES-256-GCM encryption. Per-organization key isolation via PBKDF2.
          </p>
        </div>
        {hasChanges && (
          <Button onClick={saveSettings} disabled={saving || !masterKeyConfigured}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        )}
      </div>

      {/* Master Key Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" />
            Master Key Status
          </CardTitle>
          <CardDescription>
            The encryption master key must be configured on the server before encryption can be enabled.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            {masterKeyConfigured ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-700">Master Key Configured</span>
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-red-500" />
                <span className="font-medium text-red-600">Master Key Not Configured</span>
              </>
            )}
          </div>

          {masterKeyConfigured ? (
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">AES-256-GCM</Badge>
              <Badge variant="outline">PBKDF2 Key Derivation</Badge>
              <Badge variant="outline">Per-Organization Isolation</Badge>
              <Badge variant="outline">100,000 Iterations</Badge>
            </div>
          ) : (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Add <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">ENCRYPTION_MASTER_KEY</code> to your server environment variables.
                Generate a key with: <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">npx ts-node scripts/generate-encryption-key.ts</code>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* File Encryption Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HardDrive className="h-4 w-4" />
            File Encryption
          </CardTitle>
          <CardDescription>
            When enabled, new image uploads will be encrypted at rest with organization-specific keys.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable File Encryption</Label>
              <p className="text-sm text-muted-foreground">
                New images uploaded via notes and sticks will be encrypted before storage.
              </p>
            </div>
            <Switch
              checked={encryption.file_encryption_enabled || false}
              onCheckedChange={(checked) => updateEncryption({ file_encryption_enabled: checked })}
              disabled={!masterKeyConfigured}
            />
          </div>

          {encryption.file_encryption_enabled && masterKeyConfigured && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>What&apos;s encrypted:</strong> New images uploaded to notes and sticks.
                <br />
                <strong>Not encrypted:</strong> Avatars and branding logos (public by design).
                <br />
                <strong>Backward compatible:</strong> Existing unencrypted images continue to work normally.
              </AlertDescription>
            </Alert>
          )}

          {encryption.enabled_at && (
            <p className="text-xs text-muted-foreground">
              First enabled: {new Date(encryption.enabled_at).toLocaleDateString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* What's Encrypted */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Encryption Coverage
          </CardTitle>
          <CardDescription>
            Overview of what data is encrypted at rest in your organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">2FA TOTP Secrets</span>
              </div>
              {masterKeyConfigured ? (
                <Badge className="bg-green-100 text-green-800 border-green-300">Encrypted</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">Not Configured</Badge>
              )}
            </div>

            <div className="border-t" />

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">SSO Client Secrets</span>
              </div>
              {masterKeyConfigured ? (
                <Badge className="bg-green-100 text-green-800 border-green-300">Encrypted</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">Not Configured</Badge>
              )}
            </div>

            <div className="border-t" />

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">File Uploads (Images)</span>
              </div>
              {encryption.file_encryption_enabled && masterKeyConfigured && (
                <Badge className="bg-green-100 text-green-800 border-green-300">Encrypted</Badge>
              )}
              {!(encryption.file_encryption_enabled && masterKeyConfigured) && masterKeyConfigured && (
                <Badge variant="outline" className="text-yellow-700 border-yellow-300 bg-yellow-50">Disabled</Badge>
              )}
              {!masterKeyConfigured && (
                <Badge variant="outline" className="text-muted-foreground">Not Configured</Badge>
              )}
            </div>

            <div className="border-t" />

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Database (PostgreSQL)</span>
              </div>
              <Badge variant="outline" className="text-muted-foreground">Managed by DB Admin</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Management Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" />
            Key Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Encryption keys are derived per-organization from the master key using PBKDF2 with 100,000 iterations
              and SHA-256. The master key is stored in the server environment and never exposed to clients.
            </AlertDescription>
          </Alert>

          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>Key Rotation:</strong> Not yet supported in the UI. Contact your server administrator
              for manual key rotation procedures.
            </p>
            <p>
              <strong>BYOK (Bring Your Own Key):</strong> Planned for a future release. Currently all organizations
              derive keys from the shared master key with organization-specific salt.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save button (bottom) */}
      {hasChanges && (
        <div className="flex justify-end">
          <Button onClick={saveSettings} disabled={saving || !masterKeyConfigured} size="lg">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Encryption Settings
          </Button>
        </div>
      )}
    </div>
  )
}
