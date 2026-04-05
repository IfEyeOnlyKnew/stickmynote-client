/**
 * Fuzzy search implementation with typo tolerance
 */

export interface SearchResult<T> {
  item: T
  score: number
  matches: Array<{ field: string; indices: number[][] }>
}

export class FuzzySearch<T extends Record<string, any>> {
  private items: T[]
  private readonly searchFields: (keyof T)[]

  constructor(items: T[], searchFields: (keyof T)[]) {
    this.items = items
    this.searchFields = searchFields
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = []

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        }
      }
    }

    return matrix[b.length][a.length]
  }

  /**
   * Calculate similarity score (0-1) between query and text
   */
  private calculateScore(query: string, text: string): number {
    const queryLower = query.toLowerCase()
    const textLower = text.toLowerCase()

    // Exact match
    if (textLower === queryLower) return 1.0

    // Contains query
    if (textLower.includes(queryLower)) {
      return 0.8 + (queryLower.length / textLower.length) * 0.2
    }

    // Fuzzy match using Levenshtein distance
    const distance = this.levenshteinDistance(queryLower, textLower)
    const maxLength = Math.max(queryLower.length, textLower.length)
    const similarity = 1 - distance / maxLength

    // Only return if similarity is above threshold
    return similarity > 0.6 ? similarity * 0.7 : 0
  }

  /**
   * Search items with fuzzy matching
   */
  search(query: string, options: { threshold?: number; limit?: number } = {}): SearchResult<T>[] {
    const { threshold = 0.3, limit } = options

    if (!query.trim()) {
      return this.items.map((item) => ({ item, score: 1, matches: [] }))
    }

    const results: SearchResult<T>[] = []

    for (const item of this.items) {
      let maxScore = 0
      const matches: Array<{ field: string; indices: number[][] }> = []

      for (const field of this.searchFields) {
        const fieldValue = String(item[field] || "")
        const score = this.calculateScore(query, fieldValue)

        if (score > maxScore) {
          maxScore = score
        }

        if (score > threshold) {
          matches.push({ field: String(field), indices: [] })
        }
      }

      if (maxScore >= threshold) {
        results.push({ item, score: maxScore, matches })
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score)

    return limit ? results.slice(0, limit) : results
  }

  /**
   * Update items in the search index
   */
  updateItems(items: T[]) {
    this.items = items
  }
}
