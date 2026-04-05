"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Users, Trash2, Copy, Check, Terminal } from "lucide-react"
import { LdapUserSearchInput } from "@/components/concur/ldap-user-search-input"
import { useOrganization } from "@/contexts/organization-context"
import { useToast } from "@/hooks/use-toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface ConcurAdmin {
  id: string
  user_id: string
  org_id: string
  created_at: string
  user: {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
  } | null
}

export function ConcurTab() {
  const { currentOrg } = useOrganization()
  const { toast } = useToast()
  const [administrators, setAdministrators] = useState<ConcurAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [addingEmail, setAddingEmail] = useState("")
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [scriptCopied, setScriptCopied] = useState(false)

  const fetchAdministrators = useCallback(async () => {
    if (!currentOrg) return
    try {
      setLoading(true)
      const res = await fetch("/api/concur/administrators")
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setAdministrators(data.administrators || [])
    } catch (error) {
      console.error("Failed to fetch Concur administrators:", error)
    } finally {
      setLoading(false)
    }
  }, [currentOrg])

  useEffect(() => {
    fetchAdministrators()
  }, [fetchAdministrators])

  const handleAddAdministratorByEmail = async (email: string) => {
    if (!email.trim()) return
    setAdding(true)
    try {
      const res = await fetch("/api/concur/administrators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: data.error || "Failed to add administrator", variant: "destructive" })
        return
      }
      setAdministrators((prev) => [data.administrator, ...prev])
      setAddingEmail("")
      toast({ title: "Concur administrator added successfully" })
    } catch {
      toast({ title: "Failed to add administrator", variant: "destructive" })
    } finally {
      setAdding(false)
    }
  }

  const handleRemoveAdministrator = async (userId: string) => {
    setRemovingId(userId)
    try {
      const res = await fetch(`/api/concur/administrators?userId=${userId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to remove")
      setAdministrators((prev) => prev.filter((a) => a.user_id !== userId))
      toast({ title: "Concur administrator removed" })
    } catch {
      toast({ title: "Failed to remove administrator", variant: "destructive" })
    } finally {
      setRemovingId(null)
    }
  }

  const powershellScript = `# Concur Group Creation Script
# Run this as a Concur Administrator to create a new Concur group
# Prerequisites: You must be a Concur Administrator or Organization Owner

param(
    [Parameter(Mandatory=$true)]
    [string]$GroupName,

    [Parameter(Mandatory=$false)]
    [string]$Description = "",

    [Parameter(Mandatory=$true)]
    [string]$Owner1Email,

    [Parameter(Mandatory=$true)]
    [string]$Owner2Email,

    [Parameter(Mandatory=$true)]
    [string]$Email,

    [Parameter(Mandatory=$true)]
    [string]$Password,

    [Parameter(Mandatory=$false)]
    [string]$OrgId = ""
)

$BaseUrl = "https://stickmynote.com"

# Step 1: Get CSRF token
Write-Host "Authenticating..." -ForegroundColor Cyan
try {
    $CsrfResponse = Invoke-WebRequest -Uri "$BaseUrl/api/csrf" -SessionVariable WebSession -UseBasicParsing
    $CsrfToken = ($CsrfResponse.Content | ConvertFrom-Json).token
} catch {
    Write-Host "Error: Could not reach stickmynote.com" -ForegroundColor Red
    exit 1
}

# Step 2: Sign in with email and password
$SignInBody = @{ email = $Email; password = $Password } | ConvertTo-Json
try {
    $SignInResponse = Invoke-WebRequest -Uri "$BaseUrl/api/auth/signin" \`
        -Method POST -Body $SignInBody -ContentType "application/json" \`
        -Headers @{ "x-csrf-token" = $CsrfToken } \`
        -WebSession $WebSession -UseBasicParsing

    $SignInData = $SignInResponse.Content | ConvertFrom-Json

    if ($SignInData.requires2FA) {
        Write-Host "Error: Your account requires 2FA. Please create groups from the browser instead." -ForegroundColor Red
        exit 1
    }
    if ($SignInData.requiresSetup) {
        Write-Host "Error: Your account requires 2FA setup. Please log in via the browser first." -ForegroundColor Red
        exit 1
    }
    if (-not $SignInData.success) {
        Write-Host "Error: Sign-in failed. Check your email and password." -ForegroundColor Red
        exit 1
    }

    Write-Host "Signed in as $($SignInData.user.email)" -ForegroundColor Green
} catch {
    Write-Host "Error: Sign-in failed. $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 3: Set org context cookie if provided
if ($OrgId) {
    $WebSession.Cookies.Add((New-Object System.Net.Cookie("current_org_id", $OrgId, "/", "stickmynote.com")))
}

# Step 4: Create the Concur group
$Body = @{
    name = $GroupName
    description = $Description
    owner1Email = $Owner1Email
    owner2Email = $Owner2Email
} | ConvertTo-Json

try {
    $Response = Invoke-RestMethod -Uri "$BaseUrl/api/concur/groups/create-via-script" \`
        -Method POST -Body $Body -ContentType "application/json" \`
        -WebSession $WebSession

    Write-Host ""
    Write-Host "Group created successfully!" -ForegroundColor Green
    Write-Host "Group ID: $($Response.group.id)"
    Write-Host "Group Name: $($Response.group.name)"
    Write-Host "Owners: $Owner1Email, $Owner2Email"
} catch {
    Write-Host "Error creating group: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $StreamReader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        $ErrorBody = $StreamReader.ReadToEnd()
        Write-Host "Details: $ErrorBody" -ForegroundColor Yellow
    }
}

# Example usage:
# .\\Create-ConcurGroup.ps1 -GroupName "Engineering Team" -Description "Engineering discussions" -Owner1Email "owner1@company.com" -Owner2Email "owner2@company.com" -Email "admin@company.com" -Password "yourpassword"`

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(powershellScript)
      setScriptCopied(true)
      setTimeout(() => setScriptCopied(false), 2000)
      toast({ title: "Script copied to clipboard" })
    } catch {
      toast({ title: "Failed to copy script", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-6">
      {/* Manage Concur Administrators */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Concur Administrators
          </CardTitle>
          <CardDescription>
            Manage users who can create Concur groups using the PowerShell script. Only organization owners and admins can add administrators.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add administrator */}
          <div className="relative">
            {adding && (
              <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center rounded">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
            <LdapUserSearchInput
              value={addingEmail}
              placeholder="Search for a user to add as administrator..."
              onSelect={(user) => {
                setAddingEmail(user.email)
                handleAddAdministratorByEmail(user.email)
              }}
              onChange={() => setAddingEmail("")}
              excludeEmails={administrators.map((a) => a.user?.email || "").filter(Boolean)}
              disabled={adding}
            />
          </div>

          {/* Administrators list */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && administrators.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No Concur administrators yet</p>
              <p className="text-xs">Add users by email to allow them to create Concur groups</p>
            </div>
          )}
          {!loading && administrators.length > 0 && (
            <div className="space-y-2">
              {administrators.map((admin) => (
                <div
                  key={admin.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={admin.user?.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {admin.user?.full_name?.[0] || admin.user?.email?.[0] || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{admin.user?.full_name || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">{admin.user?.email}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveAdministrator(admin.user_id)}
                    disabled={removingId === admin.user_id}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    {removingId === admin.user_id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* PowerShell Script Example */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            PowerShell Script
          </CardTitle>
          <CardDescription>
            Use this PowerShell script to create Concur groups. The script requires the user to be a Concur Administrator.
            Each group is created with two owners who can then manage members.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyScript}
              className="absolute top-2 right-2 z-10"
            >
              {scriptCopied ? (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </>
              )}
            </Button>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs leading-relaxed max-h-[500px] overflow-y-auto">
              <code>{powershellScript}</code>
            </pre>
          </div>
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
            <p className="text-sm text-blue-800">
              <strong>Authentication:</strong> The script signs in with your email and password automatically. No need to copy session cookies.
            </p>
            <p className="text-sm text-blue-800">
              <strong>2FA:</strong> If your account uses two-factor authentication, create groups from the browser at <strong>/concur</strong> instead.
            </p>
            <p className="text-sm text-blue-800">
              <strong>Multi-org:</strong> If you belong to multiple organizations, pass the <code className="bg-blue-100 px-1 rounded">-OrgId</code> parameter with your organization ID.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
