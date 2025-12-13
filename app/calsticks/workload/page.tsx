import type { Metadata } from "next"
import WorkloadClient from "./page-client"

export const metadata: Metadata = {
  title: "Resource Workload | CalSticks",
  description: "View team capacity and workload distribution",
}

export default function WorkloadPage() {
  return <WorkloadClient />
}
