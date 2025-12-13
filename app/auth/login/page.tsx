import { Suspense } from "react"
import { AuthForm } from "@/components/auth-form"
import { Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

function LoginContent({ sessionExpired }: { sessionExpired: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      {sessionExpired && (
        <Alert variant="destructive" className="max-w-md mx-auto">
          <AlertDescription>Your session has expired. Please sign in again.</AlertDescription>
        </Alert>
      )}
      <AuthForm />
    </div>
  )
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: { session_expired?: string; redirect?: string }
}) {
  const sessionExpired = searchParams?.session_expired === "true"

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <LoginContent sessionExpired={sessionExpired} />
    </Suspense>
  )
}
