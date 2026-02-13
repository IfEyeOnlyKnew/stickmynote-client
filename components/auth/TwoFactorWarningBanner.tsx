"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { ShieldAlert, X } from "lucide-react"

interface ComplianceStatus {
  compliant: boolean
  gracePeriod?: {
    daysRemaining: number
    message: string
  }
  requiresSetup?: boolean
}

export function TwoFactorWarningBanner() {
  const router = useRouter()
  const [status, setStatus] = useState<ComplianceStatus | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkCompliance()
  }, [])

  async function checkCompliance() {
    try {
      const response = await fetch("/api/auth/2fa/check-compliance")
      if (response.ok) {
        const data = await response.json()
        setStatus(data)
      }
    } catch (error) {
      console.error("Failed to check 2FA compliance:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !status || status.compliant || dismissed) {
    return null
  }

  // Non-compliant (enforcement active)
  if (status.requiresSetup) {
    return (
      <Alert variant="destructive" className="m-4">
        <ShieldAlert className="h-5 w-5" />
        <AlertTitle className="font-bold">Two-Factor Authentication Required</AlertTitle>
        <AlertDescription className="mt-2">
          <p className="mb-3">
            Your organization requires two-factor authentication. You must enable 2FA to continue
            using this application.
          </p>
          <Button
            variant="default"
            size="sm"
            onClick={() => router.push("/settings/security")}
          >
            Enable 2FA Now
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  // Grace period warning
  if (status.gracePeriod) {
    return (
      <Alert className="m-4 border-amber-500 bg-amber-50 dark:bg-amber-950">
        <ShieldAlert className="h-5 w-5 text-amber-600" />
        <div className="flex items-start justify-between flex-1">
          <div className="flex-1">
            <AlertTitle className="font-bold text-amber-900 dark:text-amber-100">
              Action Required: Enable Two-Factor Authentication
            </AlertTitle>
            <AlertDescription className="mt-2 text-amber-800 dark:text-amber-200">
              <p className="mb-3">{status.gracePeriod.message}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/settings/security")}
                className="border-amber-600 text-amber-900 hover:bg-amber-100"
              >
                Set Up 2FA
              </Button>
            </AlertDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDismissed(true)}
            className="text-amber-600 hover:bg-amber-100"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Alert>
    )
  }

  return null
}
