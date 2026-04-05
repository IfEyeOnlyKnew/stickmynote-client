"use client"
import { useState, useEffect } from "react"
import type React from "react"

import { Button } from "@/components/ui/button"
import { FormField } from "@/components/forms/FormField"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Eye, EyeOff, Loader2, Building2, KeyRound } from "lucide-react"
import type { SignInData } from "@/hooks/use-auth-form"
import { isPublicEmailDomain } from "@/lib/utils/email-domain"

interface OrganizationInfo {
  hasOrganization: boolean
  isMember: boolean
  hasPendingRequest?: boolean
  requiresApproval?: boolean
  organization?: {
    id: string
    name: string
  }
  supportContacts?: {
    contact1?: { email?: string; name?: string }
    contact2?: { email?: string; name?: string }
  }
}

interface AuthMethodInfo {
  method: "ldap" | "sso"
  enforceOnly: boolean
}

interface SignInFormProps {
  onSubmit: (data: SignInData) => Promise<boolean>
  isLoading: boolean
}

export function SignInForm({ onSubmit, isLoading }: Readonly<SignInFormProps>) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [orgInfo, setOrgInfo] = useState<OrganizationInfo | null>(null)
  const [checkingOrg, setCheckingOrg] = useState(false)
  const [authMethod, setAuthMethod] = useState<AuthMethodInfo | null>(null)
  const [ssoLoading, setSsoLoading] = useState(false)

  useEffect(() => {
    const checkOrganization = async () => {
      if (!email?.includes("@")) {
        setOrgInfo(null)
        setAuthMethod(null)
        return
      }

      const domain = email.split("@")[1]?.toLowerCase()
      if (!domain || isPublicEmailDomain(email)) {
        setOrgInfo(null)
        setAuthMethod(null)
        return
      }

      setCheckingOrg(true)
      try {
        // Check org membership and auth method in parallel
        const [orgRes, authRes] = await Promise.all([
          fetch(`/api/organizations/check-membership?domain=${domain}`),
          fetch(`/api/auth/resolve-method?email=${encodeURIComponent(email)}`),
        ])

        if (orgRes.ok) {
          const data = await orgRes.json()
          setOrgInfo(data)
        }

        if (authRes.ok) {
          const data = await authRes.json()
          setAuthMethod(data)
        } else {
          setAuthMethod(null)
        }
      } catch (err) {
        console.error("Error checking organization:", err)
      } finally {
        setCheckingOrg(false)
      }
    }

    const timeoutId = setTimeout(checkOrganization, 500) // Debounce
    return () => clearTimeout(timeoutId)
  }, [email])

  const handleSSOLogin = async () => {
    setSsoLoading(true)
    try {
      const res = await fetch("/api/auth/sso/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      if (res.ok) {
        const { redirectUrl } = await res.json()
        globalThis.location.href = redirectUrl
      } else {
        const data = await res.json()
        console.error("SSO initiation failed:", data.error)
        setSsoLoading(false)
      }
    } catch (err) {
      console.error("SSO initiation error:", err)
      setSsoLoading(false)
    }
  }

  const isSSO = authMethod?.method === "sso"
  const isSSOEnforced = isSSO && authMethod?.enforceOnly

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit({ email, password })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField
        label="Email"
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={setEmail}
        required
        disabled={isLoading}
        autoComplete="email"
      />

      {checkingOrg && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking organization...
        </div>
      )}

      {orgInfo?.hasOrganization && !isSSO && (
        <Alert className={orgInfo.isMember ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"}>
          <Building2 className={`h-4 w-4 ${orgInfo.isMember ? "text-green-600" : "text-yellow-600"}`} />
          <AlertDescription>
            {orgInfo.isMember && (
              <span className="text-green-700">
                You are a member of <strong>{orgInfo.organization?.name}</strong>
              </span>
            )}
            {!orgInfo.isMember && orgInfo.hasPendingRequest && (
              <span className="text-yellow-700">
                Your access request to <strong>{orgInfo.organization?.name}</strong> is pending approval.
              </span>
            )}
            {!orgInfo.isMember && !orgInfo.hasPendingRequest && (
              <div className="text-yellow-700">
                <p>
                  Organization <strong>{orgInfo.organization?.name}</strong> found for your domain.
                </p>
                {orgInfo.requiresApproval && <p className="text-sm mt-1">Membership approval is required to access.</p>}
                {(orgInfo.supportContacts?.contact1?.email || orgInfo.supportContacts?.contact2?.email) && (
                  <div className="mt-2 text-sm">
                    <p className="font-medium">Contact support for access:</p>
                    {orgInfo.supportContacts.contact1?.email && (
                      <p>
                        {orgInfo.supportContacts.contact1.name || "Primary"}: {orgInfo.supportContacts.contact1.email}
                      </p>
                    )}
                    {orgInfo.supportContacts.contact2?.email && (
                      <p>
                        {orgInfo.supportContacts.contact2.name || "Secondary"}: {orgInfo.supportContacts.contact2.email}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* SSO detected — show SSO sign-in button */}
      {isSSO && (
        <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
          <KeyRound className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription>
            <span className="text-blue-700 dark:text-blue-300">
              {orgInfo?.organization?.name
                ? <><strong>{orgInfo.organization.name}</strong> uses Single Sign-On</>
                : "Your organization uses Single Sign-On"
              }
            </span>
          </AlertDescription>
        </Alert>
      )}

      {isSSO ? (
        <>
          <Button
            type="button"
            className="w-full"
            onClick={handleSSOLogin}
            disabled={ssoLoading || !email}
          >
            {ssoLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Redirecting to SSO...
              </>
            ) : (
              <>
                <KeyRound className="mr-2 h-4 w-4" />
                Sign in with SSO
              </>
            )}
          </Button>

          {/* If SSO is not enforced, allow password fallback */}
          {!isSSOEnforced && (
            <div className="text-center">
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-foreground underline"
                onClick={() => setAuthMethod(null)}
              >
                Sign in with password instead
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="signin-password">Password</Label>
            <div className="relative">
              <Input
                id="signin-password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="current-password"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </>
      )}
    </form>
  )
}
