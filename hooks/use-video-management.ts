"use client"

import { parseVideoUrlAdvanced } from "@/utils/noteUtils"
import type { VideoItem } from "@/types/note"
import type { NoteTabsConfig } from "@/types/note-tabs-config"
import { useMediaUploadBase } from "./useMediaUploadBase"

export function useVideoManagement(
  noteId: string,
  config: NoteTabsConfig,
  onTabsUpdate: (tabs: any[]) => void,
  onTabChange?: (tab: string) => void,
) {
  const baseHook = useMediaUploadBase<VideoItem>({
    noteId,
    config,
    onTabsUpdate,
    onTabChange,
    tabType: "videos",
    tabName: "Videos",
  })

  const handleAddVideo = async (existingVideos: VideoItem[]) => {
    if (!baseHook.url.trim() || baseHook.isLoading) return

    console.log("[v0] Parsing video URL:", baseHook.url)

    const parsed = parseVideoUrlAdvanced(baseHook.url)
    if (!parsed) {
      console.log("[v0] Video parsing failed for URL:", baseHook.url)
      baseHook.showError("Invalid Video URL", "Enter a valid YouTube, Vimeo, or Rumble URL.")
      return
    }

    console.log("[v0] Video parsed successfully:", parsed)

    if (!baseHook.validateUrl(parsed.url)) {
      console.log("[v0] Video URL validation failed:", parsed.url)
      baseHook.showError("Invalid Video URL", "Enter a valid YouTube, Vimeo, or Rumble URL.")
      return
    }

    const newVideo: VideoItem = {
      id: parsed.embed_id || `video_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      platform: parsed.platform,
      embed_id: parsed.embed_id,
      url: parsed.url,
      title: parsed.title || "",
      thumbnail: parsed.thumbnail || "",
      duration: parsed.duration || "0",
      embed_url:
        parsed.platform === "youtube"
          ? `https://www.youtube.com/embed/${parsed.embed_id}?rel=0`
          : parsed.platform === "vimeo"
            ? `https://player.vimeo.com/video/${parsed.embed_id}`
            : `https://rumble.com/embed/${parsed.embed_id}/`,
    }

    console.log("[v0] Created new video object:", newVideo)
    console.log("[v0] Video has required fields:", {
      hasId: !!newVideo.id,
      hasPlatform: !!newVideo.platform,
      hasEmbedId: !!newVideo.embed_id,
      hasUrl: !!newVideo.url,
      hasEmbedUrl: !!newVideo.embed_url,
    })

    await baseHook.handleAdd(existingVideos, newVideo)
  }

  return {
    videoUrl: baseHook.url,
    setVideoUrl: baseHook.setUrl,
    addingVideo: baseHook.isLoading,
    handleAddVideo,
    handleDeleteVideo: baseHook.handleDelete,
  }
}
