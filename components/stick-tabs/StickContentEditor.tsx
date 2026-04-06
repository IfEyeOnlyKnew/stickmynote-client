"use client"

import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { GenerateTagsButton } from "@/components/ui/generate-tags-button"
import { SummarizeLinksButton } from "@/components/ui/summarize-links-button"
import { ExternalLink, ChevronDown } from "lucide-react"
import type { VideoItem, ImageItem } from "@/types/pad"
import { VideoCard, ImageCard } from "@/components/MediaComponents"
import { SafeHtmlRenderer } from "@/components/safe-html-renderer"

interface StickContentEditorProps {
  topic: string
  content: string
  onTopicChange: (value: string) => void
  onContentChange: (value: string) => void
  onTopicFocus?: () => void
  onContentFocus?: () => void
  readOnly?: boolean
  showMedia?: boolean
  videos?: VideoItem[]
  images?: ImageItem[]
  onDeleteVideo?: (videoId: string) => void
  onDeleteImage?: (imageId: string) => void
  isEditingTopic?: boolean
  isEditingContent?: boolean
  onCancelTopic?: () => void
  onCancelContent?: () => void
  onStickTopic?: () => void
  onStickContent?: () => void
  onGenerateTags?: () => void
  isGeneratingTags?: boolean
  onSummarizeLinks?: () => void
  isSummarizingLinks?: boolean
  generatedTags?: string[]
  generatedLinks?: Array<{ title: string; url: string }>
  details?: string
}

export function StickContentEditor({
  topic,
  content,
  onTopicChange,
  onContentChange,
  onTopicFocus,
  onContentFocus,
  readOnly = false,
  showMedia = false,
  videos = [],
  images = [],
  onDeleteVideo,
  onDeleteImage,
  isEditingTopic,
  isEditingContent,
  onCancelTopic,
  onCancelContent,
  onStickTopic,
  onStickContent,
  onGenerateTags,
  isGeneratingTags,
  onSummarizeLinks,
  isSummarizingLinks,
  generatedTags = [],
  generatedLinks = [],
  details = "",
}: Readonly<StickContentEditorProps>) {
  const topicLength = (topic || "").length
  const contentLength = (content || "").length
  const isEditing = isEditingTopic || isEditingContent

  const expandDialogRef = useRef<HTMLDialogElement>(null)

  return (
    <div className="space-y-4 !w-full !min-w-0 !max-w-full">
      {/* Topic Field */}
      <div className="!w-full !min-w-0 !max-w-full !overflow-hidden">
        <div className="flex justify-between items-center mb-1">
          <span className="block text-sm font-medium">Topic</span>
          <span className="text-xs text-gray-500">{topicLength}/75</span>
        </div>
        <textarea
          value={topic || ""}
          onChange={(e) => onTopicChange(e.target.value)}
          onFocus={onTopicFocus}
          placeholder="Enter topic (max 75 characters)"
          maxLength={75}
          className="!w-full !min-w-0 !max-w-full p-2 border rounded-md resize-none !box-border"
          rows={1}
          disabled={readOnly}
        />
      </div>

      {/* Content Field */}
      <div className="!w-full !min-w-0 !max-w-full !overflow-hidden">
        <div className="flex justify-between items-center mb-1">
          <span className="block text-sm font-medium">Content</span>
          <span className="text-xs text-gray-500">{contentLength}/25000</span>
        </div>
        <textarea
          value={content || ""}
          onChange={(e) => onContentChange(e.target.value)}
          onFocus={onContentFocus}
          placeholder="Enter content (max 25000 characters)"
          maxLength={25000}
          className="!w-full !min-w-0 !max-w-full p-2 border rounded-md resize-none !box-border"
          rows={8}
          disabled={readOnly}
        />
        {!readOnly && (
          <div className="flex justify-between items-center mt-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-6 p-1 text-gray-500 hover:text-gray-700"
              onClick={() => expandDialogRef.current?.showModal()}
            >
              <ChevronDown className="h-3 w-3 mr-1" />
              Expand
            </Button>
          </div>
        )}

        {isEditing && !readOnly && onCancelTopic && onStickTopic && onCancelContent && onStickContent && (
          <div className="flex gap-2 mt-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (isEditingTopic) onCancelTopic()
                if (isEditingContent) onCancelContent()
              }}
              className="text-xs bg-transparent"
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                if (isEditingTopic) onStickTopic()
                if (isEditingContent) onStickContent()
              }}
              className="text-xs"
            >
              Stick
            </Button>
          </div>
        )}
      </div>

      {/* Native <dialog> with showModal() — renders in browser top layer, above ALL stacking contexts */}
      <dialog
        ref={expandDialogRef}
        onClick={(e) => { if (e.target === expandDialogRef.current) expandDialogRef.current?.close() }}
        className="backdrop:bg-black/50 bg-transparent p-0 border-none max-w-[700px] w-[90vw] max-h-[85vh] rounded-lg"
      >
        <div className="bg-white rounded-lg shadow-2xl flex flex-col max-h-[85vh]">
          <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0">
            <span className="font-semibold text-sm">Content</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{contentLength}/25000</span>
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
          <div className="flex-1 p-5 min-h-0 flex flex-col">
            <textarea
              value={content || ""}
              onChange={(e) => onContentChange(e.target.value)}
              placeholder="Enter content (max 25000 characters)"
              maxLength={25000}
              disabled={readOnly}
              className="flex-1 min-h-[300px] w-full p-2 border rounded-md resize-none text-sm leading-relaxed"
            />
          </div>
        </div>
      </dialog>

      {showMedia && (
        <>
          {/* Videos */}
          {videos.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Videos</h4>
              <div className="grid gap-2">
                {videos
                  .filter(
                    (video): video is VideoItem & { platform: "youtube" | "vimeo" | "rumble"; embed_id: string } =>
                      Boolean(video.platform && video.embed_id),
                  )
                  .map((video) => (
                    <VideoCard key={video.id} video={video} onDelete={undefined} />
                  ))}
              </div>
            </div>
          )}

          {/* Images */}
          {images.length > 0 && (
            <div className="space-y-3 mt-4">
              <h4 className="text-sm font-medium text-gray-700">Images</h4>
              <div className="space-y-4">
                {images.map((image) => (
                  <ImageCard
                    key={image.id}
                    image={image}
                    onClick={() => window.open(image.url, "_blank")}
                    onDelete={onDeleteImage ? () => onDeleteImage(image.id) : undefined}
                    fullWidth={true}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Additional Details */}
          {details && details.trim() !== "" && (
            <div className="space-y-2 mt-4">
              <h4 className="text-sm font-medium text-gray-700">Additional Details</h4>
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                <SafeHtmlRenderer
                  content={details}
                  className="text-sm text-gray-900 whitespace-pre-wrap break-words"
                  mode="rich-text"
                />
              </div>
            </div>
          )}
        </>
      )}

      {generatedLinks.length > 0 && (
        <div className="space-y-2">
          <span className="text-sm font-medium text-gray-700 block">Related Links</span>
          <div className="space-y-2">
            {generatedLinks.map((link) => (
              <div key={link.url} className="flex items-center gap-2">
                <ExternalLink className="h-3 w-3 text-blue-600 flex-shrink-0" />
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex-1 truncate"
                  title={link.title}
                >
                  {link.title}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {!readOnly && onGenerateTags && (
        <div className="flex items-center gap-2 mt-2 mb-4">
          <GenerateTagsButton onClick={onGenerateTags} isGenerating={isGeneratingTags || false} />
          {generatedLinks.length > 0 && onSummarizeLinks && (
            <SummarizeLinksButton
              onClick={onSummarizeLinks}
              isSummarizing={isSummarizingLinks || false}
            />
          )}
        </div>
      )}
    </div>
  )
}
