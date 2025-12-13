"use client"

import type React from "react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ImageIcon } from "lucide-react"
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
}: ImageTabContentProps) {
  return (
    <div className="space-y-4 px-2">
      {!readOnly && (
        <div className="space-y-4">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Image URL Web</label>
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
              <label className="text-sm font-medium text-gray-700 mb-2 block">Image URL Personal</label>
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
                  Upload your personal images (max 2MB). Supported formats: JPG, PNG, GIF, WebP
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
          {!readOnly && <p className="text-sm">Click "Add from URL" or "Upload" to get started</p>}
        </div>
      )}
    </div>
  )
}
