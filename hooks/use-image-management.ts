"use client"

import type { ImageItem } from "@/types/note"
import type { NoteTabsConfig } from "@/types/note-tabs-config"
import { useMediaUploadBase } from "./useMediaUploadBase"

export function useImageManagement(
  noteId: string,
  config: NoteTabsConfig,
  onTabsUpdate: (tabs: any[]) => void,
  onTabChange?: (tab: string) => void,
) {
  const baseHook = useMediaUploadBase<ImageItem>({
    noteId,
    config,
    onTabsUpdate,
    onTabChange,
    tabType: "images",
    tabName: "Images",
  })

  const handleAddImageFromUrl = async (existingImages: ImageItem[]) => {
    if (!baseHook.url.trim() || baseHook.isLoading) return

    if (!baseHook.validateUrl(baseHook.url)) {
      baseHook.showError("Invalid Image URL", "Enter a valid image URL.")
      return
    }

    const newImage: ImageItem = {
      id: `image_${Date.now()}`,
      url: baseHook.url.trim(),
      alt: "",
      caption: "",
      size: 0,
      format: "",
    }

    await baseHook.handleAdd(existingImages, newImage)
  }

  return {
    imageUrl: baseHook.url,
    setImageUrl: baseHook.setUrl,
    addingImage: baseHook.isLoading,
    handleAddImageFromUrl,
    handleDeleteImage: baseHook.handleDelete,
  }
}
