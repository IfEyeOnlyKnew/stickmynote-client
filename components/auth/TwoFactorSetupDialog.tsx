"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useTwoFactorSetup } from "@/hooks/use-two-factor-setup"
import {
  QRCodeDisplay,
  OTPVerificationInput,
  BackupCodesDisplay,
  TwoFactorError,
} from "@/components/auth/TwoFactorShared"

interface TwoFactorSetupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function TwoFactorSetupDialog({
  open,
  onOpenChange,
  onSuccess,
}: Readonly<TwoFactorSetupDialogProps>) {
  type SetupStep = "qr" | "verify" | "backup"
  const [step, setStep] = useState<SetupStep>("qr")
  const tfa = useTwoFactorSetup()

  async function handleSetupStart() {
    const success = await tfa.startSetup()
    if (success) setStep("verify")
  }

  async function handleVerify() {
    const success = await tfa.verifyCode()
    if (success) setStep("backup")
  }

  function handleComplete() {
    onSuccess()
    onOpenChange(false)
    // Reset state
    setStep("qr")
    tfa.resetState()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {step === "qr" && (
          <>
            <DialogHeader>
              <DialogTitle>Enable Two-Factor Authentication</DialogTitle>
              <DialogDescription>
                Add an extra layer of security to your account
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                You'll need an authenticator app like Google Authenticator, Authy, or Microsoft
                Authenticator to set this up.
              </p>
              <Button onClick={handleSetupStart} disabled={tfa.loading} className="w-full">
                {tfa.loading ? "Starting..." : "Get Started"}
              </Button>
            </div>
          </>
        )}

        {step === "verify" && (
          <>
            <DialogHeader>
              <DialogTitle>Scan QR Code</DialogTitle>
              <DialogDescription>
                Scan this QR code with your authenticator app
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <QRCodeDisplay
                qrCodeDataUrl={tfa.qrCodeDataUrl}
                secret={tfa.secret}
                copiedSecret={tfa.copiedSecret}
                onCopySecret={tfa.copySecret}
              />

              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Enter the 6-digit code from your app:
                </p>
                <OTPVerificationInput code={tfa.code} onCodeChange={tfa.setCode} />
              </div>

              <TwoFactorError error={tfa.error} />

              <Button
                onClick={handleVerify}
                disabled={tfa.loading || tfa.code.length !== 6}
                className="w-full"
              >
                {tfa.loading ? "Verifying..." : "Verify and Enable"}
              </Button>
            </div>
          </>
        )}

        {step === "backup" && (
          <>
            <DialogHeader>
              <DialogTitle>Save Your Backup Codes</DialogTitle>
              <DialogDescription>
                Keep these codes safe. You'll need them if you lose access to your
                authenticator app.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <BackupCodesDisplay
                backupCodes={tfa.backupCodes}
                copiedCodes={tfa.copiedCodes}
                onCopyBackupCodes={tfa.copyBackupCodes}
              />

              <Button onClick={handleComplete} className="w-full">
                I've Saved My Backup Codes
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
