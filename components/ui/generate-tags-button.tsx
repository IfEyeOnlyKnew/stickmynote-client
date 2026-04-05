"use client"

import { Button } from "@/components/ui/button"
import { Tag } from "lucide-react"

interface GenerateTagsButtonProps {
  onClick: () => void
  isGenerating: boolean
  disabled?: boolean
  className?: string
  size?: "sm" | "default" | "lg"
  variant?: "outline" | "default" | "ghost"
  showIcon?: boolean
}

export function GenerateTagsButton({
  onClick,
  isGenerating,
  disabled = false,
  className = "",
  size = "sm",
  variant = "outline",
  showIcon = true,
}: Readonly<GenerateTagsButtonProps>) {
  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      disabled={isGenerating || disabled}
      className={`text-xs h-6 ${variant === "outline" ? "bg-transparent" : ""} ${className}`}
    >
      {isGenerating ? (
        <>
          <div className="h-3 w-3 mr-1 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
          Generating...
        </>
      ) : (
        <>
          {showIcon && <Tag className="h-3 w-3 mr-1" />}
          Generate Links
        </>
      )}
    </Button>
  )
}
