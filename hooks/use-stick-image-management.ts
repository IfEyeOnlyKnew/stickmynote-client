"use client"

import type { ImageItem } from "@/types/pad"
import type { StickTabsConfig } from "@/types/stick-tabs-config"
import { useStickMediaUploadBase } from "./useStickMediaUploadBase"

export function useStickImageManagement(
  stickId: string,
  config: StickTabsConfig,
  onTabsUpdate: (tabs: any[]) => void,
  onTabChange?: (tab: string) => void,
) {
  const baseHook = useStickMediaUploadBase<ImageItem>({
    stickId,
    config,
    onTabsUpdate,
    onTabChange,
    tabType: "images",
    tabName: "Images",
  })

  const handleAddImageFromUrl = async (existingImages: ImageItem[]) => {
    if (!baseHook.url.trim() || baseHook.isLoading) return

    console.log("[v0] Adding image from URL:", baseHook.url)

    if (!baseHook.validateUrl(baseHook.url)) {
      baseHook.showError("Invalid Image URL", "Please enter a valid image URL.")
      return
    }

    const newImage: ImageItem = {
      id: `image_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      url: baseHook.url,
      alt: `Image ${Date.now()}`,
      caption: `Image ${Date.now()}`,
    }

    console.log("[v0] Created new image object:", newImage)

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
