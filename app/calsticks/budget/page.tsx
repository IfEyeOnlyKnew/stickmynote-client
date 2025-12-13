import type { Metadata } from "next"
import BudgetClient from "./page-client"

export const metadata: Metadata = {
  title: "Budget & Cost Tracking | CalSticks",
  description: "Track project budgets and costs",
}

export default function BudgetPage() {
  return <BudgetClient />
}
