export interface PadTemplate {
  id: string
  name: string
  description: string | null
  category: string
  hub_type: "individual" | "organization" | null
  access_mode: "all_sticks" | "individual_sticks"
  initial_sticks: Array<{
    topic: string
    content: string
    color: string
  }>
  icon_name: string | null
  color_scheme: string | null
  is_system: boolean
  is_public: boolean
  created_by: string | null
  use_count: number
  created_at: string
  updated_at: string
}

export interface StarterPack {
  id: string
  name: string
  description: string
  category: string
  pad_templates: string[] // Array of pad template IDs
  stick_templates: string[] // Array of stick template IDs
  order: number
  is_featured: boolean
}
