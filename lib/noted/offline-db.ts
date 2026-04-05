/**
 * IndexedDB wrapper for Noted offline storage.
 * Stores pages locally for offline viewing and editing.
 */

const DB_NAME = "noted_offline"
const DB_VERSION = 1
const PAGES_STORE = "pages"
const SYNC_QUEUE_STORE = "sync_queue"

interface OfflinePage {
  id: string
  title: string
  content: string
  group_id: string | null
  updated_at: string
  cached_at: number
}

interface SyncQueueItem {
  id: string
  page_id: string
  action: "update" | "create" | "delete"
  data: Record<string, unknown>
  created_at: number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result

      if (!db.objectStoreNames.contains(PAGES_STORE)) {
        const pageStore = db.createObjectStore(PAGES_STORE, { keyPath: "id" })
        pageStore.createIndex("group_id", "group_id", { unique: false })
        pageStore.createIndex("cached_at", "cached_at", { unique: false })
      }

      if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
        const syncStore = db.createObjectStore(SYNC_QUEUE_STORE, { keyPath: "id" })
        syncStore.createIndex("page_id", "page_id", { unique: false })
        syncStore.createIndex("created_at", "created_at", { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("Failed to open database"))
  })
}

// ---- Pages ----

export async function cachePage(page: OfflinePage): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PAGES_STORE, "readwrite")
    tx.objectStore(PAGES_STORE).put({ ...page, cached_at: Date.now() })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error("Transaction failed"))
  })
}

export async function cachePages(pages: OfflinePage[]): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PAGES_STORE, "readwrite")
    const store = tx.objectStore(PAGES_STORE)
    for (const page of pages) {
      store.put({ ...page, cached_at: Date.now() })
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error("Transaction failed"))
  })
}

export async function getCachedPage(id: string): Promise<OfflinePage | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PAGES_STORE, "readonly")
    const request = tx.objectStore(PAGES_STORE).get(id)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error ?? new Error("Request failed"))
  })
}

export async function getAllCachedPages(): Promise<OfflinePage[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PAGES_STORE, "readonly")
    const request = tx.objectStore(PAGES_STORE).getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error ?? new Error("Request failed"))
  })
}

export async function removeCachedPage(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PAGES_STORE, "readwrite")
    tx.objectStore(PAGES_STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error("Transaction failed"))
  })
}

// ---- Sync Queue ----

export async function addToSyncQueue(item: Omit<SyncQueueItem, "id" | "created_at">): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_QUEUE_STORE, "readwrite")
    tx.objectStore(SYNC_QUEUE_STORE).put({
      ...item,
      id: `${item.page_id}-${Date.now()}`,
      created_at: Date.now(),
    })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error("Transaction failed"))
  })
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_QUEUE_STORE, "readonly")
    const index = tx.objectStore(SYNC_QUEUE_STORE).index("created_at")
    const request = index.getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error ?? new Error("Request failed"))
  })
}

export async function removeSyncQueueItem(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_QUEUE_STORE, "readwrite")
    tx.objectStore(SYNC_QUEUE_STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error("Transaction failed"))
  })
}

export async function clearSyncQueue(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_QUEUE_STORE, "readwrite")
    tx.objectStore(SYNC_QUEUE_STORE).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error("Transaction failed"))
  })
}

export async function getSyncQueueCount(): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_QUEUE_STORE, "readonly")
    const request = tx.objectStore(SYNC_QUEUE_STORE).count()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("Request failed"))
  })
}
