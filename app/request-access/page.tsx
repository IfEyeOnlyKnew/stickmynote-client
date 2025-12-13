"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Building2, Mail, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface OrganizationInfo {
  id: string
  name: string
  domain: string
  primary_contact_email: string | null
  secondary_contact_email: string | null
}

export default function RequestAccessPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [email, setEmail] = useState(searchParams.get("email") || "")
  const [reason, setReason] = useState("")
  const [organization, setOrganization] = useState<OrganizationInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkingOrg, setCheckingOrg] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Extract domain from email
  const getDomain = (email: string) => {
    const match = email.match(/@([a-zA-Z0-9.-]+)$/)
    return match ? match[1].toLowerCase() : null
  }

  // Check for organization when email changes
  useEffect(() => {
    const domain = getDomain(email)
    if (!domain) {
      setOrganization(null)
      return
    }

    const checkOrganization = async () => {
      setCheckingOrg(true)
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from("organizations")
          .select("id, name, domain, primary_contact_email, secondary_contact_email")
          .eq("domain", domain)
          .single()

        setOrganization(data as OrganizationInfo | null)
      } catch {
        setOrganization(null)
      } finally {
        setCheckingOrg(false)
      }
    }

    const debounce = setTimeout(checkOrganization, 500)
    return () => clearTimeout(debounce)
  }, [email])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organization) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/organizations/${organization.id}/access-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, reason }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to submit request")
      }

      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit request")
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle>Request Submitted</CardTitle>
            <CardDescription>Your access request has been sent to the organization administrators.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Mail className="h-4 w-4" />
              <AlertDescription>
                The organization contacts have been notified of your request. You will receive an email once your
                request is reviewed.
              </AlertDescription>
            </Alert>
            <Button onClick={() => router.push("/auth/login")} className="w-full">
              Return to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Request Organization Access
          </CardTitle>
          <CardDescription>Submit a request to join your organization on Stick My Note</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Work Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {checkingOrg && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Checking organization...
                </p>
              )}
            </div>

            {organization ? (
              <Alert>
                <Building2 className="h-4 w-4" />
                <AlertDescription>
                  <strong>{organization.name}</strong> is registered on Stick My Note. Your request will be sent to the
                  organization administrators.
                </AlertDescription>
              </Alert>
            ) : email && getDomain(email) && !checkingOrg ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No organization found for this domain. Please contact your IT administrator to set up your
                  organization on Stick My Note.
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Access (Optional)</Label>
              <Textarea
                id="reason"
                placeholder="Briefly describe why you need access..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => router.push("/auth/login")} className="flex-1">
                Back to Login
              </Button>
              <Button type="submit" disabled={!organization || loading} className="flex-1">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Request"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
