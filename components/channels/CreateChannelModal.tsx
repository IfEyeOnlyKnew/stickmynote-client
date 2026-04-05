"use client"

import React, { useState, useEffect } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Hash, Volume2, Lock, Globe, Loader2 } from "lucide-react"
import { useCSRF } from "@/hooks/useCSRF"
import type { ChatType, ChatVisibility, ChannelCategory } from "@/types/stick-chat"

interface CreateChannelModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
}

export function CreateChannelModal({ open, onOpenChange, onCreated }: Readonly<CreateChannelModalProps>) {
  const { csrfToken } = useCSRF()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [topic, setTopic] = useState("")
  const [chatType, setChatType] = useState<ChatType>("channel")
  const [visibility, setVisibility] = useState<ChatVisibility>("public")
  const [categoryId, setCategoryId] = useState<string>("__none")
  const [categories, setCategories] = useState<ChannelCategory[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      fetch("/api/channels/categories")
        .then((r) => r.json())
        .then((data) => setCategories(data.categories || []))
        .catch(() => {})
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setIsSubmitting(true)
    setError("")

    try {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
        body: JSON.stringify({
          name: name.trim(),
          chat_type: chatType,
          visibility,
          description: description.trim() || undefined,
          topic: topic.trim() || undefined,
          category_id: categoryId === "__none" ? undefined : categoryId,
        }),
      })

      if (res.ok) {
        setName("")
        setDescription("")
        setTopic("")
        setChatType("channel")
        setVisibility("public")
        setCategoryId("__none")
        onOpenChange(false)
        onCreated?.()
      } else {
        const data = await res.json()
        setError(data.error || "Failed to create channel")
      }
    } catch {
      setError("Failed to create channel")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Channel</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Channel Type */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={chatType === "channel" ? "default" : "outline"}
              size="sm"
              onClick={() => setChatType("channel")}
              className="flex-1"
            >
              <Hash className="w-4 h-4 mr-1" />
              Text Channel
            </Button>
            <Button
              type="button"
              variant={chatType === "voice" ? "default" : "outline"}
              size="sm"
              onClick={() => setChatType("voice")}
              className="flex-1"
            >
              <Volume2 className="w-4 h-4 mr-1" />
              Voice Channel
            </Button>
          </div>

          {/* Name */}
          <div>
            <Label htmlFor="channel-name">Channel Name</Label>
            <div className="flex items-center gap-2 mt-1">
              {chatType === "voice" ? (
                <Volume2 className="w-4 h-4 text-green-600 flex-shrink-0" />
              ) : (
                <Hash className="w-4 h-4 text-gray-400 flex-shrink-0" />
              )}
              <Input
                id="channel-name"
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replaceAll(/\s+/g, "-").replaceAll(/[^a-z0-9-]/g, ""))}
                placeholder="e.g. general"
                maxLength={80}
                autoFocus
              />
            </div>
          </div>

          {/* Visibility */}
          <div>
            <Label>Visibility</Label>
            <div className="flex gap-2 mt-1">
              <Button
                type="button"
                variant={visibility === "public" ? "default" : "outline"}
                size="sm"
                onClick={() => setVisibility("public")}
                className="flex-1"
              >
                <Globe className="w-4 h-4 mr-1" />
                Public
              </Button>
              <Button
                type="button"
                variant={visibility === "private" ? "default" : "outline"}
                size="sm"
                onClick={() => setVisibility("private")}
                className="flex-1"
              >
                <Lock className="w-4 h-4 mr-1" />
                Private
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {visibility === "public"
                ? "Anyone in the organization can find and join"
                : "Only invited members can see and access"}
            </p>
          </div>

          {/* Category */}
          {categories.length > 0 && (
            <div>
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">No Category</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Description */}
          <div>
            <Label htmlFor="channel-desc">Description (optional)</Label>
            <Textarea
              id="channel-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this channel about?"
              maxLength={500}
              rows={2}
              className="mt-1"
            />
          </div>

          {/* Topic */}
          {chatType === "channel" && (
            <div>
              <Label htmlFor="channel-topic">Topic (optional)</Label>
              <Input
                id="channel-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Current discussion topic"
                maxLength={250}
                className="mt-1"
              />
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Create Channel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
