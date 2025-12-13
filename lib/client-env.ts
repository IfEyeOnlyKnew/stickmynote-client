/**
 * Client-safe environment checks
 *
 * This file provides safe ways to check environment variables in client components.
 * Use these instead of directly accessing process.env in client code.
 */

// Safe check for development mode in client components
export const isDevelopment = typeof process !== "undefined" && process.env.NODE_ENV === "development"

// Safe check for production mode in client components
export const isProduction = typeof process !== "undefined" && process.env.NODE_ENV === "production"

// Get public environment variables safely
export function getPublicEnv(key: string): string | undefined {
  if (typeof window === "undefined") {
    // Server-side
    return process.env[key]
  }
  // Client-side - only NEXT_PUBLIC_ vars are available
  return process.env[key]
}
