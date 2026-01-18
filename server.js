const { createServer } = require("https")
const { createServer: createHttpServer } = require("http")
const { parse } = require("url")
const next = require("next")
const fs = require("fs")
const path = require("path")

const dev = process.env.NODE_ENV !== "production"
const hostname = process.env.HOSTNAME || "localhost"
const port = 443
const httpPort = 80

// SSL certificates
const httpsOptions = {
  key: fs.readFileSync(path.join(__dirname, "certs", "server.key")),
  cert: fs.readFileSync(path.join(__dirname, "certs", "server.crt")),
}

// Initialize Next.js app
const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  // HTTPS server on port 443
  createServer(httpsOptions, async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error("Error occurred handling", req.url, err)
      res.statusCode = 500
      res.end("Internal server error")
    }
  }).listen(port, () => {
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
