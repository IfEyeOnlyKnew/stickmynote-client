"use client"

import { useState, useCallback, useRef } from "react"
import { Mic, Square, Loader2, Play, Pause, Trash2, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface NotedAudioRecorderProps {
  open: boolean
  onClose: () => void
  onInsert: (data: { audioUrl: string; transcript: string }) => void
}

export function NotedAudioRecorder({ open, onClose, onInsert }: Readonly<NotedAudioRecorderProps>) {
  const [recording, setRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [transcript, setTranscript] = useState("")
  const [transcribing, setTranscribing] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4",
      })

      chunksRef.current = []
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach((track) => track.stop())
      }

      mediaRecorder.start(100)
      setRecording(true)
      setDuration(0)
      setAudioBlob(null)
      setAudioUrl(null)
      setTranscript("")

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1)
      }, 1000)
    } catch (err) {
      console.error("Failed to start recording:", err)
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop()
      setRecording(false)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [recording])

  const togglePlayback = useCallback(() => {
    if (!audioUrl) return
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl)
      audioRef.current.onended = () => setPlaying(false)
    }
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.play()
      setPlaying(true)
    }
  }, [audioUrl, playing])

  const transcribe = useCallback(async () => {
    if (!audioBlob) return
    try {
      setTranscribing(true)
      const formData = new FormData()
      formData.append("audio", audioBlob, "recording.webm")

      const res = await fetch("/api/noted/transcribe", {
        method: "POST",
        credentials: "include",
        body: formData,
      })

      if (res.ok) {
        const json = await res.json()
        if (json.data?.text) {
          setTranscript(json.data.text)
        } else if (json.data?.error) {
          setTranscript(`[Transcription unavailable: ${json.data.error}]`)
        }
      }
    } catch (err) {
      console.error("Failed to transcribe:", err)
      setTranscript("[Transcription failed]")
    } finally {
      setTranscribing(false)
    }
  }, [audioBlob])

  const handleDiscard = useCallback(() => {
    setAudioBlob(null)
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioUrl(null)
    setTranscript("")
    setDuration(0)
    audioRef.current = null
  }, [audioUrl])

  const handleInsert = useCallback(() => {
    if (!audioUrl) return
    onInsert({ audioUrl, transcript })
    onClose()
  }, [audioUrl, transcript, onInsert, onClose])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Audio Note</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {/* Recording indicator */}
          <div
            className={cn(
              "w-24 h-24 rounded-full flex items-center justify-center transition-all",
              (() => {
                if (recording) return "bg-red-100 dark:bg-red-900/30 animate-pulse"
                if (audioBlob) return "bg-green-100 dark:bg-green-900/30"
                return "bg-muted"
              })()
            )}
          >
            {recording && (
              <Mic className="h-10 w-10 text-red-500" />
            )}
            {!recording && audioBlob && (
              <button type="button" onClick={togglePlayback} className="p-2">
                {playing ? (
                  <Pause className="h-10 w-10 text-green-600" />
                ) : (
                  <Play className="h-10 w-10 text-green-600" />
                )}
              </button>
            )}
            {!recording && !audioBlob && (
              <Mic className="h-10 w-10 text-muted-foreground" />
            )}
          </div>

          {/* Timer */}
          <span className="text-2xl font-mono text-muted-foreground">
            {formatTime(duration)}
          </span>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {!recording && !audioBlob && (
              <Button onClick={startRecording} className="gap-2">
                <Mic className="h-4 w-4" />
                Start Recording
              </Button>
            )}
            {recording && (
              <Button variant="destructive" onClick={stopRecording} className="gap-2">
                <Square className="h-4 w-4" />
                Stop
              </Button>
            )}
            {audioBlob && !recording && (
              <>
                <Button variant="outline" onClick={handleDiscard} className="gap-1">
                  <Trash2 className="h-3.5 w-3.5" />
                  Discard
                </Button>
                <Button
                  variant="outline"
                  onClick={transcribe}
                  disabled={transcribing}
                  className="gap-1"
                >
                  {transcribing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileText className="h-3.5 w-3.5" />
                  )}
                  {transcribing ? "Transcribing..." : "Transcribe"}
                </Button>
              </>
            )}
          </div>

          {/* Transcript */}
          {transcript && (
            <div className="w-full">
              <p className="text-xs font-medium text-muted-foreground mb-1">Transcript:</p>
              <div className="bg-muted rounded-md p-3 text-sm max-h-32 overflow-y-auto">
                {transcript}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleInsert} disabled={!audioBlob}>
            Insert into Page
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
