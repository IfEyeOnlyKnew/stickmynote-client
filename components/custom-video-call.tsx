"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import Image from "next/image"
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
  useChat,
  useDataChannel,
  useMediaDeviceSelect,
  useSpeakingParticipants,
} from "@livekit/components-react"
import "@livekit/components-styles"
import { Track } from "livekit-client"
import { BackgroundProcessor, type BackgroundProcessorWrapper } from "@livekit/track-processors"
import { VideoTile } from "./video-tile"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Monitor,
  MonitorOff,
  Users,
  MessageSquare,
  Settings,
  LayoutGrid,
  Maximize,
  Send,
  X,
  Smile,
  ImageIcon,
  Wand2,
  PenTool,
} from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Whiteboard } from "@/components/video/Whiteboard"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./video-sheet"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

// Map a DOMException / media error to a user-friendly message.
function formatMediaError(kind: "camera" | "microphone" | "screen", err: unknown): string {
  const errObj = err as { name?: string; message?: string } | undefined
  const name = errObj?.name || ""
  const device = kind === "microphone" ? "microphone" : kind === "screen" ? "screen" : "camera"

  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return `${device[0].toUpperCase() + device.slice(1)} permission denied. Click the site icon in the address bar and allow ${device} access, then try again.`
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return `${device[0].toUpperCase() + device.slice(1)} is in use by another app. Close Zoom/Teams/other browser tabs and try again.`
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return `No ${device} found on this device.`
  }
  if (name === "OverconstrainedError") {
    return `${device[0].toUpperCase() + device.slice(1)} doesn't meet the required constraints.`
  }
  return `Couldn't start ${device}: ${errObj?.message || name || "unknown error"}`
}

interface CustomVideoCallProps {
  roomName: string
  onLeave: () => void
  userName?: string
  isMinimized?: boolean
  /**
   * The database room id (not the LiveKit room name). When present, the
   * Leave button fires a best-effort PATCH to update this user's
   * participant status to `left`. Owners and uninvited joiners are no-ops.
   */
  roomId?: string
}

export function CustomVideoCall({ roomName, roomId, onLeave, userName = "Guest", isMinimized = false }: Readonly<CustomVideoCallProps>) {
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL

  useEffect(() => {
    async function fetchToken() {
      try {
        const res = await fetch(`/api/video/token?roomName=${encodeURIComponent(roomName)}`)
        if (!res.ok) throw new Error("Failed to get token")
        const data = await res.json()
        setToken(data.token)
      } catch (err) {
        console.error("Failed to fetch LiveKit token:", err)
        setError("Failed to connect to video service")
      }
    }
    fetchToken()
  }, [roomName])

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-950 text-white">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <Button variant="outline" onClick={onLeave}>Leave</Button>
        </div>
      </div>
    )
  }

  if (!token || !livekitUrl) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-950 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
          <p className="text-slate-400">Connecting to video room...</p>
        </div>
      </div>
    )
  }

  return (
    <LiveKitRoom
      serverUrl={livekitUrl}
      token={token}
      connect={true}
      audio={true}
      video={true}
      onDisconnected={onLeave}
    >
      <RoomAudioRenderer />
      <VideoCallContent roomName={roomName} roomId={roomId} onLeave={onLeave} userName={userName} isMinimized={isMinimized} />
    </LiveKitRoom>
  )
}

// Extracted sub-components to reduce cognitive complexity in VideoCallContent
function VideoChatSidebar({ chatMessages, localIdentity, chatInput, onChatInputChange, onSendMessage, onClose }: Readonly<{
  chatMessages: Array<{ id: string | number; from?: { identity?: string; name?: string }; message?: string }>
  localIdentity: string
  chatInput: string
  onChatInputChange: (value: string) => void
  onSendMessage: () => void
  onClose: () => void
}>) {
  return (
    <div className="absolute right-4 top-4 bottom-24 w-80 bg-slate-900 border border-slate-800 rounded-lg shadow-xl flex flex-col z-20">
      <div className="p-4 border-b border-slate-800 flex justify-between items-center">
        <h3 className="font-semibold">Chat</h3>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {chatMessages.map((msg) => {
            const isMe = msg.from?.identity === localIdentity
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                <span className="text-xs text-slate-400 mb-1">
                  {isMe ? "You" : msg.from?.name || msg.from?.identity || "Guest"}
                </span>
                <div
                  className={`px-3 py-2 rounded-lg max-w-[80%] ${
                    isMe ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-200"
                  }`}
                >
                  {msg.message}
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>
      <div className="p-4 border-t border-slate-800 flex gap-2">
        <Input
          value={chatInput}
          onChange={(e) => onChatInputChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSendMessage()}
          placeholder="Type a message..."
          className="bg-slate-950 border-slate-700 text-white"
        />
        <Button size="icon" onClick={onSendMessage} className="bg-indigo-600 hover:bg-indigo-700">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

type VideoEffect = "none" | "blur" | "image"

function createVideoProcessor(effect: VideoEffect, imageUrl: string): BackgroundProcessorWrapper | null {
  if (effect === "blur") {
    return BackgroundProcessor({ mode: "background-blur", blurRadius: 10 })
  }
  if (effect === "image") {
    return BackgroundProcessor({ mode: "virtual-background", imagePath: imageUrl })
  }
  return null
}

function getGridColsClass(count: number): string {
  if (count <= 1) return "grid-cols-1"
  if (count <= 4) return "grid-cols-2"
  if (count <= 9) return "grid-cols-3"
  return "grid-cols-4"
}

function VideoCallContent({ roomName, roomId, onLeave, userName, isMinimized }: Readonly<CustomVideoCallProps>) {
  const room = useRoomContext()
  const participants = useParticipants()
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant()
  const speakingParticipants = useSpeakingParticipants()
  const { chatMessages, send: sendChatMessage } = useChat()
  const { toast } = useToast()

  const [showParticipants, setShowParticipants] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [chatInput, setChatInput] = useState("")
  const [layout, setLayout] = useState<"grid" | "speaker">("grid")
  const [reactions, setReactions] = useState<{ id: string; emoji: string; x: number }[]>([])
  const [showWhiteboard, setShowWhiteboard] = useState(false)
  type VideoEffect = "none" | "blur" | "image"
  const [videoEffect, setVideoEffect] = useState<VideoEffect>("none")
  const [backgroundImage, setBackgroundImage] = useState<string>(
    "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80",
  )
  const bgProcessorRef = useRef<BackgroundProcessorWrapper | null>(null)

  // Reaction data channel handler extracted to reduce nesting depth
  const handleReactionData = useCallback((msg: { payload: BufferSource }) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(msg.payload))
      if (data.emoji) addReaction(data.emoji)
    } catch {
      // Parse error ignored — malformed reaction payloads are silently dropped
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { send: sendReactionData } = useDataChannel("reaction", handleReactionData)

  const activeSpeakerId = speakingParticipants.length > 0
    ? speakingParticipants[0].identity
    : null

  const PRESET_BACKGROUNDS = [
    {
      name: "Office",
      url: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80",
    },
    {
      name: "Living Room",
      url: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=800&q=80",
    },
    {
      name: "Abstract",
      url: "https://images.unsplash.com/photo-155768331697366216548-37526070297c?w=800&q=80",
    },
    {
      name: "Nature",
      url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80",
    },
  ]

  const removeReaction = useCallback((reactionId: string) => {
    setReactions((prev) => prev.filter((r) => r.id !== reactionId))
  }, [])

  const addReaction = (emoji: string) => {
    const id = Math.random().toString(36).substring(7)
    const x = Math.random() * 80 + 10
    setReactions((prev) => [...prev, { id, emoji, x }])
    setTimeout(() => removeReaction(id), 2000)
  }

  const sendReaction = (emoji: string) => {
    const payload = new TextEncoder().encode(JSON.stringify({ emoji, name: userName }))
    sendReactionData(payload, { topic: "reaction" })
    addReaction(emoji)
  }

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return
    try {
      await sendChatMessage(chatInput)
    } catch (err) {
      console.error("Failed to send message:", err)
    }
    setChatInput("")
  }

  const toggleMic = useCallback(async () => {
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)
    } catch (err) {
      console.error("[Video] Mic toggle failed:", err)
      toast({
        title: "Microphone error",
        description: formatMediaError("microphone", err),
        variant: "destructive",
      })
    }
  }, [localParticipant, isMicrophoneEnabled, toast])

  const toggleCam = useCallback(async () => {
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled)
    } catch (err) {
      console.error("[Video] Camera toggle failed:", err)
      toast({
        title: "Camera error",
        description: formatMediaError("camera", err),
        variant: "destructive",
      })
    }
  }, [localParticipant, isCameraEnabled, toast])

  const toggleScreenShare = useCallback(async () => {
    try {
      await localParticipant.setScreenShareEnabled(!isScreenShareEnabled)
    } catch (err) {
      console.error("[Video] Screen share toggle failed:", err)
      toast({
        title: "Screen share error",
        description: formatMediaError("screen", err),
        variant: "destructive",
      })
    }
  }, [localParticipant, isScreenShareEnabled, toast])

  const handleLeave = useCallback(() => {
    // Best-effort mark participant as 'left'. No-op for owners and any
    // joiner without a participant row (404), so we ignore the response.
    if (roomId) {
      fetch(`/api/video/rooms/${roomId}/participants`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "left" }),
        keepalive: true,
      }).catch(() => {})
    }
    room.disconnect()
    onLeave()
  }, [room, roomId, onLeave])

  const applyVideoEffect = useCallback(
    async (effect: VideoEffect, imageUrl?: string) => {
      const camPub = localParticipant.getTrackPublication(Track.Source.Camera)
      const camTrack = camPub?.track
      if (!camTrack) return

      try {
        const processor = createVideoProcessor(effect, imageUrl || backgroundImage)
        if (processor) {
          await camTrack.setProcessor(processor)
          bgProcessorRef.current = processor
        } else {
          await camTrack.stopProcessor()
          bgProcessorRef.current = null
        }

        setVideoEffect(effect)
        if (imageUrl) setBackgroundImage(imageUrl)
      } catch (e) {
        console.error("Failed to apply video effect:", e)
      }
    },
    [localParticipant, backgroundImage],
  )

  const renderSpeakerLayout = () => {
    const speaker = speakingParticipants[0] || participants[0]
    const others = participants.filter((p) => p.identity !== speaker.identity)

    return (
      <div className="flex h-full gap-4">
        <div className="flex-1 relative">
          <VideoTile participant={speaker} isLocal={speaker.identity === localParticipant.identity} isActiveSpeaker={true} />
        </div>
        <div className="w-64 flex flex-col gap-4 overflow-y-auto pr-2">
          {others.map((p) => (
            <div key={p.identity} className="h-48 flex-shrink-0">
              <VideoTile participant={p} isLocal={p.identity === localParticipant.identity} isActiveSpeaker={false} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const renderGrid = () => {
    if (isMinimized) {
      const target = speakingParticipants[0] || participants[0] || localParticipant
      return (
        <div className="w-full h-full">
          <VideoTile participant={target} isLocal={target.identity === localParticipant.identity} isActiveSpeaker={true} />
        </div>
      )
    }

    if (layout === "speaker" && participants.length > 1) {
      return renderSpeakerLayout()
    }

    return (
      <div className={`grid gap-4 h-full ${getGridColsClass(participants.length)}`}>
        {participants.map((p) => (
          <VideoTile
            key={p.identity}
            participant={p}
            isLocal={p.identity === localParticipant.identity}
            isActiveSpeaker={p.identity === activeSpeakerId}
          />
        ))}
      </div>
    )
  }

  const renderChatSidebar = () => (
    <VideoChatSidebar
      chatMessages={chatMessages}
      localIdentity={localParticipant.identity}
      chatInput={chatInput}
      onChatInputChange={setChatInput}
      onSendMessage={handleSendMessage}
      onClose={() => setShowChat(false)}
    />
  )

  const renderMinimizedControls = () => (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-900/90 p-2 rounded-full border border-slate-800 z-50 backdrop-blur-sm">
      <Button variant={isMicrophoneEnabled ? "secondary" : "destructive"} size="icon" className="rounded-full h-8 w-8" onClick={toggleMic}>
        {isMicrophoneEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
      </Button>
      <Button variant={isCameraEnabled ? "secondary" : "destructive"} size="icon" className="rounded-full h-8 w-8" onClick={toggleCam}>
        {isCameraEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
      </Button>
      <Button variant="destructive" size="icon" className="rounded-full h-8 w-8" onClick={handleLeave}>
        <PhoneOff className="h-4 w-4" />
      </Button>
    </div>
  )

  const renderRightToolbar = () => (
    <div className="absolute right-4 flex gap-2">
      <Button
        variant={showWhiteboard ? "default" : "ghost"}
        size="icon"
        className={`text-slate-400 hover:text-white ${showWhiteboard ? "bg-indigo-600 text-white" : ""}`}
        onClick={() => setShowWhiteboard(!showWhiteboard)}
        title={showWhiteboard ? "Hide Whiteboard" : "Show Whiteboard"}
      >
        <PenTool />
      </Button>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
            <Smile />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-2 bg-slate-900 border-slate-800" side="top">
          <div className="flex gap-2">
            {["\u{1F44D}", "\u{1F44F}", "\u2764\uFE0F", "\u{1F602}", "\u{1F62E}", "\u{1F389}"].map((emoji) => (
              <button type="button" key={emoji} className="text-2xl hover:scale-125 transition-transform" onClick={() => sendReaction(emoji)}>
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Button
        variant={showChat ? "default" : "ghost"}
        size="icon"
        className={`text-slate-400 hover:text-white ${showChat ? "bg-slate-800 text-white" : ""}`}
        onClick={() => setShowChat(!showChat)}
      >
        <div className="relative">
          <MessageSquare />
          {chatMessages.length > 0 && !showChat && (
            <Badge className="absolute -top-2 -right-2 h-4 w-4 flex items-center justify-center p-0 text-[10px] bg-red-500">
              {chatMessages.length}
            </Badge>
          )}
        </div>
      </Button>

      <Sheet open={showParticipants} onOpenChange={setShowParticipants}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
            <div className="relative">
              <Users />
              <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs bg-slate-800 text-white">
                {participants.length}
              </Badge>
            </div>
          </Button>
        </SheetTrigger>
        <SheetContent className="w-[300px] sm:w-[400px] bg-slate-900 border-slate-800 text-white">
          <SheetHeader>
            <SheetTitle className="text-white">Participants</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-100px)] mt-4">
            <div className="space-y-4">
              {participants.map((p) => (
                <ParticipantListItem key={p.identity} participant={p} isLocal={p.identity === localParticipant.identity} />
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
      <Sheet open={showSettings} onOpenChange={setShowSettings}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
            <Settings />
          </Button>
        </SheetTrigger>
        <SheetContent className="w-[300px] sm:w-[400px] bg-slate-900 border-slate-800 text-white">
          <SheetHeader>
            <SheetTitle className="text-white">Settings</SheetTitle>
          </SheetHeader>
          <VideoEffectsSettings
            videoEffect={videoEffect}
            backgroundImage={backgroundImage}
            applyVideoEffect={applyVideoEffect}
            presetBackgrounds={PRESET_BACKGROUNDS}
          />
        </SheetContent>
      </Sheet>
    </div>
  )

  const renderFullControls = () => (
    <div className="h-20 bg-slate-900 border-t border-slate-800 flex items-center justify-center gap-4 px-4 relative z-30">
      <div className="absolute left-4 flex gap-2">
        <Button
          variant="secondary"
          size="icon"
          className="rounded-full h-10 w-10"
          onClick={() => setLayout(layout === "grid" ? "speaker" : "grid")}
          title={layout === "grid" ? "Switch to Speaker View" : "Switch to Grid View"}
        >
          {layout === "grid" ? <Maximize className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
        </Button>
      </div>

      <Button variant={isMicrophoneEnabled ? "secondary" : "destructive"} size="icon" className="rounded-full h-12 w-12" onClick={toggleMic}>
        {isMicrophoneEnabled ? <Mic /> : <MicOff />}
      </Button>
      <Button variant={isCameraEnabled ? "secondary" : "destructive"} size="icon" className="rounded-full h-12 w-12" onClick={toggleCam}>
        {isCameraEnabled ? <Video /> : <VideoOff />}
      </Button>
      <Button
        variant={isScreenShareEnabled ? "default" : "secondary"}
        size="icon"
        className={`rounded-full h-12 w-12 ${isScreenShareEnabled ? "bg-green-600 hover:bg-green-700" : ""}`}
        onClick={toggleScreenShare}
      >
        {isScreenShareEnabled ? <MonitorOff /> : <Monitor />}
      </Button>
      <Button variant="destructive" size="icon" className="rounded-full h-12 w-12 ml-4" onClick={handleLeave}>
        <PhoneOff />
      </Button>

      {renderRightToolbar()}
    </div>
  )

  return (
    <div className="flex flex-col h-full bg-slate-950 text-white relative">
      {/* Main Video Grid */}
      <div className="flex-1 p-4 overflow-hidden relative">
        {!isMinimized && (
          <div className="absolute top-4 left-4 z-10 bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-sm flex items-center gap-2 pointer-events-none">
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-sm font-medium text-white/90">Stick My Note</span>
          </div>
        )}

        {showWhiteboard ? (
          <div className="h-full rounded-lg overflow-hidden border border-slate-800">
            <Whiteboard persistKey={`whiteboard:${roomName}`} />
          </div>
        ) : (
          renderGrid()
        )}

        {/* Reactions Overlay */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {reactions.map((reaction) => (
            <div key={reaction.id} className="absolute text-4xl animate-float-up" style={{ left: `${reaction.x}%`, bottom: "0" }}>
              {reaction.emoji}
            </div>
          ))}
        </div>
      </div>

      {showChat && !isMinimized && renderChatSidebar()}
      {isMinimized ? renderMinimizedControls() : renderFullControls()}
    </div>
  )
}

function VideoEffectsSettings({ videoEffect, backgroundImage, applyVideoEffect, presetBackgrounds }: Readonly<{
  videoEffect: "none" | "blur" | "image"
  backgroundImage: string
  applyVideoEffect: (effect: "none" | "blur" | "image", imageUrl?: string) => void
  presetBackgrounds: { name: string; url: string }[]
}>) {
  return (
    <div className="mt-6 space-y-6">
      <DeviceSettings kind="videoinput" label="Camera" />
      <DeviceSettings kind="audioinput" label="Microphone" />
      <DeviceSettings kind="audiooutput" label="Speakers" />

      <div className="space-y-2">
        <Label>Video Effects</Label>
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant={videoEffect === "none" ? "default" : "outline"}
            className="w-full bg-slate-800 border-slate-700 hover:bg-slate-700"
            onClick={() => applyVideoEffect("none")}
          >
            None
          </Button>
          <Button
            variant={videoEffect === "blur" ? "default" : "outline"}
            className={`w-full border-slate-700 hover:bg-slate-700 ${videoEffect === "blur" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-slate-800"}`}
            onClick={() => applyVideoEffect("blur")}
          >
            <Wand2 className="w-4 h-4 mr-2" />
            Blur
          </Button>
          <Button
            variant={videoEffect === "image" ? "default" : "outline"}
            className={`w-full border-slate-700 hover:bg-slate-700 ${videoEffect === "image" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-slate-800"}`}
            onClick={() => applyVideoEffect("image")}
          >
            <ImageIcon className="w-4 h-4 mr-2" />
            Image
          </Button>
        </div>

        {videoEffect === "image" && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            {presetBackgrounds.map((bg) => (
              <button
                type="button"
                key={bg.name}
                className={`relative aspect-video rounded-md overflow-hidden border-2 transition-all ${
                  backgroundImage === bg.url ? "border-indigo-500 ring-2 ring-indigo-500/50" : "border-slate-700 hover:border-slate-500"
                }`}
                onClick={() => applyVideoEffect("image", bg.url)}
              >
                <Image src={bg.url || "/placeholder.svg"} alt={bg.name} fill className="object-cover" />
                <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[10px] text-white p-1 text-center backdrop-blur-sm">
                  {bg.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DeviceSettings({ kind, label }: Readonly<{ kind: MediaDeviceKind; label: string }>) {
  const { devices, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({ kind })

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        value={activeDeviceId || ""}
        onValueChange={(val) => setActiveMediaDevice(val)}
      >
        <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
          <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent className="bg-slate-800 border-slate-700 text-white">
          {devices.map((device) => (
            <SelectItem key={device.deviceId} value={device.deviceId}>
              {device.label || `${label} ${device.deviceId.slice(0, 8)}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function ParticipantListItem({
  participant,
  isLocal,
}: Readonly<{
  participant: { identity: string; name?: string; isMicrophoneEnabled?: boolean; isCameraEnabled?: boolean }
  isLocal: boolean
}>) {
  const displayName = participant.name || participant.identity || "Guest"

  return (
    <div className="flex items-center justify-between p-2 rounded hover:bg-slate-800">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold">
          {displayName.slice(0, 2).toUpperCase()}
        </div>
        <div className="text-sm font-medium">
          {displayName} {isLocal && "(You)"}
        </div>
      </div>
      <div className="flex gap-2 text-slate-400">
        {!participant.isMicrophoneEnabled && <MicOff className="h-4 w-4" />}
        {!participant.isCameraEnabled && <VideoOff className="h-4 w-4" />}
      </div>
    </div>
  )
}
