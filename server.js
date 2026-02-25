const { createServer } = require("http")
const next = require("next")
const { createWebSocketServer } = require("./lib/ws/ws-server")

const dev = process.env.NODE_ENV !== "production"
const hostname = process.env.HOSTNAME || "localhost"
const port = Number.parseInt(process.env.PORT || "80", 10)

// Initialize Next.js app
const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
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
