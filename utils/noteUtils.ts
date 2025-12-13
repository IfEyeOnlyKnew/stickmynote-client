// Color palette for notes
export const COLORS = [
  { name: "Yellow", value: "#fef3c7", class: "bg-yellow-100" },
  { name: "Pink", value: "#fce7f3", class: "bg-pink-100" },
  { name: "Blue", value: "#dbeafe", class: "bg-blue-100" },
  { name: "Green", value: "#d1fae5", class: "bg-green-100" },
  { name: "Purple", value: "#e9d5ff", class: "bg-purple-100" },
  { name: "Orange", value: "#fed7aa", class: "bg-orange-100" },
  { name: "Red", value: "#fee2e2", class: "bg-red-100" },
  { name: "Gray", value: "#f3f4f6", class: "bg-gray-100" },
  { name: "White", value: "#ffffff", class: "bg-white" },
  { name: "Cyan", value: "#cffafe", class: "bg-cyan-100" },
  { name: "Indigo", value: "#e0e7ff", class: "bg-indigo-100" },
  { name: "Lime", value: "#ecfccb", class: "bg-lime-100" },
] as const

// Timestamp formatting
export function getTimestampDisplay(createdAt: string, updatedAt?: string): string {
  // Handle missing or invalid timestamps
  if (!createdAt) {
    return "Just now"
  }

  const created = new Date(createdAt)

  // Check if date is valid
  if (isNaN(created.getTime())) {
    return "Just now"
  }

  const updated = updatedAt ? new Date(updatedAt) : null
  const now = new Date()

  const diffMs = now.getTime() - created.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  let timeDisplay = ""

  if (diffMinutes < 1) {
    timeDisplay = "Just now"
  } else if (diffMinutes < 60) {
    timeDisplay = `${diffMinutes}m ago`
  } else if (diffHours < 24) {
    timeDisplay = `${diffHours}h ago`
  } else if (diffDays < 7) {
    timeDisplay = `${diffDays}d ago`
  } else {
    timeDisplay = created.toLocaleDateString()
  }

  if (updated && updated.getTime() !== created.getTime()) {
    const updatedDiffMs = now.getTime() - updated.getTime()
    const updatedDiffMinutes = Math.floor(updatedDiffMs / (1000 * 60))
    const updatedDiffHours = Math.floor(updatedDiffMs / (1000 * 60 * 60))
    const updatedDiffDays = Math.floor(updatedDiffMs / (1000 * 60 * 60 * 24))

    let updatedDisplay = ""
    if (updatedDiffMinutes < 1) {
      updatedDisplay = "just now"
    } else if (updatedDiffMinutes < 60) {
      updatedDisplay = `${updatedDiffMinutes}m ago`
    } else if (updatedDiffHours < 24) {
      updatedDisplay = `${updatedDiffHours}h ago`
    } else if (updatedDiffDays < 7) {
      updatedDisplay = `${updatedDiffDays}d ago`
    } else {
      updatedDisplay = updated.toLocaleDateString()
    }

    return `Created ${timeDisplay}, updated ${updatedDisplay}`
  }

  return `Created ${timeDisplay}`
}

// File size formatting
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

// URL validation
export function isValidUrl(string: string): boolean {
  try {
    new URL(string)
    return true
  } catch (_) {
    return false
  }
}

// Extract video ID from various platforms
export function extractVideoId(
  url: string,
  platform: "youtube" | "vimeo" | "rumble" | "loom" | "figma" | "google-docs",
): string | null {
  switch (platform) {
    case "youtube":
      const youtubeMatch = url.match(
        /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/,
      )
      return youtubeMatch ? youtubeMatch[1] : null

    case "vimeo":
      const vimeoMatch = url.match(/vimeo\.com\/(?:.*\/)?(\d+)/)
      return vimeoMatch ? vimeoMatch[1] : null

    case "rumble":
      const rumbleMatch = url.match(/rumble\.com\/([v][\w\d]+)/)
      return rumbleMatch ? rumbleMatch[1] : null

    case "loom":
      const loomMatch = url.match(/loom\.com\/share\/([a-f0-9]+)/)
      return loomMatch ? loomMatch[1] : null

    case "figma":
      const figmaMatch = url.match(/figma\.com\/(file|proto)\/([a-zA-Z0-9]+)/)
      return figmaMatch ? figmaMatch[2] : null

    case "google-docs":
      const googleDocsMatch = url.match(/docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([a-zA-Z0-9-_]+)/)
      return googleDocsMatch ? googleDocsMatch[2] : null

    default:
      return null
  }
}

// Generate embed URL for videos
export function generateEmbedUrl(
  url: string,
  platform: "youtube" | "vimeo" | "rumble" | "loom" | "figma" | "google-docs",
): string {
  const videoId = extractVideoId(url, platform)
  if (!videoId) return url

  switch (platform) {
    case "youtube":
      return `https://www.youtube.com/embed/${videoId}?rel=0`
    case "vimeo":
      return `https://player.vimeo.com/video/${videoId}`
    case "rumble":
      return `https://rumble.com/embed/${videoId}/`
    case "loom":
      return `https://www.loom.com/embed/${videoId}`
    case "figma":
      return `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(url || `https://www.figma.com/file/${videoId}`)}`
    case "google-docs":
      return url?.replace("/edit", "/preview") || `https://docs.google.com/document/d/${videoId}/preview`
    default:
      return url
  }
}

// Color utilities
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: Number.parseInt(result[1], 16),
        g: Number.parseInt(result[2], 16),
        b: Number.parseInt(result[3], 16),
      }
    : null
}

export function rgbToHex(r: number, g: number, b: number): string {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
}

export function lightenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex

  const { r, g, b } = rgb
  const newR = Math.min(255, Math.floor(r + (255 - r) * (percent / 100)))
  const newG = Math.min(255, Math.floor(g + (255 - g) * (percent / 100)))
  const newB = Math.min(255, Math.floor(b + (255 - b) * (percent / 100)))

  return rgbToHex(newR, newG, newB)
}

export function darkenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex

  const { r, g, b } = rgb
  const newR = Math.max(0, Math.floor(r * (1 - percent / 100)))
  const newG = Math.max(0, Math.floor(g * (1 - percent / 100)))
  const newB = Math.max(0, Math.floor(b * (1 - percent / 100)))

  return rgbToHex(newR, newG, newB)
}

// Text utilities
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + "..."
}

export function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

// File type detection
export function getFileType(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase()

  const imageTypes = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"]
  const videoTypes = ["mp4", "avi", "mov", "wmv", "flv", "webm", "mkv"]
  const audioTypes = ["mp3", "wav", "ogg", "m4a", "aac", "flac"]
  const documentTypes = ["pdf", "doc", "docx", "txt", "rtf", "odt"]

  if (imageTypes.includes(extension || "")) return "image"
  if (videoTypes.includes(extension || "")) return "video"
  if (audioTypes.includes(extension || "")) return "audio"
  if (documentTypes.includes(extension || "")) return "document"

  return "unknown"
}

export function isImageFile(filename: string): boolean {
  return getFileType(filename) === "image"
}

export function isVideoFile(filename: string): boolean {
  return getFileType(filename) === "video"
}

// Search and filtering utilities
export function searchNotes(notes: any[], searchTerm: string): any[] {
  if (!searchTerm.trim()) return notes

  const term = searchTerm.toLowerCase()
  return notes.filter(
    (note) =>
      (note.topic || "").toLowerCase().includes(term) ||
      (note.content || "").toLowerCase().includes(term) ||
      (note.tags || []).some((tag: string) => tag.toLowerCase().includes(term)),
  )
}

export function filterNotesByType(notes: any[], type: "all" | "personal" | "shared"): any[] {
  switch (type) {
    case "personal":
      return notes.filter((note) => !note.is_shared)
    case "shared":
      return notes.filter((note) => note.is_shared)
    default:
      return notes
  }
}

// Position utilities for note layout
export function calculateNotePosition(index: number, containerWidth: number): { x: number; y: number } {
  const noteWidth = 300
  const noteHeight = 200
  const padding = 20
  const columns = Math.floor(containerWidth / (noteWidth + padding))

  const column = index % columns
  const row = Math.floor(index / columns)

  return {
    x: column * (noteWidth + padding) + padding,
    y: row * (noteHeight + padding) + padding,
  }
}

// Validation utilities
export function validateNoteContent(content: string, maxLength = 1000): boolean {
  return content.trim().length > 0 && content.length <= maxLength
}

export function validateNoteTopic(topic: string, maxLength = 75): boolean {
  return topic.length <= maxLength
}

export function validateReplyContent(content: string, maxLength = 400): boolean {
  return content.trim().length > 0 && content.length <= maxLength
}

// Video and Image rendering utilities
export interface VideoRenderProps {
  video: {
    id: string
    platform: "youtube" | "vimeo" | "rumble" | "loom" | "figma" | "google-docs"
    embed_id: string
    url: string
    title?: string
    thumbnail?: string
    duration?: string
  }
  onDelete?: (videoId: string) => void
  className?: string
}

export interface ImageRenderProps {
  image: {
    id: string
    url: string
    alt?: string
    caption?: string
    size?: number
    format?: string
  }
  onClick?: () => void
  onDelete?: (imageId: string) => void
  className?: string
}

export interface VideoItem {
  id: string
  platform: "youtube" | "vimeo" | "rumble" | "loom" | "figma" | "google-docs"
  embed_id: string
  url: string
  title?: string
  thumbnail?: string
  duration?: string
  added_at?: string
  embed_url?: string
}

// Centralized video embed URL generation (enhanced from existing function)
export function getVideoEmbedUrl(video: { platform: string; embed_id: string; url?: string }): string {
  // Validate that we have the required fields
  if (!video.platform || !video.embed_id) {
    return video.url || ""
  }

  let embedUrl = ""
  switch (video.platform) {
    case "youtube":
      embedUrl = `https://www.youtube-nocookie.com/embed/${video.embed_id}?rel=0`
      break
    case "vimeo":
      embedUrl = `https://player.vimeo.com/video/${video.embed_id}`
      break
    case "rumble":
      embedUrl = `https://rumble.com/embed/${video.embed_id}/`
      break
    case "loom":
      embedUrl = `https://www.loom.com/embed/${video.embed_id}`
      break
    case "figma":
      embedUrl = `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(video.url || `https://www.figma.com/file/${video.embed_id}`)}`
      break
    case "google-docs":
      embedUrl =
        video.url?.replace("/edit", "/preview") || `https://docs.google.com/document/d/${video.embed_id}/preview`
      break
    default:
      embedUrl = video.url || ""
  }

  return embedUrl
}

// Enhanced video URL parsing (improved from existing function)
export function parseVideoUrlAdvanced(url: string) {
  if (!url || typeof url !== "string") return null

  const trimmedUrl = url.trim()
  if (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://")) {
    return null
  }

  // YouTube patterns (enhanced)
  const youtubePatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
  ]

  for (const pattern of youtubePatterns) {
    const match = trimmedUrl.match(pattern)
    if (match) {
      return {
        platform: "youtube" as const,
        url: trimmedUrl,
        embed_id: match[1],
        title: "",
        thumbnail: `https://img.youtube.com/vi/${match[1]}/maxresdefault.jpg`,
        duration: "0",
      }
    }
  }

  // Vimeo patterns (enhanced)
  const vimeoMatch = trimmedUrl.match(/vimeo\.com\/(?:.*\/)?(\d+)/)
  if (vimeoMatch) {
    return {
      platform: "vimeo" as const,
      url: trimmedUrl,
      embed_id: vimeoMatch[1],
      title: "",
      thumbnail: "",
      duration: "0",
    }
  }

  // Rumble patterns (enhanced)
  const rumblePatterns = [/rumble\.com\/(v[\w\d]+)(?:[-./?]|$)/, /rumble\.com\/embed\/(v[\w\d]+)/]

  for (const pattern of rumblePatterns) {
    const match = trimmedUrl.match(pattern)
    if (match) {
      return {
        platform: "rumble" as const,
        url: trimmedUrl,
        embed_id: match[1],
        title: "",
        thumbnail: "",
        duration: "0",
      }
    }
  }

  const loomPatterns = [/loom\.com\/share\/([a-f0-9]+)/, /loom\.com\/embed\/([a-f0-9]+)/]

  for (const pattern of loomPatterns) {
    const match = trimmedUrl.match(pattern)
    if (match) {
      return {
        platform: "loom" as const,
        url: trimmedUrl,
        embed_id: match[1],
        title: "",
        thumbnail: "",
        duration: "0",
      }
    }
  }

  const figmaMatch = trimmedUrl.match(/figma\.com\/(file|proto)\/([a-zA-Z0-9]+)/)
  if (figmaMatch) {
    return {
      platform: "figma" as const,
      url: trimmedUrl,
      embed_id: figmaMatch[2],
      title: "",
      thumbnail: "",
      duration: "0",
    }
  }

  const googleDocsMatch = trimmedUrl.match(
    /docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([a-zA-Z0-9-_]+)/,
  )
  if (googleDocsMatch) {
    return {
      platform: "google-docs" as const,
      url: trimmedUrl,
      embed_id: googleDocsMatch[2],
      title: "",
      thumbnail: "",
      duration: "0",
    }
  }

  return null
}

// Enhanced video URL parsing with title fetching
export async function parseVideoUrlWithTitle(url: string) {
  if (!url || typeof url !== "string") return null

  const trimmedUrl = url.trim()
  if (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://")) {
    return null
  }

  // First parse the basic video info
  const basicInfo = parseVideoUrlAdvanced(trimmedUrl)
  if (!basicInfo) return null

  // Try to fetch the actual video title
  try {
    let title = ""

    if (basicInfo.platform === "youtube") {
      // Use YouTube oEmbed API to get video title
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(trimmedUrl)}&format=json`
      const response = await fetch(oembedUrl)
      if (response.ok) {
        const data = await response.json()
        title = data.title || ""
      }
    } else if (basicInfo.platform === "vimeo") {
      // Use Vimeo oEmbed API to get video title
      const oembedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(trimmedUrl)}`
      const response = await fetch(oembedUrl)
      if (response.ok) {
        const data = await response.json()
        title = data.title || ""
      }
    }
    // For Rumble, we'll keep the empty title as they don't have a reliable oEmbed API

    return {
      ...basicInfo,
      title: title || basicInfo.title,
    }
  } catch (error) {
    console.warn("Failed to fetch video title:", error)
    // Return basic info if title fetching fails
    return basicInfo
  }
}

// Image URL validation and cleaning utilities
export function validateAndCleanImageUrl(url: string): string {
  if (!url || typeof url !== "string") return ""

  try {
    let cleanUrl = url.trim()

    // Add protocol if missing
    if (cleanUrl.startsWith("//")) {
      cleanUrl = "https:" + cleanUrl
    } else if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
      cleanUrl = "https://" + cleanUrl
    }

    // Parse and clean URL
    const urlObj = new URL(cleanUrl)

    // Remove problematic query parameters
    const problematicParams = [
      "resize",
      "quality",
      "strip",
      "w",
      "h",
      "fit",
      "crop",
      "auto",
      "format",
      "compress",
      "optimize",
      "cache",
    ]

    problematicParams.forEach((param) => {
      urlObj.searchParams.delete(param)
    })

    return urlObj.toString()
  } catch (error) {
    console.warn("Failed to clean image URL:", error)
    return url.trim()
  }
}

// Media validation utilities
export function isValidVideoUrl(url: string): boolean {
  const parsed = parseVideoUrlAdvanced(url)
  return parsed !== null
}

export function isValidImageUrlAdvanced(url: string): boolean {
  if (!url || typeof url !== "string") return false

  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?.*)?$/i
  const imageHosts = /^https?:\/\/(.*\.)?(imgur|flickr|unsplash|pexels|pixabay|cloudinary|amazonaws)/i

  return imageExtensions.test(url) || imageHosts.test(url) || url.includes("placeholder.svg")
}

// Performance optimization utilities for large-scale usage
export function optimizeMediaLoading(mediaItems: any[], viewportWidth: number) {
  // Calculate optimal grid columns based on viewport
  const getOptimalColumns = (width: number) => {
    if (width < 640) return 2 // mobile
    if (width < 768) return 3 // tablet
    if (width < 1024) return 4 // desktop
    return 5 // large desktop
  }

  // Lazy loading configuration
  const getLazyLoadingConfig = (itemCount: number) => ({
    threshold: itemCount > 20 ? 0.1 : 0.3,
    rootMargin: itemCount > 50 ? "50px" : "100px",
  })

  return {
    columns: getOptimalColumns(viewportWidth),
    lazyConfig: getLazyLoadingConfig(mediaItems.length),
    shouldVirtualize: mediaItems.length > 100,
  }
}

// Batch processing utilities for performance
export function batchProcessMedia<T>(items: T[], batchSize = 10): T[][] {
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize))
  }
  return batches
}

// Memory management for large media collections
export function createMediaCache(maxSize = 100) {
  const cache = new Map()

  return {
    get: (key: string) => cache.get(key),
    set: (key: string, value: any) => {
      if (cache.size >= maxSize) {
        const firstKey = cache.keys().next().value
        cache.delete(firstKey)
      }
      cache.set(key, value)
    },
    clear: () => cache.clear(),
    size: () => cache.size,
  }
}

export function normalizeVideoData(video: any): VideoItem | null {
  if (!video) {
    return null
  }

  // If video already has both platform and embed_id, return as is
  if (video.platform && video.embed_id) {
    return {
      id: video.id || crypto.randomUUID(),
      platform: video.platform,
      embed_id: video.embed_id,
      url: video.url || "",
      title: video.title || "",
      thumbnail: video.thumbnail || "",
      duration: video.duration || "0",
      added_at: video.added_at,
      embed_url: video.embed_url,
    }
  }

  // Try to extract from URL if available
  const url = video.url || video.embed_url || ""
  if (!url) {
    return null
  }

  const parsed = parseVideoUrlAdvanced(url)
  if (!parsed) {
    return null
  }

  return {
    id: video.id || crypto.randomUUID(),
    platform: parsed.platform,
    embed_id: parsed.embed_id,
    url: parsed.url,
    title: video.title || parsed.title || "",
    thumbnail: video.thumbnail || parsed.thumbnail || "",
    duration: video.duration || parsed.duration || "0",
    added_at: video.added_at,
    embed_url: video.embed_url,
  }
}

// Export enhanced default object with new utilities
export default {
  COLORS,
  getTimestampDisplay,
  formatFileSize,
  isValidUrl,
  extractVideoId,
  generateEmbedUrl,
  getVideoEmbedUrl,
  parseVideoUrlAdvanced,
  parseVideoUrlWithTitle,
  validateAndCleanImageUrl,
  isValidVideoUrl,
  isValidImageUrlAdvanced,
  optimizeMediaLoading,
  batchProcessMedia,
  createMediaCache,
  hexToRgb,
  rgbToHex,
  lightenColor,
  darkenColor,
  truncateText,
  capitalizeFirst,
  slugify,
  getFileType,
  isImageFile,
  isVideoFile,
  searchNotes,
  filterNotesByType,
  calculateNotePosition,
  validateNoteContent,
  validateNoteTopic,
  validateReplyContent,
  normalizeVideoData,
}
