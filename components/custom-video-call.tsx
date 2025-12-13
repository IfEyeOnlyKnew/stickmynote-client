"use client"

import { useEffect, useState, useCallback } from "react"
import Image from "next/image"
import {
  DailyProvider,
  useParticipantIds,
  useLocalSessionId,
  useDaily,
  useScreenShare,
  useLocalParticipant,
  useActiveSpeakerId,
  useParticipant,
  useAppMessage,
  useRecording,
  useTranscription,
  useDevices, // Import useDevices from @daily-co/daily-react instead of missing hook
} from "@daily-co/daily-react"
import DailyIframe, { type DailyCall } from "@daily-co/daily-js"
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
  Disc,
  LayoutGrid,
  Maximize,
  Send,
  X,
  Smile,
  ImageIcon,
  Wand2,
  Captions,
} from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./video-sheet"
import { Badge } from "@/components/ui/badge"

interface CustomVideoCallProps {
  roomUrl: string
  onLeave: () => void
  userName?: string
  isMinimized?: boolean
}

export function CustomVideoCall({ roomUrl, onLeave, userName = "Guest", isMinimized = false }: CustomVideoCallProps) {
  const [callObject, setCallObject] = useState<DailyCall | null>(null)

  useEffect(() => {
    const newCallObject = DailyIframe.createCallObject()
    setCallObject(newCallObject)

    return () => {
      newCallObject.destroy()
    }
  }, [])

  if (!callObject) return null

  return (
    <DailyProvider callObject={callObject}>
      <VideoCallContent roomUrl={roomUrl} onLeave={onLeave} userName={userName} isMinimized={isMinimized} />
    </DailyProvider>
  )
}

function VideoCallContent({ roomUrl, onLeave, userName, isMinimized }: CustomVideoCallProps) {
  const call = useDaily()
  const participantIds = useParticipantIds()
  const localSessionId = useLocalSessionId()
  const localParticipant = useLocalParticipant()
  const activeSpeakerId = useActiveSpeakerId()
  const { isSharingScreen, startScreenShare, stopScreenShare } = useScreenShare()
  const { isRecording, startRecording, stopRecording } = useRecording()
  const { isTranscribing, startTranscription, stopTranscription } = useTranscription()
  const { cameras, microphones, speakers, setCamera, setMicrophone, setSpeaker, camState, micState } = useDevices()

  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isCamOff, setIsCamOff] = useState(false)
  const [showParticipants, setShowParticipants] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [messages, setMessages] = useState<{ sender: string; text: string }[]>([])
  const [chatInput, setChatInput] = useState("")
  const [layout, setLayout] = useState<"grid" | "speaker">("grid")
  const [reactions, setReactions] = useState<{ id: string; emoji: string; x: number }[]>([])
  const [videoEffect, setVideoEffect] = useState<"none" | "blur" | "image">("none")
  const [backgroundImage, setBackgroundImage] = useState<string>(
    "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80",
  )
  const [caption, setCaption] = useState<{
    text: string
    speaker: string
  } | null>(null)

  useEffect(() => {
    if (!call) return

    const handleTranscription = (evt: any) => {
      // Only show final results or update in real-time?
      // Let's show everything but maybe style it differently?
      // For now, just show the text.
      if (evt.text) {
        // Try to find the participant name
        const participants = call.participants()
        const speaker = participants[evt.participantId]?.user_name || "Unknown"

        setCaption({ text: evt.text, speaker })

        // Clear caption after 5 seconds of no activity
        const timer = setTimeout(() => setCaption(null), 5000)
        return () => clearTimeout(timer)
      }
    }

    call.on("transcription-message", handleTranscription)
    return () => {
      call.off("transcription-message", handleTranscription)
    }
  }, [call])

  const toggleTranscription = () => {
    if (isTranscribing) {
      stopTranscription()
    } else {
      startTranscription()
    }
  }

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

  const sendAppMessage = useAppMessage({
    onAppMessage: (ev) => {
      const name = ev.data.name || "Guest"
      if (ev.data.type === "chat") {
        setMessages((prev) => [...prev, { sender: name, text: ev.data.message }])
      } else if (ev.data.type === "reaction") {
        addReaction(ev.data.emoji)
      }
    },
  })

  const addReaction = (emoji: string) => {
    const id = Math.random().toString(36).substring(7)
    const x = Math.random() * 80 + 10 // Random position between 10% and 90%
    setReactions((prev) => [...prev, { id, emoji, x }])
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id))
    }, 2000)
  }

  const sendReaction = (emoji: string) => {
    sendAppMessage({ type: "reaction", emoji, name: userName })
    addReaction(emoji)
  }

  const handleSendMessage = () => {
    if (!chatInput.trim()) return
    sendAppMessage({
      type: "chat",
      message: chatInput,
      name: userName || "Guest",
    })
    setMessages((prev) => [...prev, { sender: "You", text: chatInput }])
    setChatInput("")
  }

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  useEffect(() => {
    if (call && roomUrl) {
      call.join({ url: roomUrl, userName }).catch((err) => console.error("Failed to join call:", err))
    }
  }, [call, roomUrl, userName])

  const toggleMic = useCallback(() => {
    call?.setLocalAudio(isMicMuted)
    setIsMicMuted(!isMicMuted)
  }, [call, isMicMuted])

  const toggleCam = useCallback(() => {
    call?.setLocalVideo(isCamOff)
    setIsCamOff(!isCamOff)
  }, [call, isCamOff])

  const toggleScreenShare = useCallback(() => {
    if (isSharingScreen) {
      stopScreenShare()
    } else {
      startScreenShare()
    }
  }, [isSharingScreen, startScreenShare, stopScreenShare])

  const handleLeave = useCallback(() => {
    call?.leave()
    onLeave()
  }, [call, onLeave])

  const applyVideoEffect = useCallback(
    async (effect: "none" | "blur" | "image", imageUrl?: string) => {
      if (!call) return

      try {
        const config: any = { video: { processor: { type: effect } } }

        if (effect === "blur") {
          config.video.processor.type = "background-blur"
          config.video.processor.config = { strength: 0.7 }
        } else if (effect === "image") {
          config.video.processor.type = "background-image"
          config.video.processor.config = {
            source: imageUrl || backgroundImage,
          }
        }

        // @ts-ignore - updateInputSettings is available but might not be in the type definition depending on version
        await call.updateInputSettings(config)

        setVideoEffect(effect)
        if (imageUrl) setBackgroundImage(imageUrl)
      } catch (e) {
        console.error("Failed to apply video effect:", e)
      }
    },
    [call, backgroundImage],
  )

  // Filter out screen shares from regular grid if needed, or handle them specially
  // For now, we just render all participants

  const renderGrid = () => {
    if (isMinimized) {
      const targetId = activeSpeakerId || participantIds[0] || localSessionId
      return (
        <div className="w-full h-full">
          <VideoTile sessionId={targetId} isLocal={targetId === localSessionId} isActiveSpeaker={true} />
        </div>
      )
    }

    if (layout === "speaker" && participantIds.length > 1) {
      const speakerId = activeSpeakerId || participantIds[0]
      const others = participantIds.filter((id) => id !== speakerId)

      return (
        <div className="flex h-full gap-4">
          <div className="flex-1 relative">
            <VideoTile sessionId={speakerId} isLocal={speakerId === localSessionId} isActiveSpeaker={true} />
          </div>
          <div className="w-64 flex flex-col gap-4 overflow-y-auto pr-2">
            {others.map((id) => (
              <div key={id} className="h-48 flex-shrink-0">
                <VideoTile sessionId={id} isLocal={id === localSessionId} isActiveSpeaker={false} />
              </div>
            ))}
          </div>
        </div>
      )
    }

    return (
      <div
        className={`grid gap-4 h-full ${
          participantIds.length <= 1
            ? "grid-cols-1"
            : participantIds.length <= 4
              ? "grid-cols-2"
              : participantIds.length <= 9
                ? "grid-cols-3"
                : "grid-cols-4"
        }`}
      >
        {participantIds.map((id) => (
          <VideoTile key={id} sessionId={id} isLocal={id === localSessionId} isActiveSpeaker={id === activeSpeakerId} />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 text-white relative">
      {/* Main Video Grid */}
      <div className="flex-1 p-4 overflow-hidden relative">
        {/* Branding Overlay */}
        {!isMinimized && (
          <div className="absolute top-4 left-4 z-10 bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-sm flex items-center gap-2 pointer-events-none">
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-sm font-medium text-white/90">Stick My Note</span>
          </div>
        )}

        {renderGrid()}

        {/* Reactions Overlay */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {reactions.map((reaction) => (
            <div
              key={reaction.id}
              className="absolute text-4xl animate-float-up"
              style={{ left: `${reaction.x}%`, bottom: "0" }}
            >
              {reaction.emoji}
            </div>
          ))}
        </div>

        {/* Transcription Caption */}
        {caption && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white text-sm rounded-md px-4 py-2 shadow-lg">
            <strong>{caption.speaker}:</strong> {caption.text}
          </div>
        )}
      </div>

      {/* Chat Sidebar */}
      {showChat && !isMinimized && (
        <div className="absolute right-4 top-4 bottom-24 w-80 bg-slate-900 border border-slate-800 rounded-lg shadow-xl flex flex-col z-20">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <h3 className="font-semibold">Chat</h3>
            <Button variant="ghost" size="icon" onClick={() => setShowChat(false)} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex flex-col ${msg.sender === "You" ? "items-end" : "items-start"}`}>
                  <span className="text-xs text-slate-400 mb-1">{msg.sender}</span>
                  <div
                    className={`px-3 py-2 rounded-lg max-w-[80%] ${
                      msg.sender === "You" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-200"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="p-4 border-t border-slate-800 flex gap-2">
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder="Type a message..."
              className="bg-slate-950 border-slate-700 text-white"
            />
            <Button size="icon" onClick={handleSendMessage} className="bg-indigo-600 hover:bg-indigo-700">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Caption Overlay */}
      {caption && !isMinimized && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 max-w-2xl w-full px-4 z-40 text-center">
          <div className="bg-black/60 backdrop-blur-md p-4 rounded-lg text-white shadow-lg transition-all animate-in fade-in slide-in-from-bottom-4">
            <p className="text-sm text-slate-300 mb-1 font-medium">{caption.speaker}</p>
            <p className="text-lg font-medium leading-relaxed">{caption.text}</p>
          </div>
        </div>
      )}

      {/* Controls Bar */}
      {isMinimized ? (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-900/90 p-2 rounded-full border border-slate-800 z-50 backdrop-blur-sm">
          <Button
            variant={isMicMuted ? "destructive" : "secondary"}
            size="icon"
            className="rounded-full h-8 w-8"
            onClick={toggleMic}
          >
            {isMicMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button
            variant={isCamOff ? "destructive" : "secondary"}
            size="icon"
            className="rounded-full h-8 w-8"
            onClick={toggleCam}
          >
            {isCamOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
          </Button>
          <Button variant="destructive" size="icon" className="rounded-full h-8 w-8" onClick={handleLeave}>
            <PhoneOff className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="h-20 bg-slate-900 border-t border-slate-800 flex items-center justify-center gap-4 px-4 relative z-30">
          <div className="absolute left-4 flex gap-2">
            <Button
              variant={isRecording ? "destructive" : "secondary"}
              size="icon"
              className={`rounded-full h-10 w-10 ${isRecording ? "animate-pulse" : ""}`}
              onClick={toggleRecording}
              title={isRecording ? "Stop Recording" : "Start Recording"}
            >
              <Disc className="h-4 w-4" />
            </Button>

            <Button
              variant={isTranscribing ? "default" : "secondary"}
              size="icon"
              className={`rounded-full h-10 w-10 ${isTranscribing ? "bg-indigo-600 hover:bg-indigo-700" : ""}`}
              onClick={toggleTranscription}
              title={isTranscribing ? "Stop Captions" : "Start Captions"}
            >
              <Captions className="h-4 w-4" />
            </Button>

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

          <Button
            variant={isMicMuted ? "destructive" : "secondary"}
            size="icon"
            className="rounded-full h-12 w-12"
            onClick={toggleMic}
          >
            {isMicMuted ? <MicOff /> : <Mic />}
          </Button>

          <Button
            variant={isCamOff ? "destructive" : "secondary"}
            size="icon"
            className="rounded-full h-12 w-12"
            onClick={toggleCam}
          >
            {isCamOff ? <VideoOff /> : <Video />}
          </Button>

          <Button
            variant={isSharingScreen ? "default" : "secondary"}
            size="icon"
            className={`rounded-full h-12 w-12 ${isSharingScreen ? "bg-green-600 hover:bg-green-700" : ""}`}
            onClick={toggleScreenShare}
          >
            {isSharingScreen ? <MonitorOff /> : <Monitor />}
          </Button>

          <Button variant="destructive" size="icon" className="rounded-full h-12 w-12 ml-4" onClick={handleLeave}>
            <PhoneOff />
          </Button>

          <div className="absolute right-4 flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                  <Smile />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-2 bg-slate-900 border-slate-800" side="top">
                <div className="flex gap-2">
                  {["👍", "👏", "❤️", "😂", "😮", "🎉"].map((emoji) => (
                    <button
                      key={emoji}
                      className="text-2xl hover:scale-125 transition-transform"
                      onClick={() => sendReaction(emoji)}
                    >
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
                {messages.length > 0 && !showChat && (
                  <Badge className="absolute -top-2 -right-2 h-4 w-4 flex items-center justify-center p-0 text-[10px] bg-red-500">
                    {messages.length}
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
                      {participantIds.length}
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
                    {participantIds.map((id) => (
                      <ParticipantListItem key={id} sessionId={id} isLocal={id === localSessionId} />
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
                <div className="mt-6 space-y-6">
                  <div className="space-y-2">
                    <Label>Camera</Label>
                    <Select
                      value={cameras.find((c) => c.selected)?.device.deviceId || ""}
                      onValueChange={(val) => setCamera(val)}
                    >
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue placeholder="Select camera" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 text-white">
                        {cameras.map((cam) => (
                          <SelectItem key={cam.device.deviceId} value={cam.device.deviceId}>
                            {cam.device.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Microphone</Label>
                    <Select
                      value={microphones.find((m) => m.selected)?.device.deviceId || ""}
                      onValueChange={(val) => setMicrophone(val)}
                    >
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue placeholder="Select microphone" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 text-white">
                        {microphones.map((mic) => (
                          <SelectItem key={mic.device.deviceId} value={mic.device.deviceId}>
                            {mic.device.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Speakers</Label>
                    <Select
                      value={speakers.find((s) => s.selected)?.device.deviceId || ""}
                      onValueChange={(val) => setSpeaker(val)}
                    >
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue placeholder="Select speakers" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 text-white">
                        {speakers.map((spk) => (
                          <SelectItem key={spk.device.deviceId} value={spk.device.deviceId}>
                            {spk.device.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

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
                        className={`w-full border-slate-700 hover:bg-slate-700 ${
                          videoEffect === "blur" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-slate-800"
                        }`}
                        onClick={() => applyVideoEffect("blur")}
                      >
                        <Wand2 className="w-4 h-4 mr-2" />
                        Blur
                      </Button>
                      <Button
                        variant={videoEffect === "image" ? "default" : "outline"}
                        className={`w-full border-slate-700 hover:bg-slate-700 ${
                          videoEffect === "image" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-slate-800"
                        }`}
                        onClick={() => applyVideoEffect("image")}
                      >
                        <ImageIcon className="w-4 h-4 mr-2" />
                        Image
                      </Button>
                    </div>

                    {videoEffect === "image" && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {PRESET_BACKGROUNDS.map((bg) => (
                          <button
                            key={bg.name}
                            className={`relative aspect-video rounded-md overflow-hidden border-2 transition-all ${
                              backgroundImage === bg.url
                                ? "border-indigo-500 ring-2 ring-indigo-500/50"
                                : "border-slate-700 hover:border-slate-500"
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
              </SheetContent>
            </Sheet>
          </div>
        </div>
      )}
    </div>
  )
}

function ParticipantListItem({
  sessionId,
  isLocal,
}: {
  sessionId: string
  isLocal: boolean
}) {
  const participant = useParticipant(sessionId)
  if (!participant) return null

  return (
    <div className="flex items-center justify-between p-2 rounded hover:bg-slate-800">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold">
          {participant.user_name?.slice(0, 2).toUpperCase() || "??"}
        </div>
        <div className="text-sm font-medium">
          {participant.user_name || "Guest"} {isLocal && "(You)"}
        </div>
      </div>
      <div className="flex gap-2 text-slate-400">
        {!participant.audio && <MicOff className="h-4 w-4" />}
        {!participant.video && <VideoOff className="h-4 w-4" />}
      </div>
    </div>
  )
}
