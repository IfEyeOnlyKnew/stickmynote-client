"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Network } from "lucide-react"
import { StickMapModal } from "@/components/stick-map-modal"

interface StickMapButtonProps {
  readonly stickId: string
  readonly stickTopic?: string | null
  readonly stickContent?: string | null
  readonly stickColor?: string | null
  readonly isPersonal?: boolean
  readonly size?: "sm" | "default"
  readonly className?: string
  readonly label?: string
  readonly showLabel?: boolean
}

export function StickMapButton({
  stickId,
  stickTopic,
  stickContent,
  stickColor,
  isPersonal = false,
  size = "sm",
  className = "h-8 px-2",
  label = "Stick Map",
  showLabel = false,
}: StickMapButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const handleOpen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setOpen(true)
  }, [])

  const handleNodeClick = useCallback(
    async (nodeId: string, data?: { chatId?: string; meetingId?: string }) => {
      setOpen(false)

      if (nodeId === "noted") {
        try {
          const query = isPersonal ? "?personal=true" : ""
          const res = await fetch(`/api/noted/pages/by-stick/${stickId}${query}`)
          const json = await res.json()
          if (json.exists && json.data?.id) {
            router.push(`/noted?page=${json.data.id}`)
          }
        } catch (err) {
          console.error("Error navigating to noted page:", err)
        }
        return
      }

      if (nodeId === "chats" && data?.chatId) {
        router.push(`/chats/${data.chatId}`)
        return
      }

      if (nodeId === "videoRooms") {
        router.push("/video")
        return
      }

      if (nodeId === "calsticks") {
        window.open(`/calsticks?stickId=${stickId}`, "_blank")
      }
    },
    [router, stickId],
  )

  return (
    <>
      <Button
        variant="ghost"
        size={size}
        onClick={handleOpen}
        className={className}
        title={label}
      >
        <Network className="h-4 w-4" />
        {showLabel && <span className="ml-1 text-xs">{label}</span>}
      </Button>

      <StickMapModal
        open={open}
        onOpenChange={setOpen}
        stickId={stickId}
        stickTopic={stickTopic || ""}
        stickContent={stickContent || ""}
        stickColor={stickColor || ""}
        onNodeClick={handleNodeClick}
      />
    </>
  )
}
