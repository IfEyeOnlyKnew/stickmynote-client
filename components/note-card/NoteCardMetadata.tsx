"use client"
import { GenerateTagsButton } from "@/components/ui/generate-tags-button"
import { SummarizeLinksButton } from "@/components/ui/summarize-links-button"
import { Badge } from "@/components/ui/badge"
import type React from "react"

interface NoteCardMetadataProps {
  noteId: string
  tags?: string[]
  hyperlinks?: any[]
  isNewNote: boolean
  hideGenerateTags: boolean
  generatingTags: string | null | undefined
  summarizingLinks?: string | null | undefined
  topic?: string
  title?: string
  content?: string
  onGenerateTags: (noteId: string, topic: string) => void
  onSummarizeLinks?: (noteId: string) => void
}

export const NoteCardMetadata: React.FC<NoteCardMetadataProps> = ({
  noteId,
  tags,
  hyperlinks,
  isNewNote,
  hideGenerateTags,
  generatingTags,
  summarizingLinks,
  topic,
  title,
  content,
  onGenerateTags,
  onSummarizeLinks,
}) => {
  return (
    <>
      {/* Tags */}
      {tags && tags.length > 0 && (
        <div className="mb-3 mt-3">
          <div className="flex flex-wrap gap-1">
            {tags.map((tag, index) => (
              <Badge key={`${noteId}-tag-${tag}-${index}`} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Hyperlinks */}
      {hyperlinks && hyperlinks.length > 0 && (
        <div className="mb-3 mt-3">
          <div className="flex flex-wrap gap-1">
            {hyperlinks.map((link, idx) => {
              let linkUrl = ""
              if (typeof link === "string") linkUrl = link
              else if (typeof link?.url === "string") linkUrl = link.url

              let linkTitle = ""
              if (typeof link === "string") {
                linkTitle = link
              } else if (link && typeof link === "object") {
                if (typeof link.title === "string") {
                  linkTitle = link.title
                } else if (typeof link.url === "string") {
                  linkTitle = link.url
                } else {
                  linkTitle = String(link.title || link.url || "Link")
                }
              }

              if (!linkUrl && !linkTitle) return null

              return (
                <a
                  key={`${noteId}-link-${idx}`}
                  href={linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-blue-600 hover:text-blue-800 text-xs px-2 py-1 bg-blue-50 rounded"
                  title={linkTitle}
                >
                  {linkTitle}
                </a>
              )
            })}
          </div>
        </div>
      )}

      {!isNewNote && !hideGenerateTags && (
        <div className="flex items-center gap-2 mt-2 mb-4">
          <GenerateTagsButton
            onClick={() => onGenerateTags(noteId, topic || title || "")}
            isGenerating={generatingTags === noteId}
          />
          {hyperlinks && hyperlinks.length > 0 && (
            <SummarizeLinksButton
              onClick={() => onSummarizeLinks?.(noteId)}
              isSummarizing={summarizingLinks === noteId}
            />
          )}
        </div>
      )}
    </>
  )
}
