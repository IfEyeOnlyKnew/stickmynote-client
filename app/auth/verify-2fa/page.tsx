"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp"
import { Input } from "@/components/ui/input"
import { ShieldCheck, Clock } from "lucide-react"
import { getCsrfToken } from "@/lib/client-csrf"

export default function Verify2FAPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [attemptsRemaining, setAttemptsRemaining] = useState(5)
  const [showBackupInput, setShowBackupInput] = useState(false)

  const verificationToken = searchParams.get("token")
  const expiresAt = searchParams.get("expiresAt")

  useEffect(() => {
    if (!verificationToken) {
      router.push("/signin")
    }
  }, [verificationToken, router])

  async function handleVerify() {
    if (!showBackupInput && code.length !== 6) {
      setError("Please enter a 6-digit code")
      return
    }

    if (showBackupInput && code.length !== 9) {
      setError("Please enter a valid backup code")
      return
    }

    setLoading(true)
    setError("")

    try {
      const csrfToken = await getCsrfToken()
      const response = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          verificationToken,
          code: showBackupInput ? code : code,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setAttemptsRemaining(data.attemptsRemaining || 0)
        throw new Error(data.error || "Verification failed")
      }

      // Call post-login to update login count and get redirect URL
      try {
        const postLoginResponse = await fetch("/api/auth/post-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        })

        if (postLoginResponse.ok) {
          const postLoginData = await postLoginResponse.json()
          router.push(postLoginData.redirect || "/dashboard")
        } else {
          // Fallback to dashboard if post-login fails
          router.push("/dashboard")
        }
      } catch {
        // Fallback to dashboard if post-login fails
        router.push("/dashboard")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed")
      setCode("")
    } finally {
      setLoading(false)
    }
  }

  if (!verificationToken) {
    return null
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <ShieldCheck className="h-12 w-12 text-primary" />
          </div>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>
            {showBackupInput
              ? "Enter one of your backup codes"
              : "Enter the 6-digit code from your authenticator app"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {expiresAt && (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                This verification session expires in{" "}
                {Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 60000)} minutes
              </AlertDescription>
            </Alert>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleVerify()
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <div className="flex justify-center">
                {showBackupInput ? (
                  <Input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="XXXX-XXXX"
                    className="w-full max-w-xs text-center text-lg font-mono"
                    maxLength={9}
                  />
                ) : (
                  <InputOTP maxLength={6} value={code} onChange={setCode}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} className="w-12 h-12 text-lg" />
                      <InputOTPSlot index={1} className="w-12 h-12 text-lg" />
                      <InputOTPSlot index={2} className="w-12 h-12 text-lg" />
                    </InputOTPGroup>
                    <InputOTPSeparator />
                    <InputOTPGroup>
                      <InputOTPSlot index={3} className="w-12 h-12 text-lg" />
                      <InputOTPSlot index={4} className="w-12 h-12 text-lg" />
                      <InputOTPSlot index={5} className="w-12 h-12 text-lg" />
                    </InputOTPGroup>
                  </InputOTP>
                )}
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>
                  {error}
                  {attemptsRemaining > 0 && (
                    <span className="block mt-1 text-sm">
                      {attemptsRemaining} attempt{attemptsRemaining !== 1 ? "s" : ""} remaining
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              disabled={loading || (showBackupInput ? code.length !== 9 : code.length !== 6)}
              className="w-full"
            >
              {loading ? "Verifying..." : "Verify"}
            </Button>
          </form>

          <div className="text-center">
            <Button
              variant="link"
              size="sm"
              onClick={() => {
                setShowBackupInput(!showBackupInput)
                setCode("")
                setError("")
              }}
            >
              {showBackupInput ? "Use authenticator code" : "Use backup code instead"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
