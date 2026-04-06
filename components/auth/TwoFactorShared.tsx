"use client"

import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp"
import { AlertTriangle, Copy, Check } from "lucide-react"
import type React from "react"

/** QR code display with manual secret entry fallback */
export function QRCodeDisplay({
  qrCodeDataUrl,
  secret,
  copiedSecret,
  onCopySecret,
}: Readonly<{
  qrCodeDataUrl: string
  secret: string
  copiedSecret: boolean
  onCopySecret: () => void
}>) {
  return (
    <>
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
          <Button size="icon" variant="outline" onClick={onCopySecret}>
            {copiedSecret ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </>
  )
}

/** OTP 6-digit verification input */
export function OTPVerificationInput({
  code,
  onCodeChange,
}: Readonly<{
  code: string
  onCodeChange: (value: string) => void
}>) {
  return (
    <div className="flex justify-center">
      <InputOTP maxLength={6} value={code} onChange={onCodeChange}>
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
  )
}

/** Backup codes display with copy button */
export function BackupCodesDisplay({
  backupCodes,
  copiedCodes,
  onCopyBackupCodes,
}: Readonly<{
  backupCodes: string[]
  copiedCodes: boolean
  onCopyBackupCodes: () => void
}>) {
  return (
    <>
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          These codes will only be shown once. Make sure to save them in a secure location.
        </AlertDescription>
      </Alert>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Backup Codes:</p>
          <Button size="sm" variant="outline" onClick={onCopyBackupCodes}>
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
          {backupCodes.map((code) => (
            <div key={code} className="py-1">
              {code}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

/** Error alert for 2FA forms */
export function TwoFactorError({ error }: Readonly<{ error: string }>) {
  if (!error) return null
  return (
    <Alert variant="destructive">
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  )
}
