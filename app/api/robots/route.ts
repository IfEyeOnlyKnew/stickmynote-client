import { NextResponse } from "next/server"

export async function GET() {
  const robots = `User-agent: *
Allow: /

Sitemap: https://www.stickmynote.com/sitemap.xml

# Disallow admin and API routes
Disallow: /api/
Disallow: /admin/
Disallow: /_next/
Disallow: /auth/callback

# Allow important pages
Allow: /
Allow: /about
Allow: /notes
Allow: /how-to-search
Allow: /auth`

  return new NextResponse(robots, {
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate",
    },
  })
}
