const crypto = require("crypto")

// Generate a strong CSRF secret
function generateCSRFSecret() {
  // Generate 64 bytes (512 bits) of random data
  const secret = crypto.randomBytes(64).toString("hex")

  return secret
}

// Run the generator
generateCSRFSecret()
