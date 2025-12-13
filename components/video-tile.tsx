"use client";

import { useEffect, useRef } from "react";
import {
  useParticipant,
  useVideoTrack,
  useAudioTrack,
} from "@daily-co/daily-react";
import { Card } from "@/components/ui/card";
import {
  MicOff,
  VideoOff,
  SignalHigh,
  SignalMedium,
  SignalLow,
} from "lucide-react";

interface VideoTileProps {
  sessionId: string;
  isLocal?: boolean;
  isActiveSpeaker?: boolean;
}

export function VideoTile({
  sessionId,
  isLocal = false,
  isActiveSpeaker = false,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const participant = useParticipant(sessionId);
  const videoState = useVideoTrack(sessionId);
  const audioState = useAudioTrack(sessionId);

  useEffect(() => {
    if (videoState.track && videoRef.current) {
      videoRef.current.srcObject = new MediaStream([videoState.track]);
    }
  }, [videoState.track]);

  useEffect(() => {
    if (audioState.track && audioRef.current && !isLocal) {
      audioRef.current.srcObject = new MediaStream([audioState.track]);
    }
  }, [audioState.track, isLocal]);

  if (!participant) return null;

  const isVideoOff = videoState.isOff;
  const isAudioOff = audioState.isOff;
  const networkQuality = participant.networkThreshold || "good";

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
        muted={true} // Always mute video element to avoid echo, we handle audio separately or it's local
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
            {participant.user_name?.slice(0, 2).toUpperCase() || "??"}
          </div>
        </div>
      )}

      {/* Participant Name Label */}
      <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-xs text-white flex items-center gap-2 backdrop-blur-sm">
        <span>
          {participant.user_name || "Guest"} {isLocal && "(You)"}
        </span>
        {isAudioOff && <MicOff className="h-3 w-3 text-red-400" />}
      </div>

      {/* Status Indicators */}
      <div className="absolute top-2 right-2 flex gap-1 p-1 bg-black/30 rounded backdrop-blur-sm">
        {networkQuality === "good" && (
          <SignalHigh className="h-4 w-4 text-green-500" />
        )}
        {networkQuality === "low" && (
          <SignalMedium className="h-4 w-4 text-yellow-500" />
        )}
        {networkQuality === "very-low" && (
          <SignalLow className="h-4 w-4 text-red-500" />
        )}
      </div>
    </Card>
  );
}
