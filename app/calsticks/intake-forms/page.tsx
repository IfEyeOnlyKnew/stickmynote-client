import type { Metadata } from "next"
import IntakeFormsClient from "./page-client"

export const metadata: Metadata = {
  title: "Intake Forms | CalSticks",
  description: "Manage public intake forms",
}

export default function IntakeFormsPage() {
  return <IntakeFormsClient />
}
