"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Monitor,
  Apple,
  Download,
  Globe,
  Smartphone,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react"

function BackButton() {
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <ArrowLeft className="h-4 w-4" />
      Back
    </button>
  )
}

type Platform = "windows" | "mac" | "linux" | "unknown"

interface DownloadInfo {
  platform: Platform
  label: string
  icon: React.ElementType
  filename: string
  description: string
}

const GITHUB_RELEASES_BASE = "https://github.com/IfEyeOnlyKnew/stickmynote-desktop/releases/latest/download"

const downloads: Record<string, DownloadInfo> = {
  windows: {
    platform: "windows",
    label: "Windows",
    icon: Monitor,
    filename: "StickMyNote_Setup.exe",
    description: "Windows 10 or later (64-bit)",
  },
  mac: {
    platform: "mac",
    label: "macOS",
    icon: Apple,
    filename: "StickMyNote.dmg",
    description: "macOS 10.15 (Catalina) or later",
  },
  linux: {
    platform: "linux",
    label: "Linux",
    icon: Monitor,
    filename: "StickMyNote.AppImage",
    description: "Ubuntu 20.04, Fedora 36, or equivalent",
  },
}

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "unknown"
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes("win")) return "windows"
  if (ua.includes("mac")) return "mac"
  if (ua.includes("linux")) return "linux"
  return "unknown"
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export default function DownloadPage() {
  const [detectedPlatform, setDetectedPlatform] = useState<Platform>("unknown")
  const [pwaPrompt, setPwaPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isPWAInstalled, setIsPWAInstalled] = useState(false)

  useEffect(() => {
    setDetectedPlatform(detectPlatform())

    // Check if already installed as PWA
    const standalone =
      globalThis.matchMedia("(display-mode: standalone)").matches ||
      (globalThis.navigator as unknown as { standalone?: boolean }).standalone === true
    setIsPWAInstalled(standalone)

    // Capture PWA install prompt
    const handler = (e: Event) => {
      e.preventDefault()
      setPwaPrompt(e as BeforeInstallPromptEvent)
    }
    globalThis.addEventListener("beforeinstallprompt", handler)
    return () => globalThis.removeEventListener("beforeinstallprompt", handler)
  }, [])

  const handlePWAInstall = useCallback(async () => {
    if (!pwaPrompt) return
    pwaPrompt.prompt()
    const { outcome } = await pwaPrompt.userChoice
    if (outcome === "accepted") {
      setIsPWAInstalled(true)
    }
    setPwaPrompt(null)
  }, [pwaPrompt])

  const primaryDownload = detectedPlatform === "unknown" ? null : downloads[detectedPlatform]
  const otherDownloads = Object.values(downloads).filter(
    (d) => d.platform !== detectedPlatform,
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-950 dark:to-gray-900">
      {/* Header */}
      <div className="container-adaptive py-8">
        <BackButton />
      </div>

      {/* Hero */}
      <div className="container-adaptive text-center pb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          Get Stick My Note
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Install Stick My Note on your device for quick access, offline support, and native
          notifications. Choose the option that works best for you.
        </p>
      </div>

      <div className="container-adaptive max-w-4xl pb-16 space-y-8">
        {/* PWA Install (Recommended) */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                Recommended
              </span>
            </div>
            <CardTitle className="flex items-center gap-3 text-xl">
              <Globe className="h-6 w-6 text-primary" />
              Install from Browser
            </CardTitle>
            <CardDescription>
              No download required. Install directly from your browser for instant access with offline
              support and push notifications.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {isPWAInstalled && (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Already installed</span>
                </div>
              )}
              {!isPWAInstalled && pwaPrompt && (
                <Button onClick={handlePWAInstall} size="lg">
                  <Download className="h-4 w-4 mr-2" />
                  Install Now
                </Button>
              )}
              {!isPWAInstalled && !pwaPrompt && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    <strong>Chrome / Edge:</strong> Click the install icon in the address bar, or use the
                    menu &gt; &quot;Install Stick My Note&quot;
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <strong>Safari (iOS):</strong> Tap Share &gt; &quot;Add to Home Screen&quot;
                  </p>
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Offline access
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Push notifications
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Auto-updates
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Works on all platforms
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Desktop Download */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Desktop App</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Native desktop app with system tray, global shortcuts, and deep OS integration.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Primary platform first */}
            {primaryDownload && (
              <DesktopDownloadCard info={primaryDownload} recommended />
            )}
            {otherDownloads.map((info) => (
              <DesktopDownloadCard key={info.platform} info={info} />
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> System tray
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Global shortcut (Ctrl+Shift+S)
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Auto-start on login
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Native notifications
            </span>
          </div>
        </div>

        {/* Mobile */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Mobile</h2>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Smartphone className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">iOS & Android</h3>
                <p className="text-sm text-muted-foreground">
                  Use the browser install option above, or visit{" "}
                  <strong>stickmynote.com</strong> on your phone and add to your home screen.
                  Native app store versions coming soon.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function DesktopDownloadCard({
  info,
  recommended,
}: Readonly<{
  info: DownloadInfo
  recommended?: boolean
}>) {
  const Icon = info.icon
  const downloadUrl = `${GITHUB_RELEASES_BASE}/${info.filename}`

  return (
    <Card className={recommended ? "border-primary/30 ring-1 ring-primary/10" : ""}>
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium">{info.label}</h3>
              {recommended && (
                <span className="text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                  Your OS
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{info.description}</p>
            <Button
              asChild
              size="sm"
              variant={recommended ? "default" : "outline"}
              className="mt-3"
            >
              <a href={downloadUrl} download>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Download {info.filename.split(".").pop()?.toUpperCase()}
              </a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
