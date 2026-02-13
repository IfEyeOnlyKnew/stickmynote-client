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
import { AlertTriangle } from "lucide-react"
import { getCsrfToken } from "@/lib/client-csrf"

interface TwoFactorDisableDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function TwoFactorDisableDialog({
  open,
  onOpenChange,
  onSuccess,
}: TwoFactorDisableDialogProps) {
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleDisable() {
    if (code.length !== 6 && code.length !== 9) {
      setError("Please enter a valid verification code")
      return
    }

    setLoading(true)
    setError("")

    try {
      const csrfToken = await getCsrfToken()
      const response = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({ code }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to disable 2FA")
      }

      onSuccess()
      onOpenChange(false)
      setCode("")
      setError("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disable 2FA")
      setCode("")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
          <DialogDescription>
            Enter your verification code to confirm disabling 2FA
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Disabling 2FA will make your account less secure. You can re-enable it at any
              time.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <p className="text-sm font-medium">
              Enter your 6-digit authenticator code or a backup code:
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

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisable}
              disabled={loading || code.length < 6}
              className="flex-1"
            >
              {loading ? "Disabling..." : "Disable 2FA"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
