// @ts-check
/**
 * WebSocket server module (CommonJS — required by server.js)
 * Handles real-time push events via cross-process broadcasting.
 *
 * Broadcasting routes through PostgreSQL LISTEN/NOTIFY (pg-pubsub) so
 * multiple Node.js processes can share events. Falls back to local-only
 * delivery if pg-pubsub is unavailable.
 *
 * Attaches to the main HTTP/HTTPS server on the same port.
 */
const { WebSocketServer } = require("ws")
const net = require("node:net")
const pgPubSub = require("./pg-pubsub")

// LiveKit proxy target (internal network, plain WS)
const LIVEKIT_PROXY_HOST = process.env.LIVEKIT_PROXY_HOST || "192.168.50.80"
const LIVEKIT_PROXY_PORT = Number(process.env.LIVEKIT_PROXY_PORT) || 7880

/**
 * Proxy a WebSocket upgrade request to the internal LiveKit server.
 * Strips the /livekit-ws prefix and forwards raw TCP frames.
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('net').Socket} clientSocket
 * @param {Buffer} head
 */
function proxyLiveKitWebSocket(req, clientSocket, head) {
  // Rewrite path: /livekit-ws/rtc/v1?token=... → /rtc/v1?token=...
  const targetPath = req.url.replace(/^\/livekit-ws/, "") || "/"

  const upstreamSocket = net.connect(LIVEKIT_PROXY_PORT, LIVEKIT_PROXY_HOST, () => {
    // Build the HTTP upgrade request to send to LiveKit
    const lines = [`GET ${targetPath} HTTP/1.1`, `Host: ${LIVEKIT_PROXY_HOST}:${LIVEKIT_PROXY_PORT}`]

    // Forward all client headers except Host (we set our own)
    for (const key of Object.keys(req.headers)) {
      if (key.toLowerCase() === "host") continue
      const value = req.headers[key]
      if (value !== undefined) {
        lines.push(`${key}: ${Array.isArray(value) ? value.join(", ") : value}`)
      }
    }

    lines.push("", "") // blank line terminates HTTP headers
    upstreamSocket.write(lines.join("\r\n"))

    // Forward any initial data from the client
    if (head && head.length > 0) {
      upstreamSocket.write(head)
    }
  })

  // Buffer upstream data until we see the full HTTP 101 response
  let responseBuffer = Buffer.alloc(0)
  let handshakeComplete = false

  upstreamSocket.on("data", (chunk) => {
    if (handshakeComplete) {
      clientSocket.write(chunk)
      return
    }

    responseBuffer = Buffer.concat([responseBuffer, chunk])
    const headerEnd = responseBuffer.indexOf("\r\n\r\n")
    if (headerEnd === -1) return // Haven't received full headers yet

    handshakeComplete = true

    // Forward the entire HTTP 101 response to the client
    clientSocket.write(responseBuffer)
    responseBuffer = Buffer.alloc(0)

    // Pipe bidirectionally for all future data
    clientSocket.pipe(upstreamSocket)
  })

  upstreamSocket.on("error", (err) => {
    console.error("[LiveKit Proxy] Upstream error:", err.message)
    clientSocket.destroy()
  })

  upstreamSocket.on("close", () => {
    clientSocket.destroy()
  })

  clientSocket.on("error", (err) => {
    console.error("[LiveKit Proxy] Client error:", err.message)
    upstreamSocket.destroy()
  })

  clientSocket.on("close", () => {
    upstreamSocket.destroy()
  })

  console.log(`[LiveKit Proxy] Proxying WebSocket: ${targetPath.split("?")[0]}`)
}

/**
 * Extended WebSocket with custom properties for auth and heartbeat.
 * @typedef {import('ws').WebSocket & { userId?: string, orgIds?: string[], isAlive?: boolean }} ExtWebSocket
 */

/** @type {Map<string, Set<ExtWebSocket>>} */
const connections = new Map()

/** @type {import('ws').WebSocketServer | null} */
let wss = null

const HEARTBEAT_INTERVAL = 30000
const MAX_CONNECTIONS_PER_USER = 5

/** @type {import('pg').Pool | null} */
let dbPool = null

const metrics = {
  startedAt: Date.now(),
  eventsBroadcast: 0,
}

/**
 * Get a database connection pool for org membership lookups
 * @returns {import('pg').Pool}
 */
function getDbPool() {
  if (!dbPool) {
    const { Pool } = require("pg")
    dbPool = new Pool({
      host: process.env.POSTGRES_HOST || "localhost",
      port: Number(process.env.POSTGRES_PORT) || 5432,
      database: process.env.POSTGRES_DATABASE || "stickmynote",
      user: process.env.POSTGRES_USER || "stickmynote_user",
      password: process.env.POSTGRES_PASSWORD,
      ssl: process.env.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : false,
      max: 3,
    })
  }
  return dbPool
}

/**
 * Parse session cookie from upgrade request headers
 * @param {import('http').IncomingMessage} req
 * @returns {string | null}
 */
function parseSessionToken(req) {
  const cookieHeader = req.headers.cookie
  if (!cookieHeader) return null

  const cookies = cookieHeader.split(";")
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.trim().split("=")
    if (name === "session") {
      return rest.join("=")
    }
  }
  return null
}

/**
 * Verify JWT token and look up org memberships from database
 * @param {string} token
 * @returns {Promise<{userId: string, orgIds: string[]} | null>}
 */
async function verifyToken(token) {
  try {
    const { jwtVerify } = await import("jose")
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || "default-secret-change-in-production"
    )
    const { payload } = await jwtVerify(token, secret)
    if (!payload.userId) return null

    const userId = /** @type {string} */ (payload.userId)

    // Look up org memberships from database
    let orgIds = []
    try {
      const pool = getDbPool()
      const result = await pool.query(
        `SELECT org_id FROM organization_members WHERE user_id = $1 AND status = 'active'`,
        [userId]
      )
      orgIds = result.rows.map((r) => r.org_id)
    } catch (/** @type {any} */ error_) {
      console.error("[WebSocket] Failed to fetch org memberships:", error_.message)
    }

    return { userId, orgIds }
  } catch (/** @type {any} */ error_) {
    console.error("[WebSocket] Token verification failed:", error_.message)
    return null
  }
}

/**
 * Send a message to a specific user's connections
 * @param {string} userId
 * @param {string} message
 */
function sendToUser(userId, message) {
  const userSockets = connections.get(userId)
  if (!userSockets) return

  for (const ws of userSockets) {
    if (ws.readyState === 1) {
      ws.send(message)
    }
  }
}

/**
 * Send a message to all connections subscribed to an org
 * @param {string} orgId
 * @param {string} message
 */
function sendToOrg(orgId, message) {
  for (const [, sockets] of connections) {
    for (const ws of sockets) {
      if (ws.readyState === 1 && ws.orgIds?.includes(orgId)) {
        ws.send(message)
      }
    }
  }
}

/**
 * Get connection counts grouped by org.
 * @returns {Record<string, number>}
 */
function getConnectionsPerOrg() {
  /** @type {Record<string, number>} */
  const orgCounts = {}
  for (const [, sockets] of connections) {
    for (const ws of sockets) {
      if (ws.orgIds) {
        for (const orgId of ws.orgIds) {
          orgCounts[orgId] = (orgCounts[orgId] || 0) + 1
        }
      }
    }
  }
  return orgCounts
}

/**
 * Get total connection count.
 * @returns {number}
 */
function totalConnections() {
  let count = 0
  for (const [, sockets] of connections) {
    count += sockets.size
  }
  return count
}

/**
 * Get WebSocket server metrics.
 * @returns {object}
 */
function getMetrics() {
  return {
    totalConnections: totalConnections(),
    uniqueUsers: connections.size,
    connectionsPerOrg: getConnectionsPerOrg(),
    uptimeMs: Date.now() - metrics.startedAt,
    eventsBroadcast: metrics.eventsBroadcast,
    pgPubSubConnected: pgPubSub.isConnected(),
    pgPubSubEventsPublished: pgPubSub.getEventsPublished(),
  }
}

/**
 * Register broadcast functions on globalThis so API routes
 * (running in the same Node.js process) can push events.
 *
 * Routes through PostgreSQL NOTIFY for cross-process delivery.
 * Falls back to local-only if pg-pubsub is unavailable.
 */
function registerBroadcast() {
  /** @type {{ sendToUser: (userId: string, event: object) => void, sendToOrg: (orgId: string, event: object) => void, sendToUsers: (userIds: string[], event: object) => void }} */
  const broadcast = {
    sendToUser: (userId, event) => {
      metrics.eventsBroadcast++
      pgPubSub.publish("user", userId, event).catch(() => {
        // Fallback to local-only broadcast
        try {
          sendToUser(userId, JSON.stringify(event))
        } catch (/** @type {any} */ error_) {
          console.error("[WebSocket] Local broadcast to user failed:", error_.message)
        }
      })
    },
    sendToOrg: (orgId, event) => {
      metrics.eventsBroadcast++
      pgPubSub.publish("org", orgId, event).catch(() => {
        // Fallback to local-only broadcast
        try {
          sendToOrg(orgId, JSON.stringify(event))
        } catch (/** @type {any} */ error_) {
          console.error("[WebSocket] Local broadcast to org failed:", error_.message)
        }
      })
    },
    sendToUsers: (userIds, event) => {
      metrics.eventsBroadcast++
      pgPubSub.publish("users", userIds, event).catch(() => {
        // Fallback to local-only broadcast
        try {
          const message = JSON.stringify(event)
          for (const userId of userIds) {
            sendToUser(userId, message)
          }
        } catch (/** @type {any} */ error_) {
          console.error("[WebSocket] Local broadcast to users failed:", error_.message)
        }
      })
    },
  }
  // @ts-ignore -- extending globalThis for cross-module communication
  globalThis.__wsBroadcast = broadcast
  console.log("[WebSocket] Cross-process broadcast registered via PgPubSub")
}

/**
 * Enforce per-user connection limit by evicting oldest connections.
 * @param {string} userId
 * @param {ExtWebSocket} currentWs - The newly connected socket (don't evict this one)
 */
function enforceConnectionLimit(userId, currentWs) {
  const userSockets = connections.get(userId)
  if (!userSockets || userSockets.size <= MAX_CONNECTIONS_PER_USER) return

  const excess = userSockets.size - MAX_CONNECTIONS_PER_USER
  let evicted = 0
  for (const oldWs of userSockets) {
    if (evicted >= excess) break
    if (oldWs !== currentWs) {
      oldWs.close(4000, "Connection limit exceeded")
      userSockets.delete(oldWs)
      evicted++
      console.log(`[WebSocket] Evicted old connection for user ${userId} (limit: ${MAX_CONNECTIONS_PER_USER})`)
    }
  }
}

/**
 * Create and attach WebSocket server to an existing HTTP/HTTPS server.
 * Uses the ws library's built-in server attachment (handles upgrade internally).
 *
 * @param {import('http').Server | import('https').Server} server
 */
function createWebSocketServer(server) {
  wss = new WebSocketServer({ noServer: true })
  metrics.startedAt = Date.now()

  // Handle upgrade requests — complete upgrade IMMEDIATELY (synchronously)
  // before Node.js v24's request handler can make the socket non-writable.
  // Auth happens after the WebSocket is established.
  server.on("upgrade", (req, socket, head) => {
    // LiveKit WebSocket proxy: forward to internal LiveKit SFU
    if (req.url?.startsWith("/livekit-ws/")) {
      proxyLiveKitWebSocket(req, socket, head)
      return
    }

    if (req.url !== "/ws" && !req.url?.startsWith("/ws?")) {
      socket.destroy()
      return
    }

    // Complete the upgrade synchronously — socket is still writable here
    // @ts-ignore -- wss is guaranteed non-null within createWebSocketServer
    wss.handleUpgrade(req, socket, head, (/** @type {ExtWebSocket} */ ws) => {
      // Authenticate AFTER the WebSocket connection is established
      const token = parseSessionToken(req)
      if (!token) {
        console.log("[WebSocket] Rejected: no session cookie")
        ws.close(1008, "Unauthorized")
        return
      }

      verifyToken(token)
        .then((auth) => {
          if (!auth) {
            console.log("[WebSocket] Rejected: invalid token")
            ws.close(1008, "Unauthorized")
            return
          }

          console.log(`[WebSocket] Connected: ${auth.userId}`)
          ws.userId = auth.userId
          ws.orgIds = auth.orgIds
          ws.isAlive = true

          // Add to connection map
          if (!connections.has(auth.userId)) {
            connections.set(auth.userId, new Set())
          }
          const userSockets = connections.get(auth.userId)
          if (userSockets) {
            userSockets.add(ws)
          }

          // Enforce per-user connection limit
          enforceConnectionLimit(auth.userId, ws)

          // Send connection confirmation
          ws.send(JSON.stringify({ type: "connected", payload: { userId: auth.userId } }))
        })
        .catch((/** @type {any} */ error_) => {
          console.error("[WebSocket] Auth error:", error_.message)
          ws.close(1011, "Internal Error")
        })
    })
  })

  // Register cross-process broadcast functions
  registerBroadcast()

  // Register local broadcast functions with pg-pubsub and start listening
  pgPubSub.setLocalBroadcast({ sendToUser, sendToOrg })
  pgPubSub.startListening().catch((/** @type {any} */ error_) => {
    console.error("[WebSocket] PgPubSub failed to start:", error_.message)
    console.log("[WebSocket] Falling back to local-only broadcasting")
  })

  // Set up event listeners on every new WebSocket (authed or not)
  wss.on("connection", (/** @type {ExtWebSocket} */ ws) => {
    // Handle pong (heartbeat response)
    ws.on("pong", () => {
      ws.isAlive = true
    })

    // Handle incoming messages from client
    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString())
        if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }))
        }
      } catch {
        // Ignore malformed messages
      }
    })

    // Handle disconnect
    ws.on("close", () => {
      const userId = ws.userId || "unknown"
      console.log(`[WebSocket] Client disconnected: ${userId}`)
      const userSockets = connections.get(userId)
      if (userSockets) {
        userSockets.delete(ws)
        if (userSockets.size === 0) {
          connections.delete(userId)
        }
      }
    })

    ws.on("error", (err) => {
      console.error(`[WebSocket] Error for ${ws.userId || "unknown"}:`, err.message)
    })
  })

  // Heartbeat: ping all clients every 30s, terminate dead connections
  const heartbeatInterval = setInterval(() => {
    if (!wss) return
    wss.clients.forEach((/** @type {ExtWebSocket} */ ws) => {
      if (ws.isAlive === false) {
        console.log(`[WebSocket] Terminating dead connection: ${ws.userId}`)
        return ws.terminate()
      }
      ws.isAlive = false
      ws.ping()
    })
  }, HEARTBEAT_INTERVAL)

  wss.on("close", () => {
    clearInterval(heartbeatInterval)
    pgPubSub.stop().catch(() => {})
  })

  // Expose metrics on globalThis for the admin endpoint
  // @ts-ignore -- extending globalThis for cross-module communication
  globalThis.__wsMetrics = { getMetrics }

  console.log("[WebSocket] Server attached on /ws path")

  return {
    wss,
    connections,
    totalConnections,
    getMetrics,
  }
}

module.exports = { createWebSocketServer }
