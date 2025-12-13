import { NextResponse, type NextRequest } from "next/server"
import { getSecurityHeaders } from "@/lib/security-headers"
import { createServerClient } from "@supabase/ssr"

const PROTECTED_ROUTES = [
  "/notes",
  "/control-panel",
  "/panel",
  "/social",
  "/dashboard",
  "/tags",
  "/mysticks",
  "/mypads",
  "/calsticks",
  "/quicksticks",
  "/profile",
  "/video",
  "/paks",
  "/settings",
]

const PUBLIC_ROUTES = ["/", "/about", "/auth", "/how-to-search", "/invites/accept"]

const PERSONAL_ONLY_ALLOWED_ROUTES = ["/notes", "/panel", "/profile", "/settings/profile"]

const FULL_ACCESS_ROUTES = [
  "/dashboard",
  "/social",
  "/control-panel",
  "/tags",
  "/mysticks",
  "/mypads",
  "/calsticks",
  "/quicksticks",
  "/video",
  "/paks",
  "/settings/organization",
]

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some((route) => pathname.startsWith(route))
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(route))
}

function isPersonalOnlyAllowedRoute(pathname: string): boolean {
  return PERSONAL_ONLY_ALLOWED_ROUTES.some((route) => pathname.startsWith(route))
}

function isFullAccessRoute(pathname: string): boolean {
  return FULL_ACCESS_ROUTES.some((route) => pathname.startsWith(route))
}

const USE_LOCAL_AUTH = process.env.USE_LOCAL_DATABASE === "true"

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname.startsWith("/api/")) {
    return NextResponse.next()
  }

  // Let Next handle static assets quickly
  const isStaticAsset =
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/public/") ||
    pathname.match(/\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|mp3|glb|gltf|txt|json)$/i)

  if (isStaticAsset) {
    const res = NextResponse.next()
    res.headers.set("Cache-Control", "public, max-age=31536000, immutable")
    return res
  }

  const securityHeaders = getSecurityHeaders()

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set("Content-Security-Policy", securityHeaders["Content-Security-Policy"])

  let res = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return res
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          req.cookies.set(name, value)
        })

        const updatedRequestHeaders = new Headers(req.headers)
        updatedRequestHeaders.set("Content-Security-Policy", securityHeaders["Content-Security-Policy"])

        res = NextResponse.next({
          request: {
            headers: updatedRequestHeaders,
          },
        })

        cookiesToSet.forEach(({ name, value, options }) => {
          const secureOptions = {
            ...options,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax" as const,
            path: "/",
            domain: undefined,
          }
          res.cookies.set(name, value, secureOptions)
        })
      },
    },
  })

  const needsHubModeCheck = isProtectedRoute(pathname) && !isPublicRoute(pathname)

  if (needsHubModeCheck) {
    try {
      if (USE_LOCAL_AUTH) {
        const { getSession } = await import("@/lib/auth/local-auth")
        const { db } = await import("@/lib/database/pg-client")

        const session = await getSession()

        if (!session) {
          const redirectUrl = new URL("/auth/login", req.url)
          const fullPath = pathname + req.nextUrl.search
          redirectUrl.searchParams.set("redirect", fullPath)
          return NextResponse.redirect(redirectUrl)
        }

        const user = session.user

        // Get hub_mode from local database
        const result = await db.query(`SELECT hub_mode FROM users WHERE id = $1`, [user.id])

        const hubMode = result.rows[0]?.hub_mode || "personal_only"
        const isFullAccessPath = isFullAccessRoute(pathname)

        if (hubMode === "personal_only" && isFullAccessPath) {
          const redirectUrl = new URL("/notes", req.url)
          return NextResponse.redirect(redirectUrl)
        }

        Object.entries(securityHeaders).forEach(([key, value]) => {
          res.headers.set(key, value)
        })

        res.headers.set("Vary", "Cookie, Authorization")

        return res
      }

      // Existing Supabase code
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser()

      if (error?.message?.includes("Refresh Token") || error?.code === "refresh_token_not_found") {
        // Create redirect response
        const redirectUrl = new URL("/auth/login", req.url)
        const fullPath = pathname + req.nextUrl.search
        redirectUrl.searchParams.set("redirect", fullPath)
        redirectUrl.searchParams.set("session_expired", "true")
        const redirectResponse = NextResponse.redirect(redirectUrl)

        // Explicitly delete all Supabase auth cookies
        const cookieNames = req.cookies.getAll().map((c) => c.name)
        const authCookieNames = cookieNames.filter(
          (name) => name.startsWith("sb-") || name.includes("supabase") || name.includes("auth-token"),
        )

        authCookieNames.forEach((name) => {
          redirectResponse.cookies.delete(name)
          // Also try deleting with different path options
          redirectResponse.cookies.set(name, "", {
            expires: new Date(0),
            path: "/",
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
          })
        })

        // Try to sign out as well (but don't wait for it)
        supabase.auth.signOut().catch(() => {})

        return redirectResponse
      }

      if (!user || error) {
        const redirectUrl = new URL("/auth/login", req.url)
        const fullPath = pathname + req.nextUrl.search
        redirectUrl.searchParams.set("redirect", fullPath)
        return NextResponse.redirect(redirectUrl)
      }

      let hubMode: string | null = null

      // This avoids the @supabase/supabase-js bundling issue in v0 preview
      if (supabaseServiceKey && supabaseUrl) {
        try {
          // Create admin client using SSR package to avoid bundling issues
          const supabaseAdmin = createServerClient(supabaseUrl, supabaseServiceKey, {
            cookies: {
              getAll() {
                return []
              },
              setAll() {},
            },
          })

          const { data: userProfile } = await supabaseAdmin.from("users").select("hub_mode").eq("id", user.id).single()

          if (userProfile) {
            hubMode = userProfile.hub_mode
          }
        } catch (adminError) {
          // Silently handle admin client errors
        }
      }

      const effectiveHubMode = hubMode || "personal_only"
      const isFullAccessPath = isFullAccessRoute(pathname)

      if (effectiveHubMode === "personal_only" && isFullAccessPath) {
        const redirectUrl = new URL("/notes", req.url)
        return NextResponse.redirect(redirectUrl)
      }
    } catch (error) {
      const redirectUrl = new URL("/auth/login", req.url)
      const fullPath = pathname + req.nextUrl.search
      redirectUrl.searchParams.set("redirect", fullPath)
      return NextResponse.redirect(redirectUrl)
    }
  }

  Object.entries(securityHeaders).forEach(([key, value]) => {
    res.headers.set(key, value)
  })

  res.headers.set("Vary", "Cookie, Authorization")

  return res
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.json|public/|images/).*)"],
}
