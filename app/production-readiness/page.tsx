import { ProductionReadiness } from "@/components/production-readiness"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"

export default function ProductionReadinessPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <BreadcrumbNav
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Production Readiness", current: true },
          ]}
        />

        <ProductionReadiness />
      </div>
    </main>
  )
}
