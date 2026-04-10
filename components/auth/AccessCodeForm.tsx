"use client"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp"
import { Lock } from "lucide-react"

interface AccessCodeFormProps {
  readonly accessCode: string
  readonly error: string
  readonly onAccessCodeChange: (value: string) => void
}

export function AccessCodeForm({ accessCode, error, onAccessCodeChange }: Readonly<AccessCodeFormProps>) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Access Required</h2>
        <p className="text-muted-foreground">Please enter your 6-digit access code to continue</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="access-code" className="flex items-center gap-2 justify-center">
            <Lock className="h-4 w-4" />
            Access Code Required
          </Label>
          <div className="flex justify-center">
            <InputOTP
              id="access-code"
              maxLength={6}
              value={accessCode}
              onChange={onAccessCodeChange}
              containerClassName="justify-center"
            >
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
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Enter your 6-digit access code to access Sign In, Sign Up, and Reset features.
          </p>
        </div>
      </div>
    </div>
  )
}
