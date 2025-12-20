import { SystemConfigCheck } from "@/components/system-config-check"
import { isDiagnosticAccessible } from "@/lib/is-production"
import { notFound } from "next/navigation"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"

export default function ConfigCheckPage() {
  if (!isDiagnosticAccessible()) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="container mx-auto py-8">
        <BreadcrumbNav
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Config Check", current: true },
          ]}
        />

        <SystemConfigCheck />
      </div>
    </div>
  )
}
