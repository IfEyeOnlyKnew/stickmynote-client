"use client"

import React, { useState } from "react"
import { MessagesSquare } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { CreateChatModal } from "@/components/stick-chats/CreateChatModal"

interface ChatIconButtonProps {
  readonly unreadCount?: number
  readonly className?: string
}

/**
 * A chat icon button that opens the Create Chat modal.
 * Can be placed on dashboards or navigation areas.
 */
export const ChatIconButton: React.FC<ChatIconButtonProps> = ({
  unreadCount = 0,
  className = "",
}) => {
  const [modalOpen, setModalOpen] = useState(false)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setModalOpen(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`
          relative p-1.5 rounded-md transition-all duration-200
          hover:bg-purple-100 hover:text-purple-600
          ${className}
        `}
        title="New chat"
      >
        <MessagesSquare className="w-4 h-4 text-gray-500 hover:text-purple-600" />
        {unreadCount > 0 && (
          <Badge
            className="absolute -top-1 -right-1 bg-blue-500 text-white text-[10px] px-1 py-0 min-w-[16px] h-4 flex items-center justify-center"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </Badge>
        )}
      </button>

      <CreateChatModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  )
}
