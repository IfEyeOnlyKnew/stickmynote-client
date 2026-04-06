"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { AuthFormModal } from "@/components/auth-form-modal"
import { StickyNote, Search, Palette, Share2, Lock, Star, CheckCircle, Video, BrainCircuit, Maximize2, Sparkles, Trash2 } from "lucide-react"
import Link from "next/link"
import { Caveat, Inter } from "next/font/google"

const caveat = Caveat({ subsets: ["latin"], weight: ["400", "500", "600", "700"] })
const inter = Inter({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"] })

/* ─── Typing animation sequences ─── */
const typingSequences = [
  { label: "Task", text: "Ship the new dashboard by Friday. Tag @design for review..." },
  { label: "Video", text: "https://youtube.com/watch?v=team-standup-recording" },
  { label: "Ask AI", text: "Summarize all notes from this week's sprint planning..." },
  { label: "Collab", text: "Hey team — I pinned the Q2 roadmap. Drop your feedback!" },
]

/* ─── Typewriter hook ─── */
function useTypewriter(sequences: typeof typingSequences) {
  const [seqIndex, setSeqIndex] = useState(0)
  const [charIndex, setCharIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    const current = sequences[seqIndex]
    const speed = isDeleting ? 25 : 45
    const pauseAtEnd = 2200
    const pauseAtStart = 400

    if (!isDeleting && charIndex === current.text.length) {
      const t = setTimeout(() => setIsDeleting(true), pauseAtEnd)
      return () => clearTimeout(t)
    }

    if (isDeleting && charIndex === 0) {
      const t = setTimeout(() => {
        setIsDeleting(false)
        setSeqIndex((prev) => (prev + 1) % sequences.length)
      }, pauseAtStart)
      return () => clearTimeout(t)
    }

    const t = setTimeout(() => {
      setCharIndex((prev) => prev + (isDeleting ? -1 : 1))
    }, speed)
    return () => clearTimeout(t)
  }, [charIndex, isDeleting, seqIndex, sequences])

  return {
    text: sequences[seqIndex].text.slice(0, charIndex),
    label: sequences[seqIndex].label,
  }
}

/* ─── Sticky-note card component ─── */
function StickyNoteCard({
  color,
  rotate,
  children,
  className = "",
}: Readonly<{
  color: string
  rotate: string
  children: React.ReactNode
  className?: string
}>) {
  return (
    <div
      className={`relative p-6 rounded-[2px] shadow-[3px_4px_14px_rgba(0,0,0,0.2)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[4px_6px_20px_rgba(0,0,0,0.28)] cursor-default ${rotate} ${className}`}
      style={{ backgroundColor: color }}
    >
      {/* Folded corner */}
      <div
        className="absolute bottom-0 right-0 w-6 h-6"
        style={{
          background: "linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.06) 50%)",
        }}
      />
      {children}
    </div>
  )
}

export default function HomePage() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const justOpenedRef = useRef(false)
  const typed = useTypewriter(typingSequences)

  const handleButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    justOpenedRef.current = true
    setIsAuthModalOpen(true)
    setTimeout(() => {
      justOpenedRef.current = false
    }, 100)
  }

  const handleDialogChange = (open: boolean) => {
    if (!open && justOpenedRef.current) {
      return
    }
    setIsAuthModalOpen(open)
  }

  const closeAuthModal = () => {
    setIsAuthModalOpen(false)
  }

  const features = [
    { icon: StickyNote, title: "Interactive Sticks", desc: "Drag, drop, and rearrange sticky notes across your digital board with real-time sync.", color: "#FDE68A", rotate: "rotate-[-1.5deg]" },
    { icon: Palette, title: "Custom Colors", desc: "Categorize and visually organize your notes with a full spectrum of bold colors.", color: "#FDE68A", rotate: "rotate-[1deg]" },
    { icon: Search, title: "Smart Search", desc: "Find any note instantly — search across content, tags, and AI-generated summaries.", color: "#FDE68A", rotate: "rotate-[-0.5deg]" },
    { icon: Share2, title: "Collaborate", desc: "Shared pads, real-time editing, and team channels. Work together seamlessly.", color: "#FDE68A", rotate: "rotate-[2deg]" },
    { icon: BrainCircuit, title: "AI Powered", desc: "Ask AI to summarize, tag, detect duplicates, or answer questions about your notes.", color: "#FDE68A", rotate: "rotate-[-1deg]" },
    { icon: Video, title: "Video Calls", desc: "Jump into video meetings directly from any pad. Share screens, record, and review.", color: "#FDE68A", rotate: "rotate-[1.5deg]" },
  ]

  return (
    <div className={`min-h-screen bg-slate-950 ${inter.className}`}>
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <StickyNote className="h-8 w-8 text-amber-400" />
            <span className={`text-2xl font-bold text-white ${caveat.className}`}>Stick My Note</span>
          </div>
          <nav className="hidden md:flex items-center space-x-6"></nav>
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleButtonClick}
              type="button"
              className="border-slate-600 text-slate-200 hover:bg-slate-800 hover:text-white cursor-pointer"
            >
              Sign In
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section — Dark with typing sticky note */}
      <section className="relative py-20 md:py-32 px-4 overflow-hidden">
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        {/* Amber glow behind note */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-amber-500/10 rounded-full blur-[120px]" />

        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left — copy */}
            <div>
              <Badge variant="secondary" className="mb-6 bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/10">
                <Star className="h-3 w-3 mr-1" />
                Now Live on stickmynote.com
              </Badge>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6 leading-[1.1] tracking-tight">
                Your ideas,{" "}
                <span className={`text-amber-400 ${caveat.className} text-5xl sm:text-6xl md:text-7xl`}>stuck</span>{" "}
                where they matter.
              </h1>
              <p className="text-lg text-slate-400 mb-8 max-w-lg leading-relaxed">
                Notes, video calls, AI summaries, and real-time collaboration — all on one board.
                Pin what matters. Find it instantly.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  size="lg"
                  className="text-lg px-8 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold shadow-lg shadow-amber-500/20 cursor-pointer"
                  onClick={handleButtonClick}
                  type="button"
                >
                  Start Creating Notes
                  <StickyNote className="ml-2 h-5 w-5" />
                </Button>
                <Link href="/about">
                  <Button
                    variant="outline"
                    size="lg"
                    className="text-lg px-8 py-3 border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
                  >
                    Learn More
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right — animated stick (matches real app UI) */}
            <div className="flex justify-center lg:justify-end">
              <div className="relative w-[340px] sm:w-[420px]">
                {/* Stick card — white bg, 3px colored border, colored shadow */}
                <div
                  className="relative bg-white rounded-lg overflow-hidden"
                  style={{
                    border: "3px solid #eab308",
                    boxShadow: "0 10px 20px -5px rgba(234,179,8,0.35), 0 4px 10px -3px rgba(234,179,8,0.25)",
                  }}
                >
                  {/* Header toolbar — matches NoteCardHeader */}
                  <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                    <div className="flex items-center gap-1">
                      <div className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:bg-gray-100">
                        <Maximize2 className="h-3.5 w-3.5" />
                      </div>
                      <div className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:bg-gray-100">
                        <Lock className="h-3.5 w-3.5" />
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-purple-500 hover:bg-purple-50">
                        <Sparkles className="h-3 w-3" />
                        <span className="text-xs font-medium">Ask AI</span>
                      </div>
                      <div className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:bg-gray-100">
                        <Palette className="h-3.5 w-3.5" />
                      </div>
                      <div className="w-6 h-6 rounded flex items-center justify-center text-red-400 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  </div>

                  {/* Tab bar — matches GenericStickTabs */}
                  <div className="flex items-center gap-1 px-3 pt-2">
                    <div className="px-2 py-1 text-xs font-medium text-gray-700 border-b-2 border-yellow-500">Main</div>
                    <div className="px-2 py-1 text-xs text-gray-400">Videos</div>
                    <div className="px-2 py-1 text-xs text-gray-400">Images</div>
                    <div className="px-2 py-1 text-xs text-gray-400">Details</div>
                    <div className="px-2 py-1 text-xs text-gray-400">Files</div>
                  </div>

                  {/* Content area */}
                  <div className="px-3 py-3 space-y-3">
                    {/* Topic field */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-600">Topic</span>
                        <span className="text-[10px] text-gray-400">
                          {(() => { if (typed.label === "Task") return "22"; if (typed.label === "Video") return "10"; if (typed.label === "Ask AI") return "14"; return "11" })()}/75
                        </span>
                      </div>
                      <div className="border border-gray-200 rounded-md px-2 py-1.5 text-sm text-gray-800 bg-white">
                        {typed.label === "Task" && "Sprint planning action"}
                        {typed.label === "Video" && "Team sync"}
                        {typed.label === "Ask AI" && "Weekly summary"}
                        {typed.label === "Collab" && "Q2 Roadmap"}
                      </div>
                    </div>

                    {/* Content field — typing happens here */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-600">Content</span>
                        <span className="text-[10px] text-gray-400">{typed.text.length}/25000</span>
                      </div>
                      <div className="border border-gray-200 rounded-md px-2 py-2 min-h-[120px] bg-white">
                        <p className="text-sm text-gray-800 leading-relaxed">
                          {typed.text}
                          <span className="inline-block w-[2px] h-4 bg-gray-800 ml-0.5 animate-pulse align-text-bottom" />
                        </p>
                      </div>
                    </div>

                    {/* Action buttons — matches NoteCardActions */}
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-100">
                      <div className="px-3 py-1 text-xs border border-gray-200 rounded-md text-gray-500 bg-white">
                        Cancel
                      </div>
                      <div className="px-3 py-1 text-xs rounded-md text-white bg-gray-800 font-medium">
                        Stick
                      </div>
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div className="absolute bottom-1 right-2 text-[10px] text-gray-400 bg-white/80 px-1 rounded">
                    Just now
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-slate-900">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight">
              Everything you need to stay organized
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Powerful features designed to make note-taking and collaboration effortless.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f) => (
              <StickyNoteCard key={f.title} color={f.color} rotate={f.rotate}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-amber-600/15 rounded-lg flex items-center justify-center">
                    <f.icon className="h-5 w-5 text-amber-700" />
                  </div>
                  <h3 className={`font-bold text-slate-800 ${caveat.className} text-2xl`}>{f.title}</h3>
                </div>
                <p className="text-slate-700 leading-relaxed text-sm">{f.desc}</p>
              </StickyNoteCard>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-4 bg-slate-950">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight">
              How it works
            </h2>
            <p className="text-lg text-slate-400">Get started in three simple steps</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { num: "1", title: "Sign Up", desc: "Create your free account in seconds. No credit card required.", rot: "rotate-[-2deg]" },
              { num: "2", title: "Create Notes", desc: "Start adding sticky notes to your digital board. Organize however you like.", rot: "rotate-[1.5deg]" },
              { num: "3", title: "Stay Organized", desc: "Search, filter, and manage your notes. Share with others when needed.", rot: "rotate-[-1deg]" },
            ].map((step) => (
              <StickyNoteCard key={step.num} color="#FDE68A" rotate={step.rot}>
                <div className={`text-4xl font-bold text-amber-600 mb-1 ${caveat.className}`}>{step.num}</div>
                <h3 className={`text-2xl font-semibold text-slate-800 mb-2 ${caveat.className}`}>{step.title}</h3>
                <p className="text-slate-700 text-sm">{step.desc}</p>
              </StickyNoteCard>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-slate-900">
        <div className="container mx-auto max-w-3xl flex justify-center">
          <div className="relative bg-[#FDE68A] p-10 md:p-14 rounded-[2px] shadow-[6px_8px_32px_rgba(0,0,0,0.35)] rotate-[1deg] max-w-xl w-full text-center">
            {/* Tape */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-24 h-5 bg-white/25 rounded-sm rotate-[-2deg] shadow-sm" />

            <h2 className={`text-4xl md:text-5xl font-bold text-slate-800 mb-4 ${caveat.className}`}>
              Ready to get organized?
            </h2>
            <p className="text-slate-700 mb-8">
              Join users who have transformed their productivity with Stick My Note.
            </p>
            <Button
              size="lg"
              className="text-lg px-8 py-3 bg-slate-900 hover:bg-slate-800 text-amber-400 font-semibold shadow-lg cursor-pointer"
              onClick={handleButtonClick}
              type="button"
            >
              Get Started
              <CheckCircle className="ml-2 h-5 w-5" />
            </Button>

            {/* Folded corner */}
            <div
              className="absolute bottom-0 right-0 w-8 h-8"
              style={{
                background: "linear-gradient(135deg, transparent 50%, rgba(180,140,40,0.15) 50%)",
              }}
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-800 text-white py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <StickyNote className="h-6 w-6 text-amber-400" />
                <span className={`text-xl font-bold ${caveat.className}`}>Stick My Note</span>
              </div>
              <p className="text-slate-500">Your digital workspace for organizing thoughts, ideas, and tasks.</p>
            </div>

            <div>
              <h3 className="font-semibold mb-4 text-slate-300">Product</h3>
              <ul className="space-y-2 text-slate-500">
                <li>
                  <Link href="/personal" className="hover:text-white transition-colors">
                    Personal
                  </Link>
                </li>
                <li>
                  <Link href="/about" className="hover:text-white transition-colors">
                    About
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4 text-slate-300">Account</h3>
              <ul className="space-y-2 text-slate-500">
                <li>
                  <button onClick={handleButtonClick} type="button" className="hover:text-white transition-colors cursor-pointer">
                    Sign In
                  </button>
                </li>
                <li>
                  <button onClick={handleButtonClick} type="button" className="hover:text-white transition-colors cursor-pointer">
                    Sign Up
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4 text-slate-300">Website</h3>
              <ul className="space-y-2 text-slate-500">
                <li>
                  <a
                    href={process.env.NEXT_PUBLIC_SITE_URL || "https://stickmynote.com"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition-colors"
                  >
                    stickmynote.com
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800 mt-8 pt-8 text-center text-slate-600">
            <p>&copy; 2025 Stick My Note. All rights reserved. Hosted on stickmynote.com</p>
          </div>
        </div>
      </footer>

      <Dialog open={isAuthModalOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto p-0">
          <DialogTitle className="sr-only">Authentication</DialogTitle>
          <AuthFormModal onSuccess={closeAuthModal} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
