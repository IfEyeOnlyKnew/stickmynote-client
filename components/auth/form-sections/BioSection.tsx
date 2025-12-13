"use client"
import { TextAreaField } from "@/components/forms/TextAreaField"
import type { SignUpData } from "@/hooks/use-auth-form"

interface BioSectionProps {
  formData: SignUpData
  updateField: (field: keyof SignUpData, value: string) => void
  isLoading: boolean
}

export function BioSection({ formData, updateField, isLoading }: BioSectionProps) {
  return (
    <TextAreaField
      label="Bio"
      placeholder="Tell us about yourself"
      value={formData.bio}
      onChange={(value) => updateField("bio", value)}
      disabled={isLoading}
      rows={3}
      maxLength={500}
      showCharCount={true}
    />
  )
}
