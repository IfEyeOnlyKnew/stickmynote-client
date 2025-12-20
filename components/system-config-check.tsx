"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Database, Settings } from "lucide-react"
import { useSystemConfig } from "@/hooks/use-system-config"
import { ConfigCheckResults } from "@/components/config-check/ConfigCheckResults"

export function SystemConfigCheck() {
  const { checks, loading, runAllChecks } = useSystemConfig()

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            System Configuration Check
          </CardTitle>
          <CardDescription>Diagnose system health and identify configuration issues</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="check" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="check">Run Check</TabsTrigger>
              <TabsTrigger value="results">Results {checks.length > 0 && `(${checks.length})`}</TabsTrigger>
            </TabsList>

            <TabsContent value="check" className="space-y-4">
              <Alert>
                <Database className="h-4 w-4" />
                <AlertDescription>
                  This will check your database connection, authentication system, and environment configuration.
                </AlertDescription>
              </Alert>

              <Button onClick={runAllChecks} disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Database className="h-4 w-4 mr-2 animate-pulse" />
                    Running Health Check...
                  </>
                ) : (
                  <>
                    <Settings className="h-4 w-4 mr-2" />
                    Run Health Check
                  </>
                )}
              </Button>
            </TabsContent>

            <TabsContent value="results" className="space-y-4">
              <ConfigCheckResults checks={checks} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

export default SystemConfigCheck
