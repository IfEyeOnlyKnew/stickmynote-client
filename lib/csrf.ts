// CSRF protection using Web Crypto API (Edge Runtime compatible)

const CSRF_SECRET = process.env.CSRF_SECRET
if (!CSRF_SECRET) {
  throw new Error("CSRF_SECRET environment variable is required")
}

function stringToArrayBuffer(str: string): ArrayBuffer {
  const encoder = new TextEncoder()
  const arr = encoder.encode(str)
  return arr.buffer.slice(0) // Ensures ArrayBuffer, not SharedArrayBuffer
}

// Convert Uint8Array to hex string
function uint8ArrayToHex(arr: Uint8Array): string {
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

// Convert hex string to Uint8Array
function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.substr(i, 2), 16)
  }
  return bytes
}

// Generate random token
function generateRandomToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return uint8ArrayToHex(array)
}

// Create HMAC signature using Web Crypto API
async function createHMAC(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    stringToArrayBuffer(secret), // Use stringToArrayBuffer for proper type
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )

  const signature = await crypto.subtle.sign("HMAC", key, stringToArrayBuffer(message)) // Use stringToArrayBuffer for proper type

  return uint8ArrayToHex(new Uint8Array(signature))
}

// Verify HMAC signature
async function verifyHMAC(message: string, signature: string, secret: string): Promise<boolean> {
  const expectedSignature = await createHMAC(message, secret)
  return expectedSignature === signature
}

export async function generateCSRFToken(): Promise<string> {
  const token = generateRandomToken()
  const timestamp = Date.now().toString()
  const payload = `${token}.${timestamp}`
  const signature = await createHMAC(payload, CSRF_SECRET!)

  return `${payload}.${signature}`
}

export async function validateCSRFToken(token: string): Promise<boolean> {
  if (!token) return false

  try {
    const parts = token.split(".")
    if (parts.length !== 3) return false

    const [tokenPart, timestamp, signature] = parts
    const payload = `${tokenPart}.${timestamp}`

    // Verify signature
    const isValidSignature = await verifyHMAC(payload, signature, CSRF_SECRET!)
    if (!isValidSignature) return false

    // Check if token is not expired (24 hours)
    const tokenTime = Number.parseInt(timestamp)
    const now = Date.now()
    const maxAge = 24 * 60 * 60 * 1000 // 24 hours

    return now - tokenTime < maxAge
  } catch (error) {
    console.error("CSRF token validation error:", error)
    return false
  }
}

export function getCSRFTokenFromRequest(request: Request): string | null {
  // Try header first
  const headerToken = request.headers.get("x-csrf-token")
  if (headerToken) return headerToken

  // Try cookie
  const cookieHeader = request.headers.get("cookie")
  if (cookieHeader) {
    const cookies = cookieHeader.split(";").map((c) => c.trim())
    const csrfCookie = cookies.find((c) => c.startsWith("csrf-token="))
    if (csrfCookie) {
      return csrfCookie.split("=")[1]
    }
  }

  return null
}

export async function validateCSRFMiddleware(request: Request): Promise<boolean> {
  // Skip CSRF validation for safe methods
  const method = request.method
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    return true
  }

  // Validate CSRF token for state-changing methods
  const token = getCSRFTokenFromRequest(request)
  if (!token) {
    console.warn("[CSRF] No CSRF token found in request")
    return false
  }

  const isValid = await validateCSRFToken(token)
  if (!isValid) {
    console.warn("[CSRF] Invalid CSRF token")
  }

  return isValid
}
