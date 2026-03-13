import type React from "react"
import "./globals.css"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { UserProvider } from "@/contexts/user-context"
import { OrganizationProvider } from "@/contexts/organization-context"
import { OrgThemeProvider } from "@/components/organization/org-theme-provider"
import { Toaster } from "@/components/toaster"
import type { Metadata, Viewport } from "next"
import { ErrorBoundary } from "@/components/error-boundary"
import { CookieConsentBanner } from "@/components/cookie-consent-banner"
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister"
import { ChatRequestNotifications } from "@/components/chat/ChatRequestNotifications"
import { PresenceTracker } from "@/components/PresenceTracker"
import { PWAInstallPrompt } from "@/components/pwa/PWAInstallPrompt"
import { OfflineIndicator } from "@/components/pwa/OfflineIndicator"
import { SWUpdateNotification } from "@/components/pwa/SWUpdateNotification"
import { MobileBottomNav } from "@/components/responsive/MobileBottomNav"
import { AccessibilityProvider } from "@/contexts/accessibility-context"
import { KeyboardDetector } from "@/components/KeyboardDetector"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://stickmynote.com"),
  title: "Stick My Note - Digital Sticky Notes | stickmynote.com",
  description:
    "Organize your thoughts with beautiful, interactive sticky notes. Create, share, and manage your digital workspace. Available on stickmynote.com",
  keywords: "sticky notes, digital notes, organization, productivity, note taking, stickmynote",
  authors: [{ name: "stickmynote.com" }],
  creator: "stickmynote.com",
  publisher: "stickmynote.com",
  robots: "index, follow",
  verification: {
    google: "your-google-verification-code",
  },
  openGraph: {
    title: "Stick My Note - Digital Sticky Notes",
    description:
      "Organize your thoughts with beautiful, interactive sticky notes. Create, share, and manage your digital workspace.",
    url: process.env.NEXT_PUBLIC_SITE_URL || "https://stickmynote.com",
    siteName: "Stick My Note",
    type: "website",
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "Stick My Note - Digital Sticky Notes",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Stick My Note - Digital Sticky Notes",
    description: "Organize your thoughts with beautiful, interactive sticky notes.",
    images: ["/images/og-image.png"],
  },
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  alternates: {
    canonical: process.env.NEXT_PUBLIC_SITE_URL || "https://stickmynote.com",
  },
  other: {
    "application/ld+json": JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Stick My Note",
      description: "Digital sticky notes application for organizing thoughts and ideas",
      url: process.env.NEXT_PUBLIC_SITE_URL || "https://stickmynote.com",
      applicationCategory: "ProductivityApplication",
      operatingSystem: "Web Browser",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    }),
  },
    generator: 'v0.app'
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#2563eb" },
    { media: "(prefers-color-scheme: dark)", color: "#1e1b4b" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ServiceWorkerRegister />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          Skip to main content
        </a>
        <ErrorBoundary>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            <AccessibilityProvider>
            <UserProvider>
              <OrganizationProvider>
                <OrgThemeProvider>
                  <KeyboardDetector />
                  <PresenceTracker />
                  <main id="main-content" className="pb-[env(safe-area-inset-bottom)]">{children}</main>
                  <MobileBottomNav />
                  <Toaster />
                  <ChatRequestNotifications />
                  <CookieConsentBanner />
                  <OfflineIndicator />
                  <PWAInstallPrompt />
                  <SWUpdateNotification />
                </OrgThemeProvider>
              </OrganizationProvider>
            </UserProvider>
          </AccessibilityProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
