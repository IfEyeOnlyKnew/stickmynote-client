const CACHE_VERSION = 4
const CACHE_NAME = `stickmynote-v${CACHE_VERSION}`
const API_CACHE_NAME = `stickmynote-api-v${CACHE_VERSION}`
const OFFLINE_PAGE = "/offline"

// Assets to cache immediately on install
const PRECACHE_ASSETS = ["/", "/manifest.json", "/offline"]

// Install event: Cache core assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS)
    }),
  )
  self.skipWaiting()
})

// Activate event: Clean up old caches and notify clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
              return caches.delete(cacheName)
            }
          }),
        )
      })
      .then(() => {
        // Notify all clients that SW has been updated
        return self.clients.matchAll({ type: "window" }).then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: "SW_UPDATED", version: CACHE_VERSION })
          })
        })
      }),
  )
  self.clients.claim()
})

// Fetch event: Network First for HTML, Stale-While-Revalidate for API/Assets
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)

  // Skip non-http(s) requests
  if (!url.protocol.startsWith("http")) return

  // Handle API requests (Stale-While-Revalidate)
  if (url.pathname.startsWith("/api/")) {
    // Skip non-GET requests for caching to avoid side effects
    if (event.request.method !== "GET") return

    // Never cache auth endpoints — stale auth responses cause redirect loops
    if (url.pathname.startsWith("/api/auth/")) return

    event.respondWith(
      caches.open(API_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse.ok) {
                cache.put(event.request, networkResponse.clone())
              }
              return networkResponse
            })
            .catch(() => cachedResponse)

          return cachedResponse || fetchPromise
        })
      }),
    )
    return
  }

  // Handle Navigation/HTML requests (Network First with offline fallback)
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache successful navigation responses
          if (response.ok) {
            const responseClone = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone)
            })
          }
          return response
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => {
            return cached || caches.match(OFFLINE_PAGE) || caches.match("/")
          })
        }),
    )
    return
  }

  // Handle Static Assets (Stale-While-Revalidate)
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.ok) {
              cache.put(event.request, networkResponse.clone())
            }
            return networkResponse
          })
          .catch(() => cachedResponse)
        return cachedResponse || fetchPromise
      })
    }),
  )
})

// Background Sync for Offline Edits
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-offline-actions") {
    event.waitUntil(syncOfflineActions())
  }
})

async function syncOfflineActions() {
  // Open IndexedDB to get queued actions
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
      // Remove successful action from queue
      const deleteTx = db.transaction("offline-actions", "readwrite")
      deleteTx.objectStore("offline-actions").delete(action.id)
    } catch {
      // Will retry on next sync
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
      // Focus existing window if available
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      // Open new window
      return self.clients.openWindow(url)
    }),
  )
})
