import type { Metadata } from "next"
import IntakeFormClient from "./page-client"

export const metadata: Metadata = {
  title: "Submit Request | CalSticks",
  description: "Submit a new task request",
}

interface PageProps {
  params: {
    token: string
  }
}

export default function IntakeFormPage({ params }: Readonly<PageProps>) {
  return <IntakeFormClient token={params.token} />
}
