"use client"
import { PasswordField as ReusablePasswordField } from "@/components/forms/PasswordField"

interface PasswordFieldProps {
  id: string
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  disabled?: boolean
  autoComplete?: string
  minLength?: number
  showPassword?: boolean
  onToggleVisibility?: () => void
}

export function PasswordField({
  label,
  placeholder,
  value,
  onChange,
  required = false,
  disabled = false,
  autoComplete,
}: PasswordFieldProps) {
  return (
    <ReusablePasswordField
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      required={required}
      disabled={disabled}
      autoComplete={autoComplete}
    />
  )
}
