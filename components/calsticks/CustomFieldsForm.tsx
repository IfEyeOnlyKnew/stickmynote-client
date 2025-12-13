"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { format } from "date-fns"

interface CustomField {
  id: string
  name: string
  type: "text" | "number" | "select" | "date" | "boolean" | "url"
  options?: string[]
}

interface CustomFieldsFormProps {
  taskId: string
}

export function CustomFieldsForm({ taskId }: CustomFieldsFormProps) {
  const [fields, setFields] = useState<CustomField[]>([])
  const [values, setValues] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [tableNotFound, setTableNotFound] = useState(false)

  useEffect(() => {
    fetchData()
  }, [taskId])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [fieldsRes, valuesRes] = await Promise.all([
        fetch("/api/calsticks/custom-fields"),
        fetch(`/api/calsticks/custom-fields/values?taskId=${taskId}`),
      ])

      if (fieldsRes.ok && fieldsRes.headers.get("content-type")?.includes("application/json")) {
        const fieldsData = await fieldsRes.json()
        if (fieldsData.tableNotFound) {
          setTableNotFound(true)
          setLoading(false)
          return
        }
        setFields(fieldsData.fields || [])
      } else if (!fieldsRes.ok) {
        console.error("Custom fields API returned error:", fieldsRes.status)
      }

      if (valuesRes.ok && valuesRes.headers.get("content-type")?.includes("application/json")) {
        const valuesData = await valuesRes.json()

        if (valuesData.tableNotFound) {
          setTableNotFound(true)
          setLoading(false)
          return
        }

        const valuesMap: Record<string, any> = {}
        valuesData.values?.forEach((v: any) => {
          const val = v.value_text || v.value_number || v.value_date || v.value_boolean
          valuesMap[v.field_id] = val
        })
        setValues(valuesMap)
      } else if (!valuesRes.ok) {
        console.error("Custom field values API returned error:", valuesRes.status)
      }
    } catch (error) {
      console.error("Failed to fetch custom fields data:", error)
      // Assume table not found if any error occurs
      setTableNotFound(true)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = async (fieldId: string, value: any, type: string) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }))

    try {
      await fetch("/api/calsticks/custom-fields/values", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          fieldId,
          value,
          type,
        }),
      })
    } catch (error) {
      console.error("Failed to save field value:", error)
    }
  }

  if (loading) return <div className="text-sm text-muted-foreground">Loading fields...</div>
  if (tableNotFound) {
    return (
      <Alert variant="default" className="mt-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Custom fields requires database migration. Run:{" "}
          <code className="text-xs">scripts/add-calstick-custom-fields.sql</code>
        </AlertDescription>
      </Alert>
    )
  }
  if (fields.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-4 border-t pt-4 mt-4">
      <div className="col-span-2 font-medium text-sm text-muted-foreground mb-2">Custom Fields</div>
      {fields.map((field) => (
        <div key={field.id} className="space-y-2">
          <Label>{field.name}</Label>

          {field.type === "text" && (
            <Input value={values[field.id] || ""} onChange={(e) => handleChange(field.id, e.target.value, "text")} />
          )}

          {field.type === "url" && (
            <Input
              type="url"
              value={values[field.id] || ""}
              onChange={(e) => handleChange(field.id, e.target.value, "url")}
              placeholder="https://"
            />
          )}

          {field.type === "number" && (
            <Input
              type="number"
              value={values[field.id] || ""}
              onChange={(e) => handleChange(field.id, Number.parseFloat(e.target.value), "number")}
            />
          )}

          {field.type === "select" && (
            <Select value={values[field.id] || ""} onValueChange={(val) => handleChange(field.id, val, "select")}>
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {field.type === "date" && (
            <Input
              type="date"
              value={values[field.id] ? format(new Date(values[field.id]), "yyyy-MM-dd") : ""}
              onChange={(e) => handleChange(field.id, new Date(e.target.value).toISOString(), "date")}
            />
          )}

          {field.type === "boolean" && (
            <div className="flex items-center space-x-2 h-10">
              <Switch checked={!!values[field.id]} onCheckedChange={(val) => handleChange(field.id, val, "boolean")} />
              <span className="text-sm text-muted-foreground">{values[field.id] ? "Yes" : "No"}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
