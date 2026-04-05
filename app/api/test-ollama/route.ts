import { type NextRequest, NextResponse } from "next/server"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const ollamaUrl = process.env.OLLAMA_BASE_URL || "http://192.168.50.70:11434"

  console.log("[test-ollama] Starting test...")
  console.log("[test-ollama] OLLAMA_BASE_URL:", ollamaUrl)
  console.log("[test-ollama] OLLAMA_MODEL:", process.env.OLLAMA_MODEL)

  const results: any = {
    ollamaUrl,
    model: process.env.OLLAMA_MODEL,
    tests: []
  }

  // Test 1: Simple fetch to /api/tags
  try {
    console.log("[test-ollama] Test 1: Fetching /api/tags...")
    const startTime = Date.now()
    const response = await fetch(`${ollamaUrl}/api/tags`, {
      method: "GET",
      cache: "no-store",
    })
    const duration = Date.now() - startTime
    const data = await response.json()
    results.tests.push({
      name: "GET /api/tags",
      success: true,
      status: response.status,
      duration: `${duration}ms`,
      models: data.models?.map((m: any) => m.name) || [],
    })
    console.log("[test-ollama] Test 1 SUCCESS:", data.models?.map((m: any) => m.name))
  } catch (error: any) {
    console.error("[test-ollama] Test 1 FAILED:", error)
    results.tests.push({
      name: "GET /api/tags",
      success: false,
      error: error.message,
      errorName: error.name,
      errorCause: error.cause ? JSON.stringify(error.cause) : undefined,
    })
  }

  // Test 2: Simple generation
  try {
    console.log("[test-ollama] Test 2: Testing generation...")
    const startTime = Date.now()
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || "llama3.2",
        prompt: "Say hello in one word.",
        stream: false,
        options: {
          num_predict: 10,
        },
      }),
      cache: "no-store",
    })
    const duration = Date.now() - startTime

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    results.tests.push({
      name: "POST /api/generate",
      success: true,
      status: response.status,
      duration: `${duration}ms`,
      response: data.response?.substring(0, 100) || "no response",
    })
    console.log("[test-ollama] Test 2 SUCCESS:", data.response?.substring(0, 50))
  } catch (error: any) {
    console.error("[test-ollama] Test 2 FAILED:", error)
    results.tests.push({
      name: "POST /api/generate",
      success: false,
      error: error.message,
      errorName: error.name,
      errorCause: error.cause ? JSON.stringify(error.cause) : undefined,
    })
  }

  // Test 3: With AbortController (like the real code uses)
  try {
    console.log("[test-ollama] Test 3: Testing with AbortController...")
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const startTime = Date.now()
    const response = await fetch(`${ollamaUrl}/api/tags`, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    })
    clearTimeout(timeoutId)

    const duration = Date.now() - startTime
    await response.json()
    results.tests.push({
      name: "GET /api/tags (with AbortController)",
      success: true,
      status: response.status,
      duration: `${duration}ms`,
    })
    console.log("[test-ollama] Test 3 SUCCESS")
  } catch (error: any) {
    console.error("[test-ollama] Test 3 FAILED:", error)
    results.tests.push({
      name: "GET /api/tags (with AbortController)",
      success: false,
      error: error.message,
      errorName: error.name,
      errorCause: error.cause ? JSON.stringify(error.cause) : undefined,
    })
  }

  console.log("[test-ollama] All tests completed")
  return NextResponse.json(results)
}
