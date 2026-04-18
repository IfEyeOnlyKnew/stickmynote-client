"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface NotedIconProps {
  stickId: string
  stickTopic?: string
  stickContent?: string
  isPersonal?: boolean
  size?: "sm" | "md"
  className?: string
  openInNewTab?: boolean
}

export function NotedIcon({
  stickId,
  isPersonal = false,
  size = "sm",
  className,
  openInNewTab = false,
}: Readonly<NotedIconProps>) {
  const router = useRouter()

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const params = new URLSearchParams({ stick: stickId })
    if (isPersonal) params.set("personal", "true")
    const url = `/noted?${params.toString()}`
    if (openInNewTab) {
      window.open(url, "_blank", "noopener,noreferrer")
    } else {
      router.push(url)
    }
  }, [stickId, isPersonal, openInNewTab, router])

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClick}
            className={className || (size === "sm" ? "h-8 px-2" : "h-9 px-3")}
          >
            <BookOpen className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} />
          </Button>
        </TooltipTrigger>
        <TooltipContent className="z-[9999]" sideOffset={8}>
          <p>Open in Noted</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
