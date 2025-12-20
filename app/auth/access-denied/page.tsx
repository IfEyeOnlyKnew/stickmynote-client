"use client"

import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ShieldX, Mail, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function AccessDeniedPage() {
  const searchParams = useSearchParams()
  const reason = searchParams.get("reason")
  const orgName = searchParams.get("org")

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <ShieldX className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Access Denied</CardTitle>
          <CardDescription>
            {reason === "not_preregistered" ? (
              <>
                You are not pre-registered to access{" "}
                <span className="font-semibold">{orgName || "this organization"}</span>.
              </>
            ) : (
              "You do not have permission to access this resource."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
            <p className="mb-2 font-medium text-foreground">What does this mean?</p>
            <p>
              Your organization requires employees to be pre-registered before they can access Stick My Notes. This
              helps ensure only authorized team members can access your organization&apos;s data.
            </p>
          </div>

          <div className="rounded-lg border p-4 text-sm">
            <p className="mb-2 font-medium flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Need access?
            </p>
            <p className="text-muted-foreground">
              Contact your organization administrator and ask them to pre-register your email address in the
              organization settings.
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-4">
            <Button asChild variant="outline">
              <Link href="/auth/login">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Login
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/personal">Continue to Personal Hub</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
