/**
 * Extract domain from email address
 * @param email - Email address (e.g., chris.doran@magna.com)
 * @returns Domain (e.g., magna.com)
 */
export function extractDomain(email: string): string | null {
  if (!email || typeof email !== "string") {
    return null
  }

  const emailParts = email.trim().toLowerCase().split("@")
  if (emailParts.length !== 2) {
    return null
  }

  const domain = emailParts[1]

  // Validate domain format
  if (!domain || domain.length < 3 || !domain.includes(".")) {
    return null
  }

  return domain
}

/**
 * Generate organization name from domain
 * @param domain - Email domain (e.g., magna.com)
 * @returns Organization name (e.g., Magna)
 */
export function generateOrgNameFromDomain(domain: string): string {
  if (!domain) return "My Organization"

  // Remove TLD and capitalize
  const parts = domain.split(".")
  const name = parts[0]

  return name.charAt(0).toUpperCase() + name.slice(1)
}

/**
 * Check if domain is a public email provider
 * @param domain - Email domain
 * @returns True if public provider
 */
export function isPublicEmailDomain(domain: string): boolean {
  const publicDomains = [
    "gmail.com",
    "yahoo.com",
    "hotmail.com",
    "outlook.com",
    "icloud.com",
    "aol.com",
    "mail.com",
    "protonmail.com",
    "zoho.com",
    "yandex.com",
    "gmx.com",
    "live.com",
    "msn.com",
    "me.com",
    "mac.com",
  ]

  return publicDomains.includes(domain.toLowerCase())
}

/**
 * Determine hub_mode based on email domain
 * Corporate emails get full_access, personal emails get personal_only
 * @param email - User email address
 * @returns hub_mode value
 */
export function determineHubModeFromEmail(email: string): "personal_only" | "full_access" {
  const domain = extractDomain(email)

  if (!domain) {
    return "personal_only"
  }

  // Public/personal email domains get personal_only mode
  if (isPublicEmailDomain(domain)) {
    return "personal_only"
  }

  // Corporate/organization emails get full_access mode
  return "full_access"
}
