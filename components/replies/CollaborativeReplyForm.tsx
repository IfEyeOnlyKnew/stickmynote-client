"use client"

import type React from "react"
import { Plus, X, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { CollaborativeRichTextEditor } from "@/components/rich-text/CollaborativeRichTextEditorDynamic"

interface CollaborativeReplyFormProps {
  replyId: string
  content: string
  onContentChange: (content: string) => void
  onSubmit: (e: React.MouseEvent) => void
  onCancel?: (e: React.MouseEvent) => void
  isSubmitting: boolean
  isCompact?: boolean
  maxLength?: number
  enableCollaboration?: boolean
}

export const CollaborativeReplyForm: React.FC<CollaborativeReplyFormProps> = ({
  replyId,
  content,
  onContentChange,
  onSubmit,
  onCancel,
  isSubmitting,
  isCompact = false,
  maxLength = 1000,
  enableCollaboration = true,
}) => {
  const [showEditor, setShowEditor] = useState(false)

  // For compact mode, use simple textarea
  if (isCompact) {
    return (
      <div
        role="none"
        className="reply-form-container space-y-3 p-4 bg-white rounded-md border-2 border-blue-300 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-900">Add Reply</h4>
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel} className="h-5 w-5 p-0" title="Cancel">
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        <textarea
          placeholder="Write your reply..."
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          maxLength={maxLength}
          rows={4}
          className="w-full min-h-[100px] text-sm resize-none bg-white border border-gray-300 rounded-md p-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-900"
        />

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {content.length}/{maxLength} characters
          </span>
          <div className="flex gap-2">
            {onCancel && (
              <Button variant="outline" size="sm" onClick={onCancel} className="text-xs h-7 bg-transparent">
                Cancel
              </Button>
            )}
            <Button onClick={onSubmit} disabled={!content.trim() || isSubmitting} size="sm" className="text-xs h-7">
              {isSubmitting ? (
                <>
                  <div className="h-3 w-3 mr-1 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Sticking...
                </>
              ) : (
                "Stick"
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // For non-compact mode, offer rich text editor option
  if (showEditor) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Reply with Rich Text</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowEditor(false)}
            className="text-xs h-7"
            title="Switch to simple text"
          >
            Simple Text
          </Button>
        </div>

        <CollaborativeRichTextEditor
          documentId={`reply-${replyId}`}
          content={content}
          onChange={onContentChange}
          placeholder="Write a reply with rich formatting..."
          maxLength={maxLength}
          enableCollaboration={enableCollaboration}
          className="min-h-[150px]"
        />

        <div className="flex items-center justify-end gap-2">
          {onCancel && (
            <Button variant="outline" size="sm" onClick={onCancel} className="h-8 bg-transparent">
              Cancel
            </Button>
          )}
          <Button size="sm" onClick={onSubmit} disabled={!content.trim() || isSubmitting} className="h-8">
            {isSubmitting ? (
              <>
                <div className="h-3 w-3 mr-1 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1" />
                Add Reply
              </>
            )}
          </Button>
        </div>
      </div>
    )
  }

  // Default: simple textarea with option to switch to rich text
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Add Reply</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowEditor(true)}
          className="text-xs h-7"
          title="Switch to rich text editor"
        >
          <Users className="h-3 w-3 mr-1" />
          Rich Text
        </Button>
      </div>

      <textarea
        placeholder="Write a reply... (max 1000 characters)"
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        maxLength={maxLength}
        rows={3}
        className="w-full text-sm text-gray-900 border border-gray-300 rounded-md p-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
      />

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-600">
          {content.length}/{maxLength}
        </span>
        <Button size="sm" onClick={onSubmit} disabled={!content.trim() || isSubmitting} className="h-8">
          {isSubmitting ? (
            <>
              <div className="h-3 w-3 mr-1 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Adding...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-1" />
              Add Reply
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
