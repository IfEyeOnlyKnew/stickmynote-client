import type { Metadata } from "next"
import PortfolioClient from "./page-client"

export const metadata: Metadata = {
  title: "Portfolio Dashboard | CalSticks",
  description: "Portfolio overview and OKR tracking",
}

export default function PortfolioPage() {
  return <PortfolioClient />
}
