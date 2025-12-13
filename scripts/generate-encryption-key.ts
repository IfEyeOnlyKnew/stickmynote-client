// Run this script to generate a secure encryption key
// The output can be used as ENCRYPTION_MASTER_KEY

import { randomBytes } from "crypto"

const key = randomBytes(32).toString("base64")

console.log("=".repeat(60))
console.log("Generated ENCRYPTION_MASTER_KEY:")
console.log("=".repeat(60))
console.log(key)
console.log("=".repeat(60))
console.log("\nAdd this to your Vercel environment variables:")
console.log(`ENCRYPTION_MASTER_KEY=${key}`)
console.log("\nIMPORTANT: Store this key securely. If lost, encrypted data cannot be recovered.")
