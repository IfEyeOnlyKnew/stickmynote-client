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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp"
import { AlertTriangle, Copy, Check } from "lucide-react"
import { getCsrfToken } from "@/lib/client-csrf"

interface BackupCodesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function BackupCodesDialog({
  open,
  onOpenChange,
  onSuccess,
}: BackupCodesDialogProps) {
  const [step, setStep] = useState<"verify" | "codes">("verify")
  const [code, setCode] = useState("")
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [copiedCodes, setCopiedCodes] = useState(false)

  async function handleRegenerate() {
    if (code.length !== 6) {
      setError("Please enter a 6-digit code")
      return
    }

    setLoading(true)
    setError("")

    try {
      const csrfToken = await getCsrfToken()
      const response = await fetch("/api/auth/2fa/regenerate-backup-codes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({ code }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to regenerate codes")
      }

      const data = await response.json()
      setBackupCodes(data.backupCodes)
      setStep("codes")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate codes")
      setCode("")
    } finally {
      setLoading(false)
    }
  }

  function handleComplete() {
    onSuccess()
    onOpenChange(false)
    setStep("verify")
    setCode("")
    setError("")
    setBackupCodes([])
  }

  function copyBackupCodes() {
    navigator.clipboard.writeText(backupCodes.join("\n"))
    setCopiedCodes(true)
    setTimeout(() => setCopiedCodes(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {step === "verify" && (
          <>
            <DialogHeader>
              <DialogTitle>Regenerate Backup Codes</DialogTitle>
              <DialogDescription>
                Enter your verification code to generate new backup codes
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Generating new backup codes will invalidate all existing codes.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Enter your 6-digit authenticator code:
                </p>
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
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleRegenerate}
                disabled={loading || code.length !== 6}
                className="w-full"
              >
                {loading ? "Regenerating..." : "Regenerate Codes"}
              </Button>
            </div>
          </>
        )}

        {step === "codes" && (
          <>
            <DialogHeader>
              <DialogTitle>New Backup Codes</DialogTitle>
              <DialogDescription>
                Save these codes in a secure location
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Your old backup codes no longer work. Save these new codes now.
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
                I've Saved My Backup Codes
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
