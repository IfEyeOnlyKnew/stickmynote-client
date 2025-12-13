"use client"

import type React from "react"

import { createSupabaseBrowser } from "@/lib/supabase-browser"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"
import { ArrowLeft, Mail } from "lucide-react"
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

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    clearErrors()

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: `${window.location.origin}/auth/reset-password/confirm`,
      })

      if (error) {
        setFieldError("email", error.message)
      } else {
        setFieldError("email", "") // Clear error to show success
        // Show success message by setting a "positive" error
        setTimeout(() => {
          setFieldError("email", "✓ Check your email for the password reset link!")
        }, 100)
      }
    } catch (err) {
      setFieldError("email", "An unexpected error occurred. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const isSuccess = errors.email?.startsWith("✓")

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Mail className="w-6 h-6 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Reset Password</h1>
            <p className="text-gray-600 mt-2">
              Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>

          {errors.email && (
            <Alert className={`mb-4 ${isSuccess ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
              <AlertDescription className={isSuccess ? "text-green-800" : "text-red-800"}>
                {errors.email}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleResetPassword} className="space-y-4">
            <FormField
              label="Email Address"
              type="email"
              value={formData.email}
              onChange={(value) => updateField("email", value)}
              placeholder="Enter your email address"
              required
              autoComplete="email"
            />

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Sending..." : "Send Reset Link"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/auth/login"
              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-500 font-medium"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
