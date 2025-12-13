"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { VideoIcon } from "lucide-react"
import { VideoCard } from "@/components/MediaComponents"
import type { VideoItem } from "@/types/note"
import { normalizeVideoData } from "@/utils/noteUtils"

interface StickVideoTabContentProps {
  videos: VideoItem[]
  videoUrl: string
  addingVideo: boolean
  readOnly?: boolean
  onVideoUrlChange: (url: string) => void
  onAddVideo: () => void
  onDeleteVideo?: (videoId: string) => void
}

export function StickVideoTabContent({
  videos,
  videoUrl,
  addingVideo,
  readOnly = false,
  onVideoUrlChange,
  onAddVideo,
  onDeleteVideo,
}: StickVideoTabContentProps) {
  const filteredVideos = videos
    .map((video) => normalizeVideoData(video))
    .filter((video): video is NonNullable<typeof video> => {
      return video !== null && video.platform !== undefined && video.embed_id !== undefined
    })

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Video URL</label>
            <div className="flex gap-2">
              <Input
                value={videoUrl}
                onChange={(e) => onVideoUrlChange(e.target.value)}
                placeholder="Paste YouTube, Vimeo, Rumble, Loom, Figma, or Google Docs URL..."
                className="flex-1"
              />
              <Button onClick={onAddVideo} disabled={!videoUrl.trim() || addingVideo}>
                {addingVideo ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  "Add"
                )}
              </Button>
            </div>
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                <strong>Supported platforms:</strong> YouTube, Vimeo, Rumble, Loom, Figma, and Google Docs (documents,
                sheets, presentations)
              </p>
            </div>
          </div>
        </div>
      )}

      {videos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredVideos.map((video) => (
            <VideoCard key={video.id} video={video} onDelete={readOnly ? undefined : onDeleteVideo} />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <VideoIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No videos added yet</p>
          {!readOnly && <p className="text-sm">Click "Add Video" to get started</p>}
        </div>
      )}
    </div>
  )
}
