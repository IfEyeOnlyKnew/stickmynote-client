"use client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { useAccessCode } from "@/hooks/use-access-code"
import { useAuthModal } from "@/hooks/use-auth-modal"
import { useAuthForm } from "@/hooks/use-auth-form"
import { useUser } from "@/contexts/user-context"
import { AccessCodeForm } from "@/components/auth/AccessCodeForm"
import { SignInForm } from "@/components/auth/SignInForm"
import { SignUpForm } from "@/components/auth/SignUpForm"
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm"
import { useEffect, useRef } from "react"

interface AuthFormModalProps {
  mode?: "signin" | "signup" | "reset"
  onSuccess?: () => void
}

export function AuthFormModal({ mode = "signin", onSuccess }: Readonly<AuthFormModalProps>) {
  const { toast } = useToast()
  const initialFocusRef = useRef<HTMLDivElement>(null)
  const { reloadUser } = useUser()

  const { activeTab, handleTabChange, handleAuthSuccess } = useAuthModal({
    initialMode: mode,
    onSuccess,
  })

  const { accessCode, handleAccessCodeChange, isAccessCodeVerified, error: accessCodeError } = useAccessCode()

  const { signIn, signUp, resetPassword, isLoading } = useAuthForm()

  useEffect(() => {
    if (initialFocusRef.current) {
      initialFocusRef.current.focus()
    }
  }, [])

  const handleTabChangeWithValidation = (value: string) => {
    const success = handleTabChange(value, isAccessCodeVerified)
    if (!success && (value === "signup" || value === "reset")) {
      toast({
        title: "Access Code Required",
        description: "Please enter your 6-digit access code first.",
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onSuccess) {
        onSuccess()
      }
    }
    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [onSuccess])

  if (!isAccessCodeVerified) {
    return (
      <Card className="w-full max-w-md mx-auto" role="dialog" aria-labelledby="access-code-title">
        <CardContent className="pt-6" ref={initialFocusRef} tabIndex={-1}>
          {accessCodeError && (
            <Alert variant="destructive" className="mb-4" role="alert" aria-live="polite">
              <AlertDescription>{accessCodeError}</AlertDescription>
            </Alert>
          )}
          <AccessCodeForm accessCode={accessCode} onAccessCodeChange={handleAccessCodeChange} error={accessCodeError} />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      className="w-full max-w-md mx-auto"
      role="dialog"
      aria-labelledby="auth-modal-title"
      aria-describedby="auth-modal-description"
    >
      <CardHeader className="space-y-1">
        <CardTitle id="auth-modal-title" className="text-2xl font-bold text-center">
          Welcome
        </CardTitle>
        <CardDescription id="auth-modal-description" className="text-center">
          <span className="text-green-600" aria-label="Access code verified">
            ✓ Access Code Verified
          </span>{" "}
          - Sign in to your account or create a new one
        </CardDescription>
      </CardHeader>
      <CardContent ref={initialFocusRef} tabIndex={-1}>
        <Tabs
          value={activeTab}
          onValueChange={handleTabChangeWithValidation}
          className="w-full"
          aria-label="Authentication options"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
            <TabsTrigger value="reset">Reset</TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <SignInForm
              onSubmit={async (data) => {
                const success = await signIn(data)
                if (success) {
                  await reloadUser()
                  handleAuthSuccess()
                }
                return success
              }}
              isLoading={isLoading}
            />
          </TabsContent>

          <TabsContent value="signup">
            <SignUpForm
              onSubmit={async (data) => {
                const success = await signUp(data)
                if (success) {
                  handleTabChange("signin", true)
                }
                return success
              }}
              isLoading={isLoading}
              onSuccess={() => {
                handleTabChange("signin", true)
              }}
            />
          </TabsContent>

          <TabsContent value="reset">
            <ResetPasswordForm
              onSubmit={async (data) => {
                const success = await resetPassword(data)
                if (success) {
                  handleTabChange("signin", true)
                }
                return success
              }}
              isLoading={isLoading}
              onSuccess={() => {
                handleTabChange("signin", true)
              }}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
