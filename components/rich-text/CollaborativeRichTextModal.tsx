"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CollaborativeRichTextEditor } from "./CollaborativeRichTextEditorDynamic"

interface CollaborativeRichTextModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  documentId: string
  content: string
  onChange: (content: string) => void
  onSave: (content: string) => void // Pass content to save callback
  readOnly?: boolean
  maxLength?: number
  enableCollaboration?: boolean
}

export function CollaborativeRichTextModal({
  isOpen,
  onClose,
  title,
  documentId,
  content,
  onChange,
  onSave,
  readOnly = false,
  maxLength = 500,
  enableCollaboration = true,
}: Readonly<CollaborativeRichTextModalProps>) {
  const [localContent, setLocalContent] = useState(content)

  useEffect(() => {
    setLocalContent(content)
  }, [content, isOpen])

  const handleSave = () => {
    onChange(localContent)
    onSave(localContent)
  }

  const handleCancel = () => {
    setLocalContent(content)
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
            {readOnly ? "View collaborative rich text content" : "Edit rich text content with real-time collaboration"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <CollaborativeRichTextEditor
            documentId={documentId}
            content={localContent}
            onChange={setLocalContent}
            placeholder="Add any additional details, notes, or metadata..."
            readOnly={readOnly}
            maxLength={maxLength}
            className="h-[500px] overflow-y-auto"
            enableCollaboration={enableCollaboration}
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
