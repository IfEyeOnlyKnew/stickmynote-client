import { notFound } from "next/navigation"
import { Libre_Bodoni, Public_Sans } from "next/font/google"
import { HostedArticle } from "@/components/hosted/HostedArticle"
import { getHostedPageBySlug } from "@/lib/handlers/hosted-page-handler"

const libreBodoni = Libre_Bodoni({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hosted-serif",
  display: "swap",
})

const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-hosted-sans",
  display: "swap",
})

export const dynamic = "force-dynamic"

export default async function HostedSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const data = await getHostedPageBySlug(slug)
  if (!data) notFound()
  return (
    <div className={`${libreBodoni.variable} ${publicSans.variable}`}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .hosted-article .font-serif { font-family: var(--font-hosted-serif), ui-serif, Georgia, serif; }
            .hosted-article .font-sans  { font-family: var(--font-hosted-sans), ui-sans-serif, system-ui, sans-serif; }
          `,
        }}
      />
      <div className="hosted-article">
        <HostedArticle data={data} />
      </div>
    </div>
  )
}
