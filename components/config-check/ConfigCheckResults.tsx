"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react"
import type { ConfigCheck } from "@/hooks/use-supabase-config"

interface ConfigCheckResultsProps {
  checks: ConfigCheck[]
}

export function ConfigCheckResults({ checks }: ConfigCheckResultsProps) {
  const getStatusIcon = (status: ConfigCheck["status"]) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "error":
        return <XCircle className="h-4 w-4 text-red-600" />
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
    }
  }

  const getStatusBadge = (status: ConfigCheck["status"]) => {
    switch (status) {
      case "success":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            OK
          </Badge>
        )
      case "error":
        return <Badge variant="destructive">Error</Badge>
      case "warning":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            Warning
          </Badge>
        )
    }
  }

  if (checks.length === 0) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>No check results yet. Run the configuration check to see results here.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Configuration Results</h3>
        <div className="flex gap-2">
          <Badge variant="outline" className="bg-green-50">
            {checks.filter((c) => c.status === "success").length} OK
          </Badge>
          <Badge variant="outline" className="bg-red-50">
            {checks.filter((c) => c.status === "error").length} Error
          </Badge>
          <Badge variant="outline" className="bg-yellow-50">
            {checks.filter((c) => c.status === "warning").length} Warning
          </Badge>
        </div>
      </div>

      <div className="grid gap-4">
        {checks.map((check, index) => (
          <Card
            key={index}
            className={`border-l-4 ${
              check.status === "success"
                ? "border-l-green-500"
                : check.status === "error"
                  ? "border-l-red-500"
                  : "border-l-yellow-500"
            }`}
          >
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                {getStatusIcon(check.status)}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{check.name}</h4>
                    {getStatusBadge(check.status)}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{check.message}</p>
                  {check.details && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-gray-500 hover:text-gray-700">Show Details</summary>
                      <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-x-auto max-h-40 overflow-y-auto">
                        {JSON.stringify(check.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {checks.some((c) => c.status === "error") && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            Critical errors found. Please fix the errors above before attempting signup.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
