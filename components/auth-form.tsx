"use client"
import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAccessCode } from "@/hooks/use-access-code"
import { useAuthForm } from "@/hooks/use-auth-form"
import { createClient } from "@/lib/supabase/client"
import { AccessCodeForm } from "@/components/auth/AccessCodeForm"
import { SignInForm } from "@/components/auth/SignInForm"
import { SignUpForm } from "@/components/auth/SignUpForm"
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm"
import { Loader2 } from "lucide-react"

interface AuthFormProps {
  mode?: "signin" | "signup" | "reset"
}

export function AuthForm({ mode = "signin" }: AuthFormProps) {
  const [activeTab, setActiveTab] = useState(mode)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [isAlreadyAuthenticated, setIsAlreadyAuthenticated] = useState(false)
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirectTo") || searchParams.get("redirect") || "/dashboard"
  const supabase = createClient()

  const {
    accessCode,
    isAccessCodeVerified,
    isCheckingStatus,
    error: accessCodeError,
    handleAccessCodeChange,
  } = useAccessCode()

  const { isLoading, error: authError, signIn, signUp, resetPassword } = useAuthForm(redirectTo)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          setIsAlreadyAuthenticated(true)
          window.location.href = redirectTo
        }
      } catch (error) {
      } finally {
        setIsCheckingAuth(false)
      }
    }

    checkAuth()
  }, [supabase, redirectTo])

  const handleTabChange = (value: string) => {
    if (value === "signin" || value === "signup" || value === "reset") {
      setActiveTab(value)
    }
  }

  if (isCheckingAuth || isCheckingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!isAccessCodeVerified && !isAlreadyAuthenticated) {
    return (
      <AccessCodeForm accessCode={accessCode} error={accessCodeError} onAccessCodeChange={handleAccessCodeChange} />
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Welcome</CardTitle>
          <CardDescription className="text-center">
            Sign in to your account or create a new one
            <span className="block text-green-600 text-xs mt-1">✅ Access Code Verified</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
              <TabsTrigger value="reset">Reset</TabsTrigger>
            </TabsList>

            {authError && (
              <Alert variant="destructive" className="mt-4">
                <AlertDescription>{authError}</AlertDescription>
              </Alert>
            )}

            <TabsContent value="signin">
              <SignInForm onSubmit={signIn} isLoading={isLoading} />
            </TabsContent>

            <TabsContent value="signup">
              <SignUpForm onSubmit={signUp} onSuccess={() => setActiveTab("signin")} isLoading={isLoading} />
            </TabsContent>

            <TabsContent value="reset">
              <ResetPasswordForm
                onSubmit={resetPassword}
                onSuccess={() => setActiveTab("signin")}
                isLoading={isLoading}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
