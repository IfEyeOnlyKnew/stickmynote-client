"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react"

function SSOErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error") || "unknown"
  const message = searchParams.get("message") || "An error occurred during Single Sign-On."

  const errorMessages: Record<string, string> = {
    missing_state: "Your SSO session has expired. Please try signing in again.",
    invalid_state: "Security validation failed. Please try signing in again.",
    state_mismatch: "Security validation failed. Please try signing in again.",
    idp_error: message,
    login_failed: message,
    no_token: "Authentication succeeded but we couldn't create your session. Please try again.",
    unexpected: message,
  }

  const displayMessage = errorMessages[error] || message

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle>Sign-In Error</CardTitle>
          <CardDescription>
            There was a problem signing you in with Single Sign-On
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertDescription>{displayMessage}</AlertDescription>
          </Alert>

          <div className="flex flex-col gap-2">
            <Button
              onClick={() => window.location.href = "/auth/login"}
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.href = "/auth/login"}
              className="w-full"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Sign In
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            If this problem persists, contact your organization administrator.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function SSOErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      }
    >
      <SSOErrorContent />
    </Suspense>
  )
}
