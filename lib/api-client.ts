class APIClient {
  private csrfToken: string | null = null

  async fetchCSRFToken(): Promise<string> {
    if (this.csrfToken) {
      return this.csrfToken
    }

    const response = await fetch("/api/csrf", {
      method: "GET",
      credentials: "include",
    })

    if (!response.ok) {
      throw new Error("Failed to fetch CSRF token")
    }

    const data = await response.json()
    this.csrfToken = data.csrfToken

    if (!this.csrfToken) {
      throw new Error("No CSRF token received")
    }

    return this.csrfToken
  }

  async request(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = new Headers(options.headers)

    // Add CSRF token for state-changing requests
    if (["POST", "PUT", "DELETE", "PATCH"].includes(options.method || "GET")) {
      const token = await this.fetchCSRFToken()
      headers.set("X-CSRF-Token", token)
    }

    // Ensure JSON content type for POST/PUT requests
    if (["POST", "PUT", "PATCH"].includes(options.method || "GET")) {
      headers.set("Content-Type", "application/json")
    }

    return fetch(url, {
      ...options,
      headers,
      credentials: "include",
    })
  }

  async get(url: string, options: RequestInit = {}): Promise<Response> {
    return this.request(url, { ...options, method: "GET" })
  }

  async post(
    url: string,
    data?: CreateNoteData | UpdateNoteData | CreateReplyData | Record<string, unknown>,
    options: RequestInit = {},
  ): Promise<Response> {
    return this.request(url, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async put(
    url: string,
    data?: UpdateNoteData | Record<string, unknown>,
    options: RequestInit = {},
  ): Promise<Response> {
    return this.request(url, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async delete(url: string, options: RequestInit = {}): Promise<Response> {
    return this.request(url, { ...options, method: "DELETE" })
  }
}

import type { CreateNoteData, UpdateNoteData, CreateReplyData } from "@/types/note"
export const apiClient = new APIClient()
