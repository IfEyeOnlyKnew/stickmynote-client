"use client"

import { Button } from "@/components/ui/button"
import { FileText } from "lucide-react"

interface SummarizeLinksButtonProps {
  onClick: () => void
  isSummarizing: boolean
  disabled?: boolean
  className?: string
  size?: "sm" | "default" | "lg"
  variant?: "outline" | "default" | "ghost"
  showIcon?: boolean
}

export function SummarizeLinksButton({
  onClick,
  isSummarizing,
  disabled = false,
  className = "",
  size = "sm",
  variant = "outline",
  showIcon = true,
}: Readonly<SummarizeLinksButtonProps>) {
  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      disabled={isSummarizing || disabled}
      className={`text-xs h-6 ${variant === "outline" ? "bg-transparent" : ""} ${className}`}
    >
      {isSummarizing ? (
        <>
          <div className="h-3 w-3 mr-1 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
          Summarizing...
        </>
      ) : (
        <>
          {showIcon && <FileText className="h-3 w-3 mr-1" />}
          Link Summary
        </>
      )}
    </Button>
  )
}
