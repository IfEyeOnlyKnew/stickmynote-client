"use client"

import { useState } from "react"
import { createSupabaseBrowser } from "@/lib/supabase-browser"

export interface ConfigCheck {
  name: string
  status: "success" | "error" | "warning"
  message: string
  details?: any
}

export function useSupabaseConfig() {
  const [checks, setChecks] = useState<ConfigCheck[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createSupabaseBrowser()

  const checkEnvironmentVariables = (): ConfigCheck => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        name: "Environment Variables",
        status: "error",
        message: "Missing required Supabase environment variables",
        details: {
          NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ? "✅ Set" : "❌ Missing",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey ? "✅ Set" : "❌ Missing",
        },
      }
    }

    return {
      name: "Environment Variables",
      status: "success",
      message: "All required environment variables are set",
      details: {
        NEXT_PUBLIC_SUPABASE_URL: supabaseUrl.substring(0, 30) + "...",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey.substring(0, 30) + "...",
      },
    }
  }

  const checkSupabaseConnection = async (): Promise<ConfigCheck> => {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) {
        return {
          name: "Supabase Connection",
          status: "error",
          message: `Connection failed: ${userError.message}`,
          details: userError,
        }
      }

      return {
        name: "Supabase Connection",
        status: "success",
        message: "Successfully connected to Supabase",
        details: { connected: true, hasUser: !!userData.user },
      }
    } catch (connError) {
      return {
        name: "Supabase Connection",
        status: "error",
        message: "Failed to establish connection",
        details: connError,
      }
    }
  }

  const checkDatabaseAccess = async (): Promise<ConfigCheck> => {
    try {
      const { data: dbTest, error: dbError } = await supabase.from("users").select("count", { count: "exact" })
      if (dbError) {
        return {
          name: "Database Access",
          status: "error",
          message: `Database access failed: ${dbError.message}`,
          details: dbError,
        }
      }

      return {
        name: "Database Access",
        status: "success",
        message: "Successfully accessed users table",
        details: { userCount: dbTest?.length || 0 },
      }
    } catch (dbError) {
      return {
        name: "Database Access",
        status: "error",
        message: "Database connection failed",
        details: dbError,
      }
    }
  }

  const checkAuthConfiguration = async (): Promise<ConfigCheck> => {
    try {
      const authResponse = await fetch("/api/check-supabase-config")
      const authData = await authResponse.json()

      if (authResponse.ok) {
        return {
          name: "Auth Configuration",
          status: "success",
          message: "Auth configuration retrieved successfully",
          details: authData,
        }
      }

      return {
        name: "Auth Configuration",
        status: "warning",
        message: "Could not retrieve auth configuration",
        details: authData,
      }
    } catch (authError) {
      return {
        name: "Auth Configuration",
        status: "warning",
        message: "Auth configuration check failed",
        details: authError,
      }
    }
  }

  const checkSignupFunctionality = async (): Promise<ConfigCheck> => {
    const testEmail = `test-${Date.now()}@example.com`
    const testPassword = "TestPassword123!"

    try {
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: testEmail,
        password: testPassword,
        options: {
          data: {
            username: "testuser",
            full_name: "Test User",
          },
        },
      })

      if (signupError) {
        return {
          name: "Signup Test",
          status: "error",
          message: `Signup failed: ${signupError.message}`,
          details: {
            error: signupError,
            testEmail,
            errorCode: signupError.status,
          },
        }
      }

      // Clean up test user if created
      if (signupData.user) {
        try {
          await fetch("/api/clear-all-users-complete", { method: "POST" })
        } catch (cleanupError) {
          console.warn("Failed to cleanup test user:", cleanupError)
        }
      }

      return {
        name: "Signup Test",
        status: signupData.user ? "success" : "warning",
        message: signupData.user ? "Signup successful - user created" : "Signup completed but no user object returned",
        details: {
          userId: signupData.user?.id,
          email: signupData.user?.email,
          confirmed: signupData.user?.email_confirmed_at ? "Yes" : "No",
          session: signupData.session ? "Created" : "None",
          testEmail,
        },
      }
    } catch (signupTestError) {
      return {
        name: "Signup Test",
        status: "error",
        message: "Signup test failed with exception",
        details: signupTestError,
      }
    }
  }

  const checkEmailConfiguration = async (): Promise<ConfigCheck> => {
    try {
      const emailResponse = await fetch("/api/test-resend")
      const emailData = await emailResponse.json()

      if (emailResponse.ok && emailData.success) {
        return {
          name: "Email Configuration",
          status: "success",
          message: "Email service is configured and working",
          details: emailData,
        }
      }

      return {
        name: "Email Configuration",
        status: "warning",
        message: "Email service may not be properly configured",
        details: emailData,
      }
    } catch (emailError) {
      return {
        name: "Email Configuration",
        status: "warning",
        message: "Could not test email configuration",
        details: emailError,
      }
    }
  }

  const runAllChecks = async () => {
    setLoading(true)
    setChecks([])

    const configChecks: ConfigCheck[] = []

    try {
      console.log("🔧 Checking environment variables...")
      configChecks.push(checkEnvironmentVariables())

      console.log("🔗 Testing Supabase connection...")
      configChecks.push(await checkSupabaseConnection())

      console.log("🗄️ Testing database access...")
      configChecks.push(await checkDatabaseAccess())

      console.log("🔐 Checking auth configuration...")
      configChecks.push(await checkAuthConfiguration())

      console.log("🧪 Testing signup functionality...")
      configChecks.push(await checkSignupFunctionality())

      console.log("📧 Checking email configuration...")
      configChecks.push(await checkEmailConfiguration())
    } catch (error) {
      configChecks.push({
        name: "General Error",
        status: "error",
        message: "Unexpected error during configuration check",
        details: error,
      })
    }

    setChecks(configChecks)
    setLoading(false)
  }

  return {
    checks,
    loading,
    runAllChecks,
  }
}
