import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { ReactNode } from "react"

interface SettingSwitchProps {
  id: string
  label: string | ReactNode
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

export function SettingSwitch({ id, label, description, checked, onCheckedChange }: SettingSwitchProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}
