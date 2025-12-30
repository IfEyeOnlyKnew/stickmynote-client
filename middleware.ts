import { NextResponse, type NextRequest } from "next/server"
import { getSecurityHeaders } from "@/lib/security-headers"

const PROTECTED_ROUTES = [
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
