"use client"

import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface TextAreaFieldProps {
  label: string
  placeholder?: string
  value: string | undefined
  onChange: (value: string) => void
  error?: string
  required?: boolean
  disabled?: boolean
  rows?: number
  maxLength?: number
  showCharCount?: boolean
  className?: string
}

export function TextAreaField({
  label,
  placeholder,
  value,
  onChange,
  error,
  required,
  disabled,
  rows = 3,
  maxLength,
  showCharCount = true,
  className = "",
}: Readonly<TextAreaFieldProps>) {
  const id = `textarea-${label.toLowerCase().replaceAll(/\s+/g, "-")}`
  const safeValue = value || ""

  return (
    <div className={`space-y-2 ${className}`}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      <Textarea
        id={id}
        placeholder={placeholder}
        value={safeValue}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        rows={rows}
        maxLength={maxLength}
        className={error ? "border-red-500" : ""}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      {showCharCount && maxLength && (
        <div className="flex justify-end text-xs text-gray-500">
          <span>
            {safeValue.length}/{maxLength} characters
          </span>
        </div>
      )}
    </div>
  )
}
