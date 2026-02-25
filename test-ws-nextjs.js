// Test WebSocket WITH Next.js loaded on HTTPS
// Determines if Next.js interferes with WebSocket upgrade
const { createServer } = require("https")
const fs = require("fs")
const path = require("path")
const { WebSocketServer } = require("ws")

const httpsOptions = {
  key: fs.readFileSync(path.join(__dirname, "certs", "server.key")),
  cert: fs.readFileSync(path.join(__dirname, "certs", "server.crt")),
}

// Explicitly set NODE_ENV before loading Next.js
process.env.NODE_ENV = "production"

const next = require("next")
const app = next({ dev: false, hostname: "localhost", port: 443 })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  console.log("[Test] Next.js prepared")

  const server = createServer(httpsOptions, async (req, res) => {
    if (req.headers.upgrade) {
      console.log("[Test] WARNING: request event fired for upgrade request!")
      return
    }
    try {
      await handle(req, res)
    } catch (err) {
      console.error("Error:", err)
      res.statusCode = 500
      res.end("Error")
    }
  })

  console.log("[Test] Listeners after createServer - request:", server.listenerCount("request"), "upgrade:", server.listenerCount("upgrade"))

  const wss = new WebSocketServer({ noServer: true })

  server.on("upgrade", (req, socket, head) => {
    console.log("[Test] Upgrade event for:", req.url)

    if (req.url !== "/ws" && !req.url?.startsWith("/ws?")) {
      socket.destroy()
      return
    }

    console.log("[Test] Socket: writable=%s readable=%s head=%d bytes", socket.writable, socket.readable, head.length)

    wss.handleUpgrade(req, socket, head, (ws) => {
      console.log("[Test] Upgrade complete, sending message")
      ws.send(JSON.stringify({ type: "test", message: "Hello from Next.js + WS!" }))
      ws.on("close", () => console.log("[Test] Disconnected"))
      ws.on("error", (err) => console.log("[Test] Error:", err.message))
    })
  })

  console.log("[Test] Listeners after WS setup - request:", server.listenerCount("request"), "upgrade:", server.listenerCount("upgrade"))

  server.listen(443, () => {
    console.log("[Test] Ready on https://localhost:443")
    console.log("[Test] Listeners after listen - request:", server.listenerCount("request"), "upgrade:", server.listenerCount("upgrade"))
    console.log("[Test] Test: new WebSocket('wss://stickmynote.com/ws') in browser console")
  })
})
