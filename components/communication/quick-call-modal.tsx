"use client"

import { useState, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Loader2, Video, Monitor, Phone, Users } from "lucide-react"
import { toast } from "sonner"
import { useCommunicationPaletteContext } from "./communication-palette-provider"
import { VideoRoomModal } from "@/components/video-room-modal"
import { VideoInviteUserSearch } from "@/components/video/VideoInviteUserSearch"

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface QuickCallModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  autoScreenShare?: boolean
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function QuickCallModal({
  open,
  onOpenChange,
  autoScreenShare = false,
}: QuickCallModalProps) {
  const { context } = useCommunicationPaletteContext()
  const { padName, stickTopic } = context

  // Form state
  const [roomName, setRoomName] = useState("")
  const [audioOnly, setAudioOnly] = useState(false)
  const [selectedEmails, setSelectedEmails] = useState<string[]>([])
  const [isCreating, setIsCreating] = useState(false)

  // Video room state
  const [activeRoomUrl, setActiveRoomUrl] = useState<string | null>(null)
  const [activeLivekitRoomName, setActiveLivekitRoomName] = useState<string | null>(null)

  // Generate default room name from context
  const getDefaultRoomName = useCallback(() => {
    if (padName) {
      return `${padName} - Quick Call`
    }
    if (stickTopic) {
      return `${stickTopic} - Discussion`
    }
    return `Quick Call - ${new Date().toLocaleDateString()}`
  }, [padName, stickTopic])

  const handleCreateRoom = async () => {
    setIsCreating(true)

    try {
      const name = roomName.trim() || getDefaultRoomName()

      const response = await fetch("/api/video/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          inviteEmails: selectedEmails,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create room")
      }

      const { room } = await response.json()

      // Close the setup dialog and open the video room
      onOpenChange(false)
      setActiveRoomUrl(room.room_url)
      setActiveLivekitRoomName(room.livekit_room_name || null)

      if (selectedEmails.length > 0) {
        toast.success(`Invitations sent to ${selectedEmails.length} participant(s)`)
      }
    } catch (error) {
      console.error("Error creating video room:", error)
      toast.error(error instanceof Error ? error.message : "Failed to create room")
    } finally {
      setIsCreating(false)
    }
  }

  const handleCloseVideoRoom = () => {
    setActiveRoomUrl(null)
    setActiveLivekitRoomName(null)
    // Reset form for next time
    setRoomName("")
    setAudioOnly(false)
    setSelectedEmails([])
  }

  // If we have an active room, show the video modal
  if (activeRoomUrl) {
    return <VideoRoomModal roomUrl={activeRoomUrl} livekitRoomName={activeLivekitRoomName || undefined} onClose={handleCloseVideoRoom} />
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {autoScreenShare ? (
              <>
                <Monitor className="h-5 w-5 text-green-500" />
                Start Screen Share
              </>
            ) : (
              <>
                <Video className="h-5 w-5 text-blue-500" />
                Quick Call
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {autoScreenShare
              ? "Start a screen sharing session. Others can join with the link."
              : "Start an instant video call. Invite others to join."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Room Name */}
          <div className="space-y-2">
            <Label htmlFor="room-name">Room Name</Label>
            <Input
              id="room-name"
              placeholder={getDefaultRoomName()}
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
            />
          </div>

          {/* Context indicator */}
          {(padName || stickTopic) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
              <Users className="h-4 w-4" />
              <span>
                Context: {padName || stickTopic}
              </span>
            </div>
          )}

          {/* Audio only toggle (not shown for screen share) */}
          {!autoScreenShare && (
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="audio-only">Audio Only</Label>
                <p className="text-xs text-muted-foreground">
                  Start with video off
                </p>
              </div>
              <Switch
                id="audio-only"
                checked={audioOnly}
                onCheckedChange={setAudioOnly}
              />
            </div>
          )}

          {/* Invite Users via LDAP Search */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>Invite Participants (optional)</Label>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                LDAP
              </span>
            </div>
            <div className="border-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 rounded-lg p-3">
              <VideoInviteUserSearch
                selectedEmails={selectedEmails}
                onEmailsChange={setSelectedEmails}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreateRoom} disabled={isCreating}>
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : autoScreenShare ? (
              <>
                <Monitor className="h-4 w-4 mr-2" />
                Start Sharing
              </>
            ) : (
              <>
                <Phone className="h-4 w-4 mr-2" />
                Start Call
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ----------------------------------------------------------------------------
// Screen Share Modal (wrapper with autoScreenShare=true)
// ----------------------------------------------------------------------------

export function ScreenShareModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <QuickCallModal open={open} onOpenChange={onOpenChange} autoScreenShare />
  )
}
