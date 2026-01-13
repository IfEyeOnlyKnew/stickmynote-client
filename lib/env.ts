import { z } from "zod"

/**
 * Environment Variable Validation
 *
 * This file validates all environment variables at runtime to ensure
 * the application fails fast if required configuration is missing.
 *
 * SECURITY BEST PRACTICES:
 * 1. NEVER hardcode secrets in code
 * 2. Use environment variables for all sensitive data
 * 3. Validate all env vars at startup
 * 4. Use type-safe access to prevent typos
 * 5. Mark sensitive vars as non-enumerable in production
 *
 * IMPORTANT: Only import this file in SERVER-SIDE code:
 * - API routes (app/api/**)
 * - Server components
 * - Server-side utilities (lib/**)
 * - Middleware
 *
 * DO NOT import in client components or client-side code.
 */

if (typeof window !== "undefined") {
  throw new Error(
    "lib/env.ts should only be imported in server-side code. " +
      "Use process.env.NEXT_PUBLIC_* directly in client components.",
  )
}

const isProduction = process.env.NODE_ENV === "production"
const isVercel = process.env.VERCEL === "1"

const serverSchema = z.object({
  // Database (PostgreSQL) - REQUIRED
  DATABASE_URL: z.string().optional(),
  POSTGRES_URL: z.string().url().optional(),
  POSTGRES_PRISMA_URL: z.string().url().optional(),
  POSTGRES_URL_NON_POOLING: z.string().url().optional(),
  POSTGRES_USER: z.string().optional(),
  POSTGRES_PASSWORD: z.string().optional(),
  POSTGRES_DATABASE: z.string().optional(),
  POSTGRES_HOST: z.string().optional(),

  // Authentication (Local JWT)
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters").optional(),

  // Redis (Upstash) - OPTIONAL but recommended for production
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  KV_URL: z.string().url().optional(),
  KV_REST_API_URL: z.string().url().optional(),
  KV_REST_API_TOKEN: z.string().optional(),
  KV_REST_API_READ_ONLY_TOKEN: z.string().optional(),
  REDIS_URL: z.string().url().optional(),

  // AI Services - OPTIONAL
  // Provider selection: "auto" | "ollama" | "azure" | "anthropic"
  // Note: "ollama" is recommended for maximum privacy (runs on your own hardware)
  AI_PROVIDER: z.enum(["auto", "ollama", "azure", "anthropic"]).optional(),

  // Ollama (local AI - maximum privacy, runs on your own hardware)
  OLLAMA_BASE_URL: z.string().url().optional(),
  OLLAMA_MODEL: z.string().optional(),

  // Azure OpenAI (recommended for enterprise privacy - data stays in your tenant)
  AZURE_OPENAI_RESOURCE_NAME: z.string().optional(),
  AZURE_OPENAI_DEPLOYMENT_NAME: z.string().optional(),
  AZURE_OPENAI_API_KEY: z.string().optional(),
  AZURE_OPENAI_API_VERSION: z.string().optional(),
  // Custom endpoint for Azure Private Endpoints (maximum privacy)
  AZURE_OPENAI_ENDPOINT: z.string().url().optional(),

  // Anthropic Claude (high-quality, safety-focused)
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),

  // Email (Resend) - OPTIONAL
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),

  // Storage (Vercel Blob) - OPTIONAL
  BLOB_READ_WRITE_TOKEN: z.string().optional(),

  // Security - REQUIRED
  CSRF_SECRET: z
    .string()
    .min(32, "CSRF_SECRET must be at least 32 characters for security")
    .refine((val) => {
      // Ensure it's not a weak/default value
      const weakSecrets = ["your-secret-here", "change-me", "secret", "password"]
      return !weakSecrets.includes(val.toLowerCase())
    }, "CSRF_SECRET must not be a default/weak value"),
  LOGIN_ACCESS_CODE: z.string().optional(),

  // API Keys - OPTIONAL
  BRAVE_API_KEY: z.string().optional(),
  DAILY_API_KEY: z.string().optional(),

  // Sentry (Error Tracking) - OPTIONAL
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),

  // Feature Flags - OPTIONAL
  RATE_LIMIT_FORCE_MEMORY: z.string().optional(),
  DISABLE_RATE_LIMIT_REDIS: z.string().optional(),
  BUILD_STANDALONE: z.string().optional(),
  ANALYZE: z.string().optional(),

  // Build Info - OPTIONAL
  BUILD_ID: z.string().optional(),

  // Public URLs - OPTIONAL but recommended
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  NEXT_PUBLIC_DAILY_DOMAIN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),

  NODE_ENV: z.enum(["development", "production", "test"]).optional(),
  VERCEL: z.string().optional(),
  VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
})

function validateProductionEnv(env: z.infer<typeof serverSchema>) {
  if (!isProduction) return

  const productionRequired = {
    CSRF_SECRET: env.CSRF_SECRET,
    DATABASE_URL: env.DATABASE_URL || env.POSTGRES_URL,
    NEXT_PUBLIC_SITE_URL: env.NEXT_PUBLIC_SITE_URL,
  }

  const missing = Object.entries(productionRequired)
    .filter(([_, value]) => !value)
    .map(([key]) => key)

  if (missing.length > 0) {
    throw new Error(
      `Production deployment missing critical environment variables: ${missing.join(", ")}\n` +
        "These variables are required for secure production operation.",
    )
  }

  // Warn about missing optional but recommended vars
  const recommended = {
    UPSTASH_REDIS_REST_URL: env.UPSTASH_REDIS_REST_URL,
    RESEND_API_KEY: env.RESEND_API_KEY,
    SENTRY_DSN: env.SENTRY_DSN,
  }

  const missingRecommended = Object.entries(recommended)
    .filter(([_, value]) => !value)
    .map(([key]) => key)

  if (missingRecommended.length > 0) {
    console.warn(
      `⚠️  Production deployment missing recommended environment variables: ${missingRecommended.join(", ")}\n` +
        "Consider adding these for better functionality.",
    )
  }
}

// Validate environment variables
function validateEnv() {
  try {
    const parsed = serverSchema.parse(process.env)

    validateProductionEnv(parsed)

    if (!isProduction) {
      console.log("✅ Environment variables validated successfully")
    }

    return parsed
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map((err) => `  - ${err.path.join(".")}: ${err.message}`).join("\n")

      console.error("❌ Invalid environment variables:\n" + missingVars)

      // In development, log warning but don't crash
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "\n⚠️  Continuing in development mode with missing env vars\n" +
            "⚠️  Copy .env.example to .env.local and fill in the required values\n",
        )
        return process.env as unknown as z.infer<typeof serverSchema>
      }

      // In production, crash immediately
      throw new Error(
        `Invalid environment variables:\n${missingVars}\n\n` +
          "Please ensure all required environment variables are set in your deployment platform.",
      )
    }
    throw error
  }
}

export function getEnvVar(key: keyof Env, fallback?: string): string {
  const value = env[key]
  if (value === undefined || value === null || value === "") {
    if (fallback !== undefined) {
      return fallback
    }
    if (isProduction) {
      throw new Error(`Required environment variable ${key} is not set`)
    }
    console.warn(`⚠️  Environment variable ${key} is not set, using empty string`)
    return ""
  }
  return value as string
}

export function hasEnvVar(key: keyof Env): boolean {
  const value = env[key]
  return value !== undefined && value !== null && value !== ""
}

// Export validated environment variables
export const env = validateEnv()

// Type-safe environment variable access
export type Env = z.infer<typeof serverSchema>
