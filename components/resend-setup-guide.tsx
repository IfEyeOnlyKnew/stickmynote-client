"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, Mail } from "lucide-react"
import { SetupStep } from "@/components/setup/SetupStep"
import { resendSetupSteps } from "@/config/resend-setup-steps"

export function ResendSetupGuide() {
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)

  const testResendConnection = async () => {
    setTesting(true)
    setTestResult(null)

    try {
      const response = await fetch("/api/test-resend")
      const result = await response.json()
      setTestResult(result)
    } catch (error) {
      setTestResult({
        success: false,
        error: "Failed to test connection",
        details: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Resend Email Setup Guide
          </CardTitle>
          <CardDescription>
            Configure Resend for sending authentication emails in your Stick My Note application
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {resendSetupSteps.map((step, index) => (
            <SetupStep key={step.id} step={step} stepNumber={index + 1}>
              {step.id === "test-connection" && (
                <div className="space-y-3">
                  <Button onClick={testResendConnection} disabled={testing} className="w-full sm:w-auto">
                    {testing ? "Testing..." : "Test Resend API Key"}
                  </Button>

                  {testResult && (
                    <Alert variant={testResult.success ? "default" : "destructive"}>
                      <div className="flex items-center gap-2">
                        {testResult.success ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <AlertDescription>
                          {testResult.success ? (
                            <div>
                              <p className="font-medium text-green-800">✅ Resend API key is working!</p>
                              <p className="text-sm text-green-700 mt-1">{testResult.message}</p>
                              {testResult.testEmailId && (
                                <p className="text-xs text-green-600 mt-1">Test email ID: {testResult.testEmailId}</p>
                              )}
                            </div>
                          ) : (
                            <div>
                              <p className="font-medium">❌ Resend API key test failed</p>
                              <p className="text-sm mt-1">{testResult.error}</p>
                              {testResult.instructions && <p className="text-xs mt-1">{testResult.instructions}</p>}
                            </div>
                          )}
                        </AlertDescription>
                      </div>
                    </Alert>
                  )}
                </div>
              )}
            </SetupStep>
          ))}

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-2">Current Status</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={process.env.RESEND_API_KEY ? "default" : "destructive"}>
                  {process.env.RESEND_API_KEY ? "✅" : "❌"}
                </Badge>
                <span className="text-sm">Resend API Key {process.env.RESEND_API_KEY ? "Configured" : "Missing"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={testResult?.success ? "default" : "secondary"}>
                  {testResult?.success ? "✅" : testResult === null ? "⏳" : "❌"}
                </Badge>
                <span className="text-sm">
                  API Connection {testResult?.success ? "Verified" : testResult === null ? "Not Tested" : "Failed"}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
