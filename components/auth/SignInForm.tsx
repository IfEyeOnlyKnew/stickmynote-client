"use client"
import { useState, useEffect } from "react"
import type React from "react"

import { Button } from "@/components/ui/button"
import { FormField } from "@/components/forms/FormField"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Eye, EyeOff, Loader2, Building2 } from "lucide-react"
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

interface SignInFormProps {
  onSubmit: (data: SignInData) => Promise<boolean>
  isLoading: boolean
}

export function SignInForm({ onSubmit, isLoading }: SignInFormProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [orgInfo, setOrgInfo] = useState<OrganizationInfo | null>(null)
  const [checkingOrg, setCheckingOrg] = useState(false)

  useEffect(() => {
    const checkOrganization = async () => {
      if (!email || !email.includes("@")) {
        setOrgInfo(null)
        return
      }

      const domain = email.split("@")[1]?.toLowerCase()
      if (!domain || isPublicEmailDomain(email)) {
        setOrgInfo(null)
        return
      }

      setCheckingOrg(true)
      try {
        const res = await fetch(`/api/organizations/check-membership?domain=${domain}`)
        if (res.ok) {
          const data = await res.json()
          setOrgInfo(data)
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

      {orgInfo?.hasOrganization && (
        <Alert className={orgInfo.isMember ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"}>
          <Building2 className={`h-4 w-4 ${orgInfo.isMember ? "text-green-600" : "text-yellow-600"}`} />
          <AlertDescription>
            {orgInfo.isMember ? (
              <span className="text-green-700">
                You are a member of <strong>{orgInfo.organization?.name}</strong>
              </span>
            ) : orgInfo.hasPendingRequest ? (
              <span className="text-yellow-700">
                Your access request to <strong>{orgInfo.organization?.name}</strong> is pending approval.
              </span>
            ) : (
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
    </form>
  )
}
