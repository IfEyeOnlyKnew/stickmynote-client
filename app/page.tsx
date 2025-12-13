"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { AuthFormModal } from "@/components/auth-form-modal"
import { StickyNote, Search, Palette, Share2, Lock, Zap, Star, CheckCircle } from "lucide-react"
import Link from "next/link"

export default function HomePage() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const justOpenedRef = useRef(false)

  useEffect(() => {
    setMounted(true)
  }, [])

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <StickyNote className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">Stick My Note</span>
          </div>
          <nav className="hidden md:flex items-center space-x-6"></nav>
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" onClick={handleButtonClick} type="button">
              Sign In
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <Badge variant="secondary" className="mb-4">
            <Star className="h-3 w-3 mr-1" />
            Now Live on stickmynote.com
          </Badge>
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Your Digital
            <span className="text-blue-600 block">Sticky Note Board</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
            Organize your thoughts, ideas, and tasks with beautiful, interactive sticky notes. Share with others or keep
            them private. Your digital workspace awaits.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-lg px-8 py-3" onClick={handleButtonClick} type="button">
              Start Creating Notes
              <StickyNote className="ml-2 h-5 w-5" />
            </Button>
            <Link href="/about">
              <Button variant="outline" size="lg" className="text-lg px-8 py-3 bg-transparent">
                Learn More
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-white">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Everything you need to stay organized</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Powerful features designed to make note-taking and organization effortless and enjoyable.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <StickyNote className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle>Interactive Notes</CardTitle>
                <CardDescription>
                  Create, edit, and move sticky notes around your digital board with drag-and-drop functionality.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <Palette className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle>Custom Colors</CardTitle>
                <CardDescription>
                  Choose from a variety of colors to categorize and organize your notes visually.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <Search className="h-6 w-6 text-purple-600" />
                </div>
                <CardTitle>Smart Search</CardTitle>
                <CardDescription>
                  Find your notes instantly with powerful search functionality across content and tags.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                  <Share2 className="h-6 w-6 text-orange-600" />
                </div>
                <CardTitle>Share & Collaborate</CardTitle>
                <CardDescription>
                  Share your notes with others or keep them private. Perfect for team collaboration.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                  <Lock className="h-6 w-6 text-red-600" />
                </div>
                <CardTitle>Secure & Private</CardTitle>
                <CardDescription>
                  Your notes are encrypted and secure. Only you can access your private notes.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                  <Zap className="h-6 w-6 text-indigo-600" />
                </div>
                <CardTitle>Lightning Fast</CardTitle>
                <CardDescription>
                  Built with modern technology for instant loading and real-time updates.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">How it works</h2>
            <p className="text-lg text-gray-600">Get started in three simple steps</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">Sign Up</h3>
              <p className="text-gray-600">Create your free account in seconds. No credit card required.</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">Create Notes</h3>
              <p className="text-gray-600">
                Start adding sticky notes to your digital board. Organize however you like.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">Stay Organized</h3>
              <p className="text-gray-600">Search, filter, and manage your notes. Share with others when needed.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-blue-600">
        <div className="container mx-auto text-center max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Ready to get organized?</h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of users who have transformed their productivity with Stick My Note.
          </p>
          <div className="flex justify-center">
            <Button
              size="lg"
              variant="secondary"
              className="text-lg px-8 py-3"
              onClick={handleButtonClick}
              type="button"
            >
              Get Started
              <CheckCircle className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <StickyNote className="h-6 w-6" />
                <span className="text-xl font-bold">Stick My Note</span>
              </div>
              <p className="text-gray-400">Your digital workspace for organizing thoughts, ideas, and tasks.</p>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <Link href="/notes" className="hover:text-white transition-colors">
                    Notes
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
              <h3 className="font-semibold mb-4">Account</h3>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <Button variant="outline" size="sm" onClick={handleButtonClick} type="button">
                    Sign In
                  </Button>
                </li>
                <li>
                  <Button variant="outline" size="sm" onClick={handleButtonClick} type="button">
                    Sign Up
                  </Button>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Website</h3>
              <ul className="space-y-2 text-gray-400">
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

          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
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
