import { Libre_Bodoni, Public_Sans } from "next/font/google"
import { HostedArticle, type HostedArticleData } from "@/components/hosted/HostedArticle"

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

const fixture: HostedArticleData = {
  masthead: {
    wordmark: "Stick My Note",
    tagline: "Hosted from a Stick",
  },
  hero: {
    topic: "Company Picnic — May 15",
    deck: "A long-overdue gathering, a field full of kites, and a plan for what comes next.",
    authorName: "Chris Doran",
    createdAt: "2026-03-01T14:00:00Z",
    updatedAt: "2026-04-10T09:30:00Z",
    accentColor: "#6366f1",
  },
  lead:
    "After two quieter years, we're bringing the whole company back to the park. This page collects the plan, the schedule, the photos from last time, and the ideas people have been kicking around in the discussion below.",
  body:
    "We'll meet at Shelter 3 starting at 11am. Food arrives at noon. Games, a short speech from leadership, and then the rest of the day is yours. Bring family, bring friends, bring something to sit on.",
  sections: [
    {
      tabName: "Schedule",
      leadIn: "Here's the rough shape of the day — loose on purpose.",
      items: [
        {
          type: "event",
          title: "Arrival & setup",
          startsAt: "2026-05-15T11:00:00Z",
          description: "Shelter 3. Name tags, coffee, and a chance to catch up before things get noisy.",
        },
        {
          type: "event",
          title: "Lunch",
          startsAt: "2026-05-15T12:00:00Z",
          description: "Catered from La Cocina. Vegetarian and gluten-free options confirmed.",
        },
        {
          type: "event",
          title: "Short remarks & awards",
          startsAt: "2026-05-15T13:30:00Z",
          description: "Ten minutes, maximum. Promise.",
        },
      ],
      closing: "The afternoon is unstructured — fields, games, shade, and whatever you want to make of it.",
    },
    {
      tabName: "Last Year's Photos",
      leadIn: "A quick look back at 2025's picnic for anyone who missed it.",
      items: [
        {
          type: "image",
          url: "https://images.unsplash.com/photo-1506869640319-fe1a24fd76dc?w=1200",
          caption: "The kite-flying contest, still the most competitive event of the day.",
        },
        {
          type: "image",
          url: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200",
          caption: "Shelter 3 at lunch.",
        },
      ],
    },
    {
      tabName: "Helpful Links",
      leadIn: "A few resources people asked for in previous years.",
      items: [
        {
          type: "link",
          title: "Park map (PDF)",
          url: "https://example.com/parkmap.pdf",
          description: "Shelter 3 is in the northeast corner, past the pond.",
        },
        {
          type: "link",
          title: "Dietary restrictions form",
          url: "https://example.com/form",
          description: "Please fill out by May 1 so catering can plan.",
        },
      ],
    },
    {
      tabName: "A Quick Intro Video",
      leadIn: "Last year's recap, two minutes.",
      items: [
        {
          type: "video",
          url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
          caption: "2025 picnic recap.",
        },
      ],
    },
  ],
  discussion: {
    heading: "What people are saying",
    replies: [
      {
        id: "r1",
        author: "Amanda Doran",
        createdAt: "2026-04-02T15:20:00Z",
        body: "Can we do the kite contest again? That was genuinely the best part of last year.",
        replies: [
          {
            id: "r1a",
            author: "Chris Doran",
            createdAt: "2026-04-02T16:45:00Z",
            body: "Yes — already on the list. Bringing the same judges.",
          },
        ],
      },
      {
        id: "r2",
        author: "Erica Doran",
        createdAt: "2026-04-05T09:10:00Z",
        body: "Any chance of shade seating this year? Last year a few of us got roasted.",
      },
      {
        id: "r3",
        author: "Frank Miller",
        createdAt: "2026-04-08T11:00:00Z",
        body: "Counting the days. See everyone there.",
      },
    ],
  },
  footer: {
    stickId: "9e571e99-a70d-4870-83b5-1d2075cfcf04",
    permalink: "/hosted/9e571e99",
    publishedAt: "2026-04-14T12:00:00Z",
  },
}

export default function HostedPreviewPage() {
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
        <HostedArticle data={fixture} />
      </div>
    </div>
  )
}
