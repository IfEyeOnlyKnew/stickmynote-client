export interface UserSettings {
  profile: {
    name: string
    email: string
    bio: string
    avatar: string
  }
  preferences: {
    theme: string
    language: string
    timezone: string
    autoSave: boolean
    spellCheck: boolean
    defaultNoteColor: string
    compactView: boolean
  }
  notifications: {
    emailNotifications: boolean
    pushNotifications: boolean
    weeklyDigest: boolean
    mentionNotifications: boolean
  }
  privacy: {
    profileVisibility: string
    showEmail: boolean
    allowTagging: boolean
  }
}

export const initialSettings: UserSettings = {
  profile: {
    name: "John Doe",
    email: "john.doe@example.com",
    bio: "Passionate note-taker and knowledge organizer",
    avatar: "/placeholder.svg?height=80&width=80",
  },
  preferences: {
    theme: "system",
    language: "en",
    timezone: "America/New_York",
    autoSave: true,
    spellCheck: true,
    defaultNoteColor: "#fef3c7",
    compactView: false,
  },
  notifications: {
    emailNotifications: true,
    pushNotifications: false,
    weeklyDigest: true,
    mentionNotifications: false,
  },
  privacy: {
    profileVisibility: "public",
    showEmail: false,
    allowTagging: true,
  },
}
