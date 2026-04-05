"use client"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Smile } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"

export const REACTIONS = [
  { emoji: "👍", label: "Thumbs up", value: "thumbs_up" },
  { emoji: "❤️", label: "Heart", value: "heart" },
  { emoji: "🎉", label: "Celebrate", value: "celebrate" },
  { emoji: "💡", label: "Idea", value: "idea" },
  { emoji: "👀", label: "Eyes", value: "eyes" },
  { emoji: "🔥", label: "Fire", value: "fire" },
  { emoji: "✅", label: "Check", value: "check" },
  { emoji: "❓", label: "Question", value: "question" },
]

interface ReactionPickerProps {
  onReactionSelect: (reactionType: string) => void
  userReactions?: Set<string>
  size?: "sm" | "md" | "lg"
}

export function ReactionPicker({ onReactionSelect, userReactions = new Set(), size = "md" }: Readonly<ReactionPickerProps>) {
  const [open, setOpen] = useState(false)

  const buttonSizeClasses = {
    sm: "h-6 w-6 text-sm",
    md: "h-8 w-8 text-base",
    lg: "h-10 w-10 text-lg",
  }

  const handleReactionClick = (reactionValue: string) => {
    onReactionSelect(reactionValue)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size={size === "sm" ? "sm" : "icon"}
          className={cn(size === "sm" ? "h-7 w-7" : "", "hover:bg-accent hover:text-accent-foreground")}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setOpen(!open)
          }}
          type="button"
        >
          <Smile className={cn("h-4 w-4", size === "sm" && "h-3 w-3")} />
          <span className="sr-only">Add reaction</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-2"
        align="start"
        side="bottom"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          // Allow closing if clicking outside, but not if clicking the trigger
          if (e.target instanceof Element && e.target.closest('[role="button"]')) {
            e.preventDefault()
          }
        }}
      >
        <div className="flex flex-wrap gap-1 max-w-xs">
          {REACTIONS.map((reaction) => {
            const isSelected = userReactions.has(reaction.value)
            return (
              <Button
                key={reaction.value}
                variant={isSelected ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  buttonSizeClasses[size],
                  "hover:scale-110 transition-transform",
                  isSelected && "ring-2 ring-primary",
                )}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleReactionClick(reaction.value)
                }}
                title={reaction.label}
                type="button"
              >
                {reaction.emoji}
              </Button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
