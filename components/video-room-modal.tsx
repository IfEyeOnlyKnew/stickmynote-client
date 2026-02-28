"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, MonitorOff, ExternalLink } from "lucide-react"
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useRoomContext,
} from "@livekit/components-react"
import "@livekit/components-styles"

interface VideoRoomModalProps {
  /** The app's join URL (e.g., /video/join/<roomId>) for "Open in New Tab" */
  roomUrl: string
  /** The LiveKit room name for connecting. If not provided, extracted from roomUrl. */
  livekitRoomName?: string
  onClose: () => void
}

export function VideoRoomModal({ roomUrl, livekitRoomName, onClose }: VideoRoomModalProps) {
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isJoining, setIsJoining] = useState(true)
  const [resolvedRoomName, setResolvedRoomName] = useState<string | null>(livekitRoomName || null)

  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL

  // If no livekitRoomName provided, extract roomId from URL and fetch room info
  useEffect(() => {
    async function resolveRoom() {
      if (livekitRoomName) {
        setResolvedRoomName(livekitRoomName)
        return
      }

      // Extract roomId from URL like /video/join/<roomId> or full URL
      const urlPath = roomUrl.includes("/video/join/") ? roomUrl : ""
      const roomId = urlPath.split("/video/join/").pop()?.split("?")[0]

      if (!roomId) {
        setError("Invalid room URL")
        setIsJoining(false)
        return
      }

      try {
        const res = await fetch(`/api/video/rooms`)
        if (!res.ok) throw new Error("Failed to fetch rooms")
        const data = await res.json()
        const room = data.rooms?.find((r: any) => r.id === roomId)
        if (room?.livekit_room_name) {
          setResolvedRoomName(room.livekit_room_name)
        } else {
          setError("Room not found")
          setIsJoining(false)
        }
      } catch {
        setError("Failed to load room info")
        setIsJoining(false)
      }
    }

    resolveRoom()
  }, [roomUrl, livekitRoomName])

  // Fetch token once we have the room name
  useEffect(() => {
    if (!resolvedRoomName) return

    async function fetchToken() {
      try {
        const res = await fetch(`/api/video/token?roomName=${encodeURIComponent(resolvedRoomName!)}`)
        if (!res.ok) throw new Error("Failed to get token")
        const data = await res.json()
        setToken(data.token)
      } catch (err) {
        setError("Failed to connect to video service")
        setIsJoining(false)
      }
    }

    fetchToken()
  }, [resolvedRoomName])

  const openInNewTab = () => {
    window.open(roomUrl, "_blank")
    onClose()
  }

  const handleLeave = () => {
    onClose()
  }

  return (
    <Dialog open={true} onOpenChange={handleLeave}>
      <DialogContent
        className="max-w-5xl max-h-[90vh]"
        aria-labelledby="video-room-title"
        aria-describedby="video-room-description"
      >
        <DialogHeader>
          <DialogTitle id="video-room-title" className="flex items-center justify-between">
            <span>Video Conference</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={openInNewTab}
              className="gap-2"
              aria-label="Open video conference in new tab"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Open in New Tab
            </Button>
          </DialogTitle>
          <DialogDescription id="video-room-description">
            Join the video conference room with audio and video controls
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-md mb-4" role="alert" aria-live="assertive">
            <p className="font-semibold">Error</p>
            <p className="text-sm whitespace-pre-line">{error}</p>
            <Button
              onClick={openInNewTab}
              variant="outline"
              size="sm"
              className="mt-2 gap-2 bg-transparent"
              aria-label="Open room in new tab as alternative"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Open Room in New Tab
            </Button>
          </div>
        )}

        <div className="relative min-h-[600px]">
          {(isJoining || !token) && !error && (
            <div
              className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10"
              role="status"
              aria-live="polite"
            >
              <div className="text-center">
                <div
                  className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"
                  aria-hidden="true"
                ></div>
                <p className="text-muted-foreground">Joining video room...</p>
                <Button
                  onClick={openInNewTab}
                  variant="outline"
                  size="sm"
                  className="mt-4 gap-2 bg-transparent"
                  aria-label="Open in new tab instead of waiting"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Open in New Tab Instead
                </Button>
              </div>
            </div>
          )}

          {token && livekitUrl && resolvedRoomName && (
            <LiveKitRoom
              serverUrl={livekitUrl}
              token={token}
              connect={true}
              audio={true}
              video={true}
              onConnected={() => setIsJoining(false)}
              onDisconnected={handleLeave}
            >
              <RoomAudioRenderer />
              <ModalVideoContent onLeave={handleLeave} />
            </LiveKitRoom>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ModalVideoContent({ onLeave }: { onLeave: () => void }) {
  const room = useRoomContext()
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant()

  const toggleMute = async () => {
    await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)
  }

  const toggleVideo = async () => {
    await localParticipant.setCameraEnabled(!isCameraEnabled)
  }

  const toggleScreenShare = async () => {
    await localParticipant.setScreenShareEnabled(!isScreenShareEnabled)
  }

  const handleLeave = () => {
    room.disconnect()
    onLeave()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="w-full min-h-[600px] bg-slate-950 rounded-lg flex items-center justify-center text-white">
        <p className="text-sm text-slate-400">Video conference active</p>
      </div>

      <div className="flex justify-center gap-4" role="group" aria-label="Video conference controls">
        <Button
          variant={!isMicrophoneEnabled ? "destructive" : "outline"}
          size="icon"
          onClick={toggleMute}
          className="rounded-full h-12 w-12"
          aria-label={!isMicrophoneEnabled ? "Unmute microphone" : "Mute microphone"}
          aria-pressed={!isMicrophoneEnabled}
        >
          {!isMicrophoneEnabled ? (
            <MicOff className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Mic className="h-5 w-5" aria-hidden="true" />
          )}
        </Button>

        <Button
          variant={!isCameraEnabled ? "destructive" : "outline"}
          size="icon"
          onClick={toggleVideo}
          className="rounded-full h-12 w-12"
          aria-label={!isCameraEnabled ? "Turn on camera" : "Turn off camera"}
          aria-pressed={!isCameraEnabled}
        >
          {!isCameraEnabled ? (
            <VideoOff className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Video className="h-5 w-5" aria-hidden="true" />
          )}
        </Button>

        <Button
          variant={isScreenShareEnabled ? "default" : "outline"}
          size="icon"
          onClick={toggleScreenShare}
          className="rounded-full h-12 w-12"
          aria-label={isScreenShareEnabled ? "Stop screen sharing" : "Start screen sharing"}
          aria-pressed={isScreenShareEnabled}
        >
          {isScreenShareEnabled ? (
            <MonitorOff className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Monitor className="h-5 w-5" aria-hidden="true" />
          )}
        </Button>

        <Button
          variant="destructive"
          size="icon"
          onClick={handleLeave}
          className="rounded-full h-12 w-12"
          aria-label="Leave video conference"
        >
          <PhoneOff className="h-5 w-5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
