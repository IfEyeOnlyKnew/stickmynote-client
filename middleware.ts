import { NextResponse, type NextRequest } from "next/server"
import { getSecurityHeaders } from "@/lib/security-headers"

const PROTECTED_ROUTES = [
  "/control-panel",
  "/panel",
  "/inference",
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

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some((route) => pathname.startsWith(route))
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => {
    if (route === "/") {
      return pathname === "/"
    }
    return pathname === route || pathname.startsWith(route + "/") || pathname.startsWith(route)
  })
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname.startsWith("/api/")) {
    const res = NextResponse.next()
    // Auth endpoints: never cache — stale auth responses cause redirect loops
    if (pathname.startsWith("/api/auth/")) {
      res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate")
      res.headers.set("Pragma", "no-cache")
    }
    // Public API endpoints (sitemap, robots): moderate cache
    else if (pathname === "/api/sitemap" || pathname === "/api/robots") {
      res.headers.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400")
    }
    // All other API: private, no cache
    else {
      res.headers.set("Cache-Control", "private, no-cache")
    }
    res.headers.set("Vary", "Cookie, Authorization, Accept")
    return res
  }

  // Service worker must never be cached long-term — browsers rely on fresh responses for update detection
  if (pathname === "/sw.js") {
    const res = NextResponse.next()
    res.headers.set("Cache-Control", "public, max-age=0, must-revalidate")
    res.headers.set("Service-Worker-Allowed", "/")
    return res
  }

  // Let Next handle static assets quickly
  const isStaticAsset =
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/public/") ||
    pathname.match(/\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|mp3|glb|gltf|txt|json)$/i)

  if (isStaticAsset) {
    const res = NextResponse.next()
    res.headers.set("Cache-Control", "public, max-age=31536000, immutable")
    res.headers.set("X-Content-Type-Options", "nosniff")
    res.headers.set("Vary", "Accept-Encoding")
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

  const needsAuthCheck = isProtectedRoute(pathname) && !isPublicRoute(pathname)

  if (needsAuthCheck) {
    // Check for session cookie existence only (Edge-compatible)
    // Full session validation happens in page/API routes which run in Node.js runtime
    const sessionCookie = req.cookies.get("session")

    if (!sessionCookie?.value) {
      const redirectUrl = new URL("/auth/login", req.url)
      const fullPath = pathname + req.nextUrl.search
      redirectUrl.searchParams.set("redirect", fullPath)
      return NextResponse.redirect(redirectUrl)
    }

    Object.entries(securityHeaders).forEach(([key, value]) => {
      res.headers.set(key, value)
    })

    res.headers.set("Vary", "Cookie, Authorization")

    return res
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
