"use client"

import { useEffect, useRef } from "react"
import type { Participant } from "livekit-client"
import { Track, ConnectionQuality } from "livekit-client"
import { Card } from "@/components/ui/card"
import {
  MicOff,
  SignalHigh,
  SignalMedium,
  SignalLow,
} from "lucide-react"

interface VideoTileProps {
  participant: Participant
  isLocal?: boolean
  isActiveSpeaker?: boolean
}

export function VideoTile({
  participant,
  isLocal = false,
  isActiveSpeaker = false,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  const cameraPublication = participant.getTrackPublication(Track.Source.Camera)
  const micPublication = participant.getTrackPublication(Track.Source.Microphone)

  const videoTrack = cameraPublication?.track
  const audioTrack = micPublication?.track

  const isVideoOff = !cameraPublication?.isSubscribed || cameraPublication?.isMuted || !videoTrack
  const isAudioOff = !micPublication?.isSubscribed || micPublication?.isMuted || !audioTrack

  useEffect(() => {
    if (videoTrack && videoRef.current) {
      videoTrack.attach(videoRef.current)
      return () => {
        videoTrack.detach(videoRef.current!)
      }
    }
  }, [videoTrack])

  useEffect(() => {
    if (audioTrack && audioRef.current && !isLocal) {
      audioTrack.attach(audioRef.current)
      return () => {
        audioTrack.detach(audioRef.current!)
      }
    }
  }, [audioTrack, isLocal])

  const connectionQuality = participant.connectionQuality
  const displayName = participant.name || participant.identity || "Guest"

  return (
    <Card
      className={`relative overflow-hidden bg-slate-950 aspect-video border-0 ring-1 ${
        isActiveSpeaker ? "ring-green-500 ring-2" : "ring-white/10"
      }`}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        muted={true}
        playsInline
        className={`w-full h-full object-cover ${
          isLocal ? "scale-x-[-1]" : ""
        } ${isVideoOff ? "hidden" : ""}`}
      >
        <track kind="captions" />
      </video>

      {/* Audio Element (for remote participants) */}
      {!isLocal && (
        <audio ref={audioRef} autoPlay playsInline>
          <track kind="captions" />
        </audio>
      )}

      {/* Fallback for when video is off */}
      {isVideoOff && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
          <div className="h-20 w-20 rounded-full bg-slate-800 flex items-center justify-center text-2xl font-semibold text-white">
            {displayName.slice(0, 2).toUpperCase()}
          </div>
        </div>
      )}

      {/* Participant Name Label */}
      <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-xs text-white flex items-center gap-2 backdrop-blur-sm">
        <span>
          {displayName} {isLocal && "(You)"}
        </span>
        {isAudioOff && <MicOff className="h-3 w-3 text-red-400" />}
      </div>

      {/* Status Indicators */}
      <div className="absolute top-2 right-2 flex gap-1 p-1 bg-black/30 rounded backdrop-blur-sm">
        {(connectionQuality === ConnectionQuality.Excellent || connectionQuality === ConnectionQuality.Good) && (
          <SignalHigh className="h-4 w-4 text-green-500" />
        )}
        {connectionQuality === ConnectionQuality.Poor && (
          <SignalMedium className="h-4 w-4 text-yellow-500" />
        )}
        {connectionQuality === ConnectionQuality.Lost && (
          <SignalLow className="h-4 w-4 text-red-500" />
        )}
      </div>
    </Card>
  )
}
