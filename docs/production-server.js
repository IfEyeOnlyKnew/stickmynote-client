const { createServer } = require("node:https")
const { createServer: createHttpServer } = require("node:http")
const next = require("next")
const fs = require("node:fs")
const pathModule = require("node:path")
const { createWebSocketServer } = require("./lib/ws/ws-server")

const dev = process.env.NODE_ENV !== "production"
const hostname = process.env.HOSTNAME || "localhost"
const port = 443
const httpPort = 80

// SSL certificates
const httpsOptions = {
  key: fs.readFileSync(pathModule.join(__dirname, "certs", "server.key")),
  cert: fs.readFileSync(pathModule.join(__dirname, "certs", "server.crt")),
}

// Initialize Next.js app
const app = next({ dev, hostname, port })
// Prevent Next.js from registering its own upgrade handler
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

  const server = createServer(httpsOptions, async (req, res) => {
    // Node.js v24 fires request events for WebSocket upgrades.
    // Neutralize the response so Next.js cannot corrupt the WebSocket socket.
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

  // Attach WebSocket server to the main HTTPS server
  createWebSocketServer(server)

  server.listen(port, () => {
    console.log(`> Ready on https://${hostname}:${port}`)
  })

  // HTTP redirect to HTTPS on port 80
  createHttpServer((req, res) => {
    res.writeHead(301, { Location: `https://${req.headers.host}${req.url}` })
    res.end()
  }).listen(httpPort, () => {
    console.log(`> HTTP redirect on port ${httpPort}`)
  })
})
