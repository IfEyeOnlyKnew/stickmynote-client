// @ts-check
/**
 * WebSocket server module (CommonJS — required by server.js)
 * Handles real-time push events via in-process broadcasting
 *
 * Since this is a single-server deployment, events are broadcast
 * directly from API routes to connected WebSocket clients via
 * globalThis.__wsBroadcast (no external message broker needed).
 */
const { WebSocketServer } = require("ws")

/** @type {Map<string, Set<import('ws').WebSocket>>} */
const connections = new Map()

/** @type {import('ws').WebSocketServer | null} */
let wss = null

const HEARTBEAT_INTERVAL = 30000

/**
 * Parse session_token cookie from upgrade request headers
 * @param {import('http').IncomingMessage} req
 * @returns {string | null}
 */
function parseSessionToken(req) {
  const cookieHeader = req.headers.cookie
  if (!cookieHeader) return null

  const cookies = cookieHeader.split(";")
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.trim().split("=")
    if (name === "session_token") {
      return rest.join("=")
    }
  }
  return null
}

/**
 * Verify JWT token using jose (ESM dynamic import)
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

    // Get user's org memberships for org-level channels
    let orgIds = []
    if (payload.orgIds && Array.isArray(payload.orgIds)) {
      orgIds = payload.orgIds
    }

    return { userId: /** @type {string} */ (payload.userId), orgIds }
  } catch (error) {
    console.error("[WebSocket] Token verification failed:", error.message)
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
      if (ws.readyState === 1 && ws.orgIds && ws.orgIds.includes(orgId)) {
        ws.send(message)
      }
    }
  }
}

/**
 * Register broadcast functions on globalThis so API routes
 * (running in the same Node.js process) can push events directly.
 */
function registerBroadcast() {
  globalThis.__wsBroadcast = {
    sendToUser: (userId, event) => {
      try {
        sendToUser(userId, JSON.stringify(event))
      } catch (err) {
        console.error("[WebSocket] Broadcast to user failed:", err.message)
      }
    },
    sendToOrg: (orgId, event) => {
      try {
        sendToOrg(orgId, JSON.stringify(event))
      } catch (err) {
        console.error("[WebSocket] Broadcast to org failed:", err.message)
      }
    },
    sendToUsers: (userIds, event) => {
      try {
        const message = JSON.stringify(event)
        for (const userId of userIds) {
          sendToUser(userId, message)
        }
      } catch (err) {
        console.error("[WebSocket] Broadcast to users failed:", err.message)
      }
    },
  }
  console.log("[WebSocket] In-process broadcast registered on globalThis")
}

/**
 * Create and attach WebSocket server to an HTTP/HTTPS server
 * @param {import('http').Server | import('https').Server} server
 */
function createWebSocketServer(server) {
  wss = new WebSocketServer({ noServer: true })

  // Register in-process broadcast functions
  registerBroadcast()

  // Handle upgrade requests
  server.on("upgrade", async (req, socket, head) => {
    // Only handle /ws path
    const url = new URL(req.url || "/", `http://${req.headers.host}`)
    if (url.pathname !== "/ws") {
      socket.destroy()
      return
    }

    // Authenticate
    const token = parseSessionToken(req)
    if (!token) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n")
      socket.destroy()
      return
    }

    const auth = await verifyToken(token)
    if (!auth) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n")
      socket.destroy()
      return
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.userId = auth.userId
      ws.orgIds = auth.orgIds
      ws.isAlive = true
      wss.emit("connection", ws, req)
    })
  })

  // Handle new connections
  wss.on("connection", (ws) => {
    const userId = ws.userId
    const orgIds = ws.orgIds || []

    console.log(`[WebSocket] Client connected: ${userId} (${orgIds.length} orgs)`)

    // Add to connection map
    if (!connections.has(userId)) {
      connections.set(userId, new Set())
    }
    connections.get(userId).add(ws)

    // Send connection confirmation
    ws.send(JSON.stringify({ type: "connected", payload: { userId } }))

    // Handle pong (heartbeat response)
    ws.on("pong", () => {
      ws.isAlive = true
    })

    // Handle incoming messages from client
    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString())
        // Handle client-initiated messages (e.g., presence heartbeat)
        if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }))
        }
      } catch {
        // Ignore malformed messages
      }
    })

    // Handle disconnect
    ws.on("close", () => {
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
      console.error(`[WebSocket] Error for ${userId}:`, err.message)
    })
  })

  // Heartbeat: ping all clients every 30s, terminate dead connections
  const heartbeatInterval = setInterval(() => {
    if (!wss) return
    wss.clients.forEach((ws) => {
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
  })

  const totalConnections = () => {
    let count = 0
    for (const [, sockets] of connections) {
      count += sockets.size
    }
    return count
  }

  console.log("[WebSocket] Server started on /ws path (in-process broadcast, no Redis)")

  return {
    wss,
    connections,
    totalConnections,
  }
}

module.exports = { createWebSocketServer }
