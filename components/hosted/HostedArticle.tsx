import React from "react"
import { format } from "date-fns"

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
  thumbnailUrl?: string
  startsAt?: string
  endsAt?: string
  caption?: string
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

function Masthead({ wordmark, tagline }: { wordmark: string; tagline: string }) {
  return (
    <div className="border-b bg-white/90 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="font-bold text-sm tracking-tight text-indigo-700">{wordmark}</span>
          <span className="text-xs text-gray-500">{tagline}</span>
        </div>
      </div>
    </div>
  )
}

function Hero({ hero }: { hero: HostedArticleData["hero"] }) {
  return (
    <header className="relative pt-10 pb-8 px-6">
      <div
        className="absolute left-0 top-0 h-1 w-full"
        style={{ backgroundColor: hero.accentColor }}
        aria-hidden
      />
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold font-serif leading-tight text-gray-900">
          {hero.topic || "Untitled"}
        </h1>
        {hero.deck && (
          <p className="mt-4 text-xl text-gray-600 leading-relaxed font-serif italic">{hero.deck}</p>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-2 text-sm text-gray-500">
          <span className="font-medium text-gray-700">{hero.authorName}</span>
          <span aria-hidden>·</span>
          <span>{formatDate(hero.createdAt)}</span>
          {hero.updatedAt && hero.updatedAt !== hero.createdAt && (
            <>
              <span aria-hidden>·</span>
              <span className="text-gray-400">Updated {formatDate(hero.updatedAt)}</span>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

function renderItem(item: HostedArticleSectionItem, idx: number, accent: string) {
  switch (item.type) {
    case "image":
      return (
        <figure key={idx} className="my-6">
          <img
            src={item.url}
            alt={item.caption || item.title || ""}
            className="w-full rounded-lg border shadow-sm"
          />
          {item.caption && (
            <figcaption className="text-sm text-gray-500 text-center mt-2 italic">{item.caption}</figcaption>
          )}
        </figure>
      )
    case "video":
      return (
        <figure key={idx} className="my-6">
          <div className="aspect-video rounded-lg overflow-hidden border shadow-sm bg-black">
            {item.url?.includes("youtube") || item.url?.includes("youtu.be") ? (
              <iframe
                src={item.url.replace("watch?v=", "embed/")}
                title={item.caption || "Video"}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video src={item.url} controls className="w-full h-full">
                <track kind="captions" />
              </video>
            )}
          </div>
          {item.caption && <figcaption className="text-sm text-gray-500 text-center mt-2">{item.caption}</figcaption>}
        </figure>
      )
    case "link":
      return (
        <a
          key={idx}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block my-3 p-4 border rounded-lg hover:border-gray-400 transition-colors"
        >
          <div className="font-medium text-gray-900">{item.title || item.url}</div>
          {item.description && <div className="text-sm text-gray-600 mt-1">{item.description}</div>}
          {item.url && <div className="text-xs mt-1" style={{ color: accent }}>{new URL(item.url).hostname}</div>}
        </a>
      )
    case "file":
      return (
        <a
          key={idx}
          href={item.url}
          className="flex items-center gap-3 my-3 p-3 border rounded-lg hover:border-gray-400 transition-colors"
        >
          <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xs">
            FILE
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900 truncate">{item.title || "Download"}</div>
            {item.description && <div className="text-xs text-gray-500 truncate">{item.description}</div>}
          </div>
        </a>
      )
    case "event":
      return (
        <div key={idx} className="my-4 p-4 border-l-4 rounded-r bg-gray-50" style={{ borderColor: accent }}>
          <div className="font-semibold text-gray-900">{item.title}</div>
          {item.startsAt && (
            <div className="text-sm text-gray-600 mt-1">
              {formatDate(item.startsAt)}
              {item.endsAt && ` – ${formatDate(item.endsAt)}`}
            </div>
          )}
          {item.description && <div className="text-sm text-gray-700 mt-2">{item.description}</div>}
        </div>
      )
    case "prose":
    default:
      if (item.html) {
        return (
          <div
            key={idx}
            className="my-4 text-gray-800 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: item.html }}
          />
        )
      }
      return (
        <p key={idx} className="my-4 text-gray-800 leading-relaxed">
          {item.description}
        </p>
      )
  }
}

function Section({ section, accent }: { section: HostedArticleSection; accent: string }) {
  return (
    <section className="max-w-3xl mx-auto px-6 py-8">
      <h2
        className="text-2xl md:text-3xl font-bold font-serif text-gray-900 pb-2 mb-4 border-b-2"
        style={{ borderColor: accent }}
      >
        {section.tabName}
      </h2>
      {section.leadIn && <p className="text-lg text-gray-700 leading-relaxed italic mb-4">{section.leadIn}</p>}
      <div>{section.items.map((item, i) => renderItem(item, i, accent))}</div>
      {section.closing && <p className="mt-4 text-gray-700 leading-relaxed">{section.closing}</p>}
    </section>
  )
}

function ReplyNode({ reply, depth = 0 }: { reply: HostedArticleReply; depth?: number }) {
  return (
    <div className={depth > 0 ? "ml-6 border-l-2 border-gray-200 pl-4 mt-3" : "mt-4"}>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="font-medium text-sm text-gray-900">{reply.author}</span>
        <span className="text-xs text-gray-400">{formatDate(reply.createdAt)}</span>
      </div>
      <div className="text-gray-800 leading-relaxed">{reply.body}</div>
      {reply.replies?.map((r) => (
        <ReplyNode key={r.id} reply={r} depth={depth + 1} />
      ))}
    </div>
  )
}

function Discussion({ discussion, accent }: { discussion: NonNullable<HostedArticleData["discussion"]>; accent: string }) {
  if (!discussion.replies.length) return null
  return (
    <section className="max-w-3xl mx-auto px-6 py-8 border-t">
      <h2
        className="text-2xl md:text-3xl font-bold font-serif text-gray-900 pb-2 mb-4 border-b-2"
        style={{ borderColor: accent }}
      >
        {discussion.heading}
      </h2>
      <div>
        {discussion.replies.map((r) => (
          <ReplyNode key={r.id} reply={r} />
        ))}
      </div>
    </section>
  )
}

function Footer({ footer, wordmark }: { footer: HostedArticleData["footer"]; wordmark: string }) {
  return (
    <footer className="border-t mt-8 py-8 bg-gray-50">
      <div className="max-w-3xl mx-auto px-6 text-center text-sm text-gray-500">
        <div>
          Published from <span className="font-semibold text-indigo-700">{wordmark}</span> · Stick{" "}
          <code className="text-xs bg-white px-1 py-0.5 rounded border">{footer.stickId}</code>
        </div>
        <div className="mt-1 text-xs text-gray-400">{formatDate(footer.publishedAt)}</div>
      </div>
    </footer>
  )
}

export function HostedArticle({ data }: { data: HostedArticleData }) {
  const accent = data.hero.accentColor || "#6366f1"
  return (
    <article className="min-h-screen bg-white text-gray-900">
      <Masthead wordmark={data.masthead.wordmark} tagline={data.masthead.tagline} />
      <Hero hero={data.hero} />

      {(data.lead || data.body) && (
        <section className="max-w-3xl mx-auto px-6 py-4">
          {data.lead && <p className="text-xl text-gray-800 leading-relaxed font-serif mb-6">{data.lead}</p>}
          {data.body && (
            <div className="text-gray-800 leading-relaxed whitespace-pre-wrap">{data.body}</div>
          )}
        </section>
      )}

      {data.sections.map((s, i) => (
        <Section key={i} section={s} accent={accent} />
      ))}

      {data.discussion && <Discussion discussion={data.discussion} accent={accent} />}

      <Footer footer={data.footer} wordmark={data.masthead.wordmark} />
    </article>
  )
}
