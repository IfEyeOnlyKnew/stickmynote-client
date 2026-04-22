const CACHE_VERSION = 6
const CACHE_NAME = `stickmynote-v${CACHE_VERSION}`
const API_CACHE_NAME = `stickmynote-api-v${CACHE_VERSION}`
const OFFLINE_PAGE = "/offline"

// Assets to cache immediately on install
const PRECACHE_ASSETS = ["/", "/manifest.json", "/offline"]

// Paths the SW must NOT intercept. Anything on these paths talks directly
// to the network — the SW returning a stale or cached Response can break
// real-time features (LiveKit WebRTC, video tokens, etc.).
const NETWORK_ONLY_PATH_PREFIXES = [
  "/video/",          // video rooms & join pages
  "/api/video/",      // room + invite + token endpoints
  "/livekit-ws",      // LiveKit WebSocket proxy
  "/ws",              // app WebSocket
  "/api/auth/",       // auth — cached auth causes redirect loops
]

function isNetworkOnly(url) {
  return NETWORK_ONLY_PATH_PREFIXES.some((p) => url.pathname.startsWith(p))
}

// Minimal error Response so we never hand undefined to respondWith
function fallbackErrorResponse() {
  return new Response("Service unavailable", {
    status: 503,
    headers: { "Content-Type": "text/plain" },
  })
}

// Install event: Cache core assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS)),
  )
  self.skipWaiting()
})

// Activate event: Clean up old caches and notify clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
              return caches.delete(cacheName)
            }
          }),
        ),
      )
      .then(() =>
        self.clients.matchAll({ type: "window" }).then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: "SW_UPDATED", version: CACHE_VERSION })
          })
        }),
      ),
  )
  self.clients.claim()
})

// Stale-while-revalidate helper. Always resolves to a valid Response.
async function staleWhileRevalidate(cacheName, request) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const networkPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone()).catch(() => {})
      }
      return networkResponse
    })
    .catch(() => null)

  if (cached) return cached
  const fresh = await networkPromise
  return fresh || fallbackErrorResponse()
}

// Network-first for navigations. Always resolves to a valid Response.
async function navigationNetworkFirst(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const clone = response.clone()
      caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {})
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    const offline = await caches.match(OFFLINE_PAGE)
    if (offline) return offline
    const root = await caches.match("/")
    if (root) return root
    return fallbackErrorResponse()
  }
}

// Fetch event
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)

  if (!url.protocol.startsWith("http")) return

  // Bypass the SW entirely for real-time paths
  if (isNetworkOnly(url)) return

  // API requests (GET only) → stale-while-revalidate
  if (url.pathname.startsWith("/api/")) {
    if (event.request.method !== "GET") return
    event.respondWith(staleWhileRevalidate(API_CACHE_NAME, event.request))
    return
  }

  // Navigation requests → network-first with offline fallback
  if (event.request.mode === "navigate") {
    event.respondWith(navigationNetworkFirst(event.request))
    return
  }

  // Everything else (static assets) → stale-while-revalidate
  event.respondWith(staleWhileRevalidate(CACHE_NAME, event.request))
})

// Background Sync for Offline Edits
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-offline-actions") {
    event.waitUntil(syncOfflineActions())
  }
})

async function syncOfflineActions() {
  const db = await openDB()
  const tx = db.transaction("offline-actions", "readwrite")
  const store = tx.objectStore("offline-actions")
  const actions = await getAllFromStore(store)

  for (const action of actions) {
    try {
      await fetch(action.url, {
        method: action.method,
        headers: action.headers,
        body: action.body,
      })
      const deleteTx = db.transaction("offline-actions", "readwrite")
      deleteTx.objectStore("offline-actions").delete(action.id)
    } catch {
      break
    }
  }
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("stickmynote-offline", 1)
    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains("offline-actions")) {
        db.createObjectStore("offline-actions", { keyPath: "id", autoIncrement: true })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function getAllFromStore(store) {
  return new Promise((resolve, reject) => {
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// Push notification handler
self.addEventListener("push", (event) => {
  if (!event.data) return

  const data = event.data.json()
  const options = {
    body: data.body || "You have a new notification",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    vibrate: [100, 50, 100],
    data: {
      url: data.url || "/",
      dateOfArrival: Date.now(),
    },
    actions: data.actions || [],
    tag: data.tag || "default",
    renotify: !!data.tag,
  }

  event.waitUntil(self.registration.showNotification(data.title || "Stick My Note", options))
})

// Notification click handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  const url = event.notification.data?.url || "/"
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
