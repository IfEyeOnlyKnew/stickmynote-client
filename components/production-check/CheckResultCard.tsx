import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react"
import type { Check } from "@/hooks/use-production-checks"

interface CheckResultCardProps {
  check: Check
}

export function CheckResultCard({ check }: Readonly<CheckResultCardProps>) {
  const getIcon = (status: Check["status"]) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "error":
        return <XCircle className="h-4 w-4 text-red-600" />
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
    }
  }

  const getBorderColor = (status: Check["status"]) => {
    switch (status) {
      case "success":
        return "border-l-green-500"
      case "error":
        return "border-l-red-500"
      case "warning":
        return "border-l-yellow-500"
    }
  }

  const getBadgeVariant = (status: Check["status"]) => {
    switch (status) {
      case "success":
        return "default"
      case "error":
        return "destructive"
      case "warning":
        return "secondary"
    }
  }

  return (
    <Card className={`border-l-4 ${getBorderColor(check.status)}`}>
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          {getIcon(check.status)}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium">{check.name}</h4>
              <Badge variant={getBadgeVariant(check.status)}>{check.status.toUpperCase()}</Badge>
            </div>
            <p className="text-sm text-gray-600 mb-2">{check.message}</p>
            {check.details && (
              <details className="text-xs">
                <summary className="cursor-pointer text-gray-500 hover:text-gray-700">Details</summary>
                <pre className="mt-2 p-2 bg-gray-50 rounded overflow-auto max-h-40">
                  {JSON.stringify(check.details, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
