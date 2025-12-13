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

  const handleUploadPersonalImage = async (existingImages: ImageItem[]) => {
    if (!selectedFile || uploadingFile) return

    setUploadingFile(true)
    try {
      console.log("[v0] Uploading personal image:", selectedFile.name)

      const formData = new FormData()
      formData.append("file", selectedFile)

      const response = await fetch("/api/upload-image", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Failed to upload file")
      }

      const { url } = await response.json()

      const newImage: ImageItem = {
        id: `image_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        url,
        alt: selectedFile.name,
        caption: selectedFile.name,
        size: selectedFile.size,
        format: selectedFile.type,
      }

      const updatedImages = [...existingImages, newImage]
      await config.saveStickTab(stickId, "images", { images: updatedImages })

      const updatedTabs = await config.getStickTabs(stickId)
      onTabsUpdate(updatedTabs)
      onTabChange?.("Images")

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

  return {
    selectedFile,
    uploadingFile,
    handleFileSelect,
    handleUploadPersonalImage,
  }
}
