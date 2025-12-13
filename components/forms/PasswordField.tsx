"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff } from "lucide-react"
import { PasswordStrengthIndicator } from "./PasswordStrengthIndicator"

interface PasswordFieldProps {
  label: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
  error?: string
  required?: boolean
  disabled?: boolean
  autoComplete?: string
  showStrengthIndicator?: boolean
  minLength?: number
}

export function PasswordField({
  label,
  placeholder = "Enter your password",
  value,
  onChange,
  error,
  required,
  disabled,
  autoComplete = "current-password",
  showStrengthIndicator = false,
  minLength,
}: PasswordFieldProps) {
  const [showPassword, setShowPassword] = useState(false)
  const id = `password-${label.toLowerCase().replace(/\s+/g, "-")}`

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={showPassword ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete}
          minLength={minLength}
          className={error ? "border-red-500 pr-10" : "pr-10"}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
          onClick={() => setShowPassword(!showPassword)}
          disabled={disabled}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {showStrengthIndicator && <PasswordStrengthIndicator password={value} />}
    </div>
  )
}
