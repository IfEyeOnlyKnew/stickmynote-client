// Client-side API functions for Knowledge Base operations

import type {
  KnowledgeBaseArticle,
  CreateKBArticleRequest,
  UpdateKBArticleRequest,
  SearchKBRequest,
  KBHistoryVersion,
} from "@/lib/types/social-collaboration"

export class KnowledgeBaseAPI {
  /**
   * Fetch all KB articles for a pad
   */
  static async getArticles(padId: string): Promise<KnowledgeBaseArticle[]> {
    const response = await fetch(`/api/social-pads/${padId}/knowledge-base`)
    if (!response.ok) {
      throw new Error("Failed to fetch KB articles")
    }
    return response.json()
  }

  /**
   * Get a single KB article by ID
   */
  static async getArticle(padId: string, articleId: string): Promise<KnowledgeBaseArticle> {
    const response = await fetch(`/api/social-pads/${padId}/knowledge-base/${articleId}`)
    if (!response.ok) {
      throw new Error("Failed to fetch KB article")
    }
    return response.json()
  }

  /**
   * Create a new KB article
   */
  static async createArticle(data: CreateKBArticleRequest): Promise<KnowledgeBaseArticle> {
    const response = await fetch(`/api/social-pads/${data.pad_id}/knowledge-base`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      throw new Error("Failed to create KB article")
    }
    return response.json()
  }

  /**
   * Update an existing KB article
   */
  static async updateArticle(
    padId: string,
    articleId: string,
    data: UpdateKBArticleRequest,
  ): Promise<KnowledgeBaseArticle> {
    const response = await fetch(`/api/social-pads/${padId}/knowledge-base/${articleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      throw new Error("Failed to update KB article")
    }
    return response.json()
  }

  /**
   * Delete a KB article
   */
  static async deleteArticle(padId: string, articleId: string): Promise<void> {
    const response = await fetch(`/api/social-pads/${padId}/knowledge-base/${articleId}`, {
      method: "DELETE",
    })
    if (!response.ok) {
      throw new Error("Failed to delete KB article")
    }
  }

  /**
   * Search KB articles
   */
  static async searchArticles(params: SearchKBRequest): Promise<KnowledgeBaseArticle[]> {
    const queryParams = new URLSearchParams()
    queryParams.set("query", params.query)
    if (params.category) queryParams.set("category", params.category)
    if (params.tags) queryParams.set("tags", params.tags.join(","))
    if (params.limit) queryParams.set("limit", params.limit.toString())

    const response = await fetch(`/api/social-pads/${params.pad_id}/knowledge-base/search?${queryParams}`)
    if (!response.ok) {
      throw new Error("Failed to search KB articles")
    }
    return response.json()
  }

  /**
   * Get version history for an article
   */
  static async getHistory(padId: string, articleId: string): Promise<KBHistoryVersion[]> {
    const response = await fetch(`/api/social-pads/${padId}/knowledge-base/${articleId}/history`)
    if (!response.ok) {
      throw new Error("Failed to fetch KB history")
    }
    return response.json()
  }

  /**
   * Vote on article helpfulness
   */
  static async voteHelpful(padId: string, articleId: string, isHelpful: boolean): Promise<void> {
    const response = await fetch(`/api/social-pads/${padId}/knowledge-base/${articleId}/helpful`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_helpful: isHelpful }),
    })
    if (!response.ok) {
      throw new Error("Failed to vote on KB article")
    }
  }

  /**
   * Increment view count
   */
  static async incrementView(padId: string, articleId: string): Promise<void> {
    await fetch(`/api/social-pads/${padId}/knowledge-base/${articleId}/view`, {
      method: "POST",
    })
  }
}
