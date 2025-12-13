import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Shield, Cookie, Database, Lock, Eye, FileText } from "lucide-react"
import Link from "next/link"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"

export const runtime = "edge"
export const revalidate = 3600 // Revalidate every hour

export const metadata = {
  title: "Privacy Policy - Stick My Note",
  description: "Learn how Stick My Note collects, uses, and protects your personal information.",
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <BreadcrumbNav
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Privacy Policy", current: true },
          ]}
        />

        <div className="mb-6">
          <Link href="/">
            <Button variant="outline" className="flex items-center gap-2 bg-transparent">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-3xl">
              <Shield className="h-8 w-8 text-blue-600" />
              Privacy Policy
            </CardTitle>
            <CardDescription>Last updated: {new Date().toLocaleDateString()}</CardDescription>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-3">
                <Eye className="h-5 w-5 text-blue-600" />
                Introduction
              </h2>
              <p className="text-muted-foreground">
                At Stick My Note ("we", "our", or "us"), we are committed to protecting your privacy and ensuring the
                security of your personal information. This Privacy Policy explains how we collect, use, disclose, and
                safeguard your information when you use our service at stickmynote.com.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-3">
                <Database className="h-5 w-5 text-blue-600" />
                Information We Collect
              </h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Personal Information</h3>
                  <p className="text-muted-foreground mb-2">When you create an account, we collect:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                    <li>Email address (required for authentication)</li>
                    <li>Username and full name (optional)</li>
                    <li>Profile information (bio, website, location, phone - all optional)</li>
                    <li>Avatar/profile picture (optional)</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Content Data</h3>
                  <p className="text-muted-foreground mb-2">We store the content you create:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                    <li>Notes, sticks, and pads you create</li>
                    <li>Replies and comments</li>
                    <li>Tags and categories</li>
                    <li>Media files (images, videos) you upload</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Usage Information</h3>
                  <p className="text-muted-foreground mb-2">We automatically collect:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                    <li>Device information (browser type, operating system)</li>
                    <li>IP address and location data</li>
                    <li>Usage patterns and preferences</li>
                    <li>Log data (access times, pages viewed, errors)</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-3">
                <Cookie className="h-5 w-5 text-blue-600" />
                Cookies and Tracking Technologies
              </h2>
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  We use cookies and similar tracking technologies to enhance your experience:
                </p>

                <div>
                  <h3 className="font-semibold mb-2">Essential Cookies</h3>
                  <p className="text-muted-foreground">
                    Required for the website to function properly. These include authentication cookies, session
                    management, and security features. You cannot opt out of these cookies.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Analytics Cookies</h3>
                  <p className="text-muted-foreground">
                    Help us understand how visitors use our site. We use this information to improve our service. You
                    can opt out of analytics cookies through our cookie consent banner.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Marketing Cookies</h3>
                  <p className="text-muted-foreground">
                    Used to deliver personalized advertisements. You can opt out of marketing cookies through our cookie
                    consent banner.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-3">
                <FileText className="h-5 w-5 text-blue-600" />
                How We Use Your Information
              </h2>
              <p className="text-muted-foreground mb-2">We use your information to:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li>Provide, maintain, and improve our services</li>
                <li>Authenticate your account and prevent fraud</li>
                <li>Send you service-related communications</li>
                <li>Respond to your requests and support inquiries</li>
                <li>Analyze usage patterns to improve user experience</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-3">
                <Lock className="h-5 w-5 text-blue-600" />
                Data Security
              </h2>
              <p className="text-muted-foreground mb-2">
                We implement industry-standard security measures to protect your data:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li>Encryption in transit (HTTPS/TLS)</li>
                <li>Encryption at rest for sensitive data</li>
                <li>Regular security audits and updates</li>
                <li>Access controls and authentication</li>
                <li>Content Security Policy (CSP) headers</li>
                <li>CSRF protection</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Your Rights (GDPR & CCPA)</h2>
              <p className="text-muted-foreground mb-2">You have the following rights regarding your personal data:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li>
                  <strong>Right to Access:</strong> Request a copy of your personal data
                </li>
                <li>
                  <strong>Right to Rectification:</strong> Correct inaccurate or incomplete data
                </li>
                <li>
                  <strong>Right to Erasure:</strong> Request deletion of your personal data
                </li>
                <li>
                  <strong>Right to Data Portability:</strong> Receive your data in a machine-readable format
                </li>
                <li>
                  <strong>Right to Object:</strong> Object to processing of your personal data
                </li>
                <li>
                  <strong>Right to Withdraw Consent:</strong> Withdraw consent for data processing at any time
                </li>
              </ul>
              <p className="text-muted-foreground mt-3">
                To exercise these rights, visit your{" "}
                <Link href="/profile" className="text-blue-600 hover:underline">
                  profile page
                </Link>{" "}
                where you can download your data or delete your account.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Data Retention</h2>
              <p className="text-muted-foreground">
                We retain your personal data only as long as necessary to provide our services and comply with legal
                obligations. When you delete your account, we permanently delete all your personal data and content
                within 30 days, except where we are required by law to retain certain information.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Third-Party Services</h2>
              <p className="text-muted-foreground mb-2">
                We use the following third-party services that may collect information:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li>Supabase (authentication and database hosting)</li>
                <li>Vercel (hosting and deployment)</li>
                <li>Analytics providers (only with your consent)</li>
              </ul>
              <p className="text-muted-foreground mt-2">
                These services have their own privacy policies and we encourage you to review them.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Children's Privacy</h2>
              <p className="text-muted-foreground">
                Our service is not intended for children under 13 years of age. We do not knowingly collect personal
                information from children under 13. If you believe we have collected information from a child under 13,
                please contact us immediately.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Changes to This Policy</h2>
              <p className="text-muted-foreground">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the
                new Privacy Policy on this page and updating the "Last updated" date. We encourage you to review this
                Privacy Policy periodically.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Contact Us</h2>
              <p className="text-muted-foreground">
                If you have any questions about this Privacy Policy or our data practices, please contact us at:
              </p>
              <div className="mt-2 p-4 bg-gray-100 rounded-lg">
                <p className="text-muted-foreground">
                  Email: privacy@stickmynote.com
                  <br />
                  Website:{" "}
                  <Link href="/" className="text-blue-600 hover:underline">
                    stickmynote.com
                  </Link>
                </p>
              </div>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
