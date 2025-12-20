"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Building2, User, Loader2, Lock, Unlock } from "lucide-react"
import { useRouter } from "next/navigation"
import { PadTemplatePicker } from "@/components/social/pad-template-picker"
import type { PadTemplate } from "@/types/pad-templates"

type HubType = "individual" | "organization"
type AccessMode = "all_sticks" | "individual_sticks"

interface HubSetupModalProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly hubType?: HubType
}

interface HubFormData {
  name: string
  email: string
  description: string
  homeCode: string
  accessMode: AccessMode
  hubType: HubType
}

// Helper: Validate hub form data
function validateHubForm(data: HubFormData): string | null {
  if (!data.name.trim() || !data.email.trim()) {
    return "Name and email are required"
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(data.email)) {
    return "Please enter a valid email address"
  }
  return null
}

// Helper: Create hub via API
async function createHub(data: HubFormData): Promise<{ pad?: any; error?: string }> {
  try {
    const response = await fetch("/api/social-pads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name.trim(),
        description: data.description.trim(),
        hub_type: data.hubType,
        hub_email: data.email.trim(),
        home_code: data.homeCode.trim() || null,
        is_public: false,
        access_mode: data.accessMode,
      }),
    })

    const result = await response.json()
    
    if (!response.ok) {
      return { error: result.error || "Failed to create hub" }
    }
    
    return { pad: result.pad }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create hub" }
  }
}

// Helper: Create initial sticks from template
async function createInitialSticks(padId: string, template: PadTemplate): Promise<void> {
  if (!template.initial_sticks?.length) return

  const stickPromises = template.initial_sticks.map((stick) =>
    fetch("/api/social-sticks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        social_pad_id: padId,
        topic: stick.topic,
        content: stick.content,
        color: stick.color,
        is_public: false,
      }),
    })
  )

  await Promise.allSettled(stickPromises)
}

export function HubSetupModal({ open, onOpenChange, hubType: initialHubType }: HubSetupModalProps) {
  const router = useRouter()
  const [step, setStep] = useState<"type" | "details">(initialHubType ? "details" : "type")
  const [hubType, setHubType] = useState<HubType>(initialHubType || "individual")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [description, setDescription] = useState("")
  const [homeCode, setHomeCode] = useState("")
  const [accessMode, setAccessMode] = useState<AccessMode>("individual_sticks")
  const [selectedTemplate, setSelectedTemplate] = useState<PadTemplate | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const resetForm = () => {
    setName("")
    setEmail("")
    setDescription("")
    setHomeCode("")
    setAccessMode("individual_sticks")
    setSelectedTemplate(null)
    setError("")
    setStep(initialHubType ? "details" : "type")
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) resetForm()
    onOpenChange(newOpen)
  }

  const handleTypeSelect = (type: HubType) => {
    setHubType(type)
    setStep("details")
  }

  const handleTemplateSelect = (template: PadTemplate) => {
    setSelectedTemplate(template)
    setName(template.name)
    setDescription(template.description || "")
    setAccessMode(template.access_mode)
  }

  const handleCreate = async () => {
    const formData: HubFormData = { name, email, description, homeCode, accessMode, hubType }
    
    const validationError = validateHubForm(formData)
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    setError("")

    const result = await createHub(formData)
    
    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    if (result.pad && selectedTemplate) {
      await createInitialSticks(result.pad.id, selectedTemplate)
    }

    handleOpenChange(false)
    router.push(`/social/pads/${result.pad.id}/edit`)
    setLoading(false)
  }

  const handleBack = () => {
    if (initialHubType) {
      handleOpenChange(false)
    } else {
      setStep("type")
      setError("")
    }
  }

  // Render the hub type selection step
  const renderTypeSelection = () => (
    <>
      <DialogHeader>
        <DialogTitle className="text-2xl">Create Your Social Hub</DialogTitle>
        <DialogDescription>
          Choose the type of Social Hub you want to create. You can create both types later.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-4">
        <button
          onClick={() => handleTypeSelect("individual")}
          className="flex items-start gap-4 p-6 border-2 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
        >
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            <User className="h-6 w-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-1">Individual Hub</h3>
            <p className="text-sm text-gray-600">
              Perfect for personal projects, freelancers, or individual content creators. Manage your own social
              workspace with full control.
            </p>
          </div>
        </button>

        <button
          onClick={() => handleTypeSelect("organization")}
          className="flex items-start gap-4 p-6 border-2 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all text-left"
        >
          <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
            <Building2 className="h-6 w-6 text-purple-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-1">Organization Hub</h3>
            <p className="text-sm text-gray-600">
              Ideal for teams, companies, or groups. Collaborate with multiple members, assign admins, and manage
              organizational content.
            </p>
          </div>
        </button>
      </div>
    </>
  )

  // Render the hub details form step
  const renderDetailsForm = () => (
    <>
      <DialogHeader className="flex-shrink-0">
        <DialogTitle className="text-2xl">
          {hubType === "individual" ? "Individual" : "Organization"} Hub Details
        </DialogTitle>
        <DialogDescription>
          Provide the details for your {hubType} hub. The email address helps distinguish your hub from others
          with similar names.
        </DialogDescription>
      </DialogHeader>

      <div className="overflow-y-auto flex-1 pr-2">
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Start from Template (Optional)</Label>
            <PadTemplatePicker hubType={hubType} onTemplateSelect={handleTemplateSelect} />
            {selectedTemplate && (
              <p className="text-xs text-green-600">
                Template &quot;{selectedTemplate.name}&quot; selected. Values pre-filled below.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">{hubType === "individual" ? "Individual" : "Organization"} Name *</Label>
            <Input
              id="name"
              placeholder={hubType === "individual" ? "John Doe" : "Acme Corporation"}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-gray-500">Must be unique for {hubType} hubs</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              placeholder={hubType === "individual" ? "john@example.com" : "contact@acme.com"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-gray-500">Required to distinguish hubs with similar names</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="homeCode">Home Code (Optional)</Label>
            <Input
              id="homeCode"
              placeholder="e.g., DIV-001, DEPT-A, REGION-WEST"
              value={homeCode}
              onChange={(e) => setHomeCode(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-gray-500">Divisional code for organizational categorization</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder={
                hubType === "individual"
                  ? "Personal workspace for my projects and ideas"
                  : "Collaborative space for our team"
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              rows={3}
            />
          </div>

          <div className="space-y-3 border-t pt-4">
            <Label className="text-base font-semibold">Stick Access Control</Label>
            <p className="text-sm text-gray-600">Choose how members access sticks in this pad</p>
            <RadioGroup
              value={accessMode}
              onValueChange={(value) => setAccessMode(value as typeof accessMode)}
              disabled={loading}
            >
              <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                <RadioGroupItem value="all_sticks" id="all_sticks" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="all_sticks" className="font-medium cursor-pointer flex items-center gap-2">
                    <Unlock className="h-4 w-4 text-green-600" />
                    All Sticks Access
                  </Label>
                  <p className="text-xs text-gray-600 mt-1">
                    Members automatically get access to all sticks in this pad when added
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                <RadioGroupItem value="individual_sticks" id="individual_sticks" className="mt-1" />
                <div className="flex-1">
                  <Label
                    htmlFor="individual_sticks"
                    className="font-medium cursor-pointer flex items-center gap-2"
                  >
                    <Lock className="h-4 w-4 text-orange-600" />
                    Individual Stick Access
                  </Label>
                  <p className="text-xs text-gray-600 mt-1">
                    Members can only see the pad. Admins/Owners must grant access to individual sticks
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </div>

      <div className="flex gap-2 flex-shrink-0 pt-4 border-t">
        <Button variant="outline" onClick={handleBack} disabled={loading} className="flex-1 bg-transparent">
          {initialHubType ? "Cancel" : "Back"}
        </Button>
        <Button onClick={handleCreate} disabled={loading} className="flex-1">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            "Create Hub"
          )}
        </Button>
      </div>
    </>
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
        {step === "type" && !initialHubType ? renderTypeSelection() : renderDetailsForm()}
      </DialogContent>
    </Dialog>
  )
}
