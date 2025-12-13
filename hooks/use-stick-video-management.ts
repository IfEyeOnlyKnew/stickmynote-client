"use client"

import { parseVideoUrlWithTitle } from "@/utils/noteUtils"
import type { VideoItem } from "@/types/pad"
import type { StickTabsConfig } from "@/types/stick-tabs-config"
import { useStickMediaUploadBase } from "./useStickMediaUploadBase"

export function useStickVideoManagement(
  stickId: string,
  config: StickTabsConfig,
  onTabsUpdate: (tabs: any[]) => void,
  onTabChange?: (tab: string) => void,
) {
  const baseHook = useStickMediaUploadBase<VideoItem>({
    stickId,
    config,
    onTabsUpdate,
    onTabChange,
    tabType: "videos",
    tabName: "Videos",
  })

  const handleAddVideo = async (existingVideos: VideoItem[]) => {
    if (!baseHook.url.trim() || baseHook.isLoading) return

    console.log("[v0] Parsing video URL:", baseHook.url)

    const parsed = await parseVideoUrlWithTitle(baseHook.url)
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
      ...parsed,
      title: parsed.title || "",
      thumbnail: parsed.thumbnail || "",
      duration: parsed.duration || "0",
    }

    console.log("[v0] Created new video object:", newVideo)

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
