"use client"

import { useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Shield, Globe, AlertTriangle, Zap, LinkIcon } from "lucide-react"
import { useProductionChecks } from "@/hooks/use-production-checks"
import { CheckResultCard } from "@/components/production-check/CheckResultCard"

export function ProductionReadiness() {
  const { results, running, runAllChecks, getChecksByCategory } = useProductionChecks()

  useEffect(() => {
    runAllChecks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const categories = getChecksByCategory()

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Production Readiness
          </CardTitle>
          <CardDescription>Run checks to ensure the app is ready for production</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="checks" className="w-full">
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="checks">Checks</TabsTrigger>
              <TabsTrigger value="results">Results {results.length > 0 && `(${results.length})`}</TabsTrigger>
            </TabsList>

            <TabsContent value="checks" className="space-y-4">
              <Alert>
                <Globe className="h-4 w-4" />
                <AlertDescription>
                  These checks validate environment variables, SEO endpoints, rate limiting, database connectivity, and
                  AI tag generation (with automatic fallback if needed).
                </AlertDescription>
              </Alert>
              <Button onClick={runAllChecks} disabled={running} className="flex items-center gap-2">
                {running && <Zap className="h-4 w-4 animate-pulse" />}
                Run Checks
              </Button>
            </TabsContent>

            <TabsContent value="results" className="space-y-4">
              {results.length === 0 ? (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>No results yet. Run checks to see details here.</AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-6">
                  {categories.map((category) => (
                    <div key={category.name} className="space-y-3">
                      <h3 className="text-lg font-semibold text-gray-900">{category.name}</h3>
                      <div className="space-y-3">
                        {category.checks.map((check, index) => (
                          <CheckResultCard key={`${category.name}-${index}`} check={check} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
          <div className="mt-6 text-xs text-gray-500 flex items-center gap-2">
            <LinkIcon className="h-4 w-4" />
            Domain target: https://www.stickmynote.com
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
