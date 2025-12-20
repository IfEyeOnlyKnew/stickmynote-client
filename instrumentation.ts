export async function register() {
  // Server and edge instrumentation can be added here if needed
  // Sentry has been removed
  
  if (process.env.NEXT_RUNTIME === "browser") {
    await import("./instrumentation-client")
  }
}
