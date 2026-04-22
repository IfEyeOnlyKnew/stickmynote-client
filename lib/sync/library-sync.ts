"use client"

/**
 * Tauri-only folder sync for the stick Library.
 *
 * - User picks a local folder that maps to one stick.
 * - Initial scan uploads every file that isn't already on the server.
 * - A filesystem watcher listens for add / change / delete and mirrors them up.
 * - Mappings persist across app restarts via tauri-plugin-store.
 * - Auth is the ambient `session` cookie — all HTTP goes through fetch() in the
 *   Tauri webview, so the existing httpOnly cookie Just Works.
 */

import { open as openDialog } from "@tauri-apps/plugin-dialog"
import {
  BaseDirectory,
  exists,
  readDir,
  readFile,
  stat,
  watch,
} from "@tauri-apps/plugin-fs"
import { LazyStore } from "@tauri-apps/plugin-store"

export type LibrarySyncState = "idle" | "scanning" | "syncing" | "error"

export interface LibrarySyncMapping {
  stickId: string
  stickType: string
  localPath: string
  addedAt: string
}

export interface LibrarySyncStatus {
  stickId: string
  localPath: string
  state: LibrarySyncState
  lastError?: string
  lastSyncedAt?: string
  queued: number
  uploaded: number
}

type UploadedRecord = {
  sha256: string
  fileId: string
  originalFilename: string
}

type UploadedMap = Record<string, UploadedRecord>

type StatusListener = (snapshot: LibrarySyncStatus[]) => void

const MAPPINGS_KEY = "mappings"
const UPLOADED_KEY_PREFIX = "uploaded:"
const WATCH_DEBOUNCE_MS = 2000

// Tauri v2 global is __TAURI_INTERNALS__ (v1 used __TAURI__).
export function isTauriDesktop(): boolean {
  if (typeof window === "undefined") return false
  const w = window as unknown as Record<string, unknown>
  return "__TAURI_INTERNALS__" in w || "__TAURI__" in w
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", bytes)
  const arr = Array.from(new Uint8Array(buf))
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("")
}

function baseName(p: string): string {
  const idx = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"))
  return idx === -1 ? p : p.slice(idx + 1)
}

function relativePath(root: string, full: string): string {
  const normRoot = root.replaceAll("\\", "/")
  const normFull = full.replaceAll("\\", "/")
  if (normFull.startsWith(normRoot)) {
    return normFull.slice(normRoot.length).replace(/^\/+/, "")
  }
  return baseName(full)
}

class LibrarySyncManager {
  private store = new LazyStore("stickmynote-library-sync.json")
  private workers = new Map<string, Worker>()
  private statusByStick = new Map<string, LibrarySyncStatus>()
  private listeners = new Set<StatusListener>()
  private initialized = false

  async init(): Promise<void> {
    if (this.initialized || !isTauriDesktop()) return
    this.initialized = true
    const mappings = await this.listMappings()
    for (const m of mappings) {
      await this.startWorker(m)
    }
  }

  subscribe(cb: StatusListener): () => void {
    this.listeners.add(cb)
    cb(this.snapshot())
    return () => this.listeners.delete(cb)
  }

  snapshot(): LibrarySyncStatus[] {
    return [...this.statusByStick.values()]
  }

  getStatus(stickId: string): LibrarySyncStatus | undefined {
    return this.statusByStick.get(stickId)
  }

  async listMappings(): Promise<LibrarySyncMapping[]> {
    const raw = await this.store.get<LibrarySyncMapping[]>(MAPPINGS_KEY)
    return raw ?? []
  }

  async addFolder(stickId: string, stickType: string): Promise<LibrarySyncMapping | null> {
    if (!isTauriDesktop()) return null
    const selected = await openDialog({ directory: true, multiple: false })
    if (typeof selected !== "string") return null
    const mapping: LibrarySyncMapping = {
      stickId,
      stickType,
      localPath: selected,
      addedAt: new Date().toISOString(),
    }
    await this.persistMapping(mapping)
    await this.startWorker(mapping)
    return mapping
  }

  async removeFolder(stickId: string): Promise<void> {
    const worker = this.workers.get(stickId)
    if (worker) {
      await worker.stop()
      this.workers.delete(stickId)
    }
    const mappings = await this.listMappings()
    const filtered = mappings.filter((m) => m.stickId !== stickId)
    await this.store.set(MAPPINGS_KEY, filtered)
    await this.store.delete(`${UPLOADED_KEY_PREFIX}${stickId}`)
    await this.store.save()
    this.statusByStick.delete(stickId)
    this.emit()
  }

  private async persistMapping(mapping: LibrarySyncMapping): Promise<void> {
    const mappings = await this.listMappings()
    const others = mappings.filter((m) => m.stickId !== mapping.stickId)
    await this.store.set(MAPPINGS_KEY, [...others, mapping])
    await this.store.save()
  }

  private async startWorker(mapping: LibrarySyncMapping): Promise<void> {
    if (this.workers.has(mapping.stickId)) return
    const worker = new Worker(mapping, this.store, (s) => this.setStatus(s))
    this.workers.set(mapping.stickId, worker)
    this.setStatus({
      stickId: mapping.stickId,
      localPath: mapping.localPath,
      state: "idle",
      queued: 0,
      uploaded: 0,
    })
    worker.start().catch((err) => {
      console.error(`[LibrarySync] worker ${mapping.stickId} failed:`, err)
      this.setStatus({
        stickId: mapping.stickId,
        localPath: mapping.localPath,
        state: "error",
        lastError: err instanceof Error ? err.message : String(err),
        queued: 0,
        uploaded: 0,
      })
    })
  }

  private setStatus(s: LibrarySyncStatus): void {
    this.statusByStick.set(s.stickId, s)
    this.emit()
  }

  private emit(): void {
    const snap = this.snapshot()
    for (const cb of this.listeners) cb(snap)
  }
}

class Worker {
  private unwatch: (() => void) | null = null
  private stopped = false
  private queue = new Set<string>()
  private flushing = false
  private uploaded = 0

  constructor(
    private readonly mapping: LibrarySyncMapping,
    private readonly store: LazyStore,
    private readonly reportStatus: (s: LibrarySyncStatus) => void,
  ) {}

  async start(): Promise<void> {
    this.reportStatus({
      stickId: this.mapping.stickId,
      localPath: this.mapping.localPath,
      state: "scanning",
      queued: 0,
      uploaded: 0,
    })

    if (!(await exists(this.mapping.localPath))) {
      throw new Error(`Local folder does not exist: ${this.mapping.localPath}`)
    }

    await this.initialScan()

    this.unwatch = await watch(
      this.mapping.localPath,
      (event) => this.onEvent(event),
      { recursive: true, delayMs: WATCH_DEBOUNCE_MS },
    )

    this.reportStatus({
      stickId: this.mapping.stickId,
      localPath: this.mapping.localPath,
      state: "idle",
      lastSyncedAt: new Date().toISOString(),
      queued: 0,
      uploaded: this.uploaded,
    })
  }

  async stop(): Promise<void> {
    this.stopped = true
    if (this.unwatch) {
      try { this.unwatch() } catch {
        // watcher already torn down
      }
      this.unwatch = null
    }
  }

  private async initialScan(): Promise<void> {
    const files: string[] = []
    await this.walk(this.mapping.localPath, files)
    for (const f of files) this.queue.add(f)
    await this.flush()
  }

  private async walk(dir: string, out: string[]): Promise<void> {
    const entries = await readDir(dir)
    for (const e of entries) {
      const full = `${dir}/${e.name}`.replaceAll("\\", "/")
      if (e.isDirectory) {
        await this.walk(full, out)
      } else if (e.isFile) {
        out.push(full)
      }
    }
  }

  private onEvent(event: unknown): void {
    if (this.stopped) return
    // Tauri fs watch events carry `{ type, paths }` — treat any add/modify as an upload trigger.
    const paths = (event as { paths?: string[] } | undefined)?.paths ?? []
    for (const p of paths) this.queue.add(p)
    void this.flush()
  }

  private async flush(): Promise<void> {
    if (this.flushing || this.stopped) return
    this.flushing = true
    try {
      while (this.queue.size > 0 && !this.stopped) {
        const path = this.queue.values().next().value as string
        this.queue.delete(path)
        this.reportStatus({
          stickId: this.mapping.stickId,
          localPath: this.mapping.localPath,
          state: "syncing",
          queued: this.queue.size,
          uploaded: this.uploaded,
        })
        try {
          await this.syncOne(path)
        } catch (err) {
          console.error(`[LibrarySync] upload failed for ${path}:`, err)
          this.reportStatus({
            stickId: this.mapping.stickId,
            localPath: this.mapping.localPath,
            state: "error",
            lastError: err instanceof Error ? err.message : String(err),
            queued: this.queue.size,
            uploaded: this.uploaded,
          })
        }
      }
      if (!this.stopped) {
        this.reportStatus({
          stickId: this.mapping.stickId,
          localPath: this.mapping.localPath,
          state: "idle",
          lastSyncedAt: new Date().toISOString(),
          queued: 0,
          uploaded: this.uploaded,
        })
      }
    } finally {
      this.flushing = false
    }
  }

  private async syncOne(fullPath: string): Promise<void> {
    const uploadedKey = `${UPLOADED_KEY_PREFIX}${this.mapping.stickId}`
    const uploaded = ((await this.store.get<UploadedMap>(uploadedKey)) ?? {}) as UploadedMap
    const rel = relativePath(this.mapping.localPath, fullPath)

    // Does the file still exist? If not, it's a delete — mirror by removing server row.
    if (!(await exists(fullPath))) {
      const prior = uploaded[rel]
      if (prior) {
        await this.deleteRemote(prior.fileId)
        delete uploaded[rel]
        await this.store.set(uploadedKey, uploaded)
        await this.store.save()
      }
      return
    }

    const info = await stat(fullPath)
    if (info.isDirectory) return

    const bytes = await readFile(fullPath)
    const sha = await sha256Hex(bytes)

    const prior = uploaded[rel]
    if (prior && prior.sha256 === sha) return // unchanged

    const mtime = info.mtime ? new Date(info.mtime).toISOString() : new Date().toISOString()
    const filename = baseName(fullPath)
    const newFileId = await this.uploadRemote(filename, bytes, sha, mtime)

    if (prior && prior.fileId && prior.fileId !== newFileId) {
      await this.deleteRemote(prior.fileId).catch((e) =>
        console.warn(`[LibrarySync] old version cleanup failed for ${rel}:`, e),
      )
    }

    uploaded[rel] = { sha256: sha, fileId: newFileId, originalFilename: filename }
    await this.store.set(uploadedKey, uploaded)
    await this.store.save()
    this.uploaded += 1
  }

  private async uploadRemote(
    filename: string,
    bytes: Uint8Array,
    sha256: string,
    mtime: string,
  ): Promise<string> {
    const form = new FormData()
    const blob = new Blob([bytes as unknown as ArrayBuffer], { type: "application/octet-stream" })
    form.set("file", blob, filename)
    form.set("stickId", this.mapping.stickId)
    form.set("stickType", this.mapping.stickType)
    form.set("sync", "true")
    form.set("sha256", sha256)
    form.set("client_mtime", mtime)

    const res = await fetch("/api/library", { method: "POST", body: form, credentials: "include" })
    if (!res.ok) {
      const msg = await res.text().catch(() => res.statusText)
      throw new Error(`upload ${res.status}: ${msg}`)
    }
    const data = (await res.json()) as { file?: { id?: string } }
    const id = data.file?.id
    if (!id) throw new Error("upload response missing file.id")
    return id
  }

  private async deleteRemote(fileId: string): Promise<void> {
    const res = await fetch(`/api/library/${fileId}`, { method: "DELETE", credentials: "include" })
    if (!res.ok && res.status !== 404) {
      throw new Error(`delete ${res.status}`)
    }
  }
}

export const librarySync = new LibrarySyncManager()

// The first import on the client kicks off any previously-configured workers.
if (typeof window !== "undefined" && isTauriDesktop()) {
  void librarySync.init()
}
