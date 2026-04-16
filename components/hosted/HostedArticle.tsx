import React from "react"
import { format } from "date-fns"
import { Link2, FileDown, MessageSquare, Video as VideoIcon, CalendarDays } from "lucide-react"

export interface HostedArticleReply {
  id: string
  author: string
  authorAvatarUrl?: string | null
  createdAt: string
  body: string
  replies?: HostedArticleReply[]
}

export interface HostedArticleSectionItem {
  type: "link" | "image" | "video" | "file" | "event" | "prose"
  title?: string
  description?: string
  url?: string
  embedUrl?: string
  platform?: string
  thumbnailUrl?: string
  startsAt?: string
  endsAt?: string
  caption?: string
  alt?: string
  html?: string
}

export interface HostedArticleSection {
  tabName: string
  leadIn?: string
  items: HostedArticleSectionItem[]
  closing?: string
}

export interface HostedArticleData {
  masthead: { wordmark: string; tagline: string }
  hero: {
    topic: string
    deck?: string
    authorName: string
    createdAt: string
    updatedAt?: string
    accentColor: string
  }
  lead?: string
  body?: string
  sections: HostedArticleSection[]
  discussion?: { heading: string; replies: HostedArticleReply[] }
  footer: { stickId: string; permalink: string; publishedAt: string }
}

function formatDate(iso: string): string {
  try {
    return format(new Date(iso), "MMMM d, yyyy")
  } catch {
    return iso
  }
}

function hostnameFromUrl(url: string | undefined): string {
  if (!url) return ""
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

function toYouTubeEmbed(url: string): string | null {
  const youtube = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{6,})/i.exec(url)
  return youtube ? `https://www.youtube.com/embed/${youtube[1]}` : null
}

function toVimeoEmbed(url: string): string | null {
  const vimeo = /vimeo\.com\/(?:video\/)?(\d+)/i.exec(url)
  return vimeo ? `https://player.vimeo.com/video/${vimeo[1]}` : null
}

function resolveVideoEmbed(item: HostedArticleSectionItem): { kind: "iframe"; src: string } | { kind: "video"; src: string } | null {
  if (item.embedUrl) return { kind: "iframe", src: item.embedUrl }
  if (!item.url) return null
  const yt = toYouTubeEmbed(item.url)
  if (yt) return { kind: "iframe", src: yt }
  const vm = toVimeoEmbed(item.url)
  if (vm) return { kind: "iframe", src: vm }
  if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(item.url)) return { kind: "video", src: item.url }
  return { kind: "iframe", src: item.url }
}

// ============================================================================
// Masthead
// ============================================================================

function Masthead({ wordmark, tagline }: { wordmark: string; tagline: string }) {
  return (
    <div className="border-b border-zinc-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 sticky top-0 z-40 print:static print:border-b print:bg-white">
      <div className="mx-auto max-w-[960px] px-4 md:px-8 py-3 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <span className="font-serif font-semibold text-sm tracking-tight text-zinc-900">{wordmark}</span>
          <span className="h-3 w-px bg-zinc-300" aria-hidden />
          <span className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">{tagline}</span>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Hero
// ============================================================================

function Hero({ hero }: { hero: HostedArticleData["hero"] }) {
  return (
    <header className="relative">
      <div
        className="h-1 w-full"
        style={{ backgroundColor: hero.accentColor }}
        aria-hidden
      />
      <div className="mx-auto max-w-[720px] px-4 md:px-8 pt-12 md:pt-20 pb-8 md:pb-12">
        <div className="mb-6 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
          Feature · {formatDate(hero.createdAt)}
        </div>

        <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl leading-[1.05] tracking-tight text-zinc-900">
          {hero.topic || "Untitled"}
        </h1>

        {hero.deck && (
          <p className="mt-6 font-serif text-lg md:text-xl leading-relaxed text-zinc-600 italic">
            {hero.deck}
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-600">
          <span className="font-medium text-zinc-900">{hero.authorName}</span>
          {hero.updatedAt && hero.updatedAt !== hero.createdAt && (
            <>
              <span className="text-zinc-300" aria-hidden>·</span>
              <span className="text-zinc-500">Updated {formatDate(hero.updatedAt)}</span>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

// ============================================================================
// Prose + Lead
// ============================================================================

function LeadAndBody({ lead, body }: { lead?: string; body?: string }) {
  if (!lead && !body) return null
  return (
    <section className="mx-auto max-w-[720px] px-4 md:px-8 pb-8">
      {lead && (
        <p className="font-serif text-xl md:text-2xl leading-relaxed text-zinc-800 first-letter:font-serif first-letter:text-6xl first-letter:font-semibold first-letter:mr-2 first-letter:float-left first-letter:leading-[0.9] first-letter:mt-1">
          {lead}
        </p>
      )}
      {body && (
        <div className="mt-8 space-y-5 font-sans text-lg leading-[1.7] text-zinc-800 whitespace-pre-wrap">
          {body}
        </div>
      )}
    </section>
  )
}

// ============================================================================
// Item renderers
// ============================================================================

function ImageFigure({ item }: { item: HostedArticleSectionItem }) {
  if (!item.url) return null
  return (
    <figure className="my-10 md:-mx-20">
      <img
        src={item.url}
        alt={item.alt || item.caption || ""}
        loading="lazy"
        className="w-full rounded-sm border border-zinc-200"
      />
      {item.caption && (
        <figcaption className="mt-3 px-2 md:px-20 font-serif text-sm italic text-zinc-500 text-center">
          {item.caption}
        </figcaption>
      )}
    </figure>
  )
}

function VideoFigure({ item }: { item: HostedArticleSectionItem }) {
  const resolved = resolveVideoEmbed(item)
  if (!resolved) return null
  return (
    <figure className="my-10 md:-mx-20">
      <div className="aspect-video overflow-hidden rounded-sm border border-zinc-200 bg-zinc-900">
        {resolved.kind === "iframe" ? (
          <iframe
            src={resolved.src}
            title={item.caption || item.title || "Video"}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        ) : (
          <video src={resolved.src} controls className="w-full h-full" preload="metadata">
            <track kind="captions" />
          </video>
        )}
      </div>
      {(item.caption || item.title) && (
        <figcaption className="mt-3 px-2 md:px-20 font-serif text-sm italic text-zinc-500 text-center">
          {item.caption || item.title}
        </figcaption>
      )}
    </figure>
  )
}

function LinkCard({ item, accent }: { item: HostedArticleSectionItem; accent: string }) {
  if (!item.url) return null
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block my-4 p-5 border border-zinc-200 bg-white transition-colors duration-200 hover:border-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-zinc-900"
    >
      <div className="flex items-start gap-4">
        <div className="mt-1 flex-shrink-0 p-2 rounded-sm bg-zinc-100 group-hover:bg-zinc-200 transition-colors">
          <Link2 className="h-4 w-4 text-zinc-700" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-sans font-semibold text-base text-zinc-900 leading-snug">
            {item.title || item.url}
          </div>
          {item.description && (
            <p className="mt-1 text-sm text-zinc-600 leading-relaxed line-clamp-2">{item.description}</p>
          )}
          <div
            className="mt-2 text-xs uppercase tracking-wider transition-colors duration-200"
            style={{ color: accent }}
          >
            {hostnameFromUrl(item.url)}
          </div>
        </div>
      </div>
    </a>
  )
}

function FileCard({ item }: { item: HostedArticleSectionItem }) {
  if (!item.url) return null
  return (
    <a
      href={item.url}
      className="group flex items-center gap-4 my-3 p-4 border border-zinc-200 bg-white transition-colors hover:border-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-zinc-900"
    >
      <div className="flex-shrink-0 p-2.5 rounded-sm bg-zinc-100 group-hover:bg-zinc-200 transition-colors">
        <FileDown className="h-4 w-4 text-zinc-700" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-sans font-semibold text-sm text-zinc-900 truncate">{item.title || "Download"}</div>
        {item.description && <div className="text-xs text-zinc-500 truncate mt-0.5">{item.description}</div>}
      </div>
    </a>
  )
}

function EventCard({ item, accent }: { item: HostedArticleSectionItem; accent: string }) {
  return (
    <div
      className="my-5 p-5 border border-zinc-200 bg-white relative"
    >
      <div
        className="absolute top-0 left-0 h-full w-1"
        style={{ backgroundColor: accent }}
        aria-hidden
      />
      <div className="pl-4 flex items-start gap-3">
        <CalendarDays className="mt-0.5 h-4 w-4 flex-shrink-0 text-zinc-500" aria-hidden />
        <div className="flex-1">
          <div className="font-sans font-semibold text-zinc-900">{item.title}</div>
          {item.startsAt && (
            <div className="mt-1 text-sm text-zinc-600">
              {formatDate(item.startsAt)}
              {item.endsAt && ` – ${formatDate(item.endsAt)}`}
            </div>
          )}
          {item.description && <p className="mt-2 text-sm text-zinc-700 leading-relaxed">{item.description}</p>}
        </div>
      </div>
    </div>
  )
}

function ProseBlock({ item }: { item: HostedArticleSectionItem }) {
  if (item.html) {
    return (
      <div
        className="my-6 font-sans text-lg leading-[1.7] text-zinc-800 [&>p]:mb-4 [&_a]:underline [&_a]:text-zinc-900 [&_strong]:font-semibold [&_em]:italic [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-1 [&_blockquote]:border-l-2 [&_blockquote]:border-zinc-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-zinc-600"
        dangerouslySetInnerHTML={{ __html: item.html }}
      />
    )
  }
  if (item.description) {
    return <p className="my-5 font-sans text-lg leading-[1.7] text-zinc-800">{item.description}</p>
  }
  return null
}

function SectionItem({ item, accent }: { item: HostedArticleSectionItem; accent: string }) {
  switch (item.type) {
    case "image":
      return <ImageFigure item={item} />
    case "video":
      return <VideoFigure item={item} />
    case "link":
      return <LinkCard item={item} accent={accent} />
    case "file":
      return <FileCard item={item} />
    case "event":
      return <EventCard item={item} accent={accent} />
    case "prose":
    default:
      return <ProseBlock item={item} />
  }
}

// ============================================================================
// Section
// ============================================================================

function Section({ section, accent }: { section: HostedArticleSection; accent: string }) {
  return (
    <section className="mx-auto max-w-[720px] px-4 md:px-8 py-10 md:py-14">
      <div className="mb-8">
        <h2 className="font-serif text-3xl md:text-4xl leading-tight tracking-tight text-zinc-900">
          {section.tabName}
        </h2>
        <div
          className="mt-3 h-0.5 w-12"
          style={{ backgroundColor: accent }}
          aria-hidden
        />
      </div>

      {section.leadIn && (
        <p className="mb-6 font-serif text-lg md:text-xl italic leading-relaxed text-zinc-600">
          {section.leadIn}
        </p>
      )}

      <div>
        {section.items.map((item, i) => (
          <SectionItem key={i} item={item} accent={accent} />
        ))}
      </div>

      {section.closing && (
        <p className="mt-8 font-sans text-lg leading-[1.7] text-zinc-700">{section.closing}</p>
      )}
    </section>
  )
}

// ============================================================================
// Discussion
// ============================================================================

function ReplyNode({ reply, depth = 0, accent }: { reply: HostedArticleReply; depth?: number; accent: string }) {
  return (
    <div
      className={
        depth > 0
          ? "mt-4 ml-4 md:ml-6 border-l border-zinc-200 pl-4 md:pl-6"
          : "mt-6 border-l-2 pl-5"
      }
      style={depth === 0 ? { borderColor: accent } : undefined}
    >
      <div className="flex items-baseline gap-3 mb-1.5">
        <span className="font-sans font-semibold text-sm text-zinc-900">{reply.author}</span>
        <span className="text-xs uppercase tracking-wider text-zinc-400">{formatDate(reply.createdAt)}</span>
      </div>
      <p className="font-sans text-base leading-relaxed text-zinc-700 whitespace-pre-wrap">{reply.body}</p>
      {reply.replies?.map((r) => (
        <ReplyNode key={r.id} reply={r} depth={depth + 1} accent={accent} />
      ))}
    </div>
  )
}

function Discussion({ discussion, accent }: { discussion: NonNullable<HostedArticleData["discussion"]>; accent: string }) {
  if (!discussion.replies.length) return null
  return (
    <section className="mx-auto max-w-[720px] px-4 md:px-8 py-10 md:py-14 border-t border-zinc-200">
      <div className="mb-8 flex items-center gap-3">
        <MessageSquare className="h-5 w-5 text-zinc-500" aria-hidden />
        <h2 className="font-serif text-3xl md:text-4xl leading-tight tracking-tight text-zinc-900">
          {discussion.heading}
        </h2>
      </div>
      <div>
        {discussion.replies.map((r) => (
          <ReplyNode key={r.id} reply={r} accent={accent} />
        ))}
      </div>
    </section>
  )
}

// ============================================================================
// Footer
// ============================================================================

function Footer({ footer, wordmark }: { footer: HostedArticleData["footer"]; wordmark: string }) {
  return (
    <footer className="mt-12 border-t border-zinc-200 bg-zinc-50 print:bg-white">
      <div className="mx-auto max-w-[720px] px-4 md:px-8 py-10 text-center">
        <div className="font-serif text-lg text-zinc-900 mb-2">{wordmark}</div>
        <div className="text-sm text-zinc-500">
          Published from Stick <code className="font-mono text-xs text-zinc-400">{footer.stickId.slice(0, 8)}</code> · {formatDate(footer.publishedAt)}
        </div>
      </div>
    </footer>
  )
}

// ============================================================================
// Main component
// ============================================================================

export function HostedArticle({ data }: { data: HostedArticleData }) {
  const accent = data.hero.accentColor || "#18181B"
  return (
    <article className="min-h-screen bg-[#FAFAFA] text-zinc-900 antialiased print:bg-white">
      <Masthead wordmark={data.masthead.wordmark} tagline={data.masthead.tagline} />
      <Hero hero={data.hero} />
      <LeadAndBody lead={data.lead} body={data.body} />

      {data.sections.map((s, i) => (
        <Section key={i} section={s} accent={accent} />
      ))}

      {data.discussion && <Discussion discussion={data.discussion} accent={accent} />}

      <Footer footer={data.footer} wordmark={data.masthead.wordmark} />
    </article>
  )
}
