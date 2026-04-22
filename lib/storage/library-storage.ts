import { promises as fs } from "node:fs"
import path from "node:path"

/**
 * Storage abstraction for stick Library files.
 *
 * Two drivers:
 *   - LocalDiskDriver: writes under UPLOAD_DIR on the IIS box (current HOL-DC2-IIS behavior).
 *   - RemoteFileServerDriver: stub for a future HTTP-based file server; throws until configured.
 *
 * Select with env var FILE_STORAGE_DRIVER=local|remote (default: local).
 */

export interface LibraryUploadInput {
  stickId: string
  filename: string
  buffer: Buffer
  contentType: string
}

export interface LibraryUploadResult {
  key: string
  publicUrl: string
  size: number
}

export interface LibraryStorageDriver {
  readonly driverName: string
  upload(input: LibraryUploadInput): Promise<LibraryUploadResult>
  delete(key: string): Promise<void>
  read(key: string): Promise<Buffer>
  healthCheck(): Promise<{ healthy: boolean; message: string }>
}

function getLocalBaseDir(): string {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads")
}

function libraryKey(stickId: string, filename: string): string {
  return ["library", "sticks", stickId, filename].join("/")
}

class LocalDiskDriver implements LibraryStorageDriver {
  readonly driverName = "local"

  async upload(input: LibraryUploadInput): Promise<LibraryUploadResult> {
    const key = libraryKey(input.stickId, input.filename)
    const baseDir = getLocalBaseDir()
    const fullPath = path.join(baseDir, key)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, input.buffer)
    const stat = await fs.stat(fullPath)
    return {
      key,
      publicUrl: `/uploads/${key}`,
      size: stat.size,
    }
  }

  async delete(key: string): Promise<void> {
    const fullPath = path.join(getLocalBaseDir(), key)
    await fs.unlink(fullPath)
  }

  async read(key: string): Promise<Buffer> {
    const fullPath = path.join(getLocalBaseDir(), key)
    return fs.readFile(fullPath)
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    const baseDir = getLocalBaseDir()
    try {
      await fs.mkdir(baseDir, { recursive: true })
      const probe = path.join(baseDir, ".health")
      await fs.writeFile(probe, "OK")
      await fs.unlink(probe)
      return { healthy: true, message: `local disk OK at ${baseDir}` }
    } catch (err) {
      return {
        healthy: false,
        message: err instanceof Error ? err.message : "local disk not writable",
      }
    }
  }
}

class RemoteFileServerDriver implements LibraryStorageDriver {
  readonly driverName = "remote"

  private notConfigured(): Error {
    return new Error(
      "FILE_STORAGE_DRIVER=remote but FILE_STORAGE_URL is not set. " +
        "Configure the remote file server env vars or set FILE_STORAGE_DRIVER=local.",
    )
  }

  async upload(_input: LibraryUploadInput): Promise<LibraryUploadResult> {
    throw this.notConfigured()
  }

  async delete(_key: string): Promise<void> {
    throw this.notConfigured()
  }

  async read(_key: string): Promise<Buffer> {
    throw this.notConfigured()
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    const url = process.env.FILE_STORAGE_URL
    if (!url) {
      return { healthy: false, message: "remote driver selected but FILE_STORAGE_URL is blank" }
    }
    return { healthy: false, message: `remote driver not yet implemented (target: ${url})` }
  }
}

let cached: LibraryStorageDriver | null = null

export function getLibraryStorage(): LibraryStorageDriver {
  if (cached) return cached
  const name = (process.env.FILE_STORAGE_DRIVER || "local").toLowerCase()
  switch (name) {
    case "local":
      cached = new LocalDiskDriver()
      break
    case "remote":
      cached = new RemoteFileServerDriver()
      break
    default:
      throw new Error(
        `Unknown FILE_STORAGE_DRIVER "${name}". Use "local" or "remote".`,
      )
  }
  return cached
}

export function __resetLibraryStorageForTests(): void {
  cached = null
}
