"use client"

import type React from "react"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Lock } from "lucide-react"
import { useForm } from "@/hooks/useForm"
import { PasswordField } from "@/components/forms/PasswordField"

interface ResetPasswordFormData {
  password: string
  confirmPassword: string
}

export default function ResetPasswordConfirmPage() {
  const {
    data: formData,
    errors,
    isSubmitting,
    updateField,
    setFieldError,
    setIsSubmitting,
    clearErrors,
  } = useForm<ResetPasswordFormData>({
    password: "",
    confirmPassword: "",
  })

  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  useEffect(() => {
    if (!token) {
      setFieldError("password", "Invalid or expired reset link. Please request a new one.")
    }
  }, [token, setFieldError])

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    clearErrors()

    if (formData.password !== formData.confirmPassword) {
      setFieldError("confirmPassword", "Passwords do not match")
      setIsSubmitting(false)
      return
    }

    if (formData.password.length < 6) {
      setFieldError("password", "Password must be at least 6 characters long")
      setIsSubmitting(false)
      return
    }

    try {
      const response = await fetch("/api/auth/reset-password/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: formData.password }),
      })

      const data = await response.json()

      if (response.ok) {
        router.push("/auth/login?message=Password updated successfully")
      } else {
        setFieldError("password", data.error || "Failed to update password")
      }
    } catch (err) {
      setFieldError("password", "An unexpected error occurred. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Set New Password</h1>
            <p className="text-gray-600 mt-2">Enter your new password below.</p>
          </div>

          {errors.password && (
            <Alert className="mb-4 border-red-200 bg-red-50">
              <AlertDescription className="text-red-800">{errors.password}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <PasswordField
              label="New Password"
              value={formData.password}
              onChange={(value) => updateField("password", value)}
              error={errors.password}
              placeholder="Enter new password"
              required
              minLength={6}
            />

            <PasswordField
              label="Confirm New Password"
              value={formData.confirmPassword}
              onChange={(value) => updateField("confirmPassword", value)}
              error={errors.confirmPassword}
              placeholder="Confirm new password"
              required
              minLength={6}
            />

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
