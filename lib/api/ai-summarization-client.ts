// Client-side API functions for AI Summarization operations

import type {
  GenerateSummaryRequest,
  GenerateSummaryResponse,
  AskPadQuestionRequest,
  AskPadQuestionResponse,
  AIChangelogEntry,
} from "@/lib/types/social-collaboration"

export class AISummarizationAPI {
  /**
   * Generate AI summary for a stick
   */
  static async generateSummary(request: GenerateSummaryRequest): Promise<GenerateSummaryResponse> {
    const response = await fetch(`/api/inference-sticks/${request.stick_id}/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    })
    if (!response.ok) {
      throw new Error("Failed to generate summary")
    }
    return response.json()
  }

  /**
   * Get AI summary changelog for a stick
   */
  static async getSummaryHistory(stickId: string): Promise<AIChangelogEntry[]> {
    const response = await fetch(`/api/inference-sticks/${stickId}/summary-history`)
    if (!response.ok) {
      throw new Error("Failed to fetch summary history")
    }
    return response.json()
  }

  /**
   * Ask a question about pad content
   */
  static async askPadQuestion(request: AskPadQuestionRequest): Promise<AskPadQuestionResponse> {
    const response = await fetch(`/api/inference-pads/${request.pad_id}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    })
    if (!response.ok) {
      throw new Error("Failed to ask question")
    }
    return response.json()
  }

  /**
   * Get Q&A history for a pad
   */
  static async getQAHistory(padId: string, limit = 20) {
    const response = await fetch(`/api/inference-pads/${padId}/qa-history?limit=${limit}`)
    if (!response.ok) {
      throw new Error("Failed to fetch Q&A history")
    }
    return response.json()
  }

  /**
   * Provide feedback on Q&A answer
   */
  static async submitQAFeedback(qaId: string, wasHelpful: boolean, feedbackText?: string): Promise<void> {
    const response = await fetch(`/api/inference-pads/qa/${qaId}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ was_helpful: wasHelpful, feedback_text: feedbackText }),
    })
    if (!response.ok) {
      throw new Error("Failed to submit feedback")
    }
  }
}
