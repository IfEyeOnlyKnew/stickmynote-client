const { createServer } = require("http")
const next = require("next")
const { createWebSocketServer } = require("./lib/ws/ws-server")

const dev = process.env.NODE_ENV !== "production"
const hostname = process.env.HOSTNAME || "localhost"
const port = Number.parseInt(process.env.PORT || "80", 10)

// Initialize Next.js app
const app = next({ dev, hostname, port })
// Prevent Next.js from registering its own upgrade handler on the server.
// Next.js's setupWebSocketHandler() adds an upgrade listener that calls
// handleRequestImpl with the socket as res, corrupting WebSocket connections.
// We handle WebSocket upgrades ourselves in lib/ws/ws-server.js.
app.didWebSocketSetup = true
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    // Skip WebSocket upgrade requests — handled by ws library via upgrade event
    if (req.headers.upgrade) return
    try {
      await handle(req, res)
    } catch (err) {
      console.error("Error occurred handling", req.url, err)
      res.statusCode = 500
      res.end("Internal server error")
    }
  })

  // Attach WebSocket server to the main HTTP server
  createWebSocketServer(server)

  // Refresh materialized views every 5 minutes using a lightweight pool
  const MV_REFRESH_INTERVAL = 5 * 60 * 1000
  /** @type {import('pg').Pool | null} */
  let mvPool = null
  function getMvPool() {
    if (!mvPool) {
      const { Pool } = require("pg")
      mvPool = new Pool({
        host: process.env.POSTGRES_HOST || "localhost",
        port: Number(process.env.POSTGRES_PORT) || 5432,
        database: process.env.POSTGRES_DATABASE || "stickmynote",
        user: process.env.POSTGRES_USER || "stickmynote_user",
        password: process.env.POSTGRES_PASSWORD,
        ssl: process.env.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : false,
        max: 1,
      })
    }
    return mvPool
  }
  setInterval(async () => {
    try {
      await getMvPool().query("REFRESH MATERIALIZED VIEW social_kb_with_metrics")
      console.log("[Server] Materialized view social_kb_with_metrics refreshed")
    } catch {
      // View may not exist or refresh failed — non-critical
    }
  }, MV_REFRESH_INTERVAL)

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
  })
})
