"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp"
import { AlertTriangle, Copy, Check, ShieldAlert } from "lucide-react"
import { getCsrfToken } from "@/lib/client-csrf"
import QRCode from "qrcode"

export default function Setup2FAPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState<"info" | "qr" | "verify" | "backup">("info")
  const [qrCodeUri, setQrCodeUri] = useState<string>("")
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("")
  const [secret, setSecret] = useState<string>("")
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [copiedSecret, setCopiedSecret] = useState(false)
  const [copiedCodes, setCopiedCodes] = useState(false)

  // No grace period - setup is required immediately

  async function handleSetupStart() {
    setLoading(true)
    setError("")

    try {
      const csrfToken = await getCsrfToken()
      const response = await fetch("/api/auth/2fa/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Setup failed")
      }

      const data = await response.json()
      setSecret(data.secret)
      setQrCodeUri(data.qrCodeUri)
      setBackupCodes(data.backupCodes)

      // Generate QR code image
      const qrDataUrl = await QRCode.toDataURL(data.qrCodeUri)
      setQrCodeDataUrl(qrDataUrl)

      setStep("qr")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed")
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify() {
    if (code.length !== 6) {
      setError("Please enter a 6-digit code")
      return
    }

    setLoading(true)
    setError("")

    try {
      const csrfToken = await getCsrfToken()
      const response = await fetch("/api/auth/2fa/verify-setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({ code }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Verification failed")
      }

      setStep("backup")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed")
      setCode("")
    } finally {
      setLoading(false)
    }
  }

  function handleComplete() {
    router.push("/")
  }

  // Skip is not allowed - 2FA setup is mandatory

  function copySecret() {
    navigator.clipboard.writeText(secret)
    setCopiedSecret(true)
    setTimeout(() => setCopiedSecret(false), 2000)
  }

  function copyBackupCodes() {
    navigator.clipboard.writeText(backupCodes.join("\n"))
    setCopiedCodes(true)
    setTimeout(() => setCopiedCodes(false), 2000)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-2xl">
        {step === "info" && (
          <>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <ShieldAlert className="h-16 w-16 text-amber-600" />
              </div>
              <CardTitle className="text-2xl">Two-Factor Authentication Required</CardTitle>
              <CardDescription>
                Your organization requires all users to enable two-factor authentication
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Your organization requires two-factor authentication. You must complete this setup to continue using the application.
                </AlertDescription>
              </Alert>

              <div className="space-y-3 text-sm text-muted-foreground">
                <p>You'll need:</p>
                <ul className="list-disc list-inside space-y-1 pl-4">
                  <li>An authenticator app (Google Authenticator, Authy, Microsoft Authenticator, etc.)</li>
                  <li>A secure place to store backup codes</li>
                  <li>5-10 minutes to complete the setup</li>
                </ul>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter>
              <Button onClick={handleSetupStart} disabled={loading} className="w-full">
                {loading ? "Starting..." : "Get Started"}
              </Button>
            </CardFooter>
          </>
        )}

        {step === "qr" && (
          <>
            <CardHeader className="text-center">
              <CardTitle>Step 1: Scan QR Code</CardTitle>
              <CardDescription>
                Scan this QR code with your authenticator app
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {qrCodeDataUrl && (
                <div className="flex justify-center">
                  <img src={qrCodeDataUrl} alt="QR Code" className="w-64 h-64" />
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium">Or enter this code manually:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-muted rounded text-sm font-mono break-all">
                    {secret}
                  </code>
                  <Button size="icon" variant="outline" onClick={copySecret}>
                    {copiedSecret ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <Button onClick={() => setStep("verify")} className="w-full">
                Continue to Verification
              </Button>
            </CardContent>
          </>
        )}

        {step === "verify" && (
          <>
            <CardHeader className="text-center">
              <CardTitle>Step 2: Verify Code</CardTitle>
              <CardDescription>
                Enter the 6-digit code from your authenticator app
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={code} onChange={setCode}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("qr")} className="flex-1">
                  Back
                </Button>
                <Button
                  onClick={handleVerify}
                  disabled={loading || code.length !== 6}
                  className="flex-1"
                >
                  {loading ? "Verifying..." : "Verify and Enable"}
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {step === "backup" && (
          <>
            <CardHeader className="text-center">
              <CardTitle>Step 3: Save Your Backup Codes</CardTitle>
              <CardDescription>
                Keep these codes safe. You'll need them if you lose access to your authenticator app.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  These codes will only be shown once. Make sure to save them in a secure location.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Backup Codes:</p>
                  <Button size="sm" variant="outline" onClick={copyBackupCodes}>
                    {copiedCodes ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy All
                      </>
                    )}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg font-mono text-sm">
                  {backupCodes.map((code, i) => (
                    <div key={i} className="py-1">
                      {code}
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={handleComplete} className="w-full">
                I've Saved My Backup Codes - Continue to App
              </Button>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  )
}
