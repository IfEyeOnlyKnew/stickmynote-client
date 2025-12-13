"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Video, Plus, Users, Clock, Copy, Mail, Trash2, Info } from "lucide-react"
import { UserMenu } from "@/components/user-menu"
import { useToast } from "@/hooks/use-toast"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { VideoRoomModal } from "@/components/video-room-modal"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useHubModeGuard } from "@/hooks/use-hub-mode-guard"

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
  const router = useRouter()
  const { toast } = useToast()
  const { isAuthorized, isLoading: guardLoading } = useHubModeGuard()
  const [rooms, setRooms] = useState<VideoRoom[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newRoomName, setNewRoomName] = useState("")
  const [inviteEmails, setInviteEmails] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [activeRoomUrl, setActiveRoomUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!guardLoading && isAuthorized) {
      fetchRooms()
    }
  }, [guardLoading, isAuthorized])

  if (guardLoading || !isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  const fetchRooms = async () => {
    console.log("[v0] Fetching video rooms...")
    try {
      const response = await fetch("/api/video/rooms")
      console.log("[v0] Fetch response status:", response.status)
      console.log("[v0] Fetch response ok:", response.ok)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("[v0] Fetch error response:", errorText)
        throw new Error("Failed to fetch rooms")
      }

      const data = await response.json()
      console.log("[v0] Received rooms data:", data)
      console.log("[v0] Number of rooms:", data.rooms?.length || 0)
      console.log("[v0] Rooms array:", data.rooms)

      console.log("[v0] Current rooms state before update:", rooms)
      setRooms(data.rooms || [])
      console.log("[v0] Set rooms state to:", data.rooms || [])
    } catch (error) {
      console.error("[v0] Error fetching rooms:", error)
      toast({
        title: "Error",
        description: "Failed to load video rooms",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a room name",
        variant: "destructive",
      })
      return
    }

    setIsCreating(true)
    console.log("[v0] Creating room with name:", newRoomName)
    console.log("[v0] Invite emails:", inviteEmails)

    try {
      const response = await fetch("/api/video/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRoomName,
          inviteEmails: inviteEmails.trim()
            ? inviteEmails
                .split(",")
                .map((e) => e.trim())
                .filter((e) => e)
            : [],
        }),
      })

      console.log("[v0] Create response status:", response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("[v0] Create error response:", errorText)
        throw new Error("Failed to create room")
      }

      const data = await response.json()
      console.log("[v0] Created room data:", data)

      toast({
        title: "Success",
        description: inviteEmails.trim()
          ? "Video room created and invitations sent"
          : "Video room created successfully",
      })

      setNewRoomName("")
      setInviteEmails("")
      setShowCreateModal(false)

      console.log("[v0] About to fetch rooms after creation...")
      await fetchRooms()
      console.log("[v0] Finished fetching rooms after creation")
    } catch (error) {
      console.error("[v0] Error creating room:", error)
      toast({
        title: "Error",
        description: "Failed to create video room",
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleCopyLink = async (roomUrl: string, roomName: string) => {
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
  }

  const handleDeleteRoom = async (roomId: string, roomName: string) => {
    if (!confirm(`Are you sure you want to delete "${roomName}"? This action cannot be undone.`)) {
      return
    }

    console.log("[v0] Deleting room:", roomId, roomName)
    console.log("[v0] Current rooms before delete:", rooms)

    try {
      const response = await fetch(`/api/video/rooms?id=${roomId}`, {
        method: "DELETE",
      })

      console.log("[v0] Delete response status:", response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("[v0] Delete error response:", errorText)
        throw new Error("Failed to delete room")
      }

      const data = await response.json()
      console.log("[v0] Delete response data:", data)

      toast({
        title: "Success",
        description: `"${roomName}" has been deleted`,
      })

      console.log("[v0] About to fetch rooms after deletion...")
      await fetchRooms()
      console.log("[v0] Finished fetching rooms after deletion")
    } catch (error) {
      console.error("[v0] Error deleting room:", error)
      toast({
        title: "Error",
        description: "Failed to delete video room",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <BreadcrumbNav
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Paks-Hub", href: "/paks" },
          { label: "Video Conferencing", href: "/video" },
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

      <Alert className="mb-6 bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-800">Transcription Feature</AlertTitle>
        <AlertDescription className="text-blue-700">
          For this to work in production, you will need to ensure that Transcription is enabled in your Daily.co domain
          settings, as it is a paid/premium feature on their platform.
        </AlertDescription>
      </Alert>

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
              <Label htmlFor="inviteEmails">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Invite Participants (Optional)
                </div>
              </Label>
              <Textarea
                id="inviteEmails"
                placeholder="Enter email addresses separated by commas (e.g., user1@example.com, user2@example.com)"
                value={inviteEmails}
                onChange={(e) => setInviteEmails(e.target.value)}
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">Invitations will be sent with a link to join the room</p>
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
        {isLoading ? (
          <div className="text-center py-8">
            <p className="text-gray-500">Loading rooms...</p>
          </div>
        ) : rooms.length > 0 ? (
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
                    onClick={() => setActiveRoomUrl(room.room_url)}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    <Users className="h-4 w-4 mr-2" />
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
        ) : (
          <Card>
            <CardContent className="text-center py-8">
              <Video className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No video rooms yet</p>
              <p className="text-sm text-gray-400">Create your first room to get started</p>
            </CardContent>
          </Card>
        )}
      </div>

      {activeRoomUrl && <VideoRoomModal roomUrl={activeRoomUrl} onClose={() => setActiveRoomUrl(null)} />}
    </div>
  )
}
