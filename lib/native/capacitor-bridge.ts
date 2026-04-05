/**
 * Capacitor Native Bridge
 *
 * Provides a unified API for native mobile features.
 * Falls back gracefully to web APIs when not running in Capacitor.
 *
 * Capacitor plugins are dynamically imported and only loaded when running
 * inside a native app. The @ts-ignore comments suppress TS2307 errors for
 * packages that are only installed in the native project.
 */

/** Check if running inside a Capacitor native app */
export function isNativeApp(): boolean {
  if (typeof globalThis.window === "undefined") return false
  return !!(globalThis as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
    ?.isNativePlatform?.()
}

/** Get the current platform */
export function getPlatform(): "ios" | "android" | "web" {
  if (typeof globalThis.window === "undefined") return "web"
  const cap = (globalThis as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor
  return (cap?.getPlatform?.() as "ios" | "android") || "web"
}

/** Check if the app is running as a PWA (standalone) */
export function isPWA(): boolean {
  if (typeof globalThis.window === "undefined") return false
  return (
    globalThis.matchMedia("(display-mode: standalone)").matches ||
    (globalThis.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

/** Get the install mode */
export function getInstallMode(): "native" | "pwa" | "browser" {
  if (isNativeApp()) return "native"
  if (isPWA()) return "pwa"
  return "browser"
}

/**
 * Request push notification permissions and get token.
 * Uses Capacitor PushNotifications on native, web Push API otherwise.
 */
export async function requestPushPermission(): Promise<string | null> {
  if (isNativeApp()) {
    try {
      // @ts-ignore -- Only available in native Capacitor builds
      const { PushNotifications } = await import("@capacitor/push-notifications")
      const result = await PushNotifications.requestPermissions()
      if (result.receive === "granted") {
        await PushNotifications.register()
        return new Promise((resolve) => {
          PushNotifications.addListener("registration", (token: { value: string }) => {
            resolve(token.value)
          })
          PushNotifications.addListener("registrationError", () => {
            resolve(null)
          })
        })
      }
    } catch {
      // Plugin not available
    }
    return null
  }

  // Web Push API fallback
  if ("Notification" in globalThis && "serviceWorker" in navigator) {
    const permission = await Notification.requestPermission()
    if (permission === "granted") {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      })
      return JSON.stringify(subscription)
    }
  }
  return null
}

/**
 * Trigger haptic feedback on native devices.
 */
export async function hapticFeedback(style: "light" | "medium" | "heavy" = "light"): Promise<void> {
  if (isNativeApp()) {
    try {
      // @ts-ignore -- Only available in native Capacitor builds
      const { Haptics, ImpactStyle } = await import("@capacitor/haptics")
      const styleMap = {
        light: ImpactStyle.Light,
        medium: ImpactStyle.Medium,
        heavy: ImpactStyle.Heavy,
      }
      await Haptics.impact({ style: styleMap[style] })
    } catch {
      // Plugin not available
    }
    return
  }

  // Web Vibration API fallback
  if ("vibrate" in navigator) {
    const durations = { light: 10, medium: 20, heavy: 30 }
    navigator.vibrate(durations[style])
  }
}

/**
 * Share content using native share sheet or Web Share API.
 */
export async function shareContent(data: {
  title?: string
  text?: string
  url?: string
}): Promise<boolean> {
  if (isNativeApp()) {
    try {
      // @ts-ignore -- Only available in native Capacitor builds
      const { Share } = await import("@capacitor/share")
      await Share.share(data)
      return true
    } catch {
      return false
    }
  }

  // Web Share API
  if (navigator.share) {
    try {
      await navigator.share(data)
      return true
    } catch {
      return false
    }
  }

  // Clipboard fallback
  if (data.url && navigator.clipboard) {
    await navigator.clipboard.writeText(data.url)
    return true
  }

  return false
}

/**
 * Use biometric authentication if available.
 */
export async function authenticateWithBiometrics(): Promise<boolean> {
  if (!isNativeApp()) return false
  try {
    // @ts-ignore -- Only available in native Capacitor builds
    const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth")
    await BiometricAuth.authenticate({
      reason: "Verify your identity",
      cancelTitle: "Cancel",
    })
    return true
  } catch {
    return false
  }
}

/**
 * Configure the native status bar.
 */
export async function configureStatusBar(dark: boolean): Promise<void> {
  if (!isNativeApp()) return
  try {
    // @ts-ignore -- Only available in native Capacitor builds
    const { StatusBar, Style } = await import("@capacitor/status-bar")
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light })
    await StatusBar.setBackgroundColor({ color: dark ? "#1e1b4b" : "#2563eb" })
  } catch {
    // Plugin not available
  }
}

/**
 * Handle safe area insets for notched devices.
 */
export function getSafeAreaInsets(): { top: number; bottom: number; left: number; right: number } {
  if (typeof globalThis.window === "undefined") return { top: 0, bottom: 0, left: 0, right: 0 }

  const style = getComputedStyle(document.documentElement)
  return {
    top: Number.parseInt(style.getPropertyValue("env(safe-area-inset-top)") || "0", 10),
    bottom: Number.parseInt(style.getPropertyValue("env(safe-area-inset-bottom)") || "0", 10),
    left: Number.parseInt(style.getPropertyValue("env(safe-area-inset-left)") || "0", 10),
    right: Number.parseInt(style.getPropertyValue("env(safe-area-inset-right)") || "0", 10),
  }
}
