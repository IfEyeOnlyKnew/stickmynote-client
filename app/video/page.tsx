"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Video, Plus, Clock, Copy, Trash2, ExternalLink } from "lucide-react"
import { UserMenu } from "@/components/user-menu"
import { useToast } from "@/hooks/use-toast"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { useHubModeGuard } from "@/hooks/use-hub-mode-guard"
import { VideoInviteUserSearch } from "@/components/video/VideoInviteUserSearch"

interface VideoRoom {
  id: string
  name: string
  room_url: string
  created_at: string
  created_by: string
  multi_pak_id?: string
  pad_id?: string
}

export default function VideoPage() {
  const { toast } = useToast()
  const { isAuthorized, isLoading: guardLoading } = useHubModeGuard()
  const [rooms, setRooms] = useState<VideoRoom[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newRoomName, setNewRoomName] = useState("")
  const [inviteEmails, setInviteEmails] = useState<string[]>([])
  const [isCreating, setIsCreating] = useState(false)

  // All callbacks MUST be defined before any conditional returns (Rules of Hooks)
  const handleEmailsChange = useCallback((emails: string[]) => {
    setInviteEmails(emails)
  }, [])

  const fetchRooms = useCallback(async () => {
    try {
      const response = await fetch("/api/video/rooms")
      if (!response.ok) {
        throw new Error("Failed to fetch rooms")
      }
      const data = await response.json()
      setRooms(data.rooms || [])
    } catch (error) {
      console.error("[Video] Error fetching rooms:", error)
      toast({
        title: "Error",
        description: "Failed to load video rooms",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  const handleCreateRoom = useCallback(async () => {
    if (!newRoomName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a room name",
        variant: "destructive",
      })
      return
    }

    setIsCreating(true)

    try {
      const response = await fetch("/api/video/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRoomName,
          inviteEmails: inviteEmails,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create room")
      }

      toast({
        title: "Success",
        description: inviteEmails.length > 0
          ? "Video room created and invitations sent"
          : "Video room created successfully",
      })

      setNewRoomName("")
      setInviteEmails([])
      await fetchRooms()
    } catch (error) {
      console.error("[Video] Error creating room:", error)
      toast({
        title: "Error",
        description: "Failed to create video room",
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }, [newRoomName, inviteEmails, toast, fetchRooms])

  const handleCopyLink = useCallback(async (roomUrl: string, roomName: string) => {
    try {
      await navigator.clipboard.writeText(roomUrl)
      toast({
        title: "Link Copied",
        description: `Link to "${roomName}" copied to clipboard`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      })
    }
  }, [toast])

  const handleDeleteRoom = useCallback(async (roomId: string, roomName: string) => {
    if (!confirm(`Are you sure you want to delete "${roomName}"? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/video/rooms?id=${roomId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete room")
      }

      toast({
        title: "Success",
        description: `"${roomName}" has been deleted`,
      })

      await fetchRooms()
    } catch (error) {
      console.error("[Video] Error deleting room:", error)
      toast({
        title: "Error",
        description: "Failed to delete video room",
        variant: "destructive",
      })
    }
  }, [toast, fetchRooms])

  // useEffect AFTER all useCallback definitions
  useEffect(() => {
    if (!guardLoading && isAuthorized) {
      fetchRooms()
    }
  }, [guardLoading, isAuthorized, fetchRooms])

  // Early return AFTER all hooks
  if (guardLoading || !isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <BreadcrumbNav
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Video Hub", current: true },
        ]}
      />

      <div className="flex justify-between items-center mb-8">
        <div className="text-center flex-1">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Video Conferencing</h1>
          <p className="text-gray-600">Connect with your team in real-time</p>
        </div>
        <div className="flex items-center">
          <UserMenu />
        </div>
      </div>

      {/* Create Room Section */}
      <Card className="mb-6 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create New Video Room
          </CardTitle>
          <CardDescription>Start a new video conference and invite participants</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="roomName">Room Name</Label>
              <Input
                id="roomName"
                placeholder="Enter room name..."
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
              />
            </div>
            <div>
              <VideoInviteUserSearch
                selectedEmails={inviteEmails}
                onEmailsChange={handleEmailsChange}
              />
            </div>
            <Button onClick={handleCreateRoom} disabled={isCreating} className="w-full bg-blue-600 hover:bg-blue-700">
              {isCreating ? "Creating..." : "Create Room & Send Invites"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Active Rooms */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Your Video Rooms</h2>
        {isLoading && (
          <div className="text-center py-8">
            <p className="text-gray-500">Loading rooms...</p>
          </div>
        )}
        {!isLoading && rooms.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <Card key={room.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Video className="h-4 w-4 text-blue-600" />
                    {room.name}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Created {new Date(room.created_at).toLocaleDateString()}
                    </div>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button onClick={() => handleCopyLink(room.room_url, room.name)} variant="outline" className="w-full">
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Link
                  </Button>
                  <Button
                    onClick={() => window.open(room.room_url, "_blank")}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Join Room
                  </Button>
                  <Button onClick={() => handleDeleteRoom(room.id, room.name)} variant="destructive" className="w-full">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Room
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {!isLoading && rooms.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <Video className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No video rooms yet</p>
              <p className="text-sm text-gray-400">Create your first room to get started</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
