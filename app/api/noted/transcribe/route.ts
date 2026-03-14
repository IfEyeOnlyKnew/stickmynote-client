import { type NextRequest, NextResponse } from "next/server"
import { applyRateLimit } from "@/lib/rate-limiter-enhanced"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

async function safeRateLimit(request: NextRequest, userId: string, action: string) {
  try {
    const res = await applyRateLimit(request, userId, action)
    return res.success
  } catch {
    return true
  }
}

// POST /api/noted/transcribe - Transcribe audio via Whisper on Ollama
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const allowed = await safeRateLimit(request, user.id, "noted_transcribe")
    if (!allowed) return createRateLimitResponse()

    const formData = await request.formData()
    const audioFile = formData.get("audio") as File | null

    if (!audioFile) {
      return NextResponse.json({ error: "Audio file required" }, { status: 400 })
    }

    // Limit file size to 25MB
    if (audioFile.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "Audio file too large (max 25MB)" }, { status: 400 })
    }

    const ollamaUrl = process.env.OLLAMA_URL || "http://192.168.50.70:11434"

    // Convert audio to base64 for Whisper
    const arrayBuffer = await audioFile.arrayBuffer()
    const base64Audio = Buffer.from(arrayBuffer).toString("base64")

    try {
      // Try Whisper model on Ollama
      const whisperRes = await fetch(`${ollamaUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "whisper",
          prompt: "Transcribe the following audio:",
          images: [base64Audio],
          stream: false,
        }),
      })

      if (whisperRes.ok) {
        const data = await whisperRes.json()
        return NextResponse.json({
          data: {
            text: data.response || "",
            duration: audioFile.size / 16000, // rough estimate
          },
        })
      }
    } catch (whisperErr) {
      console.error("Whisper transcription failed:", whisperErr)
    }

    // Fallback: Use Ollama's general model to describe audio intent
    // (Whisper may not be installed yet)
    return NextResponse.json({
      data: {
        text: "",
        error: "Whisper model not available. Install with: ollama pull whisper",
      },
    })
  } catch (err) {
    console.error("Failed to transcribe audio:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
