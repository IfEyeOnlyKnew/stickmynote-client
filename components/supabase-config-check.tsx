"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Database, Settings } from "lucide-react"
import { useSupabaseConfig } from "@/hooks/use-supabase-config"
import { EnvironmentVariablesCheck } from "@/components/config-check/EnvironmentVariablesCheck"
import { ConfigCheckResults } from "@/components/config-check/ConfigCheckResults"

export function SupabaseConfigCheck() {
  const [envVars, setEnvVars] = useState<Record<string, string>>({})
  const { checks, loading, runAllChecks } = useSupabaseConfig()

  useEffect(() => {
    const checkEnvironmentVariables = () => {
      const vars = {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "Not set",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "Not set",
        SUPABASE_SERVICE_ROLE_KEY: "Hidden for security",
      }
      setEnvVars(vars)
    }

    checkEnvironmentVariables()
  }, [])

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Supabase Configuration Check
          </CardTitle>
          <CardDescription>Diagnose Supabase setup and identify signup issues</CardDescription>
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
                  This will check your Supabase configuration, test connections, and identify why signup might not be
                  working.
                </AlertDescription>
              </Alert>

              <EnvironmentVariablesCheck envVars={envVars} />

              <Button onClick={runAllChecks} disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Database className="h-4 w-4 mr-2 animate-pulse" />
                    Running Configuration Check...
                  </>
                ) : (
                  <>
                    <Settings className="h-4 w-4 mr-2" />
                    Run Configuration Check
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

export default SupabaseConfigCheck
