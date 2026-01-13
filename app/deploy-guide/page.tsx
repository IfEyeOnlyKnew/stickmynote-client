"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { CheckCircle2, AlertTriangle, ExternalLink, LinkIcon, Globe, GitBranch, Rocket } from "lucide-react"
import { isDiagnosticAccessible } from "@/lib/is-production"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"

type EnvStatus = {
  hasPostgresHost?: boolean
  hasPostgresDatabase?: boolean
  hasPostgresUser?: boolean
  hasOllamaConfig?: boolean
  hasAiFallback?: boolean
  nodeEnv?: string
}

type RateHealth = {
  status: string
  redis: boolean
  fallback: boolean
  provider?: "upstash-redis" | "upstash-kv" | "memory" | string
  envConfigured?: boolean
  warning?: string
  timestamp?: string
}

export default function DeployGuidePage() {
  const [env, setEnv] = useState<EnvStatus | null>(null)
  const [rate, setRate] = useState<RateHealth | null>(null)
  const [seo, setSeo] = useState<{ robots: boolean; sitemap: boolean } | null>(null)
  const [db, setDb] = useState<{ ok?: boolean; message?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAccessible, setIsAccessible] = useState<boolean | null>(null)

  useEffect(() => {
    const run = async () => {
      try {
        const [envR, rateR, robotsR, sitemapR, dbR] = await Promise.allSettled([
          fetch("/api/debug-env", { cache: "no-store" }),
          fetch("/api/rate-limit-health", { cache: "no-store" }),
          fetch("/robots.txt", { cache: "no-store" }),
          fetch("/sitemap.xml", { cache: "no-store" }),
          fetch("/api/database-health", { cache: "no-store" }),
        ])

        if (envR.status === "fulfilled" && envR.value.ok) {
          const j = await envR.value.json()
          setEnv(j)
        } else {
          setEnv(null)
        }

        if (rateR.status === "fulfilled" && rateR.value.ok) {
          const j = (await rateR.value.json()) as RateHealth
          setRate(j)
        } else {
          setRate(null)
        }

        setSeo({
          robots: robotsR.status === "fulfilled" && robotsR.value.ok,
          sitemap: sitemapR.status === "fulfilled" && sitemapR.value.ok,
        })

        if (dbR.status === "fulfilled" && dbR.value.ok) {
          const j = await dbR.value.json()
          setDb(j)
        } else {
          setDb(null)
        }
      } catch {
        // ignore, show partial results
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [])

  useEffect(() => {
    setIsAccessible(isDiagnosticAccessible())
  }, [])

  if (isAccessible === null) {
    return null // Loading state
  }

  if (!isAccessible) {
    return (
      <main className="min-h-screen bg-white py-10">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-2xl font-semibold">404 - Page Not Found</h1>
        </div>
      </main>
    )
  }

  const ok = (b?: boolean) =>
    b ? (
      <span className="inline-flex items-center gap-1 text-green-700">
        <CheckCircle2 className="h-4 w-4" /> OK
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-yellow-700">
        <AlertTriangle className="h-4 w-4" /> Check
      </span>
    )

  return (
    <main className="min-h-screen bg-white py-10">
      <div className="container mx-auto px-4 max-w-4xl">
        <BreadcrumbNav
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Deploy Guide", current: true },
          ]}
        />

        <div className="mb-6">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Rocket className="h-6 w-6" />
            Deploy Guide
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Follow these steps to deploy your app to Vercel and map your GoDaddy domain.
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Quick Status</CardTitle>
            <CardDescription>Environment, rate limiting, SEO, and database checks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <p className="text-sm text-gray-500">Running checks...</p>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border rounded p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">PostgreSQL env</span>
                      <Badge variant={env?.hasPostgresHost && env?.hasPostgresDatabase ? "default" : "secondary"}>
                        {env?.hasPostgresHost && env?.hasPostgresDatabase ? "Present" : "Missing"}
                      </Badge>
                    </div>
                    <ul className="mt-2 text-sm text-gray-600 space-y-1">
                      <li>Host: {ok(env?.hasPostgresHost)}</li>
                      <li>Database: {ok(env?.hasPostgresDatabase)}</li>
                      <li>User: {ok(env?.hasPostgresUser)}</li>
                    </ul>
                  </div>

                  <div className="border rounded p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Rate limiter</span>
                      <Badge variant={rate?.redis || rate?.fallback ? "default" : "destructive"}>
                        {(rate?.provider ?? "unknown").toString()}
                      </Badge>
                    </div>
                    <ul className="mt-2 text-sm text-gray-600 space-y-1">
                      <li>Redis connected: {ok(rate?.redis)}</li>
                      <li>Fallback available: {ok(rate?.fallback)}</li>
                      {rate?.warning ? <li className="text-yellow-700">Note: {rate.warning}</li> : null}
                    </ul>
                    <div className="mt-2">
                      <Link
                        href="/api/rate-limit-health"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      >
                        Open health JSON <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>

                  <div className="border rounded p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">SEO endpoints</span>
                      <Badge variant={seo?.robots && seo?.sitemap ? "default" : "secondary"}>
                        {seo?.robots && seo?.sitemap ? "OK" : "Check"}
                      </Badge>
                    </div>
                    <ul className="mt-2 text-sm text-gray-600 space-y-1">
                      <li>robots.txt: {ok(seo?.robots)}</li>
                      <li>sitemap.xml: {ok(seo?.sitemap)}</li>
                    </ul>
                    <div className="mt-2 flex gap-3">
                      <Link
                        href="/robots.txt"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      >
                        robots.txt <ExternalLink className="h-3 w-3" />
                      </Link>
                      <Link
                        href="/sitemap.xml"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      >
                        sitemap.xml <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>

                  <div className="border rounded p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Database health</span>
                      <Badge variant={db?.ok ? "default" : "secondary"}>{db?.ok ? "OK" : "Check"}</Badge>
                    </div>
                    <ul className="mt-2 text-sm text-gray-600 space-y-1">
                      <li>Connectivity: {ok(db?.ok)}</li>
                      {db?.message ? <li className="text-xs text-gray-500">Message: {db.message}</li> : null}
                    </ul>
                    <div className="mt-2">
                      <Link
                        href="/api/database-health"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      >
                        Open DB health JSON <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                </div>

                <Separator />

                <Alert>
                  <AlertDescription>
                    For a deeper check (including AI Tag generation), open the Production Readiness page:
                    <Link
                      href="/production-readiness"
                      className="ml-2 inline-flex items-center gap-1 text-blue-600 hover:underline"
                    >
                      /production-readiness <ExternalLink className="h-3 w-3" />
                    </Link>
                  </AlertDescription>
                </Alert>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Step-by-step Deployment</CardTitle>
            <CardDescription>Follow each step in order</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <section>
              <h3 className="font-medium flex items-center gap-2">
                <GitBranch className="h-5 w-5" /> 1) Connect your GitHub repo to Vercel
              </h3>
              <ul className="list-disc pl-5 text-sm text-gray-700 mt-2 space-y-1">
                <li>In Vercel Dashboard, click “New Project” and import your GitHub repository.</li>
                <li>Ensure the framework is detected as Next.js (App Router).</li>
                <li>Keep default build/output settings. No extra config is needed.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-medium flex items-center gap-2">
                <LinkIcon className="h-5 w-5" /> 2) Add environment variables
              </h3>
              <ul className="list-disc pl-5 text-sm text-gray-700 mt-2 space-y-1">
                <li>
                  Project → Settings → Environment Variables → Add:
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li>POSTGRES_HOST (database host)</li>
                    <li>POSTGRES_DATABASE (database name)</li>
                    <li>POSTGRES_USER (database user)</li>
                    <li>POSTGRES_PASSWORD (database password)</li>
                    <li>
                      UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN, or KV_REST_API_URL and KV_REST_API_TOKEN
                    </li>
                    <li>XAI_API_KEY (optional; for Generate Tags)</li>
                    <li>SMTP_HOST, SMTP_PORT, SMTP_USER (email; or RESEND_API_KEY)</li>
                    <li>CSRF_SECRET, NEXT_PUBLIC_SITE_URL</li>
                  </ul>
                </li>
                <li>Choose targets: Development, Preview, Production. Save, then redeploy to apply changes.</li>
              </ul>
              <p className="text-xs text-gray-500 mt-2">
                Note: The Vercel ↔ Upstash integration sets REST env vars automatically and you must redeploy to use
                them [^3]. If you use the @upstash/redis client directly, you can load from env with Redis.fromEnv in
                server code [^4].
              </p>
            </section>

            <section>
              <h3 className="font-medium flex items-center gap-2">
                <Globe className="h-5 w-5" /> 3) Add your GoDaddy domain
              </h3>
              <ul className="list-disc pl-5 text-sm text-gray-700 mt-2 space-y-1">
                <li>In Vercel Project → Settings → Domains → Add stickmynote.com.</li>
                <li>Follow Vercel&apos;s DNS instructions to create the A/ALIAS or CNAME record in GoDaddy DNS.</li>
                <li>Wait for DNS to propagate; Vercel will show the domain as &quot;Verified&quot;.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-medium flex items-center gap-2">
                <Rocket className="h-5 w-5" /> 4) Run pre-flight checks, then deploy
              </h3>
              <ul className="list-disc pl-5 text-sm text-gray-700 mt-2 space-y-1">
                <li>
                  Open{" "}
                  <Link href="/production-readiness" className="text-blue-600 hover:underline">
                    /production-readiness
                  </Link>{" "}
                  and confirm all checks show SUCCESS.
                </li>
                <li>Push to your main branch or click “Deploy” in Vercel to create a Production deployment.</li>
                <li>
                  Post-deploy, verify:
                  <ul className="list-disc pl-5 mt-1">
                    <li>
                      <Link href="/personal" className="text-blue-600 hover:underline">
                        /personal
                      </Link>{" "}
                      fully renders
                    </li>
                    <li>
                      <Link href="/profile" className="text-blue-600 hover:underline">
                        /profile
                      </Link>{" "}
                      loads and updates
                    </li>
                    <li>
                      <Link href="/api/rate-limit-health" className="text-blue-600 hover:underline">
                        /api/rate-limit-health
                      </Link>{" "}
                      shows provider and redis: true
                    </li>
                  </ul>
                </li>
              </ul>
              <p className="text-xs text-gray-500 mt-2">
                If you enabled the Generate Tags feature, it uses the AI SDK with your XAI_API_KEY; set it in Vercel and
                redeploy [^5].
              </p>
            </section>

            <Separator />

            <div className="flex flex-wrap gap-3">
              <Link href="/production-readiness">
                <Button variant="default">Open Production Readiness</Button>
              </Link>
              <Link href="/api/rate-limit-health" target="_blank">
                <Button variant="secondary">Open Rate Limit Health</Button>
              </Link>
              <Link href="/robots.txt" target="_blank">
                <Button variant="outline">robots.txt</Button>
              </Link>
              <Link href="/sitemap.xml" target="_blank">
                <Button variant="outline">sitemap.xml</Button>
              </Link>
            </div>

            <Alert>
              <AlertDescription className="text-xs text-gray-700">
                Tip: After changing environment variables in Vercel, always redeploy for the new values to take effect.
                The Upstash integration populates REST env vars that your app can read at runtime in route handlers;
                Redis.fromEnv is also supported when using the SDK server-side [^3][^4].
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <div className="mt-6 text-xs text-gray-500 flex items-center gap-2">
          <Globe className="h-4 w-4" />
          Target domain: https://www.stickmynote.com
        </div>
      </div>
    </main>
  )
}
