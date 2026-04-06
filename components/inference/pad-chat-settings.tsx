"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Settings,
  Bell,
  Clock,
  Bot,
  Palette,
  Shield,
  Plus,
  Trash2,
  Crown,
  Loader2,
  Check,
  AlertTriangle,
  Calendar,
} from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import type {
  PadChatSettings,
  PadChatModerator,
  WhoCanChat,
  EmailDigestFrequency,
  ChatTheme,
} from "@/types/pad-chat"
import { DEFAULT_CHAT_SETTINGS } from "@/types/pad-chat"

interface PadChatSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  padId: string
  padName: string
  isOwner: boolean
  currentUserId: string
}

const DAYS_OF_WEEK = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
]

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
]

export function PadChatSettingsDialog({
  open,
  onOpenChange,
  padId,
  padName,
  isOwner,
  currentUserId,
}: Readonly<PadChatSettingsDialogProps>) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [settings, setSettings] = useState<PadChatSettings | null>(null)
  const [moderators, setModerators] = useState<PadChatModerator[]>([])
  const [addingModerator, setAddingModerator] = useState(false)

  // Search state for adding moderators
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Array<{
    id: string
    user_id: string
    users: { id: string; email: string; full_name: string | null; avatar_url: string | null } | null
  }>>([])
  const [searching, setSearching] = useState(false)

  // Clear all messages state
  const [clearing, setClearing] = useState(false)

  // Fetch settings and moderators
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [settingsRes, moderatorsRes] = await Promise.all([
        fetch(`/api/inference-pads/${padId}/chat-settings`),
        fetch(`/api/inference-pads/${padId}/chat-moderators`),
      ])

      if (settingsRes.ok) {
        const data = await settingsRes.json()
        setSettings(data.settings || { ...DEFAULT_CHAT_SETTINGS, social_pad_id: padId })
      }

      if (moderatorsRes.ok) {
        const data = await moderatorsRes.json()
        setModerators(data.moderators || [])
      }
    } catch (error) {
      console.error("[ChatSettings] Error fetching:", error)
      toast.error("Failed to load chat settings")
    } finally {
      setLoading(false)
    }
  }, [padId])

  // Debounced search for members
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([])
      return
    }

    const timeoutId = setTimeout(async () => {
      setSearching(true)
      try {
        const response = await fetch(
          `/api/inference-pads/${padId}/members?search=${encodeURIComponent(searchQuery)}&limit=10`
        )
        if (response.ok) {
          const data = await response.json()
          // Filter out users who are already moderators
          const moderatorIds = new Set(moderators.map((mod) => mod.user_id))
          const available = (data.members || []).filter(
            (member: { user_id: string }) => !moderatorIds.has(member.user_id)
          )
          setSearchResults(available)
        }
      } catch (error) {
        console.error("[ChatSettings] Error searching members:", error)
      } finally {
        setSearching(false)
      }
    }, 300) // 300ms debounce

    return () => clearTimeout(timeoutId)
  }, [searchQuery, padId, moderators])

  useEffect(() => {
    if (open) {
      fetchData()
    }
  }, [open, fetchData])

  // Save settings
  const handleSaveSettings = async () => {
    if (!settings) return

    setSaving(true)
    setSaved(false)
    try {
      const response = await fetch(`/api/inference-pads/${padId}/chat-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      })

      if (response.ok) {
        setSaved(true)
        toast.success("Settings saved successfully")
        // Reset saved state after 2 seconds
        setTimeout(() => setSaved(false), 2000)
      } else {
        throw new Error("Failed to save")
      }
    } catch (error) {
      console.error("[ChatSettings] Error saving:", error)
      toast.error("Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  // Add moderator from search result
  const handleAddModerator = async (member: {
    user_id: string
    users: { id: string; email: string; full_name: string | null; avatar_url: string | null } | null
  }) => {
    if (!member?.users?.email) {
      toast.error("Invalid member selected")
      return
    }

    setAddingModerator(true)
    try {
      const response = await fetch(`/api/inference-pads/${padId}/chat-moderators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: member.users.email }),
      })

      if (response.ok) {
        const data = await response.json()
        setModerators((prev) => [...prev, data.moderator])
        setSearchQuery("")
        setSearchResults([])
        toast.success("Moderator added")
      } else {
        const error = await response.json()
        toast.error(error.error || "Failed to add moderator")
      }
    } catch (error) {
      console.error("[ChatSettings] Error adding moderator:", error)
      toast.error("Failed to add moderator")
    } finally {
      setAddingModerator(false)
    }
  }

  // Remove moderator
  const handleRemoveModerator = async (moderatorId: string) => {
    try {
      const response = await fetch(`/api/inference-pads/${padId}/chat-moderators/${moderatorId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setModerators((prev) => prev.filter((m) => m.id !== moderatorId))
        toast.success("Moderator removed")
      } else {
        toast.error("Failed to remove moderator")
      }
    } catch (error) {
      console.error("[ChatSettings] Error removing moderator:", error)
      toast.error("Failed to remove moderator")
    }
  }

  // Clear all messages (owner only)
  const handleClearAllMessages = async (keepPinned: boolean) => {
    setClearing(true)
    try {
      const response = await fetch(
        `/api/inference-pads/${padId}/messages?keepPinned=${keepPinned}`,
        { method: "DELETE" }
      )

      if (response.ok) {
        const data = await response.json()
        toast.success(`Cleared ${data.deletedCount} messages`)
      } else {
        const error = await response.json()
        toast.error(error.error || "Failed to clear messages")
      }
    } catch (error) {
      console.error("[ChatSettings] Error clearing messages:", error)
      toast.error("Failed to clear messages")
    } finally {
      setClearing(false)
    }
  }

  // Toggle office hours day
  const toggleDay = (day: number) => {
    if (!settings) return
    const days = settings.office_hours_days.includes(day)
      ? settings.office_hours_days.filter((d) => d !== day)
      : [...settings.office_hours_days, day].sort((a, b) => a - b)
    setSettings({ ...settings, office_hours_days: days })
  }

  const getInitials = (name: string | null, email: string) => {
    const str = name || email
    return str.substring(0, 2).toUpperCase()
  }

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-purple-600" />
            Pad Chat Settings
          </DialogTitle>
          <DialogDescription>
            Configure chat settings for {padName}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-5 mb-4">
            <TabsTrigger value="general" className="text-xs">
              <Settings className="h-3 w-3 mr-1" />
              General
            </TabsTrigger>
            <TabsTrigger value="moderators" className="text-xs">
              <Shield className="h-3 w-3 mr-1" />
              Moderators
            </TabsTrigger>
            <TabsTrigger value="notifications" className="text-xs">
              <Bell className="h-3 w-3 mr-1" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="office-hours" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              Hours
            </TabsTrigger>
            <TabsTrigger value="ai" className="text-xs">
              <Bot className="h-3 w-3 mr-1" />
              AI
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto pr-2">
            {/* General Settings */}
            <TabsContent value="general" className="space-y-4 mt-0">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Chat Access</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Chat</Label>
                      <p className="text-xs text-gray-500">Allow members to chat in this pad</p>
                    </div>
                    <Switch
                      checked={settings?.chat_enabled ?? true}
                      onCheckedChange={(checked) =>
                        setSettings((s) => (s ? { ...s, chat_enabled: checked } : s))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Who can chat?</Label>
                    <Select
                      value={settings?.who_can_chat ?? "all_members"}
                      onValueChange={(value: WhoCanChat) =>
                        setSettings((s) => (s ? { ...s, who_can_chat: value } : s))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all_members">All pad members</SelectItem>
                        <SelectItem value="verified">Verified members only</SelectItem>
                        <SelectItem value="moderators_only">Moderators only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <div>
                      <Label>Private Conversations</Label>
                      <p className="text-xs text-gray-500">
                        Users only see their own messages and moderator replies
                      </p>
                    </div>
                    <Switch
                      checked={settings?.private_conversations ?? false}
                      onCheckedChange={(checked) =>
                        setSettings((s) => (s ? { ...s, private_conversations: checked } : s))
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    Appearance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Theme</Label>
                    <Select
                      value={settings?.chat_theme ?? "default"}
                      onValueChange={(value: ChatTheme) =>
                        setSettings((s) => (s ? { ...s, chat_theme: value } : s))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default (Purple)</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="minimal">Minimal</SelectItem>
                        <SelectItem value="colorful">Colorful</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Show timestamps</Label>
                    <Switch
                      checked={settings?.show_timestamps ?? true}
                      onCheckedChange={(checked) =>
                        setSettings((s) => (s ? { ...s, show_timestamps: checked } : s))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Sound notifications</Label>
                    <Switch
                      checked={settings?.enable_sounds ?? true}
                      onCheckedChange={(checked) =>
                        setSettings((s) => (s ? { ...s, enable_sounds: checked } : s))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Typing indicators</Label>
                    <Switch
                      checked={settings?.enable_typing_indicator ?? true}
                      onCheckedChange={(checked) =>
                        setSettings((s) => (s ? { ...s, enable_typing_indicator: checked } : s))
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Message Retention */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Message Retention
                  </CardTitle>
                  <CardDescription>
                    Automatically delete old messages to keep chats manageable
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable auto-cleanup</Label>
                      <p className="text-xs text-gray-500">
                        Automatically delete messages older than the retention period
                      </p>
                    </div>
                    <Switch
                      checked={settings?.message_retention_enabled ?? false}
                      onCheckedChange={(checked) =>
                        setSettings((s) => (s ? { ...s, message_retention_enabled: checked } : s))
                      }
                    />
                  </div>

                  {settings?.message_retention_enabled && (
                    <div className="space-y-2 pl-4 border-l-2 border-purple-200">
                      <Label>Keep messages for</Label>
                      <Select
                        value={String(settings?.message_retention_days ?? 30)}
                        onValueChange={(value) =>
                          setSettings((s) => (s ? { ...s, message_retention_days: Number.parseInt(value) } : s))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">7 days</SelectItem>
                          <SelectItem value="14">14 days</SelectItem>
                          <SelectItem value="30">30 days</SelectItem>
                          <SelectItem value="60">60 days</SelectItem>
                          <SelectItem value="90">90 days</SelectItem>
                          <SelectItem value="180">180 days</SelectItem>
                          <SelectItem value="365">1 year</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500">
                        Pinned messages are never deleted automatically
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Danger Zone - Owner Only */}
              {isOwner && (
                <Card className="border-red-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2 text-red-600">
                      <AlertTriangle className="h-4 w-4" />
                      Danger Zone
                    </CardTitle>
                    <CardDescription>
                      Destructive actions - use with caution
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Clear All Messages</Label>
                        <p className="text-xs text-gray-500">
                          Permanently delete all chat messages in this pad
                        </p>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={clearing}
                          >
                            {clearing ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Clearing...
                              </>
                            ) : (
                              <>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Clear All
                              </>
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                              <AlertTriangle className="h-5 w-5 text-red-500" />
                              Clear All Messages?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete all chat messages in this pad.
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="py-4">
                            <div className="flex items-center space-x-2 mb-4">
                              <Switch
                                id="keep-pinned"
                                defaultChecked={true}
                              />
                              <Label htmlFor="keep-pinned" className="text-sm">
                                Keep pinned messages
                              </Label>
                            </div>
                          </div>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-red-600 hover:bg-red-700"
                              onClick={(e) => {
                                const keepPinned = (document.getElementById("keep-pinned") as HTMLButtonElement)?.getAttribute("data-state") === "checked"
                                handleClearAllMessages(keepPinned)
                              }}
                            >
                              Yes, Clear All Messages
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Moderators */}
            <TabsContent value="moderators" className="space-y-4 mt-0">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Chat Moderators
                  </CardTitle>
                  <CardDescription>
                    Moderators can pin messages, delete messages, and mute users
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Add moderator */}
                  {isOwner && (
                    <div className="space-y-2">
                      <Label>Add a pad member as moderator</Label>
                      <Command className="rounded-lg border" shouldFilter={false}>
                        <CommandInput
                          placeholder="Search members by name or email..."
                          value={searchQuery}
                          onValueChange={setSearchQuery}
                          disabled={addingModerator}
                        />
                        {searching && (
                          <div className="absolute right-3 top-3">
                            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                          </div>
                        )}
                        <CommandList>
                          {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                            <CommandEmpty>No matching members found</CommandEmpty>
                          )}
                          {searchQuery.length >= 2 && searchResults.length > 0 && (
                            <CommandGroup>
                              {searchResults.map((member) => (
                                <CommandItem
                                  key={member.user_id}
                                  value={member.user_id}
                                  onSelect={() => {
                                    if (!addingModerator) {
                                      handleAddModerator(member)
                                    }
                                  }}
                                  className="cursor-pointer"
                                >
                                  <Avatar className="h-8 w-8">
                                    {member.users?.avatar_url && (
                                      <AvatarImage src={member.users.avatar_url} />
                                    )}
                                    <AvatarFallback className="text-xs bg-purple-100 text-purple-700">
                                      {getInitials(member.users?.full_name || null, member.users?.email || "")}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                      {member.users?.full_name || member.users?.email}
                                    </p>
                                    {member.users?.full_name && (
                                      <p className="text-xs text-gray-500 truncate">
                                        {member.users.email}
                                      </p>
                                    )}
                                  </div>
                                  <Plus className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          )}
                        </CommandList>
                      </Command>
                      <p className="text-xs text-gray-500">
                        Type at least 2 characters to search
                      </p>
                    </div>
                  )}

                  {/* Moderator list */}
                  <div className="space-y-2">
                    {moderators.map((mod) => (
                      <div
                        key={mod.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            {mod.user?.avatar_url && (
                              <AvatarImage src={mod.user.avatar_url} />
                            )}
                            <AvatarFallback className="text-xs bg-purple-100 text-purple-700">
                              {getInitials(mod.user?.full_name || null, mod.user?.email || "")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {mod.user?.full_name || mod.user?.email}
                              </span>
                              {mod.is_owner && (
                                <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">
                                  <Crown className="h-3 w-3 mr-1" />
                                  Owner
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">{mod.user?.email}</p>
                          </div>
                        </div>
                        {isOwner && !mod.is_owner && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveModerator(mod.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}

                    {moderators.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4">
                        No moderators assigned. The pad owner has full moderator privileges.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notifications */}
            <TabsContent value="notifications" className="space-y-4 mt-0">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Moderator Notifications
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>New message alerts</Label>
                      <p className="text-xs text-gray-500">Notify moderators of new messages</p>
                    </div>
                    <Switch
                      checked={settings?.notify_moderators_new_message ?? true}
                      onCheckedChange={(checked) =>
                        setSettings((s) => (s ? { ...s, notify_moderators_new_message: checked } : s))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Mention alerts</Label>
                      <p className="text-xs text-gray-500">Notify when @mentioned</p>
                    </div>
                    <Switch
                      checked={settings?.notify_moderators_mentions ?? true}
                      onCheckedChange={(checked) =>
                        setSettings((s) => (s ? { ...s, notify_moderators_mentions: checked } : s))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Email digest</Label>
                      <p className="text-xs text-gray-500">Send summary emails when offline</p>
                    </div>
                    <Switch
                      checked={settings?.email_digest_enabled ?? false}
                      onCheckedChange={(checked) =>
                        setSettings((s) => (s ? { ...s, email_digest_enabled: checked } : s))
                      }
                    />
                  </div>

                  {settings?.email_digest_enabled && (
                    <div className="space-y-2 pl-4 border-l-2 border-purple-200">
                      <Label>Digest frequency</Label>
                      <Select
                        value={settings?.email_digest_frequency ?? "daily"}
                        onValueChange={(value: EmailDigestFrequency) =>
                          setSettings((s) => (s ? { ...s, email_digest_frequency: value } : s))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hourly">Hourly</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Office Hours */}
            <TabsContent value="office-hours" className="space-y-4 mt-0">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Office Hours
                  </CardTitle>
                  <CardDescription>
                    Set when moderators are typically available
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable office hours</Label>
                      <p className="text-xs text-gray-500">Show availability status based on schedule</p>
                    </div>
                    <Switch
                      checked={settings?.office_hours_enabled ?? false}
                      onCheckedChange={(checked) =>
                        setSettings((s) => (s ? { ...s, office_hours_enabled: checked } : s))
                      }
                    />
                  </div>

                  {settings?.office_hours_enabled && (
                    <div className="space-y-4 pl-4 border-l-2 border-purple-200">
                      <div className="space-y-2">
                        <Label>Timezone</Label>
                        <Select
                          value={settings?.office_hours_timezone ?? "UTC"}
                          onValueChange={(value) =>
                            setSettings((s) => (s ? { ...s, office_hours_timezone: value } : s))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIMEZONES.map((tz) => (
                              <SelectItem key={tz} value={tz}>
                                {tz}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Start time</Label>
                          <Input
                            type="time"
                            value={settings?.office_hours_start ?? "09:00"}
                            onChange={(e) =>
                              setSettings((s) =>
                                s ? { ...s, office_hours_start: e.target.value } : s
                              )
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>End time</Label>
                          <Input
                            type="time"
                            value={settings?.office_hours_end ?? "17:00"}
                            onChange={(e) =>
                              setSettings((s) =>
                                s ? { ...s, office_hours_end: e.target.value } : s
                              )
                            }
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Working days</Label>
                        <div className="flex gap-2">
                          {DAYS_OF_WEEK.map((day) => (
                            <button
                              type="button"
                              key={day.value}
                              onClick={() => toggleDay(day.value)}
                              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                settings?.office_hours_days.includes(day.value)
                                  ? "bg-purple-600 text-white"
                                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                              }`}
                            >
                              {day.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Away message</Label>
                        <Textarea
                          value={settings?.away_message ?? ""}
                          onChange={(e) =>
                            setSettings((s) => (s ? { ...s, away_message: e.target.value } : s))
                          }
                          placeholder="Message shown when outside office hours..."
                          rows={2}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* AI First-Responder */}
            <TabsContent value="ai" className="space-y-4 mt-0">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Bot className="h-4 w-4" />
                    AI First-Responder
                  </CardTitle>
                  <CardDescription>
                    Let AI handle initial responses and escalate to moderators when needed
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable AI assistant</Label>
                      <p className="text-xs text-gray-500">AI will greet and respond to common questions</p>
                    </div>
                    <Switch
                      checked={settings?.ai_enabled ?? false}
                      onCheckedChange={(checked) =>
                        setSettings((s) => (s ? { ...s, ai_enabled: checked } : s))
                      }
                    />
                  </div>

                  {settings?.ai_enabled && (
                    <div className="space-y-4 pl-4 border-l-2 border-purple-200">
                      <div className="space-y-2">
                        <Label>Greeting message</Label>
                        <Textarea
                          value={settings?.ai_greeting ?? ""}
                          onChange={(e) =>
                            setSettings((s) => (s ? { ...s, ai_greeting: e.target.value } : s))
                          }
                          placeholder="Hello! How can I help you today?"
                          rows={2}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Auto-escalate</Label>
                          <p className="text-xs text-gray-500">
                            Automatically notify moderators if AI can't answer
                          </p>
                        </div>
                        <Switch
                          checked={settings?.ai_auto_escalate ?? true}
                          onCheckedChange={(checked) =>
                            setSettings((s) => (s ? { ...s, ai_auto_escalate: checked } : s))
                          }
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>

        {/* Save button */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveSettings}
            disabled={saving}
            className={saved ? "bg-green-600 hover:bg-green-600" : ""}
          >
            {saving && (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            )}
            {!saving && saved && (
              <>
                <Check className="h-4 w-4 mr-2" />
                Saved!
              </>
            )}
            {!saving && !saved && (
              <>
                <Check className="h-4 w-4 mr-2" />
                Save
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
