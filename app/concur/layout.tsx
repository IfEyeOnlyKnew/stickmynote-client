import { PanelSidebar } from "@/components/panel/panel-sidebar"

export const metadata = {
  title: "Concur Groups | StickyMyNote",
  description: "Concur community groups for discussions and collaboration",
}

export default function ConcurLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex h-screen overflow-hidden">
      <PanelSidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
