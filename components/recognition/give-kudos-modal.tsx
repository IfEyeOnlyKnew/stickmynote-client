"use client"

import { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { X, Search, Send, Sparkles } from "lucide-react"
import type { RecognitionValue } from "@/types/recognition"

interface GiveKudosModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  preselectedUserId?: string
  preselectedUserName?: string
}

interface UserSearchResult {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
}

export function GiveKudosModal({ open, onOpenChange, onSuccess, preselectedUserId, preselectedUserName }: GiveKudosModalProps) {
  const [selectedUsers, setSelectedUsers] = useState<UserSearchResult[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [message, setMessage] = useState("")
  const [selectedValue, setSelectedValue] = useState<string | null>(null)
  const [values, setValues] = useState<RecognitionValue[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  // Load recognition values
  useEffect(() => {
    if (open) {
      fetch("/api/recognition/values")
        .then(res => res.json())
        .then(data => setValues(data.values || []))
        .catch(() => {})
    }
  }, [open])

  // Handle preselected user
  useEffect(() => {
    if (open && preselectedUserId && preselectedUserName) {
      setSelectedUsers([{
        id: preselectedUserId,
        full_name: preselectedUserName,
        email: "",
        avatar_url: null,
      }])
    }
  }, [open, preselectedUserId, preselectedUserName])

  // Search users
  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const res = await fetch(`/api/user-search?query=${encodeURIComponent(query)}&limit=8&source=both`)
      const data = await res.json()
      const users = Array.isArray(data) ? data : (data.users || [])
      const results = users.filter(
        (u: UserSearchResult) => u.id && !selectedUsers.some(s => s.id === u.id)
      )
      setSearchResults(results)
    } catch {
      setSearchResults([])
    }
    setSearching(false)
  }, [selectedUsers])

  useEffect(() => {
    const timer = setTimeout(() => searchUsers(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery, searchUsers])

  const addUser = (user: UserSearchResult) => {
    if (selectedUsers.length >= 10) return
    setSelectedUsers(prev => [...prev, user])
    setSearchQuery("")
    setSearchResults([])
  }

  const removeUser = (userId: string) => {
    setSelectedUsers(prev => prev.filter(u => u.id !== userId))
  }

  const handleSubmit = async () => {
    if (!selectedUsers.length || !message.trim()) return

    setSubmitting(true)
    setError("")

    try {
      const res = await fetch("/api/recognition/kudos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientIds: selectedUsers.map(u => u.id),
          message: message.trim(),
          valueId: selectedValue,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to send kudos")
        setSubmitting(false)
        return
      }

      // Reset form
      setSelectedUsers([])
      setMessage("")
      setSelectedValue(null)
      setError("")
      onOpenChange(false)
      onSuccess?.()
    } catch {
      setError("Failed to send kudos")
    }
    setSubmitting(false)
  }

  const handleClose = () => {
    setSelectedUsers([])
    setMessage("")
    setSelectedValue(null)
    setSearchQuery("")
    setError("")
    onOpenChange(false)
  }

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            Give Kudos
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Selected Users */}
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedUsers.map(user => (
                <Badge key={user.id} variant="secondary" className="flex items-center gap-1.5 py-1 px-2 text-sm">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback className="text-[10px]">{getInitials(user.full_name)}</AvatarFallback>
                  </Avatar>
                  {user.full_name}
                  <button onClick={() => removeUser(user.id)} className="ml-0.5 hover:text-red-500">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {/* User Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search for people to recognize..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
            {searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {searchResults.map(user => (
                  <button
                    key={user.id}
                    onClick={() => addUser(user)}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-left"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">{getInitials(user.full_name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm font-medium">{user.full_name}</div>
                      <div className="text-xs text-gray-500">{user.email}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {searching && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg p-3 text-sm text-gray-500">
                Searching...
              </div>
            )}
          </div>

          {/* Recognition Values */}
          {values.length > 0 && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Recognize for</label>
              <div className="flex flex-wrap gap-2">
                {values.map(value => (
                  <button
                    key={value.id}
                    onClick={() => setSelectedValue(selectedValue === value.id ? null : value.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all ${
                      selectedValue === value.id
                        ? "border-transparent text-white shadow-md scale-105"
                        : "border-gray-200 hover:border-gray-300 text-gray-700"
                    }`}
                    style={selectedValue === value.id ? { backgroundColor: value.color } : undefined}
                  >
                    <span>{value.emoji}</span>
                    {value.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message */}
          <div>
            <Textarea
              placeholder="Write a heartfelt message about why this person deserves recognition..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={1000}
              className="resize-none"
            />
            <div className="text-xs text-gray-400 text-right mt-1">{message.length}/1000</div>
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-md">{error}</div>
          )}

          {/* Submit */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !selectedUsers.length || !message.trim()}
              className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white"
            >
              {submitting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Kudos
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
