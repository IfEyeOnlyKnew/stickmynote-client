import { notFound } from "next/navigation"
import { HostedArticle } from "@/components/hosted/HostedArticle"
import { getHostedPageBySlug } from "@/lib/handlers/hosted-page-handler"

export const dynamic = "force-dynamic"

export default async function HostedSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const data = await getHostedPageBySlug(slug)
  if (!data) notFound()
  return <HostedArticle data={data} />
}
