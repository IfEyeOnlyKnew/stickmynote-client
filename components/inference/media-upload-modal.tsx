"use client"

import type React from "react"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Upload, X, type File, ImageIcon, Video, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

interface MediaUploadModalProps {
  open: boolean
  onClose: () => void
  onUploadComplete: (url: string, type: string, metadata: any) => void
  acceptedTypes?: "image" | "video" | "document" | "all"
}

export function MediaUploadModal({ open, onClose, onUploadComplete, acceptedTypes = "all" }: MediaUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)

  const getAcceptString = () => {
    if (acceptedTypes === "image") return "image/*"
    if (acceptedTypes === "video") return "video/*"
    if (acceptedTypes === "document") return ".pdf,.doc,.docx,.xls,.xlsx,.txt"
    return "image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
  }

  const getFileType = (file: File): string => {
    if (file.type.startsWith("image/")) return "image"
    if (file.type.startsWith("video/")) return "video"
    return "document"
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleFileSelect = (file: File) => {
    setSelectedFile(file)
    setError(null)
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setUploading(true)
    setProgress(0)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("file", selectedFile)
      formData.append("type", getFileType(selectedFile))

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90))
      }, 200)

      const response = await fetch("/api/inference/upload-media", {
        method: "POST",
        body: formData,
      })

      clearInterval(progressInterval)
      setProgress(100)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Upload failed")
      }

      const data = await response.json()
      onUploadComplete(data.url, data.mediaType, data)

      // Reset state
      setSelectedFile(null)
      setProgress(0)
      onClose()
    } catch (err: any) {
      console.error("[v0] Upload error:", err)
      setError(err.message || "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const getFileIcon = (file: File) => {
    if (file.type.startsWith("image/")) return <ImageIcon className="h-12 w-12 text-blue-500" />
    if (file.type.startsWith("video/")) return <Video className="h-12 w-12 text-purple-500" />
    return <FileText className="h-12 w-12 text-gray-500" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Media</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop Zone */}
          <div
            role="button"
            tabIndex={0}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
              dragActive ? "border-purple-500 bg-purple-50" : "border-gray-300 hover:border-purple-400",
              selectedFile && "bg-gray-50",
            )}
            onClick={() => !selectedFile && document.getElementById("file-input")?.click()}
            onKeyDown={(e) => e.key === "Enter" && !selectedFile && document.getElementById("file-input")?.click()}
          >
            {selectedFile ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center">{getFileIcon(selectedFile)}</div>
                <div>
                  <p className="font-medium truncate">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500">{formatFileSize(selectedFile.size)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedFile(null)
                    setError(null)
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              </div>
            ) : (
              <>
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-sm text-gray-600 mb-2">Drag and drop your file here, or click to browse</p>
                <p className="text-xs text-gray-500">
                  {acceptedTypes === "image" && "Images up to 5MB"}
                  {acceptedTypes === "video" && "Videos up to 50MB"}
                  {acceptedTypes === "document" && "Documents up to 10MB"}
                  {acceptedTypes === "all" && "Images (5MB), Videos (50MB), Documents (10MB)"}
                </p>
              </>
            )}
          </div>

          <input
            id="file-input"
            type="file"
            accept={getAcceptString()}
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            className="hidden"
          />

          {/* Progress */}
          {uploading && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-center text-gray-600">Uploading... {progress}%</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={!selectedFile || uploading}>
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
