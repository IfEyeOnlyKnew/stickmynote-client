/**
 * AES-256-GCM Encryption Utility for Multi-Tenant Data Isolation
 *
 * Provides organization-specific encryption for sensitive data.
 * Uses Web Crypto API for Edge Runtime compatibility.
 */

// Encryption configuration
const ALGORITHM = "AES-GCM"
const KEY_LENGTH = 256
const IV_LENGTH = 12 // 96 bits for GCM
const TAG_LENGTH = 128 // bits

/**
 * Derive an org-specific encryption key from the master key and org_id
 * Uses PBKDF2 for key derivation
 */
async function deriveOrgKey(orgId: string): Promise<CryptoKey> {
  const masterKey = process.env.ENCRYPTION_MASTER_KEY
  if (!masterKey) {
    throw new Error("ENCRYPTION_MASTER_KEY environment variable is not set")
  }

  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(masterKey), "PBKDF2", false, ["deriveKey"])

  // Use org_id as salt for tenant-specific key derivation
  const salt = encoder.encode(`org:${orgId}`)

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"],
  )
}

/**
 * Encrypt data with org-specific AES-256-GCM encryption
 * Returns base64-encoded ciphertext with IV prepended
 */
export async function encryptForOrg(plaintext: string, orgId: string): Promise<string> {
  try {
    const key = await deriveOrgKey(orgId)
    const encoder = new TextEncoder()
    const data = encoder.encode(plaintext)

    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))

    // Encrypt
    const ciphertext = await crypto.subtle.encrypt({ name: ALGORITHM, iv, tagLength: TAG_LENGTH }, key, data)

    // Combine IV + ciphertext
    const combined = new Uint8Array(iv.length + ciphertext.byteLength)
    combined.set(iv, 0)
    combined.set(new Uint8Array(ciphertext), iv.length)

    // Return base64-encoded result
    return btoa(String.fromCodePoint(...combined))
  } catch (error) {
    console.error("[Encryption] Failed to encrypt data:", error)
    throw new Error("Encryption failed")
  }
}

/**
 * Decrypt org-specific AES-256-GCM encrypted data
 */
export async function decryptForOrg(encryptedData: string, orgId: string): Promise<string> {
  try {
    const key = await deriveOrgKey(orgId)

    // Decode base64
    const combined = Uint8Array.from(atob(encryptedData), (c) => c.codePointAt(0)!)

    // Extract IV and ciphertext
    const iv = combined.slice(0, IV_LENGTH)
    const ciphertext = combined.slice(IV_LENGTH)

    // Decrypt
    const decrypted = await crypto.subtle.decrypt({ name: ALGORITHM, iv, tagLength: TAG_LENGTH }, key, ciphertext)

    const decoder = new TextDecoder()
    return decoder.decode(decrypted)
  } catch (error) {
    console.error("[Encryption] Failed to decrypt data:", error)
    throw new Error("Decryption failed - data may be corrupted or key mismatch")
  }
}

/**
 * Encrypt a file/blob with org-specific encryption
 * Returns encrypted ArrayBuffer with IV prepended
 */
export async function encryptFileForOrg(file: ArrayBuffer, orgId: string): Promise<ArrayBuffer> {
  try {
    const key = await deriveOrgKey(orgId)

    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))

    // Encrypt
    const ciphertext = await crypto.subtle.encrypt({ name: ALGORITHM, iv, tagLength: TAG_LENGTH }, key, file)

    // Combine IV + ciphertext
    const combined = new Uint8Array(iv.length + ciphertext.byteLength)
    combined.set(iv, 0)
    combined.set(new Uint8Array(ciphertext), iv.length)

    return combined.buffer
  } catch (error) {
    console.error("[Encryption] Failed to encrypt file:", error)
    throw new Error("File encryption failed")
  }
}

/**
 * Decrypt an org-specific encrypted file
 */
export async function decryptFileForOrg(encryptedFile: ArrayBuffer, orgId: string): Promise<ArrayBuffer> {
  try {
    const key = await deriveOrgKey(orgId)
    const combined = new Uint8Array(encryptedFile)

    // Extract IV and ciphertext
    const iv = combined.slice(0, IV_LENGTH)
    const ciphertext = combined.slice(IV_LENGTH)

    // Decrypt
    return crypto.subtle.decrypt({ name: ALGORITHM, iv, tagLength: TAG_LENGTH }, key, ciphertext)
  } catch (error) {
    console.error("[Encryption] Failed to decrypt file:", error)
    throw new Error("File decryption failed")
  }
}

/**
 * Generate a secure org-prefixed path for blob storage
 * Ensures files are namespaced by organization
 */
export function getOrgPrefixedPath(orgId: string, filename: string): string {
  // Sanitize filename
  const sanitized = filename.replaceAll(/[^a-zA-Z0-9._-]/g, "_")
  // Add timestamp for uniqueness
  const timestamp = Date.now()
  // Create org-namespaced path
  return `orgs/${orgId}/${timestamp}-${sanitized}`
}

/**
 * Check if encryption is enabled (master key is set)
 */
export function isEncryptionEnabled(): boolean {
  return !!process.env.ENCRYPTION_MASTER_KEY
}

/**
 * Hash sensitive data for comparison without decryption
 * Uses SHA-256 with org-specific salt
 */
export async function hashForOrg(data: string, orgId: string): Promise<string> {
  const encoder = new TextEncoder()
  const saltedData = encoder.encode(`${orgId}:${data}`)

  const hashBuffer = await crypto.subtle.digest("SHA-256", saltedData)
  const hashArray = new Uint8Array(hashBuffer)

  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}
