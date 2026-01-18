"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { MessageSquare, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useCSRF } from "@/hooks/useCSRF"
import type { StickType } from "@/types/stick-chat"

interface ChatIconButtonProps {
  stickId: string
  stickType: StickType
  unreadCount?: number
  className?: string
}

/**
 * A chat icon button that can be placed on stick/note cards.
 * Clicking it creates or opens an existing chat for that stick.
 */
export const ChatIconButton: React.FC<ChatIconButtonProps> = ({
  stickId,
  stickType,
  unreadCount = 0,
  className = "",
}) => {
  const router = useRouter()
  const { csrfToken } = useCSRF()
  const [isLoading, setIsLoading] = useState(false)

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card click
    e.preventDefault()

    if (isLoading) return

    setIsLoading(true)

    try {
      // Try to create or get existing chat for this stick
      const response = await fetch("/api/stick-chats", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
        body: JSON.stringify({
          stick_id: stickId,
          stick_type: stickType,
          is_group: false, // Default to 1-on-1 for stick chats
        }),
      })

      if (response.ok) {
        const data = await response.json()
        // Navigate to the chat room
        router.push(`/chats/${data.chat.id}`)
      } else {
        console.error("Failed to create/get chat:", await response.text())
      }
    } catch (error) {
      console.error("Error opening chat:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`
        relative p-1.5 rounded-md transition-all duration-200
        hover:bg-purple-100 hover:text-purple-600
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      title="Open chat"
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
      ) : (
        <>
          <MessageSquare className="w-4 h-4 text-gray-500 hover:text-purple-600" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 bg-blue-500 text-white text-[10px] px-1 py-0 min-w-[16px] h-4 flex items-center justify-center"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </>
      )}
    </button>
  )
}
