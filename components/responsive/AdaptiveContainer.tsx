"use client"

import { cn } from "@/lib/utils"

interface AdaptiveContainerProps {
  children: React.ReactNode
  className?: string
  /** Max width: "sm" | "md" | "lg" | "xl" | "full" */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "full"
  /** Add padding on sides */
  padded?: boolean
}

const maxWidthClasses = {
  sm: "max-w-2xl",
  md: "max-w-4xl",
  lg: "max-w-6xl",
  xl: "max-w-7xl",
  full: "max-w-full",
}

export function AdaptiveContainer({
  children,
  className,
  maxWidth = "lg",
  padded = true,
}: Readonly<AdaptiveContainerProps>) {
  return (
    <div
      className={cn(
        "mx-auto w-full",
        maxWidthClasses[maxWidth],
        padded && "px-4 sm:px-6 lg:px-8",
        className,
      )}
    >
      {children}
    </div>
  )
}
