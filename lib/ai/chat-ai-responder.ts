/**
 * AI Chat Responder for Pad Chat
 *
 * Provides AI-powered first response to chat messages.
 * Features:
 * - Contextual responses based on chat history
 * - Escalation detection (knows when to involve humans)
 * - Custom greeting support
 */

import { generateText, isAIAvailable } from "./ai-provider"

interface ChatContext {
  padName: string
  recentMessages: Array<{
    content: string
    is_ai_message: boolean
    user_name?: string
  }>
  aiGreeting?: string
  currentMessage: string
}

interface AIResponse {
  text: string
  shouldEscalate: boolean
  escalationReason?: string
}

// Keywords that suggest user needs human help
const ESCALATION_KEYWORDS = [
  "speak to human",
  "talk to human",
  "real person",
  "human please",
  "human help",
  "speak to someone",
  "talk to someone",
  "escalate",
  "manager",
  "supervisor",
  "complaint",
  "urgent",
  "emergency",
  "frustrated",
  "angry",
  "unacceptable",
  "refund",
  "cancel subscription",
  "delete account",
  "legal",
  "lawyer",
]

/**
 * Check if a message should be escalated to a human
 */
function detectEscalation(message: string): { shouldEscalate: boolean; reason?: string } {
  const lowerMessage = message.toLowerCase()

  for (const keyword of ESCALATION_KEYWORDS) {
    if (lowerMessage.includes(keyword)) {
      return {
        shouldEscalate: true,
        reason: `User message contains escalation indicator: "${keyword}"`,
      }
    }
  }

  // Check for all caps (frustration indicator)
  const capsRatio = (message.match(/[A-Z]/g) || []).length / message.length
  if (message.length > 20 && capsRatio > 0.7) {
    return {
      shouldEscalate: true,
      reason: "Message appears to be written in frustration (mostly caps)",
    }
  }

  // Check for excessive punctuation (frustration indicator)
  const exclamationCount = (message.match(/!/g) || []).length
  const questionCount = (message.match(/\?/g) || []).length
  if (exclamationCount > 3 || questionCount > 3) {
    return {
      shouldEscalate: true,
      reason: "Message contains excessive punctuation indicating frustration",
    }
  }

  return { shouldEscalate: false }
}

/**
 * Generate an AI response to a chat message
 */
export async function generateChatResponse(context: ChatContext): Promise<AIResponse> {
  // First check for escalation triggers
  const escalationCheck = detectEscalation(context.currentMessage)
  if (escalationCheck.shouldEscalate) {
    return {
      text: "I understand you'd like to speak with a team member. Let me notify our moderators right away. Someone will be with you shortly. In the meantime, is there anything else I can help clarify?",
      shouldEscalate: true,
      escalationReason: escalationCheck.reason,
    }
  }

  if (!isAIAvailable()) {
    return {
      text: "I'm sorry, but the AI service is temporarily unavailable. A team member will respond to you shortly.",
      shouldEscalate: true,
      escalationReason: "AI service unavailable",
    }
  }

  // Build conversation context for the AI
  const conversationHistory = context.recentMessages
    .slice(-5) // Last 5 messages for context
    .map((msg) => {
      if (msg.is_ai_message) {
        return `AI Assistant: ${msg.content}`
      }
      return `${msg.user_name || "User"}: ${msg.content}`
    })
    .join("\n")

  const systemPrompt = `You are a helpful AI assistant for the "${context.padName}" chat. You provide friendly, concise, and helpful responses.

Guidelines:
- Keep responses brief (2-3 sentences max) and conversational
- Be helpful and friendly
- If you don't know something specific, be honest about it
- For complex issues, suggest that a team member can help
- Never make up information about products, services, or policies
- Always be respectful and professional

${context.aiGreeting ? 'Your greeting message is: "' + context.aiGreeting + '"' : ""}`

  const prompt = `Recent conversation:
${conversationHistory || "(No previous messages)"}

New message from user: "${context.currentMessage}"

Respond helpfully and concisely:`

  try {
    const { text } = await generateText({
      systemPrompt,
      prompt,
      maxTokens: 200,
      temperature: 0.7,
    })

    // Clean up the response
    let cleanedText = text.trim()

    // Remove any "AI:" or "Assistant:" prefixes the model might add
    cleanedText = cleanedText.replace(/^(AI:|Assistant:|AI Assistant:)\s*/i, "")

    // Check if the AI response itself suggests escalation
    const responseIndicatesEscalation =
      cleanedText.toLowerCase().includes("team member") ||
      cleanedText.toLowerCase().includes("human agent") ||
      cleanedText.toLowerCase().includes("someone will assist") ||
      cleanedText.toLowerCase().includes("i'll connect you")

    return {
      text: cleanedText,
      shouldEscalate: responseIndicatesEscalation,
      escalationReason: responseIndicatesEscalation
        ? "AI response indicated need for human assistance"
        : undefined,
    }
  } catch (error) {
    console.error("[ChatAI] Error generating response:", error)
    return {
      text: "I'm having trouble processing your message right now. A team member will be notified to assist you.",
      shouldEscalate: true,
      escalationReason: `AI generation error: ${error instanceof Error ? error.message : "Unknown error"}`,
    }
  }
}

/**
 * Generate a greeting message for a new chat session
 */
export async function generateGreeting(padName: string, customGreeting?: string): Promise<string> {
  if (customGreeting) {
    return customGreeting
  }

  return `Hello! Welcome to ${padName}. I'm an AI assistant here to help. How can I assist you today?`
}
