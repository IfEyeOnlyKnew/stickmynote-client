import { PanelSidebar } from "@/components/panel/panel-sidebar"

export const metadata = {
  title: "Community Sticks | StickyMyNote",
  description: "Browse and discover shared community sticks",
}

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <PanelSidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
