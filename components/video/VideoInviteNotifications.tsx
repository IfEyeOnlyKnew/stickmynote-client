"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Video, X } from "lucide-react"
import { useWebSocket } from "@/hooks/useWebSocket"

interface VideoInvitePayload {
  roomId: string
  roomName: string
  roomUrl: string
  invitedBy: {
    id: string
    name: string
  }
}

interface ActiveInvite extends VideoInvitePayload {
  receivedAt: number
}

const AUTO_DISMISS_MS = 20000

/**
 * Global listener for `video_invite` WebSocket events.
 * Shows a toast-style popup that the invitee can use to join the room
 * without leaving whatever page they were on.
 */
export function VideoInviteNotifications() {
  const { subscribe } = useWebSocket()
  const [invite, setInvite] = useState<ActiveInvite | null>(null)
  const [isExiting, setIsExiting] = useState(false)

  const sendRsvp = useCallback((roomId: string, status: "joined" | "declined") => {
    fetch(`/api/video/rooms/${roomId}/participants`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => {})
  }, [])

  const handleDismiss = useCallback((decline = false) => {
    if (decline && invite) sendRsvp(invite.roomId, "declined")
    setIsExiting(true)
    setTimeout(() => {
      setInvite(null)
      setIsExiting(false)
    }, 300)
  }, [invite, sendRsvp])

  const handleJoin = useCallback(() => {
    if (!invite) return
    sendRsvp(invite.roomId, "joined")
    globalThis.open(invite.roomUrl, "_blank", "noopener,noreferrer")
    handleDismiss(false)
  }, [invite, sendRsvp, handleDismiss])

  useEffect(() => {
    const unsubscribe = subscribe("video_invite", (payload: VideoInvitePayload) => {
      if (!payload?.roomId || !payload?.roomUrl) return
      setInvite({ ...payload, receivedAt: Date.now() })
      setIsExiting(false)
    })
    return unsubscribe
  }, [subscribe])

  useEffect(() => {
    if (!invite) return
    const timer = setTimeout(() => handleDismiss(false), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [invite, handleDismiss])

  if (!invite) return null

  return (
    <div
      className={`
        fixed bottom-4 right-4 z-[60]
        max-w-sm w-full
        bg-white rounded-lg shadow-xl border border-gray-200
        transform transition-all duration-300 ease-out
        ${isExiting ? "translate-x-full opacity-0" : "translate-x-0 opacity-100"}
      `}
      role="dialog"
      aria-label="Video call invitation"
    >
      <div className="absolute top-0 left-0 right-0 h-1 bg-gray-100 rounded-t-lg overflow-hidden">
        <div
          className="h-full bg-blue-500"
          style={{
            animation: `vi-shrink ${AUTO_DISMISS_MS}ms linear forwards`,
          }}
        />
      </div>

      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 p-2 bg-blue-100 rounded-full">
            <Video className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm">
              Video call invitation
            </p>
            <p className="text-sm text-gray-600 mt-0.5">
              <span className="font-medium">{invite.invitedBy.name}</span> is inviting you
              to
            </p>
            <p className="text-sm text-gray-900 font-medium truncate mt-0.5">
              "{invite.roomName}"
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleDismiss(true)}
            className="flex-shrink-0 p-1 hover:bg-gray-100 rounded transition-colors"
            aria-label="Dismiss invite"
          >
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>

        <div className="flex gap-2 mt-3 ml-11">
          <Button
            size="sm"
            onClick={handleJoin}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Join Call
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleDismiss(true)}>
            Dismiss
          </Button>
        </div>
      </div>

      <style jsx>{`
        @keyframes vi-shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  )
}
