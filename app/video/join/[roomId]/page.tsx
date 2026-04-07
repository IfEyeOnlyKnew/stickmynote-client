"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { CustomVideoCall } from "@/components/custom-video-call"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default function VideoJoinPage() {
  const params = useParams()
  const router = useRouter()
  const roomId = params.roomId as string

  const [livekitRoomName, setLivekitRoomName] = useState<string | null>(null)
  const [_roomDisplayName, setRoomDisplayName] = useState<string>("Video Room")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchRoom() {
      try {
        const res = await fetch("/api/video/rooms")
        if (!res.ok) throw new Error("Failed to fetch rooms")
        const data = await res.json()
        const room = data.rooms?.find((r: any) => r.id === roomId)

        if (!room) {
          setError("Room not found. It may have been deleted.")
          return
        }

        if (!room.livekit_room_name) {
          setError("This room is not configured for video. Please create a new room.")
          return
        }

        setLivekitRoomName(room.livekit_room_name)
        setRoomDisplayName(room.name || "Video Room")
      } catch {
        // Expected - room fetch may fail
        setError("Failed to load room information")
      } finally {
        setLoading(false)
      }
    }

    if (roomId) fetchRoom()
  }, [roomId])

  const handleLeave = () => {
    router.push("/video")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
          <p className="text-slate-400">Loading room...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-white">
        <div className="text-center max-w-md">
          <p className="text-red-400 mb-4">{error}</p>
          <Button variant="outline" onClick={() => router.push("/video")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Video Hub
          </Button>
        </div>
      </div>
    )
  }

  if (!livekitRoomName) return null

  return (
    <div className="h-screen w-screen">
      <CustomVideoCall
        roomName={livekitRoomName}
        onLeave={handleLeave}
      />
    </div>
  )
}
