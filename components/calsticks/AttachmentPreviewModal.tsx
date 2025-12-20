"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download, ExternalLink, FileText } from "lucide-react"
import type { Attachment } from "@/types/calstick-attachment"

interface AttachmentPreviewModalProps {
  readonly attachment: Attachment
  readonly open: boolean
  readonly onClose: () => void
}

export function AttachmentPreviewModal({ attachment, open, onClose }: Readonly<AttachmentPreviewModalProps>) {
  const canPreview = ["pdf", "txt", "csv"].includes(attachment.type)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="truncate mr-4">{attachment.name}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => window.open(attachment.url, "_blank")}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.open(attachment.url, "_blank")}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Open
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden rounded-lg border bg-gray-50">
          {canPreview && attachment.type === "pdf" && (
            <iframe src={`${attachment.url}#view=FitH`} className="w-full h-full" title={attachment.name} />
          )}

          {canPreview && (attachment.type === "txt" || attachment.type === "csv") && (
            <iframe src={attachment.url} className="w-full h-full" title={attachment.name} />
          )}

          {!canPreview && (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
              <FileText className="h-16 w-16 mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">Preview not available</p>
              <p className="text-sm text-center mb-4">This file type cannot be previewed in the browser.</p>
              <div className="flex gap-2">
                <Button onClick={() => window.open(attachment.url, "_blank")}>
                  <Download className="h-4 w-4 mr-2" />
                  Download File
                </Button>
                <Button variant="outline" onClick={() => window.open(attachment.url, "_blank")}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in New Tab
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
