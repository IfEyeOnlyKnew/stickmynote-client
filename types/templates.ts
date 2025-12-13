export interface StickTemplate {
  id: string
  name: string
  description: string | null
  category: string
  topic_template: string | null
  content_template: string
  is_system: boolean
  is_public: boolean
  created_by: string | null
  use_count: number
  created_at: string
  updated_at: string
}

export interface TemplateCategory {
  name: string
  count: number
}
