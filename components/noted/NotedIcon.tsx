"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useCSRF } from "@/hooks/useCSRF"

interface NotedIconProps {
  stickId: string
  stickTopic?: string
  stickContent?: string
  isPersonal?: boolean
  size?: "sm" | "md"
  className?: string
}

export function NotedIcon({
  stickId,
  stickTopic,
  stickContent,
  isPersonal = false,
  size = "sm",
  className,
}: Readonly<NotedIconProps>) {
  const router = useRouter()
  const { csrfToken } = useCSRF()
  const [loading, setLoading] = useState(false)

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (loading) return
    setLoading(true)

    try {
      // Check if a Noted page already exists
      const params = isPersonal ? "?personal=true" : ""
      const checkRes = await fetch(`/api/noted/pages/by-stick/${stickId}${params}`, {
        credentials: "include",
      })
      const checkJson = await checkRes.json()

      if (checkJson.exists && checkJson.data?.id) {
        // Navigate to existing page
        router.push(`/noted?page=${checkJson.data.id}`)
        return
      }

      // Create a new Noted page
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (csrfToken) headers["x-csrf-token"] = csrfToken

      const createRes = await fetch("/api/noted/pages", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          [isPersonal ? "personal_stick_id" : "stick_id"]: stickId,
          title: stickTopic || "Untitled",
          content: stickContent || "",
          is_personal: isPersonal,
          source_content: stickContent || "",
        }),
      })

      if (!createRes.ok) throw new Error("Failed to create Noted page")
      const createJson = await createRes.json()
      router.push(`/noted?page=${createJson.data.id}`)
    } catch (err) {
      console.error("Noted icon error:", err)
    } finally {
      setLoading(false)
    }
  }, [stickId, stickTopic, stickContent, isPersonal, csrfToken, loading, router])

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClick}
            disabled={loading}
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
