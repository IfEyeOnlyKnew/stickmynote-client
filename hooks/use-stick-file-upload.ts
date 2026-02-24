"use client"

import type React from "react"

import { useState } from "react"
import { toast } from "@/hooks/use-toast"
import type { ImageItem } from "@/types/pad"
import type { StickTabsConfig } from "@/types/stick-tabs-config"

export function useStickFileUpload(
  stickId: string,
  config: StickTabsConfig,
  onTabsUpdate: (tabs: any[]) => void,
  onTabChange?: (tab: string) => void,
) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const uploadFileAndSave = async (file: File, existingImages: ImageItem[]) => {
    const formData = new FormData()
    formData.append("file", file)

    const response = await fetch("/api/upload-image", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || "Failed to upload file")
    }

    const { url } = await response.json()

    const newImage: ImageItem = {
      id: `image_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      url,
      alt: file.name,
      caption: file.name,
      size: file.size,
      format: file.type,
    }

    const updatedImages = [...existingImages, newImage]
    await config.saveStickTab(stickId, "images", { images: updatedImages })

    const updatedTabs = await config.getStickTabs(stickId)
    onTabsUpdate(updatedTabs)
    onTabChange?.("Images")
  }

  const handleUploadPersonalImage = async (existingImages: ImageItem[]) => {
    if (!selectedFile || uploadingFile) return

    setUploadingFile(true)
    try {
      await uploadFileAndSave(selectedFile, existingImages)

      setSelectedFile(null)
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      if (fileInput) fileInput.value = ""

      toast({
        title: "Image uploaded",
        description: "Personal image saved to this stick.",
      })
    } catch (error) {
      console.error("[v0] Error uploading personal image:", error)
      toast({
        title: "Upload Failed",
        description: "Failed to upload personal image.",
        variant: "destructive",
      })
    } finally {
      setUploadingFile(false)
    }
  }

  const handlePasteImage = async (file: File, existingImages: ImageItem[]) => {
    if (uploadingFile) return

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid File", description: "Pasted content is not an image.", variant: "destructive" })
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File Too Large", description: "Image must be less than 5MB.", variant: "destructive" })
      return
    }

    setUploadingFile(true)
    try {
      await uploadFileAndSave(file, existingImages)
      toast({ title: "Image pasted", description: "Image uploaded and saved to this stick." })
    } catch (error) {
      console.error("[v0] Error uploading pasted image:", error)
      toast({ title: "Paste failed", description: "Failed to upload pasted image.", variant: "destructive" })
    } finally {
      setUploadingFile(false)
    }
  }

  return {
    selectedFile,
    uploadingFile,
    handleFileSelect,
    handleUploadPersonalImage,
    handlePasteImage,
  }
}
