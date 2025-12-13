"use client"

import { useState, useCallback } from "react"

export function useForm<T extends Record<string, any>>(initialData: T) {
  const [data, setData] = useState(initialData)
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  const updateField = useCallback(
    (field: keyof T, value: any) => {
      setData((prev) => ({ ...prev, [field]: value }))
      setIsDirty(true)
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }))
      }
    },
    [errors],
  )

  const setFieldError = useCallback((field: keyof T, error: string) => {
    setErrors((prev) => ({ ...prev, [field]: error }))
  }, [])

  const clearErrors = useCallback(() => {
    setErrors({})
  }, [])

  const reset = useCallback(() => {
    setData(initialData)
    setErrors({})
    setIsDirty(false)
    setIsSubmitting(false)
  }, [initialData])

  const validateField = useCallback(
    (field: keyof T, validator: (value: any) => string | null) => {
      const error = validator(data[field])
      if (error) {
        setFieldError(field, error)
        return false
      }
      return true
    },
    [data, setFieldError],
  )

  return {
    data,
    errors,
    isSubmitting,
    isDirty,
    updateField,
    setFieldError,
    clearErrors,
    setIsSubmitting,
    validateField,
    reset,
  }
}
