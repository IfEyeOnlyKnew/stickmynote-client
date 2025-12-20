"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Loader2, Phone, Crown } from "lucide-react"

interface ContactsTabProps {
  supportContact1Email: string
  setSupportContact1Email: (email: string) => void
  supportContact1Name: string
  setSupportContact1Name: (name: string) => void
  supportContact2Email: string
  setSupportContact2Email: (email: string) => void
  supportContact2Name: string
  setSupportContact2Name: (name: string) => void
  savingContacts: boolean
  handleSaveContacts: () => void
}

export function ContactsTab({
  supportContact1Email,
  setSupportContact1Email,
  supportContact1Name,
  setSupportContact1Name,
  supportContact2Email,
  setSupportContact2Email,
  supportContact2Name,
  setSupportContact2Name,
  savingContacts,
  handleSaveContacts,
}: Readonly<ContactsTabProps>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Support Contacts
        </CardTitle>
        <CardDescription>
          Designate up to 2 support contacts who can help manage organization access requests. Support contacts
          can also access organization settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Contact 1 */}
          <div className="space-y-4 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Primary Contact</h4>
              <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 flex items-center gap-1">
                <Crown className="h-3 w-3" />
                Owner Access
              </Badge>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact1-name">Name</Label>
              <Input
                id="contact1-name"
                value={supportContact1Name}
                onChange={(e) => setSupportContact1Name(e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact1-email">Email</Label>
              <Input
                id="contact1-email"
                type="email"
                value={supportContact1Email}
                onChange={(e) => setSupportContact1Email(e.target.value)}
                placeholder="john@company.com"
              />
            </div>
          </div>

          {/* Contact 2 */}
          <div className="space-y-4 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Secondary Contact</h4>
              <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 flex items-center gap-1">
                <Crown className="h-3 w-3" />
                Owner Access
              </Badge>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact2-name">Name</Label>
              <Input
                id="contact2-name"
                value={supportContact2Name}
                onChange={(e) => setSupportContact2Name(e.target.value)}
                placeholder="Jane Smith"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact2-email">Email</Label>
              <Input
                id="contact2-email"
                type="email"
                value={supportContact2Email}
                onChange={(e) => setSupportContact2Email(e.target.value)}
                placeholder="jane@company.com"
              />
            </div>
          </div>
        </div>

        <Button onClick={handleSaveContacts} disabled={savingContacts}>
          {savingContacts ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Save Contacts
        </Button>
      </CardContent>
    </Card>
  )
}
