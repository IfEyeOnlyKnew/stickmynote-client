"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface FormFieldProps {
  label: string
  type?: string
  placeholder?: string
  value: string | undefined
  onChange: (value: string) => void
  error?: string
  required?: boolean
  disabled?: boolean
  autoComplete?: string
  maxLength?: number
  minLength?: number
  className?: string
}

export function FormField({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  error,
  required,
  disabled,
  autoComplete,
  maxLength,
  minLength,
  className = "",
}: Readonly<FormFieldProps>) {
  const id = `field-${label.toLowerCase().replaceAll(/\s+/g, "-")}`

  return (
    <div className={`space-y-2 ${className}`}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        autoComplete={autoComplete}
        maxLength={maxLength}
        minLength={minLength}
        className={error ? "border-red-500" : ""}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
