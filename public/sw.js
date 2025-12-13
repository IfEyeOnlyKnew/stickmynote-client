const CACHE_NAME = "stickmynote-v1"
const API_CACHE_NAME = "stickmynote-api-v1"

// Assets to cache immediately
const PRECACHE_ASSETS = ["/", "/manifest.json", "/placeholder-logo.png", "/globals.css"]

// Install event: Cache core assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS)
    }),
  )
  self.skipWaiting()
})

// Activate event: Clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
            return caches.delete(cacheName)
          }
        }),
      )
    }),
  )
  self.clients.claim()
})

// Fetch event: Network First for HTML, Stale-While-Revalidate for API/Assets
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)

  // Handle API requests (Stale-While-Revalidate)
  if (url.pathname.startsWith("/api/")) {
    // Skip non-GET requests for caching to avoid side effects
    if (event.request.method !== "GET") {
      return
    }

    event.respondWith(
      caches.open(API_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request)
            .then((networkResponse) => {
              cache.put(event.request, networkResponse.clone())
              return networkResponse
            })
            .catch(() => {
              // If network fails and no cache, we can't do much for API
              // In a full offline app, we might return a fallback JSON
            })

          return cachedResponse || fetchPromise
        })
      }),
    )
    return
  }

  // Handle Navigation/HTML requests (Network First)
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(event.request)
        })
        .then((response) => {
          return response || caches.match("/") // Fallback to root if offline and page not cached
        }),
    )
    return
  }

  // Handle Static Assets (Stale-While-Revalidate)
  // Images, CSS, JS, etc.
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          cache.put(event.request, networkResponse.clone())
          return networkResponse
        })
        return cachedResponse || fetchPromise
      })
    }),
  )
})

// Background Sync for Offline Edits (Basic Placeholder)
// Note: Full background sync requires robust IndexedDB queueing system
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-tasks") {
    event.waitUntil(
      // Logic to replay queued requests from IndexedDB would go here
      console.log("Background sync triggered"),
    )
  }
})
