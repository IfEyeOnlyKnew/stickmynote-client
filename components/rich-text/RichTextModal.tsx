"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { RichTextEditor } from "./RichTextEditorDynamic"

interface RichTextModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  content: string
  onChange: (content: string) => void
  onSave: () => void
  readOnly?: boolean
  maxLength?: number
}

export function RichTextModal({
  isOpen,
  onClose,
  title,
  content,
  onChange,
  onSave,
  readOnly = false,
  maxLength = 500,
}: RichTextModalProps) {
  const [localContent, setLocalContent] = useState(content)

  useEffect(() => {
    setLocalContent(content)
  }, [content, isOpen])

  const handleSave = () => {
    onChange(localContent)
    onSave()
    onClose()
  }

  const handleCancel = () => {
    setLocalContent(content) // Reset to original content
    onClose()
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange} modal>
      <DialogContent
        className="max-w-[90vw] max-h-[80vh] flex flex-col p-6"
        onPointerDownOutside={(e) => {
          e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {}}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            {readOnly ? "View rich text content" : "Edit rich text content with formatting options"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <RichTextEditor
            content={localContent}
            onChange={setLocalContent}
            placeholder="Add any additional details, notes, or metadata..."
            readOnly={readOnly}
            maxLength={maxLength}
            className="h-[500px] overflow-y-auto"
          />
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          {!readOnly && <Button onClick={handleSave}>Stick</Button>}
        </div>
      </DialogContent>
    </Dialog>
  )
}
