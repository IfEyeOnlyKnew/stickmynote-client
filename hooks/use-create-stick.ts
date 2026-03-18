"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface StickForm {
  topic: string
  content: string
}

interface CreateStickData extends StickForm {
  color: string
}

type StickContext = "paks" | "social"

export function useCreateStick(padId: string, context: StickContext = "paks") {
  const [form, setForm] = useState<StickForm>({
    topic: "",
    content: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const updateForm = (field: keyof StickForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const resetForm = () => {
    setForm({
      topic: "",
      content: "",
    })
    setError(null)
  }

  const isValid = form.content.trim().length > 0

  const createStick = async (stickData: CreateStickData) => {
    setIsLoading(true)
    setError(null)

    try {
      // Use different API endpoints based on context
      const endpoint = context === "social" ? "/api/inference-sticks" : "/api/sticks"
      const padIdField = context === "social" ? "social_pad_id" : "pad_id"

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...stickData,
          [padIdField]: padId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create stick")
      }

      const newStick = await response.json()
      router.refresh()
      return true
    } catch (err) {
      console.error("Error creating stick:", err)
      setError(err instanceof Error ? err.message : "Failed to create stick")
      return false
    } finally {
      setIsLoading(false)
    }
  }

  return {
    form,
    updateForm,
    resetForm,
    createStick,
    isLoading,
    error,
    isValid,
  }
}
