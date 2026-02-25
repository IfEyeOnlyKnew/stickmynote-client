// Minimal WebSocket test — no Next.js, just HTTPS + ws
// Run on production server to isolate the issue
const { createServer } = require("https")
const fs = require("fs")
const path = require("path")
const { WebSocketServer } = require("ws")

const httpsOptions = {
  key: fs.readFileSync(path.join(__dirname, "certs", "server.key")),
  cert: fs.readFileSync(path.join(__dirname, "certs", "server.crt")),
}

const server = createServer(httpsOptions, (req, res) => {
  res.writeHead(200, { "Content-Type": "text/html" })
  res.end(`<html><body><h1>WebSocket Test</h1>
<pre id="log"></pre>
<script>
function log(msg) { document.getElementById('log').textContent += msg + '\\n'; }
log('Connecting...');
const ws = new WebSocket('wss://' + location.host + '/ws');
ws.onopen = () => log('OPEN - connected!');
ws.onmessage = (e) => log('MESSAGE: ' + e.data);
ws.onerror = () => log('ERROR');
ws.onclose = (e) => log('CLOSED: code=' + e.code + ' reason=' + e.reason);
</script></body></html>`)
})

const wss = new WebSocketServer({ noServer: true })

server.on("upgrade", (req, socket, head) => {
  if (req.url !== "/ws" && !req.url?.startsWith("/ws?")) {
    socket.destroy()
    return
  }

  console.log("[Test] Upgrade request")
  console.log("[Test] Socket: writable=%s readable=%s", socket.writable, socket.readable)
  console.log("[Test] Head: %d bytes", head.length)

  wss.handleUpgrade(req, socket, head, (ws) => {
    console.log("[Test] Upgrade complete")
    ws.send(JSON.stringify({ type: "test", message: "Hello from WebSocket!" }))

    ws.on("message", (data) => console.log("[Test] Received:", data.toString()))
    ws.on("close", () => console.log("[Test] Client disconnected"))
    ws.on("error", (err) => console.log("[Test] Error:", err.message))
  })
})

server.listen(443, () => {
  console.log("[Test] HTTPS + WebSocket test server on port 443")
  console.log("[Test] Open https://stickmynote.com in browser")
})
