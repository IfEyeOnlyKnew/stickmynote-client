"use client"

import { Button } from "@/components/ui/button"
import { Heart } from "lucide-react"
import { cn } from "@/lib/utils"

interface LikeButtonProps {
  likeCount: number
  isLiked: boolean
  onToggleLike: () => void
  size?: "sm" | "md" | "lg"
}

export function LikeButton({ likeCount, isLiked, onToggleLike, size = "md" }: Readonly<LikeButtonProps>) {
  const sizeClasses = {
    sm: "h-7 w-auto px-2 text-xs",
    md: "h-8 w-auto px-3 text-sm",
    lg: "h-10 w-auto px-4 text-base",
  }

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        sizeClasses[size],
        "gap-1.5 hover:bg-accent hover:text-accent-foreground transition-colors",
        isLiked && "text-red-500 hover:text-red-600",
      )}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onToggleLike()
      }}
      type="button"
    >
      <Heart className={cn(iconSizes[size], "transition-all", isLiked && "fill-current")} />
      {likeCount > 0 && <span className="font-medium">{likeCount}</span>}
    </Button>
  )
}
