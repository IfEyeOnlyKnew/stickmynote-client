"use client"
import { useState } from "react"
import type React from "react"

import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import type { SignUpData } from "@/hooks/use-auth-form"

import { RequiredFieldsSection } from "./form-sections/RequiredFieldsSection"
import { ProfileFieldsSection } from "./form-sections/ProfileFieldsSection"
import { BioSection } from "./form-sections/BioSection"

interface SignUpFormProps {
  onSubmit: (data: SignUpData) => Promise<boolean>
  onSuccess: () => void
  isLoading: boolean
}

export function SignUpForm({ onSubmit, onSuccess, isLoading }: Readonly<SignUpFormProps>) {
  const [formData, setFormData] = useState<SignUpData>({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    username: "",
    phone: "",
    location: "",
    bio: "",
    website: "",
    avatarUrl: "",
  })
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const success = await onSubmit(formData)
    if (success) {
      setFormData({
        email: "",
        password: "",
        confirmPassword: "",
        fullName: "",
        username: "",
        phone: "",
        location: "",
        bio: "",
        website: "",
        avatarUrl: "",
      })
      onSuccess()
    }
  }

  const updateField = (field: keyof SignUpData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <RequiredFieldsSection
        formData={formData}
        updateField={updateField}
        isLoading={isLoading}
        showPassword={showPassword}
        onTogglePassword={() => setShowPassword(!showPassword)}
      />

      <ProfileFieldsSection formData={formData} updateField={updateField} isLoading={isLoading} />

      <BioSection formData={formData} updateField={updateField} isLoading={isLoading} />

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating account...
          </>
        ) : (
          "Sign Up"
        )}
      </Button>
    </form>
  )
}
