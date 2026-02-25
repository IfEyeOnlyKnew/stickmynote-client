// @ts-check
/**
 * WebSocket server module (CommonJS — required by server.js)
 * Handles real-time push events via in-process broadcasting
 *
 * Runs on its own dedicated port (WS_PORT, default 3001) to avoid
 * upgrade event conflicts with Next.js + Node.js v24 HTTPS servers.
 */
const { WebSocketServer } = require("ws")

/** @type {Map<string, Set<import('ws').WebSocket>>} */
const connections = new Map()

/** @type {import('ws').WebSocketServer | null} */
let wss = null

const HEARTBEAT_INTERVAL = 30000

/** @type {import('pg').Pool | null} */
let dbPool = null

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
    } catch (dbErr) {
      console.error("[WebSocket] Failed to fetch org memberships:", dbErr.message)
    }

    return { userId, orgIds }
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
 * Create a standalone WebSocket server on its own port.
 *
 * This avoids upgrade event conflicts with Next.js + Node.js v24 HTTPS servers
 * by running WebSocket on a dedicated HTTP/HTTPS server.
 *
 * @param {Object} [options]
 * @param {Object} [options.httpsOptions] - TLS key/cert for production (wss://)
 */
function createWebSocketServer(options = {}) {
  const wsPort = Number(process.env.WS_PORT) || 3001

  // Create a dedicated server for WebSocket traffic
  let wsHttpServer
  if (options.httpsOptions) {
    const https = require("https")
    wsHttpServer = https.createServer(options.httpsOptions)
    console.log(`[WebSocket] Creating dedicated HTTPS server on port ${wsPort}`)
  } else {
    const http = require("http")
    wsHttpServer = http.createServer()
    console.log(`[WebSocket] Creating dedicated HTTP server on port ${wsPort}`)
  }

  wss = new WebSocketServer({
    server: wsHttpServer,
    path: "/ws",
    verifyClient: (info, callback) => {
      const token = parseSessionToken(info.req)
      if (!token) {
        console.log("[WebSocket] Rejected: no session cookie")
        callback(false, 401, "Unauthorized")
        return
      }

      verifyToken(token)
        .then((auth) => {
          if (!auth) {
            console.log("[WebSocket] Rejected: token verification failed")
            callback(false, 401, "Unauthorized")
            return
          }
          // Store auth data on request for connection handler
          info.req.wsAuth = auth
          console.log(`[WebSocket] Verified user: ${auth.userId}`)
          callback(true)
        })
        .catch((err) => {
          console.error("[WebSocket] Auth error:", err.message)
          callback(false, 500, "Internal Server Error")
        })
    },
  })

  // Register in-process broadcast functions
  registerBroadcast()

  // Handle new connections
  wss.on("connection", (ws, req) => {
    const auth = req.wsAuth || {}
    const userId = auth.userId || "unknown"
    const orgIds = auth.orgIds || []

    ws.userId = userId
    ws.orgIds = orgIds
    ws.isAlive = true

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

  // Start listening on the dedicated port
  wsHttpServer.listen(wsPort, () => {
    console.log(`[WebSocket] Server listening on port ${wsPort} (path: /ws)`)
  })

  return {
    wss,
    connections,
    totalConnections,
  }
}

module.exports = { createWebSocketServer }
