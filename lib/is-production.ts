/**
 * Utility to check if the app is running in production
 * Used to hide diagnostic/config routes in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production" && process.env.VERCEL_ENV === "production"
}

/**
 * Utility to check if diagnostic routes should be accessible
 * Returns true in development, preview, and local environments
 */
export function isDiagnosticAccessible(): boolean {
  return !isProduction()
}
