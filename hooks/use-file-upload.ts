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

  const uploadFile = async (file: File, existingImages: ImageItem[]) => {
    const formData = new FormData()
    formData.append("file", file)

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
      id: `image_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      url,
      alt: file.name,
      caption: "",
      size,
      format: type,
    }

    await baseHook.handleAdd(existingImages, newImage)
  }

  const handleUploadPersonalImage = async (existingImages: ImageItem[]) => {
    if (!selectedFile || baseHook.isLoading) return

    try {
      await uploadFile(selectedFile, existingImages)
      setSelectedFile(null)
    } catch (error: any) {
      baseHook.showError("Upload failed", error.message || "Failed to upload image.")
    }
  }

  const handlePasteImage = async (file: File, existingImages: ImageItem[]) => {
    console.log("[FileUpload] handlePasteImage called:", file.name, file.type, file.size, "isLoading:", baseHook.isLoading)

    if (baseHook.isLoading) {
      console.log("[FileUpload] Skipping paste - already loading")
      return
    }

    if (!file.type.startsWith("image/")) {
      console.log("[FileUpload] Skipping paste - not an image:", file.type)
      baseHook.showError("Invalid File", "Pasted content is not an image.")
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      console.log("[FileUpload] Skipping paste - file too large:", file.size)
      baseHook.showError("File Too Large", "Image must be less than 5MB.")
      return
    }

    try {
      console.log("[FileUpload] Starting paste upload...")
      await uploadFile(file, existingImages)
      console.log("[FileUpload] Paste upload successful!")
      baseHook.showSuccess("Image pasted", "Image uploaded and saved to this note.")
    } catch (error: any) {
      console.error("[FileUpload] Paste upload failed:", error)
      baseHook.showError("Paste failed", error.message || "Failed to upload pasted image.")
    }
  }

  return {
    selectedFile,
    uploadingFile: baseHook.isLoading,
    handleFileSelect,
    handleUploadPersonalImage,
    handlePasteImage,
  }
}
