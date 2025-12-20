"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useRouter } from 'next/navigation'
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, Lightbulb, Users, Zap, Shield, Heart, Github, Mail, Globe, Sparkles, MessageCircle, Share2, Search, Palette, Move, Clock } from 'lucide-react'
import { BreadcrumbNav } from "@/components/breadcrumb-nav"

export default function AboutPage() {
  const router = useRouter()

  const features = [
    {
      icon: <Lightbulb className="w-5 h-5" />,
      title: "Smart Note Creation",
      description: "Create colorful sticky notes with topics and content. Notes are automatically saved to the cloud.",
    },
    {
      icon: <Search className="w-5 h-5" />,
      title: "Advanced Search",
      description: "Search across all content or use colon syntax (word1:word2) for precise topic matching.",
    },
    {
      icon: <Share2 className="w-5 h-5" />,
      title: "Share & Collaborate",
      description: "Toggle notes between personal and shared. Discover notes shared by other users.",
    },
    {
      icon: <MessageCircle className="w-5 h-5" />,
      title: "Interactive Replies",
      description: "Add replies to notes for discussions and follow-up thoughts.",
    },
    {
      icon: <Sparkles className="w-5 h-5" />,
      title: "AI-Powered Tags",
      description: "Generate intelligent tags for your notes using AI to improve organization and discovery.",
    },
    {
      icon: <Palette className="w-5 h-5" />,
      title: "Customizable Colors",
      description: "Choose from 8 beautiful colors to organize and categorize your notes visually.",
    },
    {
      icon: <Move className="w-5 h-5" />,
      title: "Drag & Drop",
      description: "Freely position your notes or use the organize feature for automatic grid layout.",
    },
    {
      icon: <Clock className="w-5 h-5" />,
      title: "Smart Timestamps",
      description: "Track creation and update times with relative timestamps that update automatically.",
    },
  ]

  const techStack = [
    { name: "Next.js 14", category: "Frontend Framework" },
    { name: "React 18", category: "UI Library" },
    { name: "TypeScript", category: "Language" },
    { name: "Tailwind CSS", category: "Styling" },
    { name: "PostgreSQL", category: "Database" },
    { name: "LDAP/Active Directory", category: "Authentication" },
    { name: "Shadcn/ui", category: "UI Components" },
    { name: "Lucide React", category: "Icons" },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.back()} className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div className="flex items-center gap-3">
              <Image
                src="/images/sticky-note-logo.svg"
                alt="Sticky Note Logo"
                width={32}
                height={32}
                className="w-8 h-8"
              />
              <div>
                <h1 className="text-2xl font-bold text-gray-800">About Stick My Note</h1>
                <p className="text-gray-600">Learn more about our digital sticky notes platform</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <BreadcrumbNav
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "About", current: true },
          ]}
        />

        {/* Hero Section */}
        <Card className="border-0 shadow-lg bg-gradient-to-r from-yellow-100 via-orange-100 to-red-100">
          <CardHeader className="text-center pb-4">
            <div className="text-6xl mb-4">📝</div>
            <CardTitle className="text-3xl font-bold text-gray-800 mb-2">Stick My Note</CardTitle>
            <CardDescription className="text-lg text-gray-700 max-w-2xl mx-auto">
              A modern, cloud-based sticky notes application that brings the simplicity of physical sticky notes to the
              digital world with powerful features for organization, collaboration, and discovery.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Mission Statement */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-500" />
              Our Mission
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 leading-relaxed">
              We believe that great ideas shouldn&apos;t be lost or forgotten. Stick My Note was created to provide a simple,
              intuitive, and powerful platform for capturing thoughts, organizing ideas, and sharing knowledge. Whether
              you&apos;re brainstorming, taking quick notes, or collaborating with others, our platform adapts to your
              workflow while keeping your data secure and accessible from anywhere.
            </p>
          </CardContent>
        </Card>

        {/* Key Features */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              Key Features
            </CardTitle>
            <CardDescription>Discover what makes Stick My Note special</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              {features.map((feature, index) => (
                <div key={index} className="flex gap-3 p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-1">{feature.title}</h3>
                    <p className="text-sm text-gray-600">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* How It Works */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-green-500" />
              How It Works
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 mb-1">Create Your Account</h3>
                  <p className="text-gray-600">
                    Sign up with your email to get started. Your notes are automatically synced to the cloud.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 mb-1">Start Creating Notes</h3>
                  <p className="text-gray-600">
                    Click &quot;Add Note&quot; to create your first sticky note. Add a topic, content, and choose a color.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 mb-1">Organize & Share</h3>
                  <p className="text-gray-600">
                    Drag notes around, organize them in grids, toggle sharing, and add replies for collaboration.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
                  4
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 mb-1">Discover & Search</h3>
                  <p className="text-gray-600">
                    Use advanced search features to find your notes or discover shared notes from other users.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Technology Stack */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-purple-500" />
              Built With Modern Technology
            </CardTitle>
            <CardDescription>Powered by cutting-edge web technologies for performance and reliability</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {techStack.map((tech, index) => (
                <div key={index} className="text-center">
                  <Badge variant="secondary" className="mb-1">
                    {tech.name}
                  </Badge>
                  <p className="text-xs text-gray-500">{tech.category}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Privacy & Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-600" />
              Privacy & Security
            </CardTitle>
            <CardDescription>
              Your data security and privacy are our top priorities. Here&apos;s how we protect you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                      🔒 Enterprise-Grade Encryption
                    </h3>
                    <p className="text-gray-600 text-sm">
                      All data is encrypted in transit using TLS 1.3 and at rest using AES-256 encryption. We use
                      enterprise-grade security infrastructure with automatic security updates.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                      🛡️ Advanced Threat Protection
                    </h3>
                    <p className="text-gray-600 text-sm">
                      Multi-layer security including CSRF protection, XSS prevention, SQL injection protection, and
                      comprehensive input validation on all user data.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">⚡ Smart Rate Limiting</h3>
                    <p className="text-gray-600 text-sm">
                      Intelligent rate limiting protects against abuse and ensures fair usage. Different limits for
                      various actions with graceful degradation.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                      🔐 Secure Authentication
                    </h3>
                    <p className="text-gray-600 text-sm">
                      JWT-based authentication with secure session management, automatic token refresh, and protected
                      routes throughout the application.
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">🎯 Privacy by Design</h3>
                    <p className="text-gray-600 text-sm">
                      Notes are private by default with granular sharing controls. Row-level security ensures users can
                      only access their own data. No third-party data sharing.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">🌐 Security Headers</h3>
                    <p className="text-gray-600 text-sm">
                      Comprehensive security headers including Content Security Policy, HSTS, frame protection, and
                      cross-origin policies to prevent various attack vectors.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                      ☁️ Secure Cloud Infrastructure
                    </h3>
                    <p className="text-gray-600 text-sm">
                      Hosted on-premise or in the cloud with automatic HTTPS and DDoS protection. Database hosted on
                      PostgreSQL with automatic backups and point-in-time recovery.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                      🔍 Continuous Monitoring
                    </h3>
                    <p className="text-gray-600 text-sm">
                      Real-time security monitoring, automated vulnerability scanning, and regular security audits to
                      maintain the highest security standards.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-6">
                <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Security Compliance
                </h4>
                <p className="text-green-700 text-sm">
                  Our security measures follow industry best practices and comply with modern web security standards. We
                  implement defense-in-depth strategies to protect against common vulnerabilities including OWASP Top 10
                  threats.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Version & Updates */}
        <Card>
          <CardHeader>
            <CardTitle>Version Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Current Version:</span>
                <Badge variant="outline">v1.0.0</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Last Updated:</span>
                <span className="text-gray-800">December 2024</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Platform:</span>
                <span className="text-gray-800">Web Application</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact & Support */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-500" />
              Contact & Support
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-gray-700">Have questions, feedback, or need help? We&apos;d love to hear from you!</p>
              <div className="flex flex-wrap gap-4">
                <Button variant="outline" className="flex items-center gap-2 bg-transparent">
                  <Mail className="w-4 h-4" />
                  support@stickmynote.com
                </Button>
                <Button variant="outline" className="flex items-center gap-2 bg-transparent">
                  <Github className="w-4 h-4" />
                  GitHub
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Call to Action */}
        <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-100 via-purple-100 to-pink-100">
          <CardContent className="text-center py-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Ready to Get Started?</h2>
            <p className="text-gray-700 mb-6 max-w-md mx-auto">
              Join thousands of users who are already organizing their thoughts and ideas with Stick My Note.
            </p>
            <Button
              onClick={() => router.push("/personal")}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3"
            >
              Go to My Personal Hub
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="bg-gray-50 border-t border-gray-200 mt-16">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Image
                  src="/images/sticky-note-logo.svg"
                  alt="Sticky Note Logo"
                  width={24}
                  height={24}
                  className="w-6 h-6"
                />
                <h3 className="text-lg font-bold">Stick My Note</h3>
              </div>
              <p className="text-gray-600">Your digital workspace for organizing thoughts and ideas.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-600">
                <li>
                  <Link href="/about" className="hover:text-gray-900 transition-colors">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="/how-to-search" className="hover:text-gray-900 transition-colors">
                    How to Search
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Account</h4>
              <ul className="space-y-2 text-gray-600">
                <li>
                  <Link href="/auth/login" className="hover:text-gray-900 transition-colors">
                    Sign In
                  </Link>
                </li>
                <li>
                  <Link href="/auth/register" className="hover:text-gray-900 transition-colors">
                    Sign Up
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-200 mt-8 pt-8 text-center">
            <p className="text-gray-600">
              Made with <Heart className="w-4 h-4 inline text-red-500" /> for note-takers everywhere
            </p>
            <p className="text-sm text-gray-500 mt-2">© 2024 Stick My Note. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
