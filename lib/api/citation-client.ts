// Client-side API functions for Citation operations

import type { StickCitation, CreateCitationRequest } from "@/lib/types/social-collaboration"

export class CitationAPI {
  /**
   * Get all citations for a stick
   */
  static async getCitations(stickId: string): Promise<StickCitation[]> {
    const response = await fetch(`/api/social-sticks/${stickId}/citations`)
    if (!response.ok) {
      throw new Error("Failed to fetch citations")
    }
    return response.json()
  }

  /**
   * Create a new citation
   */
  static async createCitation(data: CreateCitationRequest): Promise<StickCitation> {
    const response = await fetch(`/api/social-sticks/${data.stick_id}/citations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      throw new Error("Failed to create citation")
    }
    return response.json()
  }

  /**
   * Delete a citation
   */
  static async deleteCitation(stickId: string, citationId: string): Promise<void> {
    const response = await fetch(`/api/social-sticks/${stickId}/citations/${citationId}`, {
      method: "DELETE",
    })
    if (!response.ok) {
      throw new Error("Failed to delete citation")
    }
  }

  /**
   * Get related sticks based on citations
   */
  static async getRelatedSticks(stickId: string): Promise<any[]> {
    const response = await fetch(`/api/social-sticks/${stickId}/related`)
    if (!response.ok) {
      throw new Error("Failed to fetch related sticks")
    }
    return response.json()
  }
}
