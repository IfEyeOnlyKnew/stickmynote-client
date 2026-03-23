"use client"

import { useRef } from "react"
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
  const expandDialogRef = useRef<HTMLDialogElement>(null)

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
          rows={7}
          className="!w-full !min-w-0 !max-w-full resize-y text-gray-900 disabled:text-gray-900 disabled:bg-gray-50 disabled:border-gray-300 !box-border"
        />
        <div className="flex items-center justify-between mt-1">
          {shouldShowExpandLink() && (
            <button
              type="button"
              onClick={() => expandDialogRef.current?.showModal()}
              className="text-xs text-blue-600 hover:text-blue-800 underline cursor-pointer"
            >
              Expand
            </button>
          )}
          <div className="text-xs text-gray-500">{safeContent.length}/1000 characters</div>
        </div>
      </div>

      {/* Native <dialog> with showModal() — renders in browser top layer, above ALL stacking contexts */}
      <dialog
        ref={expandDialogRef}
        onClick={(e) => { if (e.target === expandDialogRef.current) expandDialogRef.current?.close() }}
        className="backdrop:bg-black/50 bg-transparent p-0 border-none w-[calc(50%-1.5rem)] h-[75vh] rounded-lg ml-4 mr-auto mt-4"
      >
        <div className="bg-white rounded-lg shadow-2xl flex flex-col h-full">
          <div className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0">
            <span className="font-semibold text-sm">Content</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{safeContent.length}/1000</span>
              <button
                type="button"
                onClick={() => expandDialogRef.current?.close()}
                className="text-gray-500 hover:text-gray-700 text-xl leading-none px-1"
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>
          <div className="flex-1 p-4 min-h-0 flex flex-col">
            <Textarea
              value={safeContent}
              onChange={(e) => handleContentChange(e.target.value)}
              onFocus={handleContentFocus}
              placeholder="Enter content (max 1000 characters)"
              maxLength={1000}
              disabled={readOnly}
              className="flex-1 resize-none text-sm leading-relaxed text-gray-900 disabled:text-gray-900 disabled:bg-gray-50"
            />
          </div>
          {!readOnly && onCancel && onStick && (
            <div className="flex gap-2 justify-end px-5 py-3 border-t flex-shrink-0">
              <Button variant="outline" size="sm" onClick={() => { onCancel(); expandDialogRef.current?.close() }} disabled={isSaving}>
                Cancel
              </Button>
              <Button variant="default" size="sm" onClick={() => { onStick(); expandDialogRef.current?.close() }} disabled={isSaving}>
                {isSaving ? "Saving..." : "Stick"}
              </Button>
            </div>
          )}
        </div>
      </dialog>

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
