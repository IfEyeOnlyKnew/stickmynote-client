"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Upload,
  File,
  FileText,
  FileSpreadsheet,
  FileImage,
  FileVideo,
  FileAudio,
  Trash2,
  Download,
  Search,
  Loader2,
  FolderOpen,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"

type StickType = "personal" | "concur" | "alliance" | "inference"

interface LibraryFile {
  id: string
  filename: string
  original_filename: string
  file_url: string
  mime_type: string
  file_size: number
  uploaded_by: string
  uploader_name: string | null
  uploader_avatar: string | null
  description: string | null
  created_at: string
}

interface LibraryPanelProps {
  stickId: string
  stickType: StickType
  readOnly?: boolean
  className?: string
  onFileCountChange?: (count: number) => void
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <FileImage className="h-5 w-5 text-green-600" />
  if (mimeType.startsWith("video/")) return <FileVideo className="h-5 w-5 text-purple-600" />
  if (mimeType.startsWith("audio/")) return <FileAudio className="h-5 w-5 text-pink-600" />
  if (mimeType.includes("pdf")) return <FileText className="h-5 w-5 text-red-600" />
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("csv"))
    return <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint"))
    return <FileText className="h-5 w-5 text-orange-600" />
  if (mimeType.includes("word") || mimeType.includes("document"))
    return <FileText className="h-5 w-5 text-blue-600" />
  return <File className="h-5 w-5 text-gray-600" />
}

function getFileExtBadgeColor(mimeType: string): string {
  if (mimeType.includes("pdf")) return "bg-red-100 text-red-700"
  if (mimeType.startsWith("image/")) return "bg-green-100 text-green-700"
  if (mimeType.includes("word") || mimeType.includes("document")) return "bg-blue-100 text-blue-700"
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "bg-emerald-100 text-emerald-700"
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "bg-orange-100 text-orange-700"
  if (mimeType.startsWith("video/")) return "bg-purple-100 text-purple-700"
  if (mimeType.startsWith("audio/")) return "bg-pink-100 text-pink-700"
  return "bg-gray-100 text-gray-700"
}

function getExtension(filename: string): string {
  return filename.split(".").pop()?.toUpperCase() || "FILE"
}

export function LibraryPanel({ stickId, stickType, readOnly, className, onFileCountChange }: Readonly<LibraryPanelProps>) {
  const [files, setFiles] = useState<LibraryFile[]>([])
  const [permissions, setPermissions] = useState<string[]>([])
  const [role, setRole] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const canUpload = !readOnly && permissions.includes("upload")
  const canDeleteAny = !readOnly && permissions.includes("delete_any")
  const canDeleteOwn = !readOnly && permissions.includes("delete_own")

  const fetchFiles = useCallback(async () => {
    try {
      const params = new URLSearchParams({ stickId, stickType })
      const res = await fetch(`/api/library?${params}`)
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      const fileList = data.files || []
      setFiles(fileList)
      setPermissions(data.permissions || [])
      setRole(data.role || "")
      onFileCountChange?.(fileList.length)
    } catch (error) {
      console.error("Failed to fetch library:", error)
    } finally {
      setLoading(false)
    }
  }, [stickId, stickType])

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (!selectedFiles || selectedFiles.length === 0) return

    setUploading(true)
    let successCount = 0

    for (const file of Array.from(selectedFiles)) {
      try {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("stickId", stickId)
        formData.append("stickType", stickType)

        const res = await fetch("/api/library", { method: "POST", body: formData })

        if (!res.ok) {
          const errData = await res.json()
          toast.error(`Failed to upload ${file.name}: ${errData.error}`)
          continue
        }
        successCount++
      } catch {
        toast.error(`Failed to upload ${file.name}`)
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} file${successCount > 1 ? "s" : ""} uploaded`)
      fetchFiles()
    }

    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleDelete = async (fileId: string, fileName: string) => {
    if (!confirm(`Delete "${fileName}"?`)) return

    try {
      const res = await fetch(`/api/library/${fileId}`, { method: "DELETE" })
      if (!res.ok) {
        const errData = await res.json()
        toast.error(errData.error || "Failed to delete")
        return
      }
      toast.success("File deleted")
      setFiles((prev) => {
        const updated = prev.filter((f) => f.id !== fileId)
        onFileCountChange?.(updated.length)
        return updated
      })
    } catch {
      toast.error("Failed to delete file")
    }
  }

  const handleDownload = (file: LibraryFile) => {
    const a = document.createElement("a")
    a.href = file.file_url
    a.download = file.original_filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const filteredFiles = searchQuery
    ? files.filter(
        (f) =>
          f.original_filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.description?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : files

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {files.length} file{files.length !== 1 ? "s" : ""}
          </Badge>
          {role === "owner" && (
            <Badge variant="outline" className="text-xs text-green-700 border-green-300">
              Owner
            </Badge>
          )}
          {role === "viewer" && (
            <Badge variant="outline" className="text-xs text-gray-500">
              Read-only
            </Badge>
          )}
        </div>
        {canUpload && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleUpload}
              accept=".jpg,.jpeg,.png,.gif,.webp,.svg,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.mp4,.webm,.mp3,.wav"
            />
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="gap-1"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
        )}
      </div>

      {/* Search */}
      {files.length > 3 && (
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              title="Clear search"
            >
              <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}

      {/* Empty state */}
      {!loading && filteredFiles.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <FolderOpen className="h-10 w-10 mx-auto mb-2 text-gray-300" />
          {searchQuery ? (
            <p className="text-sm">No files match your search</p>
          ) : (
            <>
              <p className="text-sm font-medium mb-1">No files yet</p>
              {canUpload && <p className="text-xs">Upload files to this stick&apos;s folder</p>}
              {!canUpload && <p className="text-xs">The stick owner can upload files here</p>}
            </>
          )}
        </div>
      )}

      {/* File list */}
      {!loading && filteredFiles.length > 0 && (
        <div className="space-y-1.5">
          {filteredFiles.map((file) => (
            <Card key={file.id} className="hover:shadow-sm transition-shadow cursor-pointer" onClick={() => window.open(file.file_url, "_blank")}>
              <CardContent className="p-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center">
                    {getFileIcon(file.mime_type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-blue-600 hover:text-blue-800" title={`Click to open ${file.original_filename}`}>
                      {file.original_filename}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge className={`text-[10px] px-1.5 py-0 ${getFileExtBadgeColor(file.mime_type)}`}>
                        {getExtension(file.original_filename)}
                      </Badge>
                      <span className="text-xs text-gray-500">{formatFileSize(file.file_size)}</span>
                      <span className="text-xs text-gray-400">
                        {formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(file)}
                      className="h-7 w-7 p-0"
                      title="Download"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    {(canDeleteAny || (canDeleteOwn && file.uploaded_by === stickId)) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(file.id, file.original_filename)}
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
