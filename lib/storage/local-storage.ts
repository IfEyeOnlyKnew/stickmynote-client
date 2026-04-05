import { promises as fs } from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"

interface UploadResult {
  url: string
  pathname: string
  contentType: string
  size: number
}

class LocalFileStorage {
  private readonly baseDir: string
  private readonly baseUrl: string

  constructor() {
    // Windows Server path: C:\inetpub\stickmynote\uploads
    this.baseDir = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads")
    this.baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  }

  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath)
    } catch {
      await fs.mkdir(dirPath, { recursive: true })
    }
  }

  private sanitizeFilename(filename: string): string {
    // Remove or replace invalid Windows filename characters
    return filename.replaceAll(/[<>:"|?*]/g, "_").replaceAll("\\", "_")
  }

  private getOrgDirectory(orgId: string): string {
    return path.join(this.baseDir, "orgs", orgId)
  }

  async uploadFile(
    file: Buffer,
    filename: string,
    orgId: string,
    folder: "avatars" | "images" | "documents" | "media" = "images",
  ): Promise<UploadResult> {
    try {
      const sanitizedFilename = this.sanitizeFilename(filename)
      const uniqueFilename = `${randomUUID()}-${sanitizedFilename}`
      const orgDir = this.getOrgDirectory(orgId)
      const folderDir = path.join(orgDir, folder)

      await this.ensureDirectory(folderDir)

      const filePath = path.join(folderDir, uniqueFilename)
      await fs.writeFile(filePath, file)

      const stat = await fs.stat(filePath)
      const relativePath = path.relative(this.baseDir, filePath).replaceAll("\\", "/")
      const url = `/uploads/${relativePath}`

      console.log(`[Storage] File uploaded: ${filePath}`)

      return {
        url,
        pathname: relativePath,
        contentType: this.getContentType(filename),
        size: stat.size,
      }
    } catch (error) {
      console.error("[Storage] Upload error:", error)
      throw new Error("Failed to upload file")
    }
  }

  async deleteFile(pathname: string): Promise<void> {
    try {
      const filePath = path.join(this.baseDir, pathname)
      await fs.unlink(filePath)
      console.log(`[Storage] File deleted: ${filePath}`)
    } catch (error) {
      console.error("[Storage] Delete error:", error)
      throw new Error("Failed to delete file")
    }
  }

  async getFile(pathname: string): Promise<Buffer | null> {
    try {
      const filePath = path.join(this.baseDir, pathname)
      return await fs.readFile(filePath)
    } catch (error) {
      console.error("[Storage] Read error:", error)
      return null
    }
  }

  async listFiles(orgId: string, folder?: string): Promise<string[]> {
    try {
      const orgDir = this.getOrgDirectory(orgId)
      const searchDir = folder ? path.join(orgDir, folder) : orgDir

      await this.ensureDirectory(searchDir)

      const files = await fs.readdir(searchDir, { recursive: true })
      return files.filter((file) => {
        const filePath = path.join(searchDir, file)
        return fs.stat(filePath).then((stat) => stat.isFile())
      })
    } catch (error) {
      console.error("[Storage] List error:", error)
      return []
    }
  }

  private getContentType(filename: string): string {
    const ext = path.extname(filename).toLowerCase()
    const mimeTypes: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".pdf": "application/pdf",
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".txt": "text/plain",
      ".json": "application/json",
    }
    return mimeTypes[ext] || "application/octet-stream"
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      await this.ensureDirectory(this.baseDir)
      const testFile = path.join(this.baseDir, ".health")
      await fs.writeFile(testFile, "OK")
      await fs.unlink(testFile)
      return {
        healthy: true,
        message: `Storage accessible at ${this.baseDir}`,
      }
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : "Storage not accessible",
      }
    }
  }
}

// Singleton instance
export const localStorage = new LocalFileStorage()

// Helper functions compatible with Vercel Blob API
export async function put(
  filename: string,
  content: Buffer | ArrayBuffer,
  options?: {
    orgId?: string
    folder?: string
    access?: "public" | "private"
    contentType?: string
    addRandomSuffix?: boolean
  },
) {
  const buffer = content instanceof ArrayBuffer ? Buffer.from(content) : content
  // Extract orgId from path if it follows the pattern orgs/{orgId}/...
  let orgId = options?.orgId || "default"
  let actualFilename = filename

  // Check if filename contains org prefix
  const orgMatch = /^orgs\/([^/]+)\/(.+)$/.exec(filename)
  if (orgMatch) {
    orgId = orgMatch[1]
    actualFilename = orgMatch[2]
  }

  const folder = (options?.folder as any) || "images"

  return localStorage.uploadFile(buffer, actualFilename, orgId, folder)
}

export async function del(urlOrPathname: string) {
  // Handle full URL or just pathname
  let pathname = urlOrPathname
  if (urlOrPathname.startsWith("http")) {
    try {
      const url = new URL(urlOrPathname)
      pathname = url.pathname.replace(/^\/uploads\//, "")
    } catch {
      // Not a valid URL, treat as pathname
    }
  }
  return localStorage.deleteFile(pathname)
}

export async function list(options?: { orgId?: string; folder?: string }) {
  const orgId = options?.orgId || "default"
  return localStorage.listFiles(orgId, options?.folder)
}
