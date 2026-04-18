"use client"

import React, { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Loader2, Users, User } from "lucide-react"
import { useCSRF } from "@/hooks/useCSRF"

interface CreateChatModalProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  /** Pre-fill the chat name (e.g., from a stick topic) */
  readonly defaultName?: string
  /** Automatically create the chat when modal opens (skips the form) */
  readonly autoSubmit?: boolean
  /** Link chat to a specific stick */
  readonly stickId?: string
  /** Type of stick being linked */
  readonly stickType?: "personal" | "social" | "pad"
  /** If true, open the created chat in a new tab instead of the current one */
  readonly openInNewTab?: boolean
}

/**
 * Modal for creating a new standalone chat room.
 */
export const CreateChatModal: React.FC<CreateChatModalProps> = ({
  open,
  onOpenChange,
  defaultName = "",
  autoSubmit = false,
  stickId,
  stickType,
  openInNewTab = false,
}) => {
  const router = useRouter()
  const { csrfToken } = useCSRF()
  const [name, setName] = useState(defaultName)
  const [isGroup, setIsGroup] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasAutoSubmitted = useRef(false)

  // Update name when defaultName changes
  useEffect(() => {
    if (defaultName) {
      setName(defaultName)
    }
  }, [defaultName])

  // Auto-submit when modal opens with autoSubmit=true
  useEffect(() => {
    if (open && autoSubmit && defaultName && !hasAutoSubmitted.current) {
      hasAutoSubmitted.current = true
      handleCreate()
    }
    if (!open) {
      hasAutoSubmitted.current = false
    }
  }, [open, autoSubmit, defaultName])

  const handleCreate = async () => {
    if (isGroup && !name.trim()) {
      setError("Group chats require a name")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // The API will check for existing chats with the same name and return that instead
      const response = await fetch("/api/stick-chats", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
        body: JSON.stringify({
          name: name.trim() || undefined,
          is_group: isGroup,
          ...(stickId ? { stick_id: stickId, stick_type: stickType } : {}),
        }),
      })

      if (response.ok) {
        const data = await response.json()
        onOpenChange(false)
        if (openInNewTab) {
          window.open(`/chats/${data.chat.id}`, "_blank", "noopener,noreferrer")
        } else {
          router.push(`/chats/${data.chat.id}`)
        }
      } else {
        const errorData = await response.json()
        setError(errorData.error || "Failed to create chat")
      }
    } catch (error) {
      console.error("Error creating chat:", error)
      setError("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setName(defaultName)
    setIsGroup(false)
    setError(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isGroup ? (
              <Users className="w-5 h-5 text-purple-500" />
            ) : (
              <User className="w-5 h-5 text-blue-500" />
            )}
            Create New Chat
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Chat Type Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="is-group">Group Chat</Label>
              <p className="text-sm text-gray-500">
                Allow multiple participants to join
              </p>
            </div>
            <Switch
              id="is-group"
              checked={isGroup}
              onCheckedChange={setIsGroup}
            />
          </div>

          {/* Chat Name */}
          <div className="space-y-2">
            <Label htmlFor="chat-name">
              Chat Name {isGroup && <span className="text-red-500">*</span>}
            </Label>
            <Input
              id="chat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isGroup ? "Enter group name..." : "Optional name..."}
              maxLength={100}
            />
            <p className="text-xs text-gray-500">
              {isGroup
                ? "Give your group a memorable name"
                : "For 1-on-1 chats, the other person's name will be shown"}
            </p>
          </div>

          {/* Error message */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 p-2 rounded">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Chat"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
