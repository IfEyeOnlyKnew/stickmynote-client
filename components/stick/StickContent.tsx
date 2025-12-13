"use client"

import { Button } from "@/components/ui/button"
import { GenerateTagsButton } from "@/components/ui/generate-tags-button"
import { Badge } from "@/components/ui/badge"

interface Stick {
  id: string
  topic: string
  content: string
  details?: string
  tags?: string[]
  hyperlinks?: Array<{ url: string; title: string }>
  isNew?: boolean
}

interface StickContentProps {
  stick: Stick
  editedStick: Stick
  canEdit: boolean
  isGeneratingTags: boolean
  onTopicChange: (value: string) => void
  onContentChange: (value: string) => void
  onDetailsChange: (value: string) => void
  onTopicFocus: () => void
  onContentFocus: () => void
  onGenerateTags: () => void
  isEditingTopic?: boolean
  isEditingContent?: boolean
  onCancelTopic?: () => void
  onCancelContent?: () => void
  onStickTopic?: () => void
  onStickContent?: () => void
}

const isValidUUID = (str: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

export function StickContent({
  stick,
  editedStick,
  canEdit,
  isGeneratingTags,
  onTopicChange,
  onContentChange,
  onDetailsChange,
  onTopicFocus,
  onContentFocus,
  onGenerateTags,
  isEditingTopic,
  isEditingContent,
  onCancelTopic,
  onCancelContent,
  onStickTopic,
  onStickContent,
}: StickContentProps) {
  if (!stick || !editedStick) {
    console.error("StickContent: Missing stick or editedStick")
    return <div className="text-red-500">Error: Stick data is missing</div>
  }

  const isValidStick = stick.id && isValidUUID(stick.id) && !stick.isNew

  return (
    <>
      <div className="space-y-4">
        {/* Topic Field */}
        <div>
          <label className="block text-sm font-medium mb-1">Topic</label>
          <textarea
            value={editedStick.topic || ""}
            onChange={(e) => onTopicChange(e.target.value)}
            onFocus={onTopicFocus}
            placeholder="Enter topic (max 75 characters)"
            maxLength={75}
            className="w-full p-2 border rounded-md resize-none"
            rows={2}
            disabled={!canEdit}
          />
          {/* Topic editing buttons */}
          {isEditingTopic && canEdit && onCancelTopic && onStickTopic && (
            <div className="flex gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={onCancelTopic} className="text-xs bg-transparent">
                Cancel
              </Button>
              <Button variant="default" size="sm" onClick={onStickTopic} className="text-xs">
                Stick
              </Button>
            </div>
          )}
        </div>

        {/* Content Field */}
        <div>
          <label className="block text-sm font-medium mb-1">Content</label>
          <textarea
            value={editedStick.content || ""}
            onChange={(e) => onContentChange(e.target.value)}
            onFocus={onContentFocus}
            placeholder="Enter content (max 1000 characters)"
            maxLength={1000}
            className="w-full p-2 border rounded-md resize-none"
            rows={8}
            disabled={!canEdit}
          />
          {/* Content editing buttons */}
          {isEditingContent && canEdit && onCancelContent && onStickContent && (
            <div className="flex gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={onCancelContent} className="text-xs bg-transparent">
                Cancel
              </Button>
              <Button variant="default" size="sm" onClick={onStickContent} className="text-xs">
                Stick
              </Button>
            </div>
          )}
        </div>

        {/* Details Field */}
        <div>
          <label className="block text-sm font-medium mb-1">Details</label>
          <textarea
            value={editedStick.details || ""}
            onChange={(e) => onDetailsChange(e.target.value)}
            placeholder="Additional details..."
            className="w-full p-2 border rounded-md resize-none"
            rows={4}
            disabled={!canEdit}
          />
        </div>
      </div>

      {/* Tags Display */}
      {editedStick.tags && editedStick.tags.length > 0 && (
        <div className="mb-3 mt-3">
          <div className="flex flex-wrap gap-1">
            {editedStick.tags.map((tag, index) => (
              <Badge key={`${stick.id}-tag-${tag}-${index}`} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Hyperlinks Display */}
      {editedStick.hyperlinks && editedStick.hyperlinks.length > 0 && (
        <div className="mb-3 mt-3">
          <div className="flex flex-wrap gap-1">
            {editedStick.hyperlinks.map((link, idx) => (
              <a
                key={`${stick.id}-link-${idx}`}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-blue-600 hover:text-blue-800 text-xs px-2 py-1 bg-blue-50 rounded"
                title={link.title}
              >
                {link.title}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Generate Tags Button */}
      {isValidStick && canEdit && (
        <div className="flex items-center gap-2 mt-2 mb-4">
          <GenerateTagsButton onClick={onGenerateTags} isGenerating={isGeneratingTags} />
        </div>
      )}
    </>
  )
}
