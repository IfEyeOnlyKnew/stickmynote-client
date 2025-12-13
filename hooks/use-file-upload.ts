"use client"

import type React from "react"
import { useState } from "react"
import type { ImageItem } from "@/types/note"
import type { NoteTabsConfig } from "@/types/note-tabs-config"
import { useMediaUploadBase } from "./useMediaUploadBase"

export function useFileUpload(
  noteId: string,
  config: NoteTabsConfig,
  onTabsUpdate: (tabs: any[]) => void,
  onTabChange?: (tab: string) => void,
) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const baseHook = useMediaUploadBase<ImageItem>({
    noteId,
    config,
    onTabsUpdate,
    onTabChange,
    tabType: "images",
    tabName: "Images",
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith("image/")) {
        baseHook.showError("Invalid File", "Please select an image file.")
        return
      }

      if (file.size > 2 * 1024 * 1024) {
        baseHook.showError("File Too Large", "Image must be less than 2MB.")
        return
      }

      setSelectedFile(file)
    }
  }

  const handleUploadPersonalImage = async (existingImages: ImageItem[]) => {
    if (!selectedFile || baseHook.isLoading) return

    try {
      const formData = new FormData()
      formData.append("file", selectedFile)

      const response = await fetch("/api/upload-image", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Upload failed")
      }

      const { url, size, type } = await response.json()

      const newImage: ImageItem = {
        id: `image_${Date.now()}`,
        url: url,
        alt: selectedFile.name,
        caption: "",
        size: size,
        format: type,
      }

      await baseHook.handleAdd(existingImages, newImage)
      setSelectedFile(null)
    } catch (error: any) {
      baseHook.showError("Upload failed", error.message || "Failed to upload image.")
    }
  }

  return {
    selectedFile,
    uploadingFile: baseHook.isLoading,
    handleFileSelect,
    handleUploadPersonalImage,
  }
}
