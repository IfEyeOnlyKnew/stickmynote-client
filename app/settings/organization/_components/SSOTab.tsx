"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Loader2,
  KeyRound,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Globe,
  ShieldCheck,
  Save,
  Trash2,
  Play,
} from "lucide-react"
import { getCsrfToken } from "@/lib/client-csrf"
import { useToast } from "@/hooks/use-toast"

interface SSOTabProps {
  currentOrgId: string
}

interface IdentityProviderConfig {
  id: string
  display_name: string
  protocol: string
  status: string
  oidc_discovery_url: string
  oidc_client_id: string
  oidc_scopes: string
  attribute_mapping: Record<string, string>
  jit_provisioning_enabled: boolean
  default_role: string
  auto_update_profile: boolean
}

interface DomainInfo {
  id: string
  domain: string
  is_verified: boolean
  verified_at: string | null
}

interface SSOConfig {
  ssoEnabled: boolean
  ssoProvider: string | null
  ssoEnforceOnly: boolean
  identityProvider: IdentityProviderConfig | null
  domains: DomainInfo[]
}

type PresetKey = "azure" | "okta" | "google" | "custom"

const PROVIDER_PRESETS: Record<PresetKey, { label: string; discoveryTemplate: string; instructions: string }> = {
  azure: {
    label: "Azure AD / Entra ID",
    discoveryTemplate: "https://login.microsoftonline.com/{tenant-id}/v2.0",
    instructions: "Go to Azure Portal > App Registrations > New Registration. Set the Redirect URI to your callback URL. Copy the Application (client) ID and create a Client Secret under Certificates & Secrets.",
  },
  okta: {
    label: "Okta",
    discoveryTemplate: "https://{your-domain}.okta.com",
    instructions: "In Okta Admin Console, go to Applications > Create App Integration > OIDC - Web Application. Set the Sign-in redirect URI to your callback URL. Copy the Client ID and Client Secret.",
  },
  google: {
    label: "Google Workspace",
    discoveryTemplate: "https://accounts.google.com",
    instructions: "In Google Cloud Console, go to APIs & Services > Credentials > Create OAuth Client ID. Set the authorized redirect URI to your callback URL. Copy the Client ID and Client Secret.",
  },
  custom: {
    label: "Custom OIDC",
    discoveryTemplate: "",
    instructions: "Enter the OIDC Discovery URL (issuer URL) for your identity provider, along with the Client ID and Client Secret.",
  },
}

export function SSOTab({ currentOrgId }: Readonly<SSOTabProps>) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; issuer?: string; error?: string } | null>(null)

  // SSO config state
  const [ssoEnabled, setSsoEnabled] = useState(false)
  const [ssoEnforceOnly, setSsoEnforceOnly] = useState(false)
  const [preset, setPreset] = useState<PresetKey>("custom")
  const [displayName, setDisplayName] = useState("")
  const [discoveryUrl, setDiscoveryUrl] = useState("")
  const [clientId, setClientId] = useState("")
  const [clientSecret, setClientSecret] = useState("")
  const [scopes, setScopes] = useState("openid profile email")
  const [jitEnabled, setJitEnabled] = useState(true)
  const [defaultRole, setDefaultRole] = useState("member")
  const [autoUpdateProfile, setAutoUpdateProfile] = useState(true)

  // IdP status
  const [idpStatus, setIdpStatus] = useState<string>("draft")
  const [hasIdp, setHasIdp] = useState(false)
  const [domains, setDomains] = useState<DomainInfo[]>([])
  const hasVerifiedDomain = domains.some((d) => d.is_verified)

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch(`/api/organizations/${currentOrgId}/sso`)
      if (res.ok) {
        const data: SSOConfig = await res.json()
        setSsoEnabled(data.ssoEnabled)
        setSsoEnforceOnly(data.ssoEnforceOnly)
        setDomains(data.domains)

        if (data.identityProvider) {
          setHasIdp(true)
          setIdpStatus(data.identityProvider.status)
          setDisplayName(data.identityProvider.display_name)
          setDiscoveryUrl(data.identityProvider.oidc_discovery_url || "")
          setClientId(data.identityProvider.oidc_client_id || "")
          setScopes(data.identityProvider.oidc_scopes || "openid profile email")
          setJitEnabled(data.identityProvider.jit_provisioning_enabled)
          setDefaultRole(data.identityProvider.default_role)
          setAutoUpdateProfile(data.identityProvider.auto_update_profile)

          // Detect preset from discovery URL
          const url = data.identityProvider.oidc_discovery_url || ""
          if (url.includes("login.microsoftonline.com")) setPreset("azure")
          else if (url.includes(".okta.com")) setPreset("okta")
          else if (url.includes("accounts.google.com")) setPreset("google")
          else setPreset("custom")
        }
      }
    } catch (err) {
      console.error("Failed to load SSO config:", err)
    } finally {
      setLoading(false)
    }
  }, [currentOrgId])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  const handlePresetChange = (value: string) => {
    const key = value as PresetKey
    setPreset(key)
    setDiscoveryUrl(PROVIDER_PRESETS[key].discoveryTemplate)
    setDisplayName(PROVIDER_PRESETS[key].label)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const csrfToken = await getCsrfToken()
      const res = await fetch(`/api/organizations/${currentOrgId}/sso`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({
          displayName,
          protocol: "oidc",
          discoveryUrl,
          clientId,
          clientSecret,
          scopes,
          jitProvisioningEnabled: jitEnabled,
          defaultRole,
          autoUpdateProfile,
          ssoEnabled,
          ssoEnforceOnly,
        }),
      })

      if (res.ok) {
        toast({ title: "SSO configuration saved" })
        setHasIdp(true)
        setClientSecret("") // Clear after save
        await loadConfig()
      } else {
        const data = await res.json()
        toast({ title: "Error", description: data.error, variant: "destructive" })
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to save SSO configuration", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleActivate = async () => {
    try {
      const csrfToken = await getCsrfToken()
      const res = await fetch(`/api/organizations/${currentOrgId}/sso`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ action: "activate" }),
      })

      if (res.ok) {
        toast({ title: "SSO activated" })
        await loadConfig()
      } else {
        const data = await res.json()
        toast({ title: "Error", description: data.error, variant: "destructive" })
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to activate SSO", variant: "destructive" })
    }
  }

  const handleDeactivate = async () => {
    try {
      const csrfToken = await getCsrfToken()
      const res = await fetch(`/api/organizations/${currentOrgId}/sso`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ action: "deactivate" }),
      })

      if (res.ok) {
        toast({ title: "SSO deactivated" })
        await loadConfig()
      } else {
        const data = await res.json()
        toast({ title: "Error", description: data.error, variant: "destructive" })
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to deactivate SSO", variant: "destructive" })
    }
  }

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to remove the SSO configuration? All users will need to use password login.")) {
      return
    }

    try {
      const res = await fetch(`/api/organizations/${currentOrgId}/sso`, {
        method: "DELETE",
      })

      if (res.ok) {
        toast({ title: "SSO configuration removed" })
        await loadConfig()
        setHasIdp(false)
        setDiscoveryUrl("")
        setClientId("")
        setClientSecret("")
        setDisplayName("")
      } else {
        const data = await res.json()
        toast({ title: "Error", description: data.error, variant: "destructive" })
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to remove SSO configuration", variant: "destructive" })
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      // For testing we need to save first to have the encrypted secret available
      // If there's no client secret entered, the test must use the saved config
      toast({ title: "Testing", description: "Attempting OIDC discovery..." })

      const csrfToken = await getCsrfToken()
      const res = await fetch(`/api/organizations/${currentOrgId}/sso/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({
          discoveryUrl,
          clientId,
          // The test endpoint expects an already-encrypted secret
          // For testing, save first, then test
          clientSecretEncrypted: clientSecret || "saved",
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setTestResult(data)
      } else {
        setTestResult({ success: false, error: "Test request failed" })
      }
    } catch (err) {
      setTestResult({ success: false, error: "Connection failed" })
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Domain Verification Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Domain Verification
          </CardTitle>
          <CardDescription>
            SSO requires at least one verified domain. Users with email addresses matching a verified domain will be routed through SSO.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {domains.length === 0 ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                No domains configured. Add a domain in the General tab first, then verify it to enable SSO.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2">
              {domains.map((domain) => (
                <div key={domain.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    {domain.is_verified ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-yellow-500" />
                    )}
                    <span className="font-mono text-sm">{domain.domain}</span>
                  </div>
                  <Badge variant={domain.is_verified ? "default" : "secondary"}>
                    {domain.is_verified ? "Verified" : "Unverified"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SSO Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            SSO Configuration
          </CardTitle>
          <CardDescription>
            Configure your identity provider for Single Sign-On. Users from verified domains will be automatically redirected.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Provider Preset */}
          <div className="space-y-2">
            <Label>Identity Provider</Label>
            <Select value={preset} onValueChange={handlePresetChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="azure">Azure AD / Entra ID</SelectItem>
                <SelectItem value="okta">Okta</SelectItem>
                <SelectItem value="google">Google Workspace</SelectItem>
                <SelectItem value="custom">Custom OIDC Provider</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {PROVIDER_PRESETS[preset].instructions}
            </p>
          </div>

          {/* Discovery URL */}
          <div className="space-y-2">
            <Label htmlFor="discovery-url">Discovery URL (Issuer)</Label>
            <Input
              id="discovery-url"
              placeholder={PROVIDER_PRESETS[preset].discoveryTemplate || "https://your-idp.example.com"}
              value={discoveryUrl}
              onChange={(e) => setDiscoveryUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The OIDC issuer URL. The /.well-known/openid-configuration endpoint will be discovered automatically.
            </p>
          </div>

          {/* Client ID */}
          <div className="space-y-2">
            <Label htmlFor="client-id">Client ID</Label>
            <Input
              id="client-id"
              placeholder="Application (client) ID"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
          </div>

          {/* Client Secret */}
          <div className="space-y-2">
            <Label htmlFor="client-secret">Client Secret</Label>
            <Input
              id="client-secret"
              type="password"
              placeholder={hasIdp ? "Enter new secret to update (leave blank to keep existing)" : "Client secret value"}
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Encrypted at rest using organization-specific keys.
            </p>
          </div>

          {/* Scopes */}
          <div className="space-y-2">
            <Label htmlFor="scopes">Scopes</Label>
            <Input
              id="scopes"
              placeholder="openid profile email"
              value={scopes}
              onChange={(e) => setScopes(e.target.value)}
            />
          </div>

          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="display-name">Display Name</Label>
            <Input
              id="display-name"
              placeholder="e.g., Company Azure AD"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          {/* JIT Provisioning */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Just-In-Time Provisioning</Label>
              <p className="text-xs text-muted-foreground">
                Automatically create user accounts when they first sign in via SSO
              </p>
            </div>
            <Switch checked={jitEnabled} onCheckedChange={setJitEnabled} />
          </div>

          {/* Default Role */}
          {jitEnabled && (
            <div className="space-y-2">
              <Label>Default Role for New Users</Label>
              <Select value={defaultRole} onValueChange={setDefaultRole}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Auto Update Profile */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-Update Profile</Label>
              <p className="text-xs text-muted-foreground">
                Update user display name from IdP on each login
              </p>
            </div>
            <Switch checked={autoUpdateProfile} onCheckedChange={setAutoUpdateProfile} />
          </div>

          {/* Callback URL Info */}
          <Alert>
            <AlertDescription>
              <strong>Callback URL</strong> (add this to your IdP):
              <code className="block mt-1 p-2 bg-muted rounded text-xs break-all">
                {typeof globalThis.window === "undefined" ? "/api/auth/sso/callback" : `${globalThis.location.origin}/api/auth/sso/callback`}
              </code>
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="flex justify-between">
          <div className="flex gap-2">
            {hasIdp && (
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-1" />
                Remove
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleTest} disabled={testing || !discoveryUrl || !clientId}>
              {testing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
              Test Connection
            </Button>
            <Button onClick={handleSave} disabled={saving || !discoveryUrl || !clientId || (!clientSecret && !hasIdp)}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Save Configuration
            </Button>
          </div>
        </CardFooter>
      </Card>

      {/* Test Result */}
      {testResult && (
        <Alert variant={testResult.success ? "default" : "destructive"}>
          {testResult.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          <AlertDescription>
            {testResult.success
              ? `Connection successful! Issuer: ${testResult.issuer}`
              : `Connection failed: ${testResult.error}`}
          </AlertDescription>
        </Alert>
      )}

      {/* Activation & Enforcement */}
      {hasIdp && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              SSO Activation
            </CardTitle>
            <CardDescription>
              Control SSO status and enforcement for your organization.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current Status */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Status:</span>
              <Badge
                variant={(() => { if (idpStatus === "active") return "default" as const; if (idpStatus === "draft") return "secondary" as const; return "outline" as const })()}
              >
                {(() => { if (idpStatus === "active") return "Active"; if (idpStatus === "draft") return "Draft"; return "Disabled" })()}
              </Badge>
            </div>

            {!hasVerifiedDomain && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  You need at least one verified domain to activate SSO.
                </AlertDescription>
              </Alert>
            )}

            {/* Enforce SSO Only */}
            {idpStatus === "active" && (
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label>Enforce SSO-Only Login</Label>
                  <p className="text-xs text-muted-foreground">
                    When enabled, password login is disabled for users in this organization. They must use SSO.
                  </p>
                </div>
                <Switch
                  checked={ssoEnforceOnly}
                  onCheckedChange={async (checked) => {
                    setSsoEnforceOnly(checked)
                    const csrfToken = await getCsrfToken()
                    await fetch(`/api/organizations/${currentOrgId}/sso`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
                      body: JSON.stringify({ ssoEnforceOnly: checked }),
                    })
                    toast({ title: checked ? "SSO-only enforcement enabled" : "Password login re-enabled" })
                  }}
                />
              </div>
            )}
          </CardContent>
          <CardFooter className="flex gap-2">
            {idpStatus === "active" ? (
              <Button variant="outline" onClick={handleDeactivate}>
                <XCircle className="h-4 w-4 mr-1" />
                Deactivate SSO
              </Button>
            ) : (
              <Button onClick={handleActivate} disabled={!hasVerifiedDomain}>
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Activate SSO
              </Button>
            )}
          </CardFooter>
        </Card>
      )}
    </div>
  )
}
