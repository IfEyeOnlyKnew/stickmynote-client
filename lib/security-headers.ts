export interface SecurityHeaders {
  "Content-Security-Policy": string
  "X-Content-Type-Options": string
  "X-Frame-Options": string
  "X-XSS-Protection": string
  "Strict-Transport-Security": string
  "Referrer-Policy": string
  "Permissions-Policy": string
  "Cross-Origin-Embedder-Policy": string
  "Cross-Origin-Opener-Policy": string
  "Cross-Origin-Resource-Policy": string
}

export function getSecurityHeaders(): SecurityHeaders {
  const isDevelopment = process.env.NODE_ENV === "development"

  // Note: When nonce is present, browsers ignore 'unsafe-inline', which breaks Next.js inline scripts
  const scriptSrcDirective =
    `'self' 'unsafe-inline' ${isDevelopment ? "'unsafe-eval'" : ""} https://static.cloudflareinsights.com`.trim()

  const cspDirectives = [
    "default-src 'self'",
    `script-src ${scriptSrcDirective}`,
    `script-src-elem ${scriptSrcDirective}`,
    "worker-src 'self' blob:",
    // CDN-READY: Add CDN origin to style-src when deploying a CDN (e.g., https://cdn.stickmynote.com)
    "style-src 'self' 'unsafe-inline'",
    // Fonts are self-hosted via next/font/google — no external font sources needed
    // CDN-READY: Add CDN origin to font-src when deploying a CDN
    "font-src 'self' data: https://r2cdn.perplexity.ai",
    // CDN-READY: Add CDN origin to img-src when deploying a CDN
    "img-src 'self' data: blob: https://i.ytimg.com https://img.youtube.com https://i.vimeocdn.com https://*.vimeo.com https://*.cloudfront.net https://*.canva.com https://*.imgur.com https://*.googleusercontent.com",
    "media-src 'self' blob: https://www.youtube.com https://player.vimeo.com https://rumble.com https://*.rumble.com https://www.loom.com https://*.loom.com",
    `connect-src 'self' https://*.upstash.io https://www.youtube.com https://vimeo.com https://*.vimeo.com ${isDevelopment ? "http://localhost:* ws://localhost:* wss://localhost:* http://127.0.0.1:* ws://127.0.0.1:* wss://127.0.0.1:*" : "wss://stickmynote.com"}`.trim(),
    "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://youtube.com https://player.vimeo.com https://rumble.com https://*.rumble.com https://www.loom.com https://*.loom.com https://www.figma.com https://figma.com https://docs.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
  ]

  return {
    "Content-Security-Policy": cspDirectives.join("; "),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": isDevelopment ? "max-age=0" : "max-age=63072000; includeSubDomains; preload",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": [
      "camera=(self)",
      "microphone=(self)",
      "geolocation=()",
      "interest-cohort=()",
      "payment=()",
      "usb=()",
      "magnetometer=()",
      "midi=()",
      "sync-xhr=()",
      "xr-spatial-tracking=()",
      'picture-in-picture=(self "https://www.youtube.com" "https://www.youtube-nocookie.com" "https://player.vimeo.com" "https://rumble.com" "https://www.loom.com" "https://www.figma.com" "https://docs.google.com")',
      'autoplay=(self "https://www.youtube.com" "https://www.youtube-nocookie.com" "https://player.vimeo.com" "https://rumble.com" "https://www.loom.com" "https://www.figma.com" "https://docs.google.com")',
      'accelerometer=(self "https://www.youtube.com" "https://www.youtube-nocookie.com" "https://player.vimeo.com" "https://rumble.com" "https://www.loom.com" "https://www.figma.com" "https://docs.google.com")',
      'gyroscope=(self "https://www.youtube.com" "https://www.youtube-nocookie.com" "https://player.vimeo.com" "https://rumble.com" "https://www.loom.com" "https://www.figma.com" "https://docs.google.com")',
      'clipboard-write=(self "https://www.youtube.com" "https://www.youtube-nocookie.com" "https://player.vimeo.com" "https://rumble.com" "https://www.loom.com" "https://www.figma.com" "https://docs.google.com")',
      "clipboard-read=(self)",
      'fullscreen=(self "https://www.youtube.com" "https://www.youtube-nocookie.com" "https://player.vimeo.com" "https://rumble.com" "https://www.loom.com" "https://www.figma.com" "https://docs.google.com")',
      "screen-wake-lock=()",
      "display-capture=(self)",
    ].join(", "),
    "Cross-Origin-Embedder-Policy": "unsafe-none",
    "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    // CDN-READY: Change to "cross-origin" when serving assets from a CDN subdomain
    "Cross-Origin-Resource-Policy": "same-site",
  }
}

export function applySecurityHeaders(response: Response): Response {
  const headers = getSecurityHeaders()

  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  return response
}

export function generateNonce(): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    return Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64")
  }
  // Fallback for environments without crypto.getRandomValues
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}
