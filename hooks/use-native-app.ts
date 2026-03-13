"use client"

import { useEffect, useState } from "react"
import { isNativeApp, isPWA, getPlatform, getInstallMode } from "@/lib/native/capacitor-bridge"

interface NativeAppInfo {
  isNative: boolean
  isPWA: boolean
  platform: "ios" | "android" | "web"
  installMode: "native" | "pwa" | "browser"
  hasNotch: boolean
}

export function useNativeApp(): NativeAppInfo {
  const [info, setInfo] = useState<NativeAppInfo>({
    isNative: false,
    isPWA: false,
    platform: "web",
    installMode: "browser",
    hasNotch: false,
  })

  useEffect(() => {
    const hasNotch =
      // iPhone X+ detection via CSS env
      CSS.supports("padding-top: env(safe-area-inset-top)") &&
      window.innerHeight > window.innerWidth &&
      window.devicePixelRatio >= 2

    setInfo({
      isNative: isNativeApp(),
      isPWA: isPWA(),
      platform: getPlatform(),
      installMode: getInstallMode(),
      hasNotch,
    })
  }, [])

  return info
}
