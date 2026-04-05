"use client"

import { useState } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X, Download, ZoomIn, ExternalLink } from "lucide-react"
import Image from "next/image"
import { cn } from "@/lib/utils"

interface MediaItem {
  url: string
  type: "image" | "video" | "document"
  filename?: string
  size?: number
}

interface MediaGalleryProps {
  items: MediaItem[]
  onDelete?: (url: string) => void
  editable?: boolean
  className?: string
}

export function MediaGallery({ items, onDelete, editable = false, className }: Readonly<MediaGalleryProps>) {
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const openLightbox = (item: MediaItem) => {
    setSelectedMedia(item)
    setLightboxOpen(true)
  }

  const handleDownload = async (url: string, filename?: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const downloadUrl = globalThis.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = downloadUrl
      link.download = filename || "download"
      document.body.appendChild(link)
      link.click()
      link.remove()
      globalThis.URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error("[v0] Download error:", error)
    }
  }

  const renderThumbnail = (item: MediaItem) => {
    if (item.type === "image") {
      return (
        <button
          type="button"
          className="relative w-full h-full group cursor-pointer border-0 p-0 bg-transparent"
          onClick={() => openLightbox(item)}
          aria-label={`View ${item.filename || "image"} in lightbox`}
        >
          <Image
            src={item.url || "/placeholder.svg"}
            alt={item.filename || "Gallery image"}
            fill
            className="object-cover rounded-lg"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors rounded-lg flex items-center justify-center">
            <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </button>
      )
    }

    if (item.type === "video") {
      return (
        <video src={item.url} controls className="w-full h-full object-cover rounded-lg">
          <track kind="captions" src="" label="Captions" default />
          Your browser does not support the video tag.
        </video>
      )
    }

    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 rounded-lg p-4">
        <ExternalLink className="h-8 w-8 text-gray-400 mb-2" />
        <p className="text-xs text-gray-600 text-center truncate w-full">{item.filename || "Document"}</p>
      </div>
    )
  }

  return (
    <>
      <div className={cn("grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4", className)}>
        {items.map((item) => (
          <div key={item.url} className="relative aspect-square">
            {renderThumbnail(item)}
            {editable && onDelete && (
              <div className="absolute top-2 right-2 flex gap-1">
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 w-7 p-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(item.url)
                  }}
                  aria-label="Delete media"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            {item.type === "document" && (
              <Button
                size="sm"
                variant="secondary"
                className="absolute bottom-2 right-2 h-7 text-xs"
                onClick={() => window.open(item.url, "_blank")}
              >
                Open
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-4xl w-full">
          {selectedMedia && (
            <div className="space-y-4">
              {selectedMedia.type === "image" && (
                <div className="relative w-full" style={{ minHeight: "400px" }}>
                  <Image
                    src={selectedMedia.url || "/placeholder.svg"}
                    alt={selectedMedia.filename || "Gallery image"}
                    width={1200}
                    height={800}
                    className="w-full h-auto rounded-lg"
                    unoptimized
                  />
                </div>
              )}
              {selectedMedia.type === "video" && (
                <video src={selectedMedia.url} controls className="w-full rounded-lg">
                  <track kind="captions" src="" label="Captions" default />
                  Your browser does not support the video tag.
                </video>
              )}
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600 truncate flex-1">{selectedMedia.filename || selectedMedia.url}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(selectedMedia.url, selectedMedia.filename)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
