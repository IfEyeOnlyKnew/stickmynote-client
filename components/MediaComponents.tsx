"use client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ExternalLink, Trash2, Eye, AlertCircle } from "lucide-react"
import { getVideoEmbedUrl, type VideoRenderProps, type ImageRenderProps } from "@/utils/noteUtils"
import Image from "next/image"

export function VideoCard({ video, onDelete, className = "" }: VideoRenderProps) {
  const hasRequiredFields = video.platform && video.embed_id

  const embedUrl = hasRequiredFields ? getVideoEmbedUrl(video) : ""

  if (!hasRequiredFields || !embedUrl) {
    return (
      <Card className={`overflow-hidden border-red-200 ${className}`}>
        <div className="aspect-video bg-red-50 flex items-center justify-center">
          <div className="text-center p-4">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-red-600">Video data incomplete</p>
            <p className="text-xs text-red-500 mt-1">
              Missing: {!video.platform && "platform"} {!video.embed_id && "embed_id"}
            </p>
            {video.url && (
              <Button variant="outline" size="sm" onClick={() => window.open(video.url, "_blank")} className="mt-2">
                <ExternalLink className="h-3 w-3 mr-1" />
                Open Link
              </Button>
            )}
          </div>
        </div>
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0 mr-2">
              <span className="text-xs px-2 py-1 bg-red-100 rounded uppercase font-medium text-red-600">
                {video.platform || "unknown"}
              </span>
            </div>
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(video.id)}
                title="Delete video"
                className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case "youtube":
        return "bg-red-100 text-red-600"
      case "vimeo":
        return "bg-blue-100 text-blue-600"
      case "rumble":
        return "bg-green-100 text-green-600"
      case "loom":
        return "bg-purple-100 text-purple-600"
      case "figma":
        return "bg-pink-100 text-pink-600"
      case "google-docs":
        return "bg-yellow-100 text-yellow-700"
      default:
        return "bg-gray-100 text-gray-600"
    }
  }

  return (
    <Card className={`overflow-hidden hover:shadow-md transition-shadow ${className}`}>
      <div className="aspect-video bg-gray-100">
        <iframe
          src={embedUrl}
          title={video.title || "Video"}
          className="w-full h-full"
          style={{ border: 0 }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          sandbox="allow-same-origin allow-scripts allow-popups allow-presentation allow-forms"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          loading="lazy"
        />
      </div>
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0 mr-2">
            {video.title ? (
              <p className="text-sm font-medium text-gray-900 truncate" title={video.title}>
                {video.title}
              </p>
            ) : (
              <span className={`text-xs px-2 py-1 rounded uppercase font-medium ${getPlatformColor(video.platform)}`}>
                {video.platform || "video"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(video.url, "_blank")}
              title="Open in new tab"
              className="h-6 w-6 p-0"
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(video.id)}
                title="Delete video"
                className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function ImageCard({
  image,
  onClick,
  onDelete,
  className = "",
  fullWidth = false,
}: ImageRenderProps & { fullWidth?: boolean }) {
  return (
    <Card className={`overflow-hidden cursor-pointer hover:shadow-md transition-shadow group ${className}`}>
      <div
        role="button"
        tabIndex={0}
        className={`${fullWidth ? "w-full" : "aspect-square"} bg-gray-100 relative overflow-hidden`}
        onClick={onClick}
        onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      >
        <Image
          src={image.url || "/placeholder.svg?height=600&width=600&query=note-image-placeholder"}
          alt={image.alt || "Image"}
          fill={!fullWidth}
          width={fullWidth ? 800 : undefined}
          height={fullWidth ? 600 : undefined}
          className={`${fullWidth ? "w-full h-auto" : "object-cover"} group-hover:scale-105 transition-transform duration-200`}
          loading="lazy"
          sizes={fullWidth ? "100vw" : "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"}
          unoptimized={image.url?.includes("placeholder.svg")}
        />
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
          <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        </div>
      </div>
      {onDelete && (
        <CardContent className="p-2">
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(image.id)
              }}
              title="Delete image"
              className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
