"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle2, Loader2 } from "lucide-react"

interface FormField {
  id: string
  field_name: string
  field_label: string
  field_type: string
  field_options?: string[]
  is_required: boolean
  placeholder?: string
  help_text?: string
  order_index: number
}

interface IntakeForm {
  id: string
  title: string
  description?: string
  fields: FormField[]
  success_message: string
}

export default function IntakeFormClient({ token }: Readonly<{ token: string }>) {
  const [form, setForm] = useState<IntakeForm | null>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchForm = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/intake/${token}`)

      if (response.ok) {
        const data = await response.json()
        setForm(data.form)
      } else {
        setError("Form not found or inactive")
      }
    } catch (err) {
      console.error("[v0] Error fetching form:", err)
      setError("Failed to load form")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchForm()
  }, [fetchForm])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form) return

    // Validate required fields
    const missingFields = form.fields.filter((f) => f.is_required && !formData[f.field_name]).map((f) => f.field_label)

    if (missingFields.length > 0) {
      setError(`Please fill in required fields: ${missingFields.join(", ")}`)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/intake/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: formData }),
      })

      if (response.ok) {
        setSubmitted(true)
      } else {
        const errorData = await response.json()
        setError(errorData.error || "Failed to submit form")
      }
    } catch (err) {
      console.error("[v0] Error submitting form:", err)
      setError("Failed to submit form")
    } finally {
      setSubmitting(false)
    }
  }

  const renderField = (field: FormField) => {
    const value = formData[field.field_name] || ""

    switch (field.field_type) {
      case "textarea":
        return (
          <Textarea
            value={value}
            onChange={(e) => setFormData({ ...formData, [field.field_name]: e.target.value })}
            placeholder={field.placeholder}
            required={field.is_required}
            rows={4}
          />
        )

      case "email":
        return (
          <Input
            type="email"
            value={value}
            onChange={(e) => setFormData({ ...formData, [field.field_name]: e.target.value })}
            placeholder={field.placeholder}
            required={field.is_required}
          />
        )

      case "number":
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => setFormData({ ...formData, [field.field_name]: e.target.value })}
            placeholder={field.placeholder}
            required={field.is_required}
          />
        )

      case "date":
        return (
          <Input
            type="date"
            value={value}
            onChange={(e) => setFormData({ ...formData, [field.field_name]: e.target.value })}
            required={field.is_required}
          />
        )

      case "url":
        return (
          <Input
            type="url"
            value={value}
            onChange={(e) => setFormData({ ...formData, [field.field_name]: e.target.value })}
            placeholder={field.placeholder || "https://"}
            required={field.is_required}
          />
        )

      case "select":
        return (
          <Select
            value={value}
            onValueChange={(val) => setFormData({ ...formData, [field.field_name]: val })}
            required={field.is_required}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {field.field_options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      default: // text
        return (
          <Input
            type="text"
            value={value}
            onChange={(e) => setFormData({ ...formData, [field.field_name]: e.target.value })}
            placeholder={field.placeholder}
            required={field.is_required}
          />
        )
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading form...</p>
        </div>
      </div>
    )
  }

  if (error && !form) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-red-500">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (submitted && form) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <CardTitle>Success!</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground">{form.success_message}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!form) return null

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-muted/30">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <CardTitle>{form.title}</CardTitle>
          {form.description && <CardDescription>{form.description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {form.fields
              .toSorted((a, b) => a.order_index - b.order_index)
              .map((field) => (
                <div key={field.id} className="space-y-2">
                  <Label htmlFor={field.field_name}>
                    {field.field_label}
                    {field.is_required && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                  {renderField(field)}
                  {field.help_text && <p className="text-sm text-muted-foreground">{field.help_text}</p>}
                </div>
              ))}

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
