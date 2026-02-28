// @ts-check
/**
 * PostgreSQL LISTEN/NOTIFY pub/sub adapter for cross-process WebSocket broadcasting.
 *
 * Uses a dedicated pg.Client (not from the pool) to maintain a persistent
 * LISTEN connection. When a NOTIFY arrives on the `ws_broadcast` channel,
 * the payload is parsed and routed to the local WebSocket broadcast functions.
 *
 * Payload format: { target: "user"|"org"|"users", id: string|string[], event: WsEvent }
 *
 * PostgreSQL NOTIFY payload limit is ~8000 bytes. Events exceeding 7900 bytes
 * are skipped with a warning.
 */

const CHANNEL = "ws_broadcast"
const MAX_PAYLOAD = 7900
const MAX_RECONNECT_DELAY = 30000

/** @type {import('pg').Client | null} */
let pgClient = null

/** @type {ReturnType<typeof setTimeout> | null} */
let reconnectTimer = null
let reconnectAttempts = 0

/** @type {{ sendToUser: (userId: string, message: string) => void, sendToOrg: (orgId: string, message: string) => void } | null} */
let localBroadcast = null

/** @type {number} */
let eventsPublished = 0

function getPgConfig() {
  return {
    host: process.env.POSTGRES_HOST || "localhost",
    port: Number(process.env.POSTGRES_PORT) || 5432,
    database: process.env.POSTGRES_DATABASE || "stickmynote",
    user: process.env.POSTGRES_USER || "stickmynote_user",
    password: process.env.POSTGRES_PASSWORD,
    ssl: process.env.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : false,
  }
}

/**
 * Register local WebSocket broadcast functions so NOTIFY handler can deliver events.
 * @param {{ sendToUser: (userId: string, message: string) => void, sendToOrg: (orgId: string, message: string) => void }} broadcast
 */
function setLocalBroadcast(broadcast) {
  localBroadcast = broadcast
}

/**
 * Handle incoming PostgreSQL NOTIFY payload.
 * Routes the event to local WebSocket connections via the registered broadcast functions.
 * @param {string | undefined} payload
 */
function handleNotification(payload) {
  if (!localBroadcast || !payload) return
  try {
    const data = JSON.parse(payload)
    const message = JSON.stringify(data.event)

    switch (data.target) {
      case "user":
        localBroadcast.sendToUser(data.id, message)
        break
      case "org":
        localBroadcast.sendToOrg(data.id, message)
        break
      case "users":
        if (Array.isArray(data.ids)) {
          for (const uid of data.ids) {
            localBroadcast.sendToUser(uid, message)
          }
        }
        break
      default:
        console.warn("[PgPubSub] Unknown target type:", data.target)
    }
  } catch (/** @type {any} */ error_) {
    console.error("[PgPubSub] Failed to handle notification:", error_.message)
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return
  pgClient = null

  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY)
  reconnectAttempts++
  console.log(`[PgPubSub] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`)

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null
    try {
      await startListening()
    } catch (/** @type {any} */ error_) {
      console.error("[PgPubSub] Reconnect failed:", error_.message)
      scheduleReconnect()
    }
  }, delay)
}

/**
 * Connect a dedicated pg.Client and LISTEN on the broadcast channel.
 */
async function startListening() {
  if (pgClient) return

  const { Client } = require("pg")
  pgClient = new Client(getPgConfig())

  pgClient.on("error", (err) => {
    console.error("[PgPubSub] Connection error:", err.message)
    pgClient = null
    scheduleReconnect()
  })

  pgClient.on("end", () => {
    console.log("[PgPubSub] Connection ended")
    pgClient = null
    scheduleReconnect()
  })

  pgClient.on("notification", (msg) => {
    if (msg.channel === CHANNEL) {
      handleNotification(msg.payload)
    }
  })

  await pgClient.connect()
  await pgClient.query(`LISTEN ${CHANNEL}`)
  reconnectAttempts = 0
  console.log(`[PgPubSub] Listening on channel: ${CHANNEL}`)
}

/**
 * Publish an event via PostgreSQL NOTIFY to all listening processes.
 * @param {"user" | "org" | "users"} targetType
 * @param {string | string[]} targetId - userId, orgId, or array of userIds
 * @param {object} event - The WsEvent object
 */
async function publish(targetType, targetId, event) {
  const payload = JSON.stringify({
    target: targetType,
    ...(targetType === "users" ? { ids: targetId } : { id: targetId }),
    event,
  })

  if (payload.length > MAX_PAYLOAD) {
    console.warn(`[PgPubSub] Payload too large (${payload.length} bytes), skipping NOTIFY`)
    return
  }

  if (!pgClient) {
    // pg-pubsub not connected — caller should fall back to local broadcast
    throw new Error("PgPubSub not connected")
  }

  await pgClient.query(`SELECT pg_notify($1, $2)`, [CHANNEL, payload])
  eventsPublished++
}

/**
 * Stop listening and close the dedicated connection.
 */
async function stop() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (pgClient) {
    try {
      await pgClient.end()
    } catch {
      // Ignore cleanup errors
    }
    pgClient = null
  }
}

/**
 * Check if the LISTEN connection is active.
 * @returns {boolean}
 */
function isConnected() {
  return pgClient !== null
}

/**
 * Get the number of events published via NOTIFY.
 * @returns {number}
 */
function getEventsPublished() {
  return eventsPublished
}

module.exports = { startListening, publish, setLocalBroadcast, stop, isConnected, getEventsPublished }
