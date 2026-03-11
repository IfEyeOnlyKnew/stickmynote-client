"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Mic,
  MicOff,
  Headphones,
  HeadphonesIcon,
  PhoneOff,
  Volume2,
  Settings,
  Users,
  Loader2,
} from "lucide-react"
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
  useSpeakingParticipants,
} from "@livekit/components-react"
import "@livekit/components-styles"
import { useCSRF } from "@/hooks/useCSRF"
import { useWebSocket } from "@/hooks/useWebSocket"
import type { StickChatWithDetails, VoiceParticipant } from "@/types/stick-chat"

interface VoiceChannelViewProps {
  channel: StickChatWithDetails
  currentUserId: string
}

export function VoiceChannelView({ channel, currentUserId }: VoiceChannelViewProps) {
  const { csrfToken } = useCSRF()
  const { subscribe } = useWebSocket()

  const [token, setToken] = useState<string | null>(null)
  const [roomName, setRoomName] = useState<string | null>(null)
  const [participants, setParticipants] = useState<VoiceParticipant[]>([])
  const [isJoined, setIsJoined] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL

  // Fetch current participants
  const fetchParticipants = useCallback(async () => {
    try {
      const res = await fetch(`/api/stick-chats/${channel.id}/voice`)
      if (res.ok) {
        const data = await res.json()
        setParticipants(data.participants || [])
      }
    } catch {}
  }, [channel.id])

  useEffect(() => {
    fetchParticipants()
  }, [fetchParticipants])

  // Listen for join/leave events
  useEffect(() => {
    const unsubs = [
      subscribe("voice.joined", (payload: any) => {
        if (payload.chatId === channel.id) fetchParticipants()
      }),
      subscribe("voice.left", (payload: any) => {
        if (payload.chatId === channel.id) fetchParticipants()
      }),
    ]
    return () => unsubs.forEach((u) => u())
  }, [subscribe, channel.id, fetchParticipants])

  const handleJoin = async () => {
    setIsConnecting(true)
    setError(null)
    try {
      // Get token
      const res = await fetch(`/api/stick-chats/${channel.id}/voice`)
      if (!res.ok) throw new Error("Failed to get voice token")
      const data = await res.json()
      setToken(data.token)
      setRoomName(data.roomName)

      // Register join
      await fetch(`/api/stick-chats/${channel.id}/voice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
      })

      setIsJoined(true)
    } catch (err) {
      setError("Failed to join voice channel")
      console.error(err)
    } finally {
      setIsConnecting(false)
    }
  }

  const handleLeave = async () => {
    try {
      await fetch(`/api/stick-chats/${channel.id}/voice`, {
        method: "DELETE",
        headers: {
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
      })
    } catch {}
    setIsJoined(false)
    setToken(null)
    setRoomName(null)
  }

  if (isJoined && token && roomName && livekitUrl) {
    return (
      <LiveKitRoom
        serverUrl={livekitUrl}
        token={token}
        connect={true}
        audio={true}
        video={false}
        onDisconnected={handleLeave}
      >
        <RoomAudioRenderer />
        <VoiceChannelContent
          channel={channel}
          currentUserId={currentUserId}
          onLeave={handleLeave}
        />
      </LiveKitRoom>
    )
  }

  // Not joined - show lobby
  return (
    <div className="flex flex-col items-center justify-center h-full bg-gray-50 p-8">
      <Volume2 className="w-16 h-16 text-green-500 mb-4" />
      <h2 className="text-xl font-bold text-gray-900 mb-1">{channel.name}</h2>
      {channel.description && (
        <p className="text-sm text-gray-500 mb-4 text-center max-w-md">{channel.description}</p>
      )}

      {/* Current participants */}
      {participants.length > 0 && (
        <div className="mb-6">
          <p className="text-xs text-gray-400 font-medium mb-2 text-center">
            {participants.length} connected
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {participants.map((p) => (
              <div key={p.id} className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm text-gray-700">
                  {p.user?.full_name || p.user?.username || "User"}
                </span>
                {p.is_muted && <MicOff className="w-3 h-3 text-red-400" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <Button
        size="lg"
        onClick={handleJoin}
        disabled={isConnecting}
        className="bg-green-600 hover:bg-green-700"
      >
        {isConnecting ? (
          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
        ) : (
          <Headphones className="w-5 h-5 mr-2" />
        )}
        Join Voice
      </Button>
    </div>
  )
}

function VoiceChannelContent({
  channel,
  currentUserId,
  onLeave,
}: {
  channel: StickChatWithDetails
  currentUserId: string
  onLeave: () => void
}) {
  const room = useRoomContext()
  const livekitParticipants = useParticipants()
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant()
  const speakingParticipants = useSpeakingParticipants()
  const [isDeafened, setIsDeafened] = useState(false)

  const toggleMic = useCallback(async () => {
    await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)
  }, [localParticipant, isMicrophoneEnabled])

  const toggleDeafen = useCallback(() => {
    setIsDeafened((prev) => {
      const next = !prev
      // Mute all remote audio tracks
      for (const p of livekitParticipants) {
        if (p.identity !== localParticipant.identity) {
          for (const pub of p.audioTrackPublications.values()) {
            if (pub.track) {
              (pub.track as any).enabled = !next
            }
          }
        }
      }
      return next
    })
  }, [livekitParticipants, localParticipant])

  const handleDisconnect = useCallback(() => {
    room.disconnect()
    onLeave()
  }, [room, onLeave])

  const speakingIds = new Set(speakingParticipants.map((p) => p.identity))

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b border-slate-800">
        <Volume2 className="w-5 h-5 text-green-500" />
        <h2 className="font-semibold text-white">{channel.name}</h2>
        <Badge variant="secondary" className="bg-green-900/50 text-green-400">
          <Users className="w-3 h-3 mr-1" />
          {livekitParticipants.length}
        </Badge>
      </div>

      {/* Participants grid */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="flex flex-wrap gap-4 justify-center">
          {livekitParticipants.map((p) => {
            const isLocal = p.identity === localParticipant.identity
            const isSpeaking = speakingIds.has(p.identity)
            const displayName = p.name || p.identity || "Guest"
            const isMuted = isLocal ? !isMicrophoneEnabled : false

            return (
              <div
                key={p.identity}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-all ${
                  isSpeaking
                    ? "bg-green-900/30 ring-2 ring-green-500/50"
                    : "bg-slate-900/50"
                }`}
              >
                <div className="relative">
                  <Avatar className="w-16 h-16">
                    <AvatarFallback className="text-lg bg-indigo-600 text-white">
                      {displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {isSpeaking && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                      <Volume2 className="w-3 h-3 text-white" />
                    </div>
                  )}
                  {isMuted && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                      <MicOff className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
                <span className="text-sm text-white font-medium">
                  {displayName} {isLocal && "(You)"}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 p-4 border-t border-slate-800">
        <Button
          variant={!isMicrophoneEnabled ? "destructive" : "secondary"}
          size="icon"
          className="rounded-full h-12 w-12"
          onClick={toggleMic}
          title={isMicrophoneEnabled ? "Mute" : "Unmute"}
        >
          {!isMicrophoneEnabled ? <MicOff /> : <Mic />}
        </Button>

        <Button
          variant={isDeafened ? "destructive" : "secondary"}
          size="icon"
          className="rounded-full h-12 w-12"
          onClick={toggleDeafen}
          title={isDeafened ? "Undeafen" : "Deafen"}
        >
          {isDeafened ? <HeadphonesIcon /> : <Headphones />}
        </Button>

        <Button
          variant="destructive"
          size="icon"
          className="rounded-full h-12 w-12"
          onClick={handleDisconnect}
          title="Disconnect"
        >
          <PhoneOff />
        </Button>
      </div>
    </div>
  )
}
