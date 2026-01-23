import { generateText } from "@/lib/ai/ai-provider"

/**
 * AIService - Unified AI service for Stick My Note
 * 
 * Uses the configured AI provider (Ollama by default for maximum privacy).
 * All AI operations go through this service.
 */
export class AIService {
  /**
   * Generate tags for stick content using configured AI provider
   */
  static async generateTags(content: string, topic?: string): Promise<string[]> {
    try {
      const prompt = `Analyze the following content and generate 3-5 relevant tags (single words or short phrases).

Topic: ${topic || "N/A"}
Content: ${content}

Return ONLY a comma-separated list of tags, nothing else.`

      const { text } = await generateText({
        prompt,
        maxTokens: 100,
      })

      // Parse tags from response
      const tags = text
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0 && tag.length < 30)
        .slice(0, 5)

      return tags
    } catch (error) {
      console.error("[AIService] Error generating tags:", error)
      return []
    }
  }

  /**
   * Summarize stick content using configured AI provider
   */
  static async summarizeContent(content: string, maxLength = 150): Promise<string> {
    try {
      const prompt = `Summarize the following content in ${maxLength} characters or less:

${content}

Return ONLY the summary, nothing else.`

      const { text } = await generateText({
        prompt,
        maxTokens: 100,
      })

      return text.trim().substring(0, maxLength)
    } catch (error) {
      console.error("[AIService] Error summarizing content:", error)
      return content.substring(0, maxLength) + "..."
    }
  }

  /**
   * Analyze content similarity to detect duplicates
   */
  static async checkDuplicate(
    newContent: string,
    existingContents: Array<{ id: string; content: string; topic?: string }>,
  ): Promise<{ isDuplicate: boolean; similarTo?: string; similarity?: number }> {
    try {
      if (existingContents.length === 0) {
        return { isDuplicate: false }
      }

      const prompt = `Analyze if the new content is similar or duplicate to any of the existing contents.

New Content: "${newContent}"

Existing Contents:
${existingContents.map((item, idx) => `${idx + 1}. (ID: ${item.id}) ${item.topic ? `Topic: ${item.topic} - ` : ""}${item.content}`).join("\n")}

Respond in this exact format:
DUPLICATE: [yes/no]
SIMILAR_TO_ID: [ID or none]
SIMILARITY: [0-100 percentage or 0]

Be strict - only mark as duplicate if content is very similar (>80% match).`

      const { text } = await generateText({
        prompt,
        maxTokens: 150,
      })

      // Parse response
      const duplicateMatch = text.match(/DUPLICATE:\s*(yes|no)/i)
      const idMatch = text.match(/SIMILAR_TO_ID:\s*(\S+)/i)
      const similarityMatch = text.match(/SIMILARITY:\s*(\d+)/i)

      const isDuplicate = duplicateMatch?.[1]?.toLowerCase() === "yes"
      const similarTo = idMatch?.[1] !== "none" ? idMatch?.[1] : undefined
      const similarity = similarityMatch?.[1] ? Number.parseInt(similarityMatch[1]) : 0

      return {
        isDuplicate,
        similarTo,
        similarity,
      }
    } catch (error) {
      console.error("[AIService] Error checking duplicate:", error)
      return { isDuplicate: false }
    }
  }

  /**
   * Generate smart reply suggestions based on stick content
   */
  static async suggestReplies(stickContent: string, stickTopic?: string): Promise<string[]> {
    try {
      const prompt = `Given the following stick, suggest 3 helpful reply suggestions that someone might want to add:

Topic: ${stickTopic || "N/A"}
Content: ${stickContent}

Return ONLY 3 reply suggestions, one per line, nothing else.`

      const { text } = await generateText({
        prompt,
        maxTokens: 200,
      })

      const suggestions = text
        .split("\n")
        .map((line) => line.replace(/^\d+\.\s*/, "").trim())
        .filter((line) => line.length > 0 && line.length < 200)
        .slice(0, 3)

      return suggestions
    } catch (error) {
      console.error("[AIService] Error generating reply suggestions:", error)
      return []
    }
  }

  /**
   * Analyze sentiment of content
   */
  static async analyzeSentiment(content: string): Promise<{
    sentiment: "positive" | "neutral" | "negative"
    confidence: number
  }> {
    try {
      const prompt = `Analyze the sentiment of the following content:

"${content}"

Respond in this exact format:
SENTIMENT: [positive/neutral/negative]
CONFIDENCE: [0-100 percentage]`

      const { text } = await generateText({
        prompt,
        maxTokens: 50,
      })

      const sentimentMatch = text.match(/SENTIMENT:\s*(positive|neutral|negative)/i)
      const confidenceMatch = text.match(/CONFIDENCE:\s*(\d+)/i)

      const sentiment = (sentimentMatch?.[1]?.toLowerCase() as any) || "neutral"
      const confidence = confidenceMatch?.[1] ? Number.parseInt(confidenceMatch[1]) : 50

      return { sentiment, confidence }
    } catch (error) {
      console.error("[AIService] Error analyzing sentiment:", error)
      return { sentiment: "neutral", confidence: 50 }
    }
  }

  /**
   * Auto-categorize stick into a category
   */
  static async categorizeStick(content: string, topic: string, availableCategories: string[]): Promise<string | null> {
    try {
      const prompt = `Categorize the following stick into one of the available categories:

Topic: ${topic}
Content: ${content}

Available Categories:
${availableCategories.map((cat, idx) => `${idx + 1}. ${cat}`).join("\n")}

Return ONLY the category name that best fits, or "none" if no good match. Return nothing else.`

      const { text } = await generateText({
        prompt,
        maxTokens: 50,
      })

      const category = text.trim().toLowerCase()
      const matchedCategory = availableCategories.find((cat) => cat.toLowerCase() === category)

      return matchedCategory || null
    } catch (error) {
      console.error("[AIService] Error categorizing stick:", error)
      return null
    }
  }

  /**
   * Generate a live summary of a stick and its replies
   */
  static async generateLiveSummary(params: {
    topic: string
    content: string
    replies: Array<{ content: string; author: string; created_at: string }>
  }): Promise<string> {
    try {
      const replyContext = params.replies
        .map((r, idx) => `${idx + 1}. ${r.author} (${new Date(r.created_at).toLocaleDateString()}): ${r.content}`)
        .join("\n")

      const prompt = `Summarize this discussion thread into a concise brief (max 200 characters).

Topic: ${params.topic}
Initial Content: ${params.content}

Discussion (${params.replies.length} replies):
${replyContext || "No replies yet"}

Focus on: current status, key decisions, blockers, and next steps. Be concise and actionable.
Return ONLY the summary, nothing else.`

      const { text } = await generateText({
        prompt,
        maxTokens: 150,
      })

      return text.trim().substring(0, 300)
    } catch (error) {
      console.error("Error generating live summary:", error)
      return ""
    }
  }

  /**
   * Extract action items from discussion
   */
  static async extractActionItems(params: {
    topic: string
    content: string
    replies: Array<{ content: string; author: string }>
  }): Promise<Array<{ title: string; owner: string; status: string; due_hint?: string }>> {
    try {
      const allContent = [
        `Topic: ${params.topic}`,
        `Content: ${params.content}`,
        ...params.replies.map((r) => `${r.author}: ${r.content}`),
      ].join("\n")

      const prompt = `Extract action items from this discussion. Look for task language like "I'll...", "Need to...", "Should...", etc.

${allContent}

Return action items in this exact format (one per line):
ACTION: [title] | OWNER: [name] | STATUS: [pending/in-progress/done] | DUE: [hint or "none"]

If no action items found, return "NONE".`

      const { text } = await generateText({
        prompt,
        maxTokens: 300,
      })

      if (text.trim().toUpperCase() === "NONE") {
        return []
      }

      // Parse action items
      const actions: Array<{ title: string; owner: string; status: string; due_hint?: string }> = []
      const lines = text.split("\n").filter((line) => line.trim().startsWith("ACTION:"))

      for (const line of lines) {
        const titleMatch = line.match(/ACTION:\s*([^|]+)/)
        const ownerMatch = line.match(/OWNER:\s*([^|]+)/)
        const statusMatch = line.match(/STATUS:\s*([^|]+)/)
        const dueMatch = line.match(/DUE:\s*([^|]+)/)

        if (titleMatch && ownerMatch && statusMatch) {
          actions.push({
            title: titleMatch[1].trim(),
            owner: ownerMatch[1].trim(),
            status: statusMatch[1].trim().toLowerCase(),
            due_hint: dueMatch?.[1]?.trim() !== "none" ? dueMatch?.[1]?.trim() : undefined,
          })
        }
      }

      return actions.slice(0, 10) // Max 10 action items
    } catch (error) {
      console.error("Error extracting action items:", error)
      return []
    }
  }

  /**
   * Generate next best questions to keep discussion moving
   */
  static async generateNextQuestions(params: {
    topic: string
    content: string
    summary: string
    sentiment?: string
  }): Promise<string[]> {
    try {
      const prompt = `Based on this discussion, suggest 3 relevant follow-up questions to keep the conversation moving.

Topic: ${params.topic}
Summary: ${params.summary}
Sentiment: ${params.sentiment || "neutral"}

Generate questions that:
- Address gaps or uncertainties
- Clarify next steps
- Identify blockers
- Validate decisions

Return ONLY 3 questions, one per line, nothing else.`

      const { text } = await generateText({
        prompt,
        maxTokens: 200,
      })

      const questions = text
        .split("\n")
        .map((q) => q.replace(/^\d+\.\s*/, "").trim())
        .filter((q) => q.length > 10 && q.length < 200 && q.endsWith("?"))
        .slice(0, 3)

      return questions
    } catch (error) {
      console.error("Error generating next questions:", error)
      return []
    }
  }

  /**
   * Answer questions about a pad's sticks using context
   */
  static async answerPadQuestion(params: {
    question: string
    sticks: Array<{
      topic: string
      content: string
      summary?: string
      replies?: Array<{
        content: string
        category?: string
        is_calstick?: boolean
        calstick_status?: string
        calstick_completed?: boolean
        user_name?: string
      }>
    }>
  }): Promise<{ answer: string; citations: Array<{ topic: string; relevance: string }> }> {
    try {
      const context = params.sticks
        .map((s, idx) => {
          let stickContext = `[${idx + 1}] Topic: ${s.topic}\nContent: ${s.content}`
          if (s.summary) {
            stickContext += `\nSummary: ${s.summary}`
          }
          if (s.replies && s.replies.length > 0) {
            // Count reply types for clarity
            const calstickCount = s.replies.filter(r => r.is_calstick).length
            const regularCount = s.replies.length - calstickCount
            stickContext += `\nReplies (${s.replies.length} total: ${regularCount} discussion replies, ${calstickCount} task items):`

            s.replies.forEach((r) => {
              const author = r.user_name || "Someone"
              const contentPreview = r.content.substring(0, 200) + (r.content.length > 200 ? "..." : "")

              if (r.is_calstick) {
                // This is a task/CalStick
                const status = r.calstick_completed ? "COMPLETED" : (r.calstick_status || "Pending")
                stickContext += `\n  - [TASK] ${author}: "${contentPreview}" (Status: ${status})`
              } else {
                // This is a regular discussion reply
                const categoryInfo = r.category && r.category !== "Default" ? ` [${r.category}]` : ""
                stickContext += `\n  - [REPLY] ${author}: "${contentPreview}"${categoryInfo}`
              }
            })
          } else {
            stickContext += `\nReplies: None yet`
          }
          return stickContext
        })
        .join("\n\n")

      const prompt = `Answer this question about the project based on the discussion threads below.

Question: ${params.question}

Understanding the data:
- Each numbered item [1], [2], etc. is a "Stick" (a discussion topic/thread)
- [REPLY] entries are discussion comments from team members
- [TASK] entries are action items/tasks with completion status

Discussion Threads:
${context}

Instructions:
- Focus on what team members actually said in their replies
- Pay attention to who said what
- Distinguish between completed tasks vs pending tasks vs discussion comments
- Do NOT assume all replies are tasks - most are regular discussion comments

Provide:
1. A clear, specific answer (2-3 sentences) based on the actual discussion content
2. Citations: List which stick numbers [1], [2], etc. are most relevant

Format:
ANSWER: [your answer]
CITATIONS: [1], [3] - [brief relevance note]`

      const { text } = await generateText({
        prompt,
        maxTokens: 400,
      })

      // Parse response - using [\s\S] instead of 's' flag for dotall behavior
      const answerMatch = text.match(/ANSWER:\s*([\s\S]+?)(?=CITATIONS:|$)/)
      const citationsMatch = text.match(/CITATIONS:\s*([\s\S]+)/)

      const answer = answerMatch?.[1]?.trim() || text.trim()
      const citations: Array<{ topic: string; relevance: string }> = []

      if (citationsMatch) {
        const citationText = citationsMatch[1]
        const numbers = citationText.match(/\[(\d+)\]/g) || []
        const relevance = citationText
          .replace(/\[\d+\]/g, "")
          .replace(/[,-]/g, "")
          .trim()

        numbers.forEach((num) => {
          const index = Number.parseInt(num.replace(/[[\]]/g, "")) - 1
          if (index >= 0 && index < params.sticks.length) {
            citations.push({
              topic: params.sticks[index].topic,
              relevance: relevance || "Relevant to question",
            })
          }
        })
      }

      return { answer, citations }
    } catch (error) {
      console.error("[AIService] Error answering pad question:", error)
      return {
        answer: "I couldn't process your question. Please try rephrasing it.",
        citations: [],
      }
    }
  }
}

// Backwards compatibility alias - will be removed in future version
/** @deprecated Use AIService instead */
export const GrokService = AIService
