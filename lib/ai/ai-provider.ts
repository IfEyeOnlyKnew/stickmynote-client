/**
 * AI Provider Configuration
 *
 * This module provides a unified interface for AI text generation that supports
 * multiple providers. Ollama is the default for maximum privacy.
 *
 * Supported providers:
 * - ollama: Local Ollama models (Maximum privacy - runs on your own hardware) [DEFAULT]
 * - azure: Azure OpenAI Service (Enterprise, private, data stays in your tenant)
 * - anthropic: Anthropic Claude (High-quality, safety-focused)
 *
 * Priority order:
 * 1. Ollama (if configured) - Maximum privacy, runs locally [RECOMMENDED]
 * 2. Azure OpenAI (if configured) - Enterprise/privacy
 * 3. Anthropic Claude (if configured)
 */

import { generateText as aiGenerateText } from "ai"
import { createAzure } from "@ai-sdk/azure"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createOllama } from "ai-sdk-ollama"

// Default timeout for AI operations (60 seconds for slow models)
const AI_TIMEOUT_MS = 60000

/**
 * Wrap a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), ms)
    ),
  ])
}

/**
 * Check if Ollama server is reachable
 */
export async function checkOllamaHealth(): Promise<{ available: boolean; error?: string }> {
  const config = getAIProviderConfig()
  if (!config.ollama) {
    return { available: false, error: "Ollama not configured" }
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(`${config.ollama.baseURL}/api/tags`, {
      method: "GET",
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return { available: false, error: `Ollama returned ${response.status}` }
    }

    return { available: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    if (message.includes("abort")) {
      return { available: false, error: "Ollama server timeout (5s) - server may be unreachable" }
    }
    return { available: false, error: `Cannot connect to Ollama: ${message}` }
  }
}

export type AIProvider = "ollama" | "azure" | "anthropic" | "auto"

interface AIProviderConfig {
  provider: AIProvider
  ollama?: {
    /** Ollama server URL (default: http://localhost:11434) */
    baseURL: string
    /** Model to use (e.g., llama3.2, mistral, codellama) */
    model: string
  }
  azure?: {
    resourceName: string
    deploymentName: string
    apiKey: string
    apiVersion?: string
    /** Custom endpoint URL for private endpoints (e.g., https://your-resource.openai.azure.com) */
    endpoint?: string
  }
  anthropic?: {
    apiKey: string
    model?: string
  }
}

/**
 * Get the current AI provider configuration from environment variables
 */
export function getAIProviderConfig(): AIProviderConfig {
  const preferredProvider = (process.env.AI_PROVIDER || "auto") as AIProvider

  const config: AIProviderConfig = {
    provider: preferredProvider,
  }

  // Ollama (local) configuration - maximum privacy
  if (process.env.OLLAMA_BASE_URL || process.env.OLLAMA_MODEL) {
    config.ollama = {
      baseURL: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
      model: process.env.OLLAMA_MODEL || "llama3.2",
    }
  }

  // Azure OpenAI configuration
  if (process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_RESOURCE_NAME) {
    config.azure = {
      resourceName: process.env.AZURE_OPENAI_RESOURCE_NAME,
      deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-4o",
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-08-01-preview",
      // Custom endpoint for private endpoints - overrides resourceName-based URL
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    }
  }

  // Anthropic Claude configuration
  if (process.env.ANTHROPIC_API_KEY) {
    config.anthropic = {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
    }
  }

  return config
}

/**
 * Determine which provider to use based on configuration and availability
 */
export function getActiveProvider(): AIProvider {
  const config = getAIProviderConfig()

  if (config.provider === "ollama" && config.ollama) {
    return "ollama"
  }

  if (config.provider === "azure" && config.azure) {
    return "azure"
  }

  if (config.provider === "anthropic" && config.anthropic) {
    return "anthropic"
  }

  // Auto mode: prefer Ollama for maximum privacy, then Azure, then Anthropic
  if (config.provider === "auto") {
    if (config.ollama) return "ollama"
    if (config.azure) return "azure"
    if (config.anthropic) return "anthropic"
  }

  throw new Error("No AI provider configured. Set OLLAMA_MODEL, AZURE_OPENAI_API_KEY, or ANTHROPIC_API_KEY.")
}

/**
 * Check if AI services are available
 */
export function isAIAvailable(): boolean {
  const config = getAIProviderConfig()
  return !!(config.ollama || config.azure || config.anthropic)
}

/**
 * Get provider display name for logging/UI
 */
export function getProviderDisplayName(): string {
  const provider = getActiveProvider()
  const config = getAIProviderConfig()
  switch (provider) {
    case "ollama":
      return `Ollama (${config.ollama?.model || "local"})`
    case "azure":
      return "Azure OpenAI (Private)"
    case "anthropic":
      return "Anthropic Claude"
    default:
      return "Unknown"
  }
}

interface GenerateTextOptions {
  prompt: string
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
}

/**
 * Generate text using the configured AI provider
 *
 * This function automatically selects the appropriate provider based on
 * environment configuration. Ollama is preferred for maximum privacy
 * as it runs entirely on your own hardware.
 */
export async function generateText(options: GenerateTextOptions): Promise<{ text: string; provider: AIProvider }> {
  const config = getAIProviderConfig()
  const provider = getActiveProvider()

  if (provider === "ollama" && config.ollama) {
    return generateWithOllama(options, config.ollama)
  }

  if (provider === "azure" && config.azure) {
    return generateWithAzure(options, config.azure)
  }

  if (provider === "anthropic" && config.anthropic) {
    return generateWithAnthropic(options, config.anthropic)
  }

  throw new Error("No AI provider available")
}

async function generateWithOllama(
  options: GenerateTextOptions,
  ollamaConfig: { baseURL: string; model: string },
): Promise<{ text: string; provider: AIProvider }> {
  const ollamaUrl = `${ollamaConfig.baseURL}/api/generate`
  try {
    return await callOllamaDirectAPI(options, ollamaUrl, ollamaConfig.model)
  } catch (directError: any) {
    logOllamaError(directError, ollamaUrl)
    return callOllamaSDKFallback(options, ollamaConfig, directError)
  }
}

async function callOllamaDirectAPI(
  options: GenerateTextOptions,
  ollamaUrl: string,
  model: string,
): Promise<{ text: string; provider: AIProvider }> {
  console.log("[ai-provider] Using direct Ollama API at:", ollamaUrl)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)

  const response = await fetch(ollamaUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt: options.systemPrompt ? `${options.systemPrompt}\n\n${options.prompt}` : options.prompt,
      stream: false,
      options: { num_predict: options.maxTokens || 500, temperature: options.temperature || 0.7 },
    }),
    signal: controller.signal,
    cache: "no-store" as RequestCache,
  })

  clearTimeout(timeoutId)

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Ollama API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  console.log("[ai-provider] Ollama direct API returned successfully")
  return { text: data.response || "", provider: "ollama" }
}

function logOllamaError(error: any, ollamaUrl: string): void {
  console.error("[ai-provider] Direct Ollama API failed:")
  console.error("  - URL:", ollamaUrl)
  console.error("  - Error:", error?.message || "No message")
  console.error("  - Full error:", error)
}

async function callOllamaSDKFallback(
  options: GenerateTextOptions,
  ollamaConfig: { baseURL: string; model: string },
  directError: any,
): Promise<{ text: string; provider: AIProvider }> {
  console.log("[ai-provider] Falling back to AI SDK...")
  try {
    const ollama = createOllama({ baseURL: ollamaConfig.baseURL })

    const result = await withTimeout(
      aiGenerateText({
        model: ollama(ollamaConfig.model) as any,
        prompt: options.prompt,
        maxOutputTokens: options.maxTokens,
        temperature: options.temperature,
        system: options.systemPrompt,
      }),
      AI_TIMEOUT_MS,
      `Ollama request timed out after ${AI_TIMEOUT_MS / 1000}s - server may be slow or unreachable at ${ollamaConfig.baseURL}`,
    )

    return { text: result.text, provider: "ollama" }
  } catch (sdkError) {
    console.error("[ai-provider] AI SDK also failed:", sdkError)
    throw directError
  }
}

async function generateWithAzure(
  options: GenerateTextOptions,
  azureConfig: { apiKey: string; endpoint?: string; resourceName?: string; deploymentName: string },
): Promise<{ text: string; provider: AIProvider }> {
  const config: Parameters<typeof createAzure>[0] = { apiKey: azureConfig.apiKey }

  if (azureConfig.endpoint) {
    config.baseURL = azureConfig.endpoint
  } else {
    config.resourceName = azureConfig.resourceName
  }

  const azure = createAzure(config)
  const result = await aiGenerateText({
    model: azure(azureConfig.deploymentName) as any,
    prompt: options.prompt,
    maxOutputTokens: options.maxTokens,
    temperature: options.temperature,
    system: options.systemPrompt,
  })

  return { text: result.text, provider: "azure" }
}

async function generateWithAnthropic(
  options: GenerateTextOptions,
  anthropicConfig: { apiKey: string; model?: string },
): Promise<{ text: string; provider: AIProvider }> {
  const anthropic = createAnthropic({ apiKey: anthropicConfig.apiKey })
  const result = await aiGenerateText({
    model: anthropic(anthropicConfig.model || "claude-sonnet-4-20250514") as any,
    prompt: options.prompt,
    maxOutputTokens: options.maxTokens,
    temperature: options.temperature,
    system: options.systemPrompt,
  })

  return { text: result.text, provider: "anthropic" }
}

/**
 * Generate tags for content using AI
 */
export async function generateTags(content: string, topic?: string): Promise<string[]> {
  const prompt = `Analyze the following content and generate 3-5 relevant tags (single words or short phrases).

Topic: ${topic || "N/A"}
Content: ${content}

Return ONLY a comma-separated list of tags, nothing else.`

  const { text } = await generateText({ prompt, maxTokens: 100 })

  return text
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0 && tag.length < 30)
    .slice(0, 5)
}

/**
 * Generate search queries for hyperlink generation
 */
export async function generateSearchQueries(content: string, fallbackTags: string[]): Promise<string[]> {
  const prompt = `Based on the following note content, generate 3-5 specific search queries that would help find relevant, useful websites and resources. Focus on actionable, informative content rather than generic searches.

Note content: "${content}"

Return only a JSON array of search query strings, no additional text.

Example response format: ["react hooks tutorial", "javascript best practices 2024", "web development tools"]`

  try {
    const { text } = await generateText({ prompt, maxTokens: 200 })

    const parsed = JSON.parse(text.trim())
    if (Array.isArray(parsed)) {
      return parsed.filter((q) => typeof q === "string" && q.trim().length > 0).slice(0, 5)
    }
  } catch {
    // Fall back to tag-based queries
  }

  return fallbackTags.map((tag) => `${tag} tutorial guide`)
}

/**
 * Summarize content
 */
export async function summarizeContent(content: string, maxLength = 150): Promise<string> {
  const prompt = `Summarize the following content in ${maxLength} characters or less:

${content}

Return ONLY the summary, nothing else.`

  const { text } = await generateText({ prompt, maxTokens: 100 })
  return text.trim().substring(0, maxLength)
}
