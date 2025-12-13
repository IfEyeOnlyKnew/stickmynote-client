import { createSupabaseBrowser } from "@/lib/supabase-browser"
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js"

export interface RealtimeSyncOptions {
  table: string
  filter?: string
  onInsert?: (payload: any) => void
  onUpdate?: (payload: any) => void
  onDelete?: (payload: any) => void
}

export class RealtimeSync {
  private channel: RealtimeChannel | null = null
  private supabase = createSupabaseBrowser()

  constructor(
    private channelName: string,
    private options: RealtimeSyncOptions,
  ) {}

  subscribe() {
    if (this.channel) {
      console.log("[v0] Already subscribed to realtime channel")
      return
    }

    this.channel = this.supabase.channel(this.channelName)

    // Setup table listeners
    const filter = this.options.filter || "*"

    if (this.channel) {
      if (this.options.onInsert) {
        this.channel.on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: this.options.table,
            filter,
          },
          (payload: RealtimePostgresChangesPayload<Record<string, any>>) => {
            console.log("[v0] Realtime INSERT:", payload)
            this.options.onInsert?.(payload)
          },
        )
      }

      if (this.options.onUpdate) {
        this.channel.on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: this.options.table,
            filter,
          },
          (payload: RealtimePostgresChangesPayload<Record<string, any>>) => {
            console.log("[v0] Realtime UPDATE:", payload)
            this.options.onUpdate?.(payload)
          },
        )
      }

      if (this.options.onDelete) {
        this.channel.on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: this.options.table,
            filter,
          },
          (payload: RealtimePostgresChangesPayload<Record<string, any>>) => {
            console.log("[v0] Realtime DELETE:", payload)
            this.options.onDelete?.(payload)
          },
        )
      }

      this.channel.subscribe((status: string) => {
        console.log("[v0] Realtime subscription status:", status)
      })
    }
  }

  unsubscribe() {
    if (this.channel) {
      this.supabase.removeChannel(this.channel)
      this.channel = null
    }
  }
}
