const { createServer } = require("node:http")
const next = require("next")
const fs = require("node:fs")
const pathModule = require("node:path")
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

// cspell:ignore openxmlformats officedocument wordprocessingml
app.prepare().then(() => {

  // MIME types for uploaded files
  const UPLOAD_MIME_TYPES = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
    ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
    ".pdf": "application/pdf", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }

  const server = createServer(async (req, res) => {
    // Skip WebSocket upgrade requests — handled by ws library via upgrade event
    if (req.headers.upgrade) return

    // Proxy HTTP requests to LiveKit (for the /validate endpoint the SDK uses on error)
    if (req.url && req.url.startsWith("/livekit-ws/")) {
      const http = require("node:http")
      const targetPath = req.url.replace(/^\/livekit-ws/, "") || "/"
      const livekitHost = process.env.LIVEKIT_PROXY_HOST || "192.168.50.80"
      const livekitPort = Number(process.env.LIVEKIT_PROXY_PORT) || 7880
      const proxyReq = http.request(
        { hostname: livekitHost, port: livekitPort, path: targetPath, method: req.method, headers: { ...req.headers, host: `${livekitHost}:${livekitPort}` } },
        (proxyRes) => { res.writeHead(proxyRes.statusCode, proxyRes.headers); proxyRes.pipe(res) },
      )
      proxyReq.on("error", (err) => { console.error("[LiveKit HTTP Proxy] Error:", err.message); res.statusCode = 502; res.end("LiveKit proxy error") })
      req.pipe(proxyReq)
      return
    }

    // Serve dynamically uploaded files from public/uploads/
    // Next.js production mode only serves files that existed at build time,
    // so we must handle uploads ourselves.
    if (req.url && req.url.startsWith("/uploads/")) {
      const urlPath = req.url.split("?")[0]
      // Prevent directory traversal: resolve and verify path stays within uploads
      const filePath = pathModule.resolve(process.cwd(), "public", urlPath.slice(1))
      const uploadsRoot = pathModule.resolve(process.cwd(), "public", "uploads")
      if (filePath.startsWith(uploadsRoot) && fs.existsSync(filePath)) {
        const ext = pathModule.extname(filePath).toLowerCase()
        res.setHeader("Content-Type", UPLOAD_MIME_TYPES[ext] || "application/octet-stream")
        res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800")
        fs.createReadStream(filePath).pipe(res)
        return
      }
    }

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
