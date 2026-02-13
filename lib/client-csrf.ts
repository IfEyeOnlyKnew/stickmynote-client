// Client-Side CSRF Token Helper
// Provides CSRF token for client-side API requests

"use client"

/**
 * Get CSRF token from cookie or fetch from API
 * Used in client-side components for authenticated requests
 */
export async function getCsrfToken(): Promise<string> {
  // First try to get from cookie
  const cookies = document.cookie.split(";")
  const csrfCookie = cookies.find((c) => c.trim().startsWith("csrf-token="))

  if (csrfCookie) {
    const token = csrfCookie.split("=")[1]
    if (token) {
      return token
    }
  }

  // If not in cookie, fetch from API
  try {
    const response = await fetch("/api/csrf")
    const data = await response.json()
    return data.token || data.csrfToken
  } catch (error) {
    console.error("[CSRF] Failed to get CSRF token:", error)
    throw new Error("Failed to get CSRF token")
  }
}
