export const NOTE_COLORS = [
  { name: "Yellow", value: "#fef3c7" },
  { name: "Pink", value: "#fce7f3" },
  { name: "Blue", value: "#dbeafe" },
  { name: "Green", value: "#d1fae5" },
  { name: "Purple", value: "#e9d5ff" },
  { name: "Orange", value: "#fed7aa" },
  { name: "Red", value: "#fecaca" },
  { name: "Gray", value: "#f3f4f6" },
  { name: "White", value: "#ffffff" },
  { name: "Cyan", value: "#cffafe" },
  { name: "Indigo", value: "#e0e7ff" },
  { name: "Lime", value: "#ecfccb" },
] as const

export const NOTE_COLOR_VALUES = NOTE_COLORS.map((c) => c.value)

export type NoteColor = (typeof NOTE_COLORS)[number]["value"]
