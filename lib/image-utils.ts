/**
 * Image Optimization Utilities
 *
 * Provides utilities for image validation, optimization, and processing.
 */

export const IMAGE_CONFIG = {
  // Maximum file size before optimization (5MB)
  maxFileSize: 5 * 1024 * 1024,
  // Maximum dimension for uploaded images
  maxDimension: 2048,
  // Allowed MIME types
  allowedTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"] as const,
  // JPEG quality for optimization
  jpegQuality: 85,
  // WebP quality for optimization
  webpQuality: 85,
  // PNG compression level
  pngCompression: 9,
} as const

/**
 * Validates if a file is a valid image
 */
export function isValidImage(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: "No file provided" }
  }

  if (!IMAGE_CONFIG.allowedTypes.includes(file.type as (typeof IMAGE_CONFIG.allowedTypes)[number])) {
    return {
      valid: false,
      error: "File must be a valid image (JPEG, PNG, WebP, or GIF)",
    }
  }

  if (file.size > IMAGE_CONFIG.maxFileSize) {
    return {
      valid: false,
      error: `File size must be less than ${IMAGE_CONFIG.maxFileSize / (1024 * 1024)}MB`,
    }
  }

  return { valid: true }
}

/**
 * Gets the appropriate file extension for a MIME type
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  }
  return map[mimeType] || "jpg"
}

/**
 * Generates a unique filename for uploaded images
 */
export function generateImageFilename(userId: string, originalFilename: string): string {
  const timestamp = Date.now()
  const randomId = Math.random().toString(36).substring(2, 8)
  const extension = originalFilename.split(".").pop() || "jpg"
  return `user-images/${userId}/${timestamp}-${randomId}.${extension}`
}
