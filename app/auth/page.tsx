"use client"

import type React from "react"

import { createSupabaseBrowser } from "@/lib/supabase-browser"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, ArrowLeft, Mail } from "lucide-react"
import Link from "next/link"
import { useForm } from "@/hooks/useForm"
import { FormField } from "@/components/forms/FormField"

interface ResetPasswordFormData {
  email: string
}

export default function ResetPasswordPage() {
  const {
    data: formData,
    errors,
    isSubmitting,
    updateField,
    setFieldError,
    setIsSubmitting,
    clearErrors,
  } = useForm<ResetPasswordFormData>({
    email: "",
  })

  const supabase = createSupabaseBrowser()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.email) {
      setFieldError("email", "Please enter your email address.")
      return
    }

    setIsSubmitting(true)
    clearErrors()

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: `${window.location.origin}/auth/reset-password/confirm`,
      })

      if (error) {
        setFieldError("email", error.message)
      } else {
        setFieldError("email", "✓ Password reset email sent! Please check your inbox and follow the instructions.")
      }
    } catch (err) {
      console.error("Reset password error:", err)
      setFieldError("email", "An unexpected error occurred. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const isSuccess = errors.email?.startsWith("✓")

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <Link href="/auth/login">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Sign In
            </Button>
          </Link>
        </div>

        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Reset Password</CardTitle>
            <CardDescription className="text-center">
              Enter your email address and we'll send you a link to reset your password
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <FormField
                label="Email"
                type="email"
                value={formData.email}
                onChange={(value) => updateField("email", value)}
                placeholder="Enter your email address"
                required
                disabled={isSubmitting}
                autoComplete="email"
              />

              {errors.email && (
                <Alert variant={isSuccess ? "default" : "destructive"}>
                  {isSuccess && <Mail className="h-4 w-4" />}
                  <AlertDescription className={isSuccess ? "text-green-600" : ""}>{errors.email}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Reset Email
              </Button>
            </form>

            <div className="text-center">
              <p className="text-sm text-gray-600">
                Remember your password?{" "}
                <Link href="/auth/login" className="text-blue-600 hover:underline font-medium">
                  Sign in here
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
