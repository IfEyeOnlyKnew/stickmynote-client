"use client"

import type React from "react"
import { useState, useCallback, useEffect, useRef } from "react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ImageIcon, ClipboardPaste, Upload } from "lucide-react"
import { ImageCard } from "@/components/MediaComponents"
import type { ImageItem } from "@/types/note"

interface ImageTabContentProps {
  images: ImageItem[]
  imageUrl: string
  addingImage: boolean
  selectedFile: File | null
  uploadingFile: boolean
  readOnly?: boolean
  onImageUrlChange: (url: string) => void
  onAddImageFromUrl: () => void
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onUploadPersonalImage: () => void
  onDeleteImage?: (imageId: string) => void
  onPasteImage?: (file: File) => void
}

function isTextInputFocused(): boolean {
  const active = document.activeElement
  if (!active) return false
  if (active.tagName !== "INPUT" && active.tagName !== "TEXTAREA") return false
  const inputType = (active as HTMLInputElement).type
  if (inputType === "file") return false
  console.log("[ImageTab] Skipping paste - focus is on input:", active.tagName, inputType)
  return true
}

function findImageInFiles(files: FileList): File | null {
  for (const file of files) {
    if (file.type.startsWith("image/")) {
      console.log("[ImageTab] Found image in clipboardData.files:", file.type, file.size)
      return file
    }
  }
  return null
}

function findImageInItems(items: DataTransferItemList): File | null {
  for (const item of items) {
    console.log("[ImageTab] Clipboard item:", item.kind, item.type)
    if (item.kind !== "file" || !item.type.startsWith("image/")) continue
    const file = item.getAsFile()
    if (file) {
      console.log("[ImageTab] Found image in clipboardData.items:", file.type, file.size)
      return file
    }
  }
  return null
}

function extractImageFromClipboard(clipboardData: DataTransfer): File | null {
  // Try clipboardData.files first (more reliable for pasted images)
  if (clipboardData.files?.length > 0) {
    const fromFiles = findImageInFiles(clipboardData.files)
    if (fromFiles) return fromFiles
  }

  // Fallback to clipboardData.items
  if (clipboardData.items) {
    const fromItems = findImageInItems(clipboardData.items)
    if (fromItems) return fromItems
  }

  console.log("[ImageTab] No image found in clipboard")
  return null
}

function extractImageFromDrop(files: FileList): File | null {
  for (const file of files) {
    if (file.type.startsWith("image/")) {
      return file
    }
  }
  return null
}

export function ImageTabContent({
  images,
  imageUrl,
  addingImage,
  selectedFile,
  uploadingFile,
  readOnly = false,
  onImageUrlChange,
  onAddImageFromUrl,
  onFileSelect,
  onUploadPersonalImage,
  onDeleteImage,
  onPasteImage,
}: Readonly<ImageTabContentProps>) {
  const [isDragOver, setIsDragOver] = useState(false)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  // Document-level paste listener — fires regardless of which element has focus
  useEffect(() => {
    if (readOnly || !onPasteImage) return

    console.log("[ImageTab] Registering document paste listener")

    const handler = (e: ClipboardEvent) => {
      console.log("[ImageTab] Paste event fired, clipboardData:", !!e.clipboardData)
      if (!e.clipboardData) return

      // Don't intercept if user is typing in a text input/textarea
      if (isTextInputFocused()) return

      const file = extractImageFromClipboard(e.clipboardData)
      if (!file) return

      e.preventDefault()
      console.log("[ImageTab] Calling onPasteImage with file:", file.name, file.type, file.size)
      onPasteImage(file)
    }

    document.addEventListener("paste", handler)
    return () => {
      console.log("[ImageTab] Removing document paste listener")
      document.removeEventListener("paste", handler)
    }
  }, [readOnly, onPasteImage])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)
      if (readOnly || !onPasteImage || !e.dataTransfer?.files) return
      const file = extractImageFromDrop(e.dataTransfer.files)
      if (file) {
        onPasteImage(file)
      }
    },
    [readOnly, onPasteImage],
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (!readOnly && onPasteImage) {
        setIsDragOver(true)
      }
    },
    [readOnly, onPasteImage],
  )

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (!readOnly && onPasteImage) {
        setIsDragOver(true)
      }
    },
    [readOnly, onPasteImage],
  )

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Only hide the overlay if we're leaving the drop zone entirely
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }, [])

  return (
    <section
      ref={dropZoneRef}
      aria-label="Image drop zone"
      className="space-y-4 px-2"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      {!readOnly && onPasteImage && (
        <section
          aria-label="Image drop zone"
          className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
            isDragOver
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 hover:border-gray-400"
          }`}
        >
          <div className="flex flex-col items-center gap-1 text-gray-500">
            <div className="flex items-center gap-3">
              <ClipboardPaste className="h-5 w-5" />
              <span className="text-sm font-medium">Paste</span>
              <span className="text-xs text-gray-400">or</span>
              <Upload className="h-5 w-5" />
              <span className="text-sm font-medium">Drop image here</span>
            </div>
            <span className="text-xs text-gray-400">
              Copy an image and press Ctrl+V, or drag a file into this area
            </span>
          </div>
        </section>
      )}

      {!readOnly && (
        <div className="space-y-4">
          <div className="space-y-4">
            <div>
              <span className="text-sm font-medium text-gray-700 mb-2 block">Image URL Web</span>
              <div className="flex gap-2">
                <Input
                  value={imageUrl}
                  onChange={(e) => onImageUrlChange(e.target.value)}
                  placeholder="Paste image URL from web..."
                  className="flex-1"
                />
                <Button onClick={onAddImageFromUrl} disabled={!imageUrl.trim() || addingImage}>
                  {addingImage ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    "Add"
                  )}
                </Button>
              </div>
            </div>

            <div className="border-t pt-4">
              <span className="text-sm font-medium text-gray-700 mb-2 block">Upload from Device</span>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input type="file" accept="image/*" onChange={onFileSelect} className="flex-1" />
                  <Button onClick={onUploadPersonalImage} disabled={!selectedFile || uploadingFile}>
                    {uploadingFile ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      "Upload"
                    )}
                  </Button>
                </div>
                {selectedFile && (
                  <div className="text-xs text-gray-600">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </div>
                )}
                <div className="text-xs text-gray-500">
                  Max 5MB. Supported formats: JPG, PNG, GIF, WebP
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {images.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {images.map((image) => (
            <ImageCard
              key={image.id}
              image={image}
              onClick={() => window.open(image.url, "_blank")}
              onDelete={readOnly ? undefined : onDeleteImage}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No images added yet</p>
          {!readOnly && <p className="text-sm">Paste, drop, or upload an image to get started</p>}
        </div>
      )}
    </section>
  )
}
