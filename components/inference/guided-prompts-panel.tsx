"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Lightbulb, MessageSquarePlus } from "lucide-react"
import type { GuidedPrompt } from "@/types/discussion-templates"

interface GuidedPromptsPanelProps {
  prompts: GuidedPrompt[]
  onSelectPrompt: (category: string) => void
  className?: string
}

const priorityStyles: Record<GuidedPrompt["priority"], { icon: string; bg: string; border: string; text: string }> = {
  high: {
    icon: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-800",
  },
  medium: {
    icon: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-800",
  },
  low: {
    icon: "text-gray-500",
    bg: "bg-gray-50",
    border: "border-gray-200",
    text: "text-gray-700",
  },
}

export function GuidedPromptsPanel({
  prompts,
  onSelectPrompt,
  className,
}: Readonly<GuidedPromptsPanelProps>) {
  if (prompts.length === 0) {
    return null
  }

  // Only show top 3 prompts
  const displayedPrompts = prompts.slice(0, 3)

  return (
    <div
      className={cn(
        "rounded-lg border border-blue-200 bg-blue-50/50 p-3",
        className
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-blue-800 mb-2">
        <Lightbulb className="h-4 w-4" />
        Suggested Next Steps
      </div>

      <div className="space-y-2">
        {displayedPrompts.map((prompt) => {
          const styles = priorityStyles[prompt.priority]

          return (
            <div
              key={prompt.prompt}
              className={cn(
                "flex items-center justify-between gap-2 p-2.5 rounded-md border",
                styles.bg,
                styles.border
              )}
            >
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm", styles.text)}>{prompt.prompt}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={cn(
                      "text-xs px-1.5 py-0.5 rounded",
                      (() => {
                        if (prompt.reason === "required") return "bg-amber-100 text-amber-700"
                        if (prompt.reason === "suggested") return "bg-blue-100 text-blue-700"
                        return "bg-gray-100 text-gray-600"
                      })()
                    )}
                  >
                    {(() => {
                      if (prompt.reason === "required") return "Required"
                      if (prompt.reason === "suggested") return "Suggested"
                      return "Next Step"
                    })()}
                  </span>
                  <span className="text-xs text-gray-500">
                    Category: <strong>{prompt.category}</strong>
                  </span>
                </div>
              </div>

              <Button
                size="sm"
                variant="ghost"
                className={cn(
                  "flex-shrink-0 h-8",
                  styles.text,
                  "hover:bg-white/50"
                )}
                onClick={() => onSelectPrompt(prompt.category)}
              >
                <MessageSquarePlus className="h-4 w-4 mr-1" />
                Add Reply
              </Button>
            </div>
          )
        })}
      </div>

      {prompts.length > 3 && (
        <p className="text-xs text-gray-500 mt-2 text-center">
          +{prompts.length - 3} more suggestions
        </p>
      )}
    </div>
  )
}
