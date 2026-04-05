"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Award, Plus, Sparkles, Trash2, Search, Settings, Trophy } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { RecognitionSettings, Badge, RecognitionValue } from "@/types/recognition"
import { DEFAULT_RECOGNITION_SETTINGS, BADGE_TIERS } from "@/types/recognition"

interface UserSearchResult {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
}

export function RecognitionTab() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<RecognitionSettings>(DEFAULT_RECOGNITION_SETTINGS)
  const [badges, setBadges] = useState<Badge[]>([])
  const [values, setValues] = useState<RecognitionValue[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Badge creation
  const [createBadgeOpen, setCreateBadgeOpen] = useState(false)
  const [newBadge, setNewBadge] = useState({ name: "", description: "", icon: "award", color: "#8b5cf6", tier: "bronze", category: "general", criteriaType: "manual", criteriaThreshold: 0 })

  // Value creation
  const [createValueOpen, setCreateValueOpen] = useState(false)
  const [newValue, setNewValue] = useState({ name: "", description: "", emoji: "⭐", color: "#f59e0b" })

  // Badge awarding
  const [awardModalOpen, setAwardModalOpen] = useState(false)
  const [awardBadgeId, setAwardBadgeId] = useState("")
  const [awardReason, setAwardReason] = useState("")
  const [userSearch, setUserSearch] = useState("")
  const [userResults, setUserResults] = useState<UserSearchResult[]>([])
  const [selectedAwardUser, setSelectedAwardUser] = useState<UserSearchResult | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [settingsRes, badgesRes, valuesRes] = await Promise.all([
        fetch("/api/recognition/settings"),
        fetch("/api/recognition/badges?includeInactive=true"),
        fetch("/api/recognition/values"),
      ])

      const settingsData = await settingsRes.json()
      const badgesData = await badgesRes.json()
      const valuesData = await valuesRes.json()

      if (settingsData.settings) setSettings(settingsData.settings)
      setBadges(badgesData.badges || [])
      setValues(valuesData.values || [])
    } catch {
      toast({ title: "Error loading recognition settings", variant: "destructive" })
    }
    setLoading(false)
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/recognition/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })
      if (res.ok) {
        toast({ title: "Recognition settings saved" })
      } else {
        toast({ title: "Failed to save settings", variant: "destructive" })
      }
    } catch {
      toast({ title: "Failed to save settings", variant: "destructive" })
    }
    setSaving(false)
  }

  const handleCreateBadge = async () => {
    try {
      const res = await fetch("/api/recognition/badges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBadge),
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: `Badge "${newBadge.name}" created` })
        setCreateBadgeOpen(false)
        setNewBadge({ name: "", description: "", icon: "award", color: "#8b5cf6", tier: "bronze", category: "general", criteriaType: "manual", criteriaThreshold: 0 })
        loadData()
      } else {
        toast({ title: data.error || "Failed to create badge", variant: "destructive" })
      }
    } catch {
      toast({ title: "Failed to create badge", variant: "destructive" })
    }
  }

  const handleCreateValue = async () => {
    try {
      const res = await fetch("/api/recognition/values", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newValue),
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: `Value "${newValue.name}" created` })
        setCreateValueOpen(false)
        setNewValue({ name: "", description: "", emoji: "⭐", color: "#f59e0b" })
        loadData()
      } else {
        toast({ title: data.error || "Failed to create value", variant: "destructive" })
      }
    } catch {
      toast({ title: "Failed to create value", variant: "destructive" })
    }
  }

  const searchUsers = async (query: string) => {
    if (query.length < 2) { setUserResults([]); return }
    try {
      const res = await fetch(`/api/user-search?query=${encodeURIComponent(query)}&limit=5&source=both`)
      const data = await res.json()
      const users = Array.isArray(data) ? data : (data.users || [])
      setUserResults(users.filter((u: UserSearchResult) => u.id))
    } catch {
      setUserResults([])
    }
  }

  const handleAwardBadge = async () => {
    if (!awardBadgeId || !selectedAwardUser) return
    try {
      const res = await fetch("/api/recognition/badges/award", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ badgeId: awardBadgeId, userId: selectedAwardUser.id, reason: awardReason }),
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: `Badge awarded to ${selectedAwardUser.full_name}` })
        setAwardModalOpen(false)
        setAwardBadgeId("")
        setSelectedAwardUser(null)
        setAwardReason("")
        setUserSearch("")
      } else {
        toast({ title: data.error || "Failed to award badge", variant: "destructive" })
      }
    } catch {
      toast({ title: "Failed to award badge", variant: "destructive" })
    }
  }

  const seedDefaults = async () => {
    try {
      await fetch("/api/recognition/badges/seed", { method: "POST" })
      toast({ title: "Default badges and values seeded" })
      loadData()
    } catch {
      toast({ title: "Failed to seed defaults", variant: "destructive" })
    }
  }

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-yellow-500" />
          Recognition & Praise
        </h2>
        <p className="text-gray-500 mt-1">Configure recognition features for your organization</p>
      </div>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            General Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Recognition</Label>
              <p className="text-sm text-gray-500">Allow members to give kudos and earn badges</p>
            </div>
            <Switch checked={settings.enabled} onCheckedChange={(v) => setSettings(s => ({ ...s, enabled: v }))} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Leaderboard</Label>
              <p className="text-sm text-gray-500">Show a leaderboard of top recognized members</p>
            </div>
            <Switch checked={settings.leaderboard_enabled} onCheckedChange={(v) => setSettings(s => ({ ...s, leaderboard_enabled: v }))} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Manager Notifications</Label>
              <p className="text-sm text-gray-500">Notify managers when their team members receive kudos</p>
            </div>
            <Switch checked={settings.manager_notifications} onCheckedChange={(v) => setSettings(s => ({ ...s, manager_notifications: v }))} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Allow Self-Kudos</Label>
              <p className="text-sm text-gray-500">Allow members to give kudos to themselves</p>
            </div>
            <Switch checked={settings.allow_self_kudos} onCheckedChange={(v) => setSettings(s => ({ ...s, allow_self_kudos: v }))} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Require Value Selection</Label>
              <p className="text-sm text-gray-500">Require a core value to be selected when giving kudos</p>
            </div>
            <Switch checked={settings.require_value} onCheckedChange={(v) => setSettings(s => ({ ...s, require_value: v }))} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Points Per Kudos</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={settings.points_per_kudos}
                onChange={(e) => setSettings(s => ({ ...s, points_per_kudos: Number.parseInt(e.target.value) || 1 }))}
              />
            </div>
            <div>
              <Label>Max Kudos Per Day</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={settings.max_kudos_per_day}
                onChange={(e) => setSettings(s => ({ ...s, max_kudos_per_day: Number.parseInt(e.target.value) || 10 }))}
              />
            </div>
          </div>

          <Button onClick={saveSettings} disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </CardContent>
      </Card>

      {/* Core Values */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Core Values</CardTitle>
            <CardDescription>Values that kudos can be tagged with</CardDescription>
          </div>
          <Button size="sm" onClick={() => setCreateValueOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Value
          </Button>
        </CardHeader>
        <CardContent>
          {values.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <p className="mb-2">No values defined yet</p>
              <Button variant="outline" size="sm" onClick={seedDefaults}>Seed Default Values</Button>
            </div>
          ) : (
            <div className="space-y-2">
              {values.map(value => (
                <div key={value.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className="text-2xl">{value.emoji}</span>
                  <div className="flex-1">
                    <div className="font-medium">{value.name}</div>
                    {value.description && <div className="text-sm text-gray-500">{value.description}</div>}
                  </div>
                  <div className="h-4 w-4 rounded-full" style={{ backgroundColor: value.color }} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Badges */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-purple-500" />
              Badges
            </CardTitle>
            <CardDescription>Achievement badges that can be earned or manually awarded</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setAwardModalOpen(true)}>
              <Trophy className="h-4 w-4 mr-1" /> Award Badge
            </Button>
            <Button size="sm" onClick={() => setCreateBadgeOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Create Badge
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {badges.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <p className="mb-2">No badges defined yet</p>
              <Button variant="outline" size="sm" onClick={seedDefaults}>Seed Default Badges</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {badges.map(badge => {
                const tierInfo = BADGE_TIERS[badge.tier] || BADGE_TIERS.bronze
                return (
                  <div key={badge.id} className="flex items-center gap-3 p-3 border rounded-lg" style={{ borderColor: tierInfo.color + "40" }}>
                    <div className="h-10 w-10 rounded-full flex items-center justify-center border-2" style={{ backgroundColor: tierInfo.bgColor, borderColor: tierInfo.color }}>
                      <Award className="h-5 w-5" style={{ color: badge.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{badge.name}</div>
                      <div className="text-xs text-gray-500 truncate">{badge.description}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-medium" style={{ color: tierInfo.color }}>{tierInfo.label}</span>
                        <span className="text-xs text-gray-400">{badge.criteria_type === "manual" ? "Manual" : `Auto: ${badge.criteria_threshold}`}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Badge Dialog */}
      <Dialog open={createBadgeOpen} onOpenChange={setCreateBadgeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Badge</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={newBadge.name} onChange={(e) => setNewBadge(b => ({ ...b, name: e.target.value }))} placeholder="Badge name" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={newBadge.description} onChange={(e) => setNewBadge(b => ({ ...b, description: e.target.value }))} placeholder="What is this badge for?" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tier</Label>
                <Select value={newBadge.tier} onValueChange={(v) => setNewBadge(b => ({ ...b, tier: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bronze">Bronze</SelectItem>
                    <SelectItem value="silver">Silver</SelectItem>
                    <SelectItem value="gold">Gold</SelectItem>
                    <SelectItem value="platinum">Platinum</SelectItem>
                    <SelectItem value="diamond">Diamond</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Color</Label>
                <Input type="color" value={newBadge.color} onChange={(e) => setNewBadge(b => ({ ...b, color: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Award Type</Label>
                <Select value={newBadge.criteriaType} onValueChange={(v) => setNewBadge(b => ({ ...b, criteriaType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual (Admin awards)</SelectItem>
                    <SelectItem value="kudos_count">Auto: Kudos Received</SelectItem>
                    <SelectItem value="kudos_given">Auto: Kudos Given</SelectItem>
                    <SelectItem value="streak">Auto: Giving Streak</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newBadge.criteriaType !== "manual" && (
                <div>
                  <Label>Threshold</Label>
                  <Input type="number" min={1} value={newBadge.criteriaThreshold} onChange={(e) => setNewBadge(b => ({ ...b, criteriaThreshold: Number.parseInt(e.target.value) || 0 }))} />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateBadgeOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateBadge} disabled={!newBadge.name.trim()}>Create Badge</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Value Dialog */}
      <Dialog open={createValueOpen} onOpenChange={setCreateValueOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Core Value</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={newValue.name} onChange={(e) => setNewValue(v => ({ ...v, name: e.target.value }))} placeholder="e.g., Teamwork" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={newValue.description} onChange={(e) => setNewValue(v => ({ ...v, description: e.target.value }))} placeholder="What does this value represent?" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Emoji</Label>
                <Input value={newValue.emoji} onChange={(e) => setNewValue(v => ({ ...v, emoji: e.target.value }))} placeholder="🤝" />
              </div>
              <div>
                <Label>Color</Label>
                <Input type="color" value={newValue.color} onChange={(e) => setNewValue(v => ({ ...v, color: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateValueOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateValue} disabled={!newValue.name.trim()}>Create Value</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Award Badge Dialog */}
      <Dialog open={awardModalOpen} onOpenChange={setAwardModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Award Badge</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Badge</Label>
              <Select value={awardBadgeId} onValueChange={setAwardBadgeId}>
                <SelectTrigger><SelectValue placeholder="Select a badge" /></SelectTrigger>
                <SelectContent>
                  {badges.filter(b => b.is_active).map(badge => (
                    <SelectItem key={badge.id} value={badge.id}>
                      {badge.name} ({BADGE_TIERS[badge.tier]?.label || badge.tier})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Recipient</Label>
              {selectedAwardUser ? (
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-md">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={selectedAwardUser.avatar_url || undefined} />
                    <AvatarFallback className="text-[10px]">{getInitials(selectedAwardUser.full_name)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{selectedAwardUser.full_name}</span>
                  <Button variant="ghost" size="sm" className="ml-auto h-6 w-6 p-0" onClick={() => { setSelectedAwardUser(null); setUserSearch("") }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search for a user..."
                    value={userSearch}
                    onChange={(e) => { setUserSearch(e.target.value); searchUsers(e.target.value) }}
                    className="pl-9"
                  />
                  {userResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {userResults.map(u => (
                        <button key={u.id} onClick={() => { setSelectedAwardUser(u); setUserResults([]) }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left text-sm">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={u.avatar_url || undefined} />
                            <AvatarFallback className="text-[10px]">{getInitials(u.full_name)}</AvatarFallback>
                          </Avatar>
                          {u.full_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div>
              <Label>Reason (optional)</Label>
              <Textarea value={awardReason} onChange={(e) => setAwardReason(e.target.value)} placeholder="Why is this badge being awarded?" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAwardModalOpen(false)}>Cancel</Button>
            <Button onClick={handleAwardBadge} disabled={!awardBadgeId || !selectedAwardUser}>Award Badge</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
