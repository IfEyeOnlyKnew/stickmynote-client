import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, FileText, AlertCircle, CheckCircle, XCircle } from "lucide-react"
import Link from "next/link"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"

export const runtime = "edge"
export const revalidate = 3600 // Revalidate every hour

export const metadata = {
  title: "Terms of Service - Stick My Note",
  description: "Terms and conditions for using Stick My Note services.",
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <BreadcrumbNav
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Terms of Service", current: true },
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
              <FileText className="h-8 w-8 text-blue-600" />
              Terms of Service
            </CardTitle>
            <CardDescription>Last updated: {new Date().toLocaleDateString()}</CardDescription>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">Agreement to Terms</h2>
              <p className="text-muted-foreground">
                By accessing or using Stick My Note (&quot;Service&quot;), you agree to be bound by these Terms of Service
                (&quot;Terms&quot;). If you disagree with any part of these terms, you may not access the Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Acceptable Use
              </h2>
              <p className="text-muted-foreground mb-2">
                You agree to use the Service only for lawful purposes. You agree not to:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li>Violate any applicable laws or regulations</li>
                <li>Infringe on intellectual property rights of others</li>
                <li>Upload malicious code, viruses, or harmful content</li>
                <li>Harass, abuse, or harm other users</li>
                <li>Attempt to gain unauthorized access to the Service</li>
                <li>Use the Service for spam or unsolicited communications</li>
                <li>Impersonate others or provide false information</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">User Accounts</h2>
              <p className="text-muted-foreground mb-2">
                When you create an account with us, you must provide accurate and complete information. You are
                responsible for:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li>Maintaining the security of your account credentials</li>
                <li>All activities that occur under your account</li>
                <li>Notifying us immediately of any unauthorized access</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Content Ownership</h2>
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold mb-2">Your Content</h3>
                  <p className="text-muted-foreground">
                    You retain all rights to the content you create and upload to the Service. By uploading content, you
                    grant us a limited license to store, display, and transmit your content solely for the purpose of
                    providing the Service.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Our Content</h3>
                  <p className="text-muted-foreground">
                    The Service and its original content, features, and functionality are owned by Stick My Note and are
                    protected by international copyright, trademark, and other intellectual property laws.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-3">
                <XCircle className="h-5 w-5 text-red-600" />
                Prohibited Content
              </h2>
              <p className="text-muted-foreground mb-2">You may not upload or share content that:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li>Is illegal, harmful, or promotes illegal activities</li>
                <li>Contains hate speech, discrimination, or harassment</li>
                <li>Infringes on intellectual property rights</li>
                <li>Contains personal information of others without consent</li>
                <li>Is sexually explicit or pornographic</li>
                <li>Contains malware or malicious code</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Service Availability</h2>
              <p className="text-muted-foreground">
                We strive to provide reliable service, but we do not guarantee that the Service will be available at all
                times. We may modify, suspend, or discontinue the Service at any time without notice. We are not liable
                for any interruption or loss of service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Termination</h2>
              <p className="text-muted-foreground mb-2">
                We may terminate or suspend your account immediately, without prior notice, for any reason, including:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li>Violation of these Terms</li>
                <li>Fraudulent or illegal activity</li>
                <li>Prolonged inactivity</li>
                <li>At your request</li>
              </ul>
              <p className="text-muted-foreground mt-2">
                Upon termination, your right to use the Service will immediately cease. You may delete your account at
                any time from your profile page.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-3">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                Disclaimer of Warranties
              </h2>
              <p className="text-muted-foreground">
                THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR
                IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Limitation of Liability</h2>
              <p className="text-muted-foreground">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, STICK MY NOTE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
                SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED
                DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Indemnification</h2>
              <p className="text-muted-foreground">
                You agree to indemnify and hold harmless Stick My Note from any claims, damages, losses, liabilities,
                and expenses arising from your use of the Service or violation of these Terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Changes to Terms</h2>
              <p className="text-muted-foreground">
                We reserve the right to modify these Terms at any time. We will notify users of any material changes by
                posting the new Terms on this page and updating the &quot;Last updated&quot; date. Your continued use of the
                Service after changes constitutes acceptance of the new Terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Governing Law</h2>
              <p className="text-muted-foreground">
                These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which
                Stick My Note operates, without regard to its conflict of law provisions.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Contact Us</h2>
              <p className="text-muted-foreground">
                If you have any questions about these Terms, please contact us at:
              </p>
              <div className="mt-2 p-4 bg-gray-100 rounded-lg">
                <p className="text-muted-foreground">
                  Email: legal@stickmynote.com
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
