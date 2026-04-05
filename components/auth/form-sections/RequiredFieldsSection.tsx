"use client"
import { FormField } from "@/components/forms/FormField"
import { PasswordField } from "./PasswordField"
import type { SignUpData } from "@/hooks/use-auth-form"

interface RequiredFieldsSectionProps {
  formData: SignUpData
  updateField: (field: keyof SignUpData, value: string) => void
  isLoading: boolean
  showPassword: boolean
  onTogglePassword: () => void
}

export function RequiredFieldsSection({
  formData,
  updateField,
  isLoading,
  showPassword,
  onTogglePassword,
}: Readonly<RequiredFieldsSectionProps>) {
  return (
    <div className="space-y-4">
      <FormField
        label="Email"
        type="email"
        placeholder="Enter your email"
        value={formData.email}
        onChange={(value) => updateField("email", value)}
        required
        disabled={isLoading}
        autoComplete="email"
      />

      <PasswordField
        label="Password *"
        placeholder="Create a password (min 6 characters)"
        value={formData.password}
        onChange={(value) => updateField("password", value)}
        required
        disabled={isLoading}
        autoComplete="new-password"
      />

      <PasswordField
        label="Confirm Password *"
        placeholder="Confirm your password"
        value={formData.confirmPassword}
        onChange={(value) => updateField("confirmPassword", value)}
        required
        disabled={isLoading}
        autoComplete="new-password"
      />

      <FormField
        label="Full Name"
        type="text"
        placeholder="Enter your full name"
        value={formData.fullName}
        onChange={(value) => updateField("fullName", value)}
        required
        disabled={isLoading}
        autoComplete="name"
      />

      <FormField
        label="Username"
        type="text"
        placeholder="Choose a username"
        value={formData.username}
        onChange={(value) => updateField("username", value)}
        required
        disabled={isLoading}
        autoComplete="username"
      />
    </div>
  )
}
