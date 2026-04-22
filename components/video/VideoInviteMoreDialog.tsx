"use client"

import { useState, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { VideoInviteUserSearch, type VideoInvitee } from "./VideoInviteUserSearch"
import { useToast } from "@/hooks/use-toast"

interface VideoInviteMoreDialogProps {
  readonly roomId: string
  readonly roomName: string
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onInvited?: () => void
}

export function VideoInviteMoreDialog({
  roomId,
  roomName,
  open,
  onOpenChange,
  onInvited,
}: VideoInviteMoreDialogProps) {
  const { toast } = useToast()
  const [emails, setEmails] = useState<string[]>([])
  const [invitees, setInvitees] = useState<VideoInvitee[]>([])
  const [submitting, setSubmitting] = useState(false)

  const handleClose = useCallback(() => {
    setEmails([])
    setInvitees([])
    onOpenChange(false)
  }, [onOpenChange])

  const handleSubmit = useCallback(async () => {
    if (invitees.length === 0) {
      toast({
        title: "No one selected",
        description: "Pick at least one person to invite.",
        variant: "destructive",
      })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/video/rooms/${roomId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitees }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || "Failed to add invitees")
      }
      toast({
        title: "Invitations sent",
        description: `${invitees.length} ${invitees.length === 1 ? "person was" : "people were"} invited.`,
      })
      onInvited?.()
      handleClose()
    } catch (err) {
      toast({
        title: "Couldn't send invites",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }, [invitees, roomId, toast, onInvited, handleClose])

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : handleClose())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite more people to "{roomName}"</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <VideoInviteUserSearch
            selectedEmails={emails}
            onEmailsChange={setEmails}
            onInviteesChange={setInvitees}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || invitees.length === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {submitting ? "Sending..." : `Invite ${invitees.length || ""}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
