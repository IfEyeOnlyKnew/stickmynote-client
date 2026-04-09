"use client"

import { Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface ReplyEditFormProps {
  editContent: string
  onContentChange: (content: string) => void
  onSave: () => void
  onCancel: () => void
  isSaving: boolean
  maxLength?: number
  saveLabel?: string
}

export function ReplyEditForm({
  editContent,
  onContentChange,
  onSave,
  onCancel,
  isSaving,
  maxLength = 1000,
  saveLabel = "Save",
}: ReplyEditFormProps) {
  return (
    <div className="space-y-2">
      <Textarea
        value={editContent}
        onChange={(e) => onContentChange(e.target.value)}
        className="text-sm text-gray-900 min-h-[60px] resize-none"
        maxLength={maxLength}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{editContent.length}/{maxLength}</span>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isSaving}
            className="h-6 px-2 text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onSave}
            disabled={isSaving || !editContent.trim()}
            className="h-6 px-2 text-xs"
          >
            {isSaving ? (
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                <Check className="h-3 w-3 mr-1" />
                {saveLabel}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
