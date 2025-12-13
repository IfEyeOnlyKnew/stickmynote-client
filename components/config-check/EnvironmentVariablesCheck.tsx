"use client"

import { Badge } from "@/components/ui/badge"

interface EnvironmentVariablesCheckProps {
  envVars: Record<string, string>
}

export function EnvironmentVariablesCheck({ envVars }: EnvironmentVariablesCheckProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Environment Variables</h3>
      <div className="grid gap-2">
        {Object.entries(envVars).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between p-2 bg-gray-50 rounded">
            <code className="text-sm font-mono">{key}</code>
            <Badge variant={value === "Not set" ? "destructive" : "default"}>
              {value === "Not set" ? "Missing" : "Set"}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  )
}
