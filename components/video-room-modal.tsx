"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, MonitorOff, ExternalLink } from "lucide-react"
import DailyIframe from "@daily-co/daily-js"

interface VideoRoomModalProps {
  roomUrl: string
  onClose: () => void
}

export function VideoRoomModal({ roomUrl, onClose }: VideoRoomModalProps) {
  const callFrameRef = useRef<any>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isJoining, setIsJoining] = useState(true)
  const initializationAttempted = useRef(false)
  const firstButtonRef = useRef<HTMLButtonElement>(null)

  const containerCallbackRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node && !initializationAttempted.current) {
        initializationAttempted.current = true

        // Give the DOM a moment to fully render
        setTimeout(() => {
          initializeDaily(node)
        }, 100)
      }
    },
    [roomUrl],
  )

  const initializeDaily = (container: HTMLDivElement) => {
    if (!roomUrl || !roomUrl.includes("daily.co")) {
      setError("Invalid room URL. Please check your Daily.co configuration.")
      setIsJoining(false)
      return
    }

    try {
      const callFrame = DailyIframe.createFrame(container, {
        showLeaveButton: false,
        showFullscreenButton: true,
        iframeStyle: {
          width: "100%",
          height: "600px",
          border: "0",
          borderRadius: "8px",
        },
      })

      callFrameRef.current = callFrame

      callFrame.on("joined-meeting", () => {
        setIsJoining(false)
        setError(null)
      })

      callFrame.on("error", (e) => {
        const errorMsg = e?.errorMsg || e?.error?.msg || "Failed to join video room"
        setError(errorMsg)
        setIsJoining(false)
      })

      const joinTimeout = setTimeout(() => {
        setError("Connection timeout. The room exists but couldn't connect. Try opening in a new tab instead.")
        setIsJoining(false)
      }, 30000)

      callFrame
        .join({ url: roomUrl })
        .then(() => {
          clearTimeout(joinTimeout)
        })
        .catch((err) => {
          clearTimeout(joinTimeout)
          setError(`Failed to join: ${err.message}`)
          setIsJoining(false)
        })
    } catch (err: any) {
      setError(`Failed to initialize: ${err.message}`)
      setIsJoining(false)
    }
  }

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleLeave()
      }
    }

    if (firstButtonRef.current) {
      firstButtonRef.current.focus()
    }

    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [])

  useEffect(() => {
    return () => {
      if (callFrameRef.current) {
        try {
          callFrameRef.current.destroy()
        } catch (err) {}
      }
    }
  }, [])

  const toggleMute = () => {
    if (callFrameRef.current) {
      callFrameRef.current.setLocalAudio(!isMuted)
      setIsMuted(!isMuted)
    }
  }

  const toggleVideo = () => {
    if (callFrameRef.current) {
      callFrameRef.current.setLocalVideo(!isVideoOff)
      setIsVideoOff(!isVideoOff)
    }
  }

  const toggleScreenShare = async () => {
    if (callFrameRef.current) {
      if (isScreenSharing) {
        await callFrameRef.current.stopScreenShare()
        setIsScreenSharing(false)
      } else {
        await callFrameRef.current.startScreenShare()
        setIsScreenSharing(true)
      }
    }
  }

  const handleLeave = () => {
    if (callFrameRef.current) {
      try {
        callFrameRef.current.leave()
        callFrameRef.current.destroy()
      } catch (err) {}
    }
    onClose()
  }

  const openInNewTab = () => {
    window.open(roomUrl, "_blank")
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
          {isJoining && !error && (
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
                <p className="text-xs text-muted-foreground mt-2">Connecting to {roomUrl}</p>
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

          <div ref={containerCallbackRef} className="w-full min-h-[600px]" aria-label="Video conference container" />
        </div>

        <div className="flex justify-center gap-4 mt-4" role="group" aria-label="Video conference controls">
          <Button
            ref={firstButtonRef}
            variant={isMuted ? "destructive" : "outline"}
            size="icon"
            onClick={toggleMute}
            className="rounded-full h-12 w-12"
            disabled={isJoining || !!error}
            aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
            aria-pressed={isMuted}
          >
            {isMuted ? (
              <MicOff className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Mic className="h-5 w-5" aria-hidden="true" />
            )}
          </Button>

          <Button
            variant={isVideoOff ? "destructive" : "outline"}
            size="icon"
            onClick={toggleVideo}
            className="rounded-full h-12 w-12"
            disabled={isJoining || !!error}
            aria-label={isVideoOff ? "Turn on camera" : "Turn off camera"}
            aria-pressed={isVideoOff}
          >
            {isVideoOff ? (
              <VideoOff className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Video className="h-5 w-5" aria-hidden="true" />
            )}
          </Button>

          <Button
            variant={isScreenSharing ? "default" : "outline"}
            size="icon"
            onClick={toggleScreenShare}
            className="rounded-full h-12 w-12"
            disabled={isJoining || !!error}
            aria-label={isScreenSharing ? "Stop screen sharing" : "Start screen sharing"}
            aria-pressed={isScreenSharing}
          >
            {isScreenSharing ? (
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
      </DialogContent>
    </Dialog>
  )
}
