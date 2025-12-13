"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Upload, File, Trash2, Download, Eye, Paperclip } from "lucide-react"
import { toast } from "sonner"
import type { Attachment } from "@/types/calstick-attachment"
import { AttachmentPreviewModal } from "./AttachmentPreviewModal"
import { CloudPickerModal } from "./CloudPickerModal"

interface AttachmentPanelProps {
  calstickId: string
}

export function AttachmentPanel({ calstickId }: AttachmentPanelProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null)
  const [showCloudPicker, setShowCloudPicker] = useState(false)

  useEffect(() => {
    fetchAttachments()
  }, [calstickId])

  const fetchAttachments = async () => {
    try {
      const response = await fetch(`/api/calsticks/${calstickId}/attachments`)
      if (response.ok) {
        const data = await response.json()
        setAttachments(data.attachments || [])
      }
    } catch (error) {
      console.error("Error fetching attachments:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (file: File) => {
    setUploading(true)
    try {
      // Upload file to blob storage
      const formData = new FormData()
      formData.append("file", file)

      const uploadResponse = await fetch("/api/calsticks/upload-attachment", {
        method: "POST",
        body: formData,
      })

      if (!uploadResponse.ok) {
        throw new Error("Upload failed")
      }

      const uploadData = await uploadResponse.json()

      // Save attachment reference
      const response = await fetch(`/api/calsticks/${calstickId}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: uploadData.name,
          url: uploadData.url,
          size: uploadData.size,
          type: uploadData.type,
          provider: "local",
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to save attachment")
      }

      toast.success("Attachment uploaded successfully")
      fetchAttachments()
    } catch (error: any) {
      console.error("Upload error:", error)
      toast.error(error.message || "Failed to upload attachment")
    } finally {
      setUploading(false)
    }
  }

  const handleCloudFileSelect = async (file: {
    name: string
    url: string
    size: number
    type: string
    provider: string
    provider_id: string
  }) => {
    try {
      const response = await fetch(`/api/calsticks/${calstickId}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          url: file.url,
          size: file.size,
          type: file.type,
          provider: file.provider,
          provider_id: file.provider_id,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to link file")
      }

      toast.success("File linked successfully")
      fetchAttachments()
      setShowCloudPicker(false)
    } catch (error: any) {
      console.error("Cloud link error:", error)
      toast.error(error.message || "Failed to link file")
    }
  }

  const handleDelete = async (attachmentId: string) => {
    if (!confirm("Delete this attachment?")) return

    try {
      const response = await fetch(`/api/calsticks/${calstickId}/attachments?attachmentId=${attachmentId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete attachment")
      }

      toast.success("Attachment deleted")
      fetchAttachments()
    } catch (error: any) {
      console.error("Delete error:", error)
      toast.error(error.message || "Failed to delete attachment")
    }
  }

  const getFileIcon = (type: string) => {
    const iconClass = "h-8 w-8"
    switch (type) {
      case "pdf":
        return <File className={`${iconClass} text-red-500`} />
      case "doc":
      case "docx":
        return <File className={`${iconClass} text-blue-500`} />
      case "xls":
      case "xlsx":
        return <File className={`${iconClass} text-green-500`} />
      case "ppt":
      case "pptx":
        return <File className={`${iconClass} text-orange-500`} />
      case "zip":
        return <File className={`${iconClass} text-purple-500`} />
      default:
        return <File className={`${iconClass} text-gray-500`} />
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-500" />
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      {/* Upload Actions */}
      <div className="flex gap-2">
        <Button
          onClick={() => document.getElementById("attachment-upload")?.click()}
          disabled={uploading}
          className="flex-1"
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? "Uploading..." : "Upload File"}
        </Button>
        <Button onClick={() => setShowCloudPicker(true)} variant="outline" className="flex-1">
          <Paperclip className="h-4 w-4 mr-2" />
          Link from Cloud
        </Button>
      </div>

      <input
        id="attachment-upload"
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
        className="hidden"
      />

      {/* Attachments List */}
      {attachments.length > 0 ? (
        <div className="grid grid-cols-1 gap-3">
          {attachments.map((attachment) => (
            <Card key={attachment.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">{getFileIcon(attachment.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate" title={attachment.name}>
                      {attachment.name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{formatFileSize(attachment.size)}</span>
                      <span>•</span>
                      <span className="uppercase">{attachment.type}</span>
                      {attachment.provider !== "local" && (
                        <>
                          <span>•</span>
                          <span className="capitalize">{attachment.provider}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPreviewAttachment(attachment)}
                      title="Preview"
                      className="h-8 w-8 p-0"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(attachment.url, "_blank")}
                      title="Download"
                      className="h-8 w-8 p-0"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(attachment.id)}
                      title="Delete"
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <File className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No attachments yet</p>
          <p className="text-sm">Upload files or link from cloud storage</p>
        </div>
      )}

      {/* Preview Modal */}
      {previewAttachment && (
        <AttachmentPreviewModal
          attachment={previewAttachment}
          open={!!previewAttachment}
          onClose={() => setPreviewAttachment(null)}
        />
      )}

      {/* Cloud Picker Modal */}
      <CloudPickerModal
        open={showCloudPicker}
        onClose={() => setShowCloudPicker(false)}
        onFileSelect={handleCloudFileSelect}
      />
    </div>
  )
}
