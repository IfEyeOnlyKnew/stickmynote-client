"use client"

import { useEffect, useRef, useCallback, useState } from "react"

export interface WsEvent {
  type: string
  payload: unknown
  timestamp: number
}

type EventHandler = (payload: any) => void

let globalWs: WebSocket | null = null
let globalConnected = false
let globalReconnectTimer: ReturnType<typeof setTimeout> | null = null
let globalReconnectAttempts = 0
const MAX_RECONNECT_DELAY = 30000
const globalHandlers = new Map<string, Set<EventHandler>>()
const globalListeners = new Set<() => void>()

function getWsUrl(): string {
  if (globalThis.window === undefined) return ""
  const protocol = globalThis.location.protocol === "https:" ? "wss:" : "ws:"
  return `${protocol}//${globalThis.location.host}/ws`
}

function notifyListeners() {
  for (const listener of globalListeners) {
    listener()
  }
}

function isWildcardMatch(pattern: string, type: string): boolean {
  if (!pattern.endsWith(".*")) return false
  const prefix = pattern.slice(0, -2)
  return type.startsWith(prefix + ".") && pattern !== type
}

function dispatchHandlers(handlers: Set<EventHandler>, payload: unknown) {
  for (const handler of handlers) {
    handler(payload)
  }
}

function handleMessage(event: MessageEvent) {
  try {
    const data: WsEvent = JSON.parse(event.data)
    if (!data.type) return

    // Dispatch to exact match handlers
    const exactHandlers = globalHandlers.get(data.type)
    if (exactHandlers) {
      dispatchHandlers(exactHandlers, data.payload)
    }

    // Dispatch to wildcard handlers (e.g., "chat_request.*" matches "chat_request.new")
    for (const [pattern, handlers] of globalHandlers) {
      if (isWildcardMatch(pattern, data.type)) {
        dispatchHandlers(handlers, data.payload)
      }
    }
  } catch {
    // Ignore malformed messages
  }
}

function isAlreadyConnected(): boolean {
  return !!globalWs && (globalWs.readyState === WebSocket.OPEN || globalWs.readyState === WebSocket.CONNECTING)
}

function connect() {
  if (globalThis.window === undefined) return
  if (isAlreadyConnected()) return

  const url = getWsUrl()
  if (!url) return

  try {
    globalWs = new WebSocket(url)

    globalWs.onopen = () => {
      console.log("[WebSocket] Connected")
      globalConnected = true
      globalReconnectAttempts = 0
      notifyListeners()
    }

    globalWs.onmessage = handleMessage

    globalWs.onclose = (event) => {
      console.log(`[WebSocket] Disconnected (code: ${event.code})`)
      globalConnected = false
      globalWs = null
      notifyListeners()

      // Auto-reconnect with exponential backoff
      if (event.code !== 1000) {
        scheduleReconnect()
      }
    }

    globalWs.onerror = () => {
      // onclose will fire after onerror, so reconnect handled there
      globalConnected = false
      notifyListeners()
    }
  } catch {
    globalConnected = false
    scheduleReconnect()
  }
}

function scheduleReconnect() {
  if (globalReconnectTimer) return

  const delay = Math.min(1000 * Math.pow(2, globalReconnectAttempts), MAX_RECONNECT_DELAY)
  globalReconnectAttempts++

  console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${globalReconnectAttempts})`)

  globalReconnectTimer = setTimeout(() => {
    globalReconnectTimer = null
    connect()
  }, delay)
}

function disconnect() {
  if (globalReconnectTimer) {
    clearTimeout(globalReconnectTimer)
    globalReconnectTimer = null
  }
  if (globalWs) {
    globalWs.close(1000)
    globalWs = null
  }
  globalConnected = false
  globalReconnectAttempts = 0
}

export function useWebSocket() {
  const [connected, setConnected] = useState(globalConnected)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    const listener = () => {
      if (mountedRef.current) {
        setConnected(globalConnected)
      }
    }

    globalListeners.add(listener)

    // Connect if not already connected
    connect()

    // Sync initial state
    setConnected(globalConnected)

    return () => {
      mountedRef.current = false
      globalListeners.delete(listener)

      // Only disconnect if no more listeners
      if (globalListeners.size === 0) {
        disconnect()
      }
    }
  }, [])

  const subscribe = useCallback((eventType: string, handler: EventHandler): (() => void) => {
    if (!globalHandlers.has(eventType)) {
      globalHandlers.set(eventType, new Set())
    }
    globalHandlers.get(eventType)!.add(handler)

    return () => {
      const handlers = globalHandlers.get(eventType)
      if (handlers) {
        handlers.delete(handler)
        if (handlers.size === 0) {
          globalHandlers.delete(eventType)
        }
      }
    }
  }, [])

  return { connected, subscribe }
}
