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

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
  })
})
