"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, ShieldAlert } from "lucide-react"
import { useTwoFactorSetup } from "@/hooks/use-two-factor-setup"
import {
  QRCodeDisplay,
  OTPVerificationInput,
  BackupCodesDisplay,
  TwoFactorError,
} from "@/components/auth/TwoFactorShared"

export default function Setup2FAPage() {
  const router = useRouter()
  useSearchParams()
  const [step, setStep] = useState<"info" | "qr" | "verify" | "backup">("info")
  const tfa = useTwoFactorSetup()

  // No grace period - setup is required immediately

  async function handleSetupStart() {
    const success = await tfa.startSetup()
    if (success) setStep("qr")
  }

  async function handleVerify() {
    const success = await tfa.verifyCode()
    if (success) setStep("backup")
  }

  function handleComplete() {
    router.push("/")
  }

  // Skip is not allowed - 2FA setup is mandatory

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

              <TwoFactorError error={tfa.error} />
            </CardContent>
            <CardFooter>
              <Button onClick={handleSetupStart} disabled={tfa.loading} className="w-full">
                {tfa.loading ? "Starting..." : "Get Started"}
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
              <QRCodeDisplay
                qrCodeDataUrl={tfa.qrCodeDataUrl}
                secret={tfa.secret}
                copiedSecret={tfa.copiedSecret}
                onCopySecret={tfa.copySecret}
              />

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
              <OTPVerificationInput code={tfa.code} onCodeChange={tfa.setCode} />

              <TwoFactorError error={tfa.error} />

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("qr")} className="flex-1">
                  Back
                </Button>
                <Button
                  onClick={handleVerify}
                  disabled={tfa.loading || tfa.code.length !== 6}
                  className="flex-1"
                >
                  {tfa.loading ? "Verifying..." : "Verify and Enable"}
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
              <BackupCodesDisplay
                backupCodes={tfa.backupCodes}
                copiedCodes={tfa.copiedCodes}
                onCopyBackupCodes={tfa.copyBackupCodes}
              />

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
