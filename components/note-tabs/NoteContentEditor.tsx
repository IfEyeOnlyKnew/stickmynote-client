"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { VideoCard, ImageCard } from "@/components/MediaComponents"
import { Button } from "@/components/ui/button"
import type { VideoItem, ImageItem } from "@/types/note"

interface NoteContentEditorProps {
  topic: string
  content: string
  onTopicChange: (value: string) => void
  onContentChange: (value: string) => void
  onTopicFocus?: () => void
  onContentFocus?: () => void
  readOnly?: boolean
  showMedia?: boolean
  videos: VideoItem[]
  images: ImageItem[]
  onDeleteVideo?: (videoId: string) => void
  onDeleteImage?: (imageId: string) => void
  isEditing?: boolean
  onCancel?: () => void
  onStick?: () => void
  isSaving?: boolean
}

export function NoteContentEditor({
  topic,
  content,
  onTopicChange,
  onContentChange,
  onTopicFocus,
  onContentFocus,
  readOnly = false,
  showMedia = false,
  videos,
  images,
  onDeleteVideo,
  onDeleteImage,
  isEditing,
  onCancel,
  onStick,
  isSaving,
}: NoteContentEditorProps) {
  const [isContentExpanded, setIsContentExpanded] = useState(false)

  const safeTopic = topic || ""
  const safeContent = content || ""
  const safeVideos = videos || []
  const safeImages = images || []

  const filteredVideos = safeVideos.filter(
    (video): video is VideoItem & { platform: "youtube" | "vimeo" | "rumble"; embed_id: string } =>
      Boolean(video.platform && video.embed_id),
  )

  const handleTopicChange = (newTopic: string) => {
    const v = newTopic.slice(0, 75)
    onTopicChange(v)
  }

  const handleContentChange = (newContent: string) => {
    const v = newContent.slice(0, 1000)
    onContentChange(v)
  }

  const handleTopicFocus = () => {
    onTopicFocus?.()
  }

  const handleContentFocus = () => {
    onContentFocus?.()
  }

  const shouldShowExpandLink = () => {
    return safeContent.length > 200 || safeContent.split("\n").length > 3
  }

  const toggleContentExpansion = () => {
    setIsContentExpanded(!isContentExpanded)
  }

  return (
    <div className="space-y-4 !w-full !max-w-full !overflow-hidden">
      <div className="!w-full !max-w-full !min-w-0 !overflow-hidden">
        <span className="text-sm font-medium text-gray-700 mb-2 block">Topic</span>
        <Input
          value={safeTopic === "Untitled Note" ? "" : safeTopic}
          onChange={(e) => handleTopicChange(e.target.value)}
          onFocus={handleTopicFocus}
          placeholder="Enter topic (max 75 characters)"
          maxLength={75}
          disabled={readOnly}
          className="!w-full !min-w-0 !max-w-full text-gray-900 disabled:text-gray-900 disabled:bg-gray-50 disabled:border-gray-300 !box-border"
        />
        <div className="text-xs text-gray-500 mt-1 text-right">{safeTopic.length}/75 characters</div>
      </div>

      <div className="!w-full !max-w-full !min-w-0 !overflow-hidden">
        <span className="text-sm font-medium text-gray-700 mb-2 block">Content</span>
        <Textarea
          value={safeContent}
          onChange={(e) => handleContentChange(e.target.value)}
          onFocus={handleContentFocus}
          placeholder="Enter content (max 1000 characters)"
          maxLength={1000}
          disabled={readOnly}
          rows={isContentExpanded ? 12 : 7}
          className="!w-full !min-w-0 !max-w-full resize-y text-gray-900 disabled:text-gray-900 disabled:bg-gray-50 disabled:border-gray-300 !box-border"
        />
        <div className="flex items-center justify-between mt-1">
          {shouldShowExpandLink() && (
            <button
              type="button"
              onClick={toggleContentExpansion}
              className="text-xs text-blue-600 hover:text-blue-800 underline cursor-pointer"
            >
              {isContentExpanded ? "Collapse" : "Expand"}
            </button>
          )}
          <div className="text-xs text-gray-500">{safeContent.length}/1000 characters</div>
        </div>
      </div>

      {isEditing && !readOnly && onCancel && onStick && (
        <div className="flex gap-2 justify-end pt-2 border-t mt-4">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="default" size="sm" onClick={onStick} disabled={isSaving}>
            {isSaving ? (
              <>
                <div className="h-3 w-3 mr-1 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving...
              </>
            ) : (
              "Stick"
            )}
          </Button>
        </div>
      )}

      {showMedia && filteredVideos.length > 0 && (
        <div className="space-y-3 mt-4">
          <h4 className="text-sm font-medium text-gray-700">Videos</h4>
          {filteredVideos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              onDelete={onDeleteVideo ? () => onDeleteVideo(video.id) : undefined}
            />
          ))}
        </div>
      )}

      {showMedia && safeImages.length > 0 && (
        <div className="space-y-3 mt-4">
          <h4 className="text-sm font-medium text-gray-700">Images</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {safeImages.map((image) => (
              <ImageCard
                key={image.id}
                image={image}
                onClick={() => window.open(image.url, "_blank")}
                onDelete={onDeleteImage ? () => onDeleteImage(image.id) : undefined}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
