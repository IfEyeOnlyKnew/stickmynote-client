// ============================================================================
// TIMEZONE CONSTANTS
// User-friendly timezone list with IANA identifiers
// ============================================================================

export interface TimezoneOption {
  value: string // IANA timezone identifier (e.g., "America/New_York")
  label: string // User-friendly label
  offset: string // UTC offset display (e.g., "GMT-05:00")
  region: string // Region for grouping
}

// Common timezones grouped by region
export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  // Americas
  { value: "America/New_York", label: "Eastern Time - New York, Toronto", offset: "GMT-05:00", region: "Americas" },
  { value: "America/Chicago", label: "Central Time - Chicago, Mexico City", offset: "GMT-06:00", region: "Americas" },
  { value: "America/Denver", label: "Mountain Time - Denver, Phoenix", offset: "GMT-07:00", region: "Americas" },
  { value: "America/Los_Angeles", label: "Pacific Time - Los Angeles, Vancouver", offset: "GMT-08:00", region: "Americas" },
  { value: "America/Anchorage", label: "Alaska Time - Anchorage", offset: "GMT-09:00", region: "Americas" },
  { value: "Pacific/Honolulu", label: "Hawaii Time - Honolulu", offset: "GMT-10:00", region: "Americas" },
  { value: "America/Sao_Paulo", label: "Brasilia Time - São Paulo", offset: "GMT-03:00", region: "Americas" },
  { value: "America/Buenos_Aires", label: "Argentina Time - Buenos Aires", offset: "GMT-03:00", region: "Americas" },
  { value: "America/Santiago", label: "Chile Time - Santiago", offset: "GMT-04:00", region: "Americas" },
  { value: "America/Bogota", label: "Colombia Time - Bogotá", offset: "GMT-05:00", region: "Americas" },

  // Europe
  { value: "Europe/London", label: "Greenwich Mean Time - London, Dublin", offset: "GMT+00:00", region: "Europe" },
  { value: "Europe/Paris", label: "Central European Time - Paris, Berlin", offset: "GMT+01:00", region: "Europe" },
  { value: "Europe/Madrid", label: "Central European Time - Madrid, Barcelona", offset: "GMT+01:00", region: "Europe" },
  { value: "Europe/Rome", label: "Central European Time - Rome, Milan", offset: "GMT+01:00", region: "Europe" },
  { value: "Europe/Amsterdam", label: "Central European Time - Amsterdam", offset: "GMT+01:00", region: "Europe" },
  { value: "Europe/Brussels", label: "Central European Time - Brussels", offset: "GMT+01:00", region: "Europe" },
  { value: "Europe/Zurich", label: "Central European Time - Zurich, Geneva", offset: "GMT+01:00", region: "Europe" },
  { value: "Europe/Stockholm", label: "Central European Time - Stockholm", offset: "GMT+01:00", region: "Europe" },
  { value: "Europe/Warsaw", label: "Central European Time - Warsaw", offset: "GMT+01:00", region: "Europe" },
  { value: "Europe/Athens", label: "Eastern European Time - Athens", offset: "GMT+02:00", region: "Europe" },
  { value: "Europe/Helsinki", label: "Eastern European Time - Helsinki", offset: "GMT+02:00", region: "Europe" },
  { value: "Europe/Bucharest", label: "Eastern European Time - Bucharest", offset: "GMT+02:00", region: "Europe" },
  { value: "Europe/Kiev", label: "Eastern European Time - Kyiv", offset: "GMT+02:00", region: "Europe" },
  { value: "Europe/Moscow", label: "Moscow Time - Moscow", offset: "GMT+03:00", region: "Europe" },
  { value: "Europe/Istanbul", label: "Turkey Time - Istanbul", offset: "GMT+03:00", region: "Europe" },

  // Middle East
  { value: "Asia/Dubai", label: "Gulf Standard Time - Dubai, Abu Dhabi", offset: "GMT+04:00", region: "Middle East" },
  { value: "Asia/Riyadh", label: "Arabia Standard Time - Riyadh, Jeddah", offset: "GMT+03:00", region: "Middle East" },
  { value: "Asia/Kuwait", label: "Arabia Standard Time - Kuwait City", offset: "GMT+03:00", region: "Middle East" },
  { value: "Asia/Qatar", label: "Arabia Standard Time - Doha", offset: "GMT+03:00", region: "Middle East" },
  { value: "Asia/Bahrain", label: "Arabia Standard Time - Manama", offset: "GMT+03:00", region: "Middle East" },
  { value: "Asia/Jerusalem", label: "Israel Time - Jerusalem, Tel Aviv", offset: "GMT+02:00", region: "Middle East" },
  { value: "Asia/Tehran", label: "Iran Time - Tehran", offset: "GMT+03:30", region: "Middle East" },

  // Africa
  { value: "Africa/Cairo", label: "Eastern European Time - Cairo", offset: "GMT+02:00", region: "Africa" },
  { value: "Africa/Johannesburg", label: "South Africa Time - Johannesburg", offset: "GMT+02:00", region: "Africa" },
  { value: "Africa/Lagos", label: "West Africa Time - Lagos", offset: "GMT+01:00", region: "Africa" },
  { value: "Africa/Nairobi", label: "East Africa Time - Nairobi", offset: "GMT+03:00", region: "Africa" },
  { value: "Africa/Casablanca", label: "Western European Time - Casablanca", offset: "GMT+01:00", region: "Africa" },

  // Asia Pacific
  { value: "Asia/Kolkata", label: "India Standard Time - Mumbai, Delhi", offset: "GMT+05:30", region: "Asia Pacific" },
  { value: "Asia/Karachi", label: "Pakistan Time - Karachi", offset: "GMT+05:00", region: "Asia Pacific" },
  { value: "Asia/Dhaka", label: "Bangladesh Time - Dhaka", offset: "GMT+06:00", region: "Asia Pacific" },
  { value: "Asia/Bangkok", label: "Indochina Time - Bangkok", offset: "GMT+07:00", region: "Asia Pacific" },
  { value: "Asia/Jakarta", label: "Western Indonesia Time - Jakarta", offset: "GMT+07:00", region: "Asia Pacific" },
  { value: "Asia/Singapore", label: "Singapore Time - Singapore", offset: "GMT+08:00", region: "Asia Pacific" },
  { value: "Asia/Kuala_Lumpur", label: "Malaysia Time - Kuala Lumpur", offset: "GMT+08:00", region: "Asia Pacific" },
  { value: "Asia/Hong_Kong", label: "Hong Kong Time - Hong Kong", offset: "GMT+08:00", region: "Asia Pacific" },
  { value: "Asia/Shanghai", label: "China Standard Time - Shanghai, Beijing", offset: "GMT+08:00", region: "Asia Pacific" },
  { value: "Asia/Taipei", label: "Taipei Time - Taipei", offset: "GMT+08:00", region: "Asia Pacific" },
  { value: "Asia/Manila", label: "Philippine Time - Manila", offset: "GMT+08:00", region: "Asia Pacific" },
  { value: "Asia/Seoul", label: "Korea Standard Time - Seoul", offset: "GMT+09:00", region: "Asia Pacific" },
  { value: "Asia/Tokyo", label: "Japan Standard Time - Tokyo", offset: "GMT+09:00", region: "Asia Pacific" },

  // Australia & Oceania
  { value: "Australia/Perth", label: "Australian Western Time - Perth", offset: "GMT+08:00", region: "Australia & Oceania" },
  { value: "Australia/Adelaide", label: "Australian Central Time - Adelaide", offset: "GMT+09:30", region: "Australia & Oceania" },
  { value: "Australia/Brisbane", label: "Australian Eastern Time - Brisbane", offset: "GMT+10:00", region: "Australia & Oceania" },
  { value: "Australia/Sydney", label: "Australian Eastern Time - Sydney, Melbourne", offset: "GMT+10:00", region: "Australia & Oceania" },
  { value: "Pacific/Auckland", label: "New Zealand Time - Auckland", offset: "GMT+12:00", region: "Australia & Oceania" },
  { value: "Pacific/Fiji", label: "Fiji Time - Suva", offset: "GMT+12:00", region: "Australia & Oceania" },
]

// Group timezones by region for easier selection
export const TIMEZONE_GROUPS = TIMEZONE_OPTIONS.reduce(
  (groups, tz) => {
    if (!groups[tz.region]) {
      groups[tz.region] = []
    }
    groups[tz.region].push(tz)
    return groups
  },
  {} as Record<string, TimezoneOption[]>
)

// Get timezone option by value
export function getTimezoneByValue(value: string): TimezoneOption | undefined {
  return TIMEZONE_OPTIONS.find((tz) => tz.value === value)
}

// Get user-friendly label for a timezone
export function getTimezoneLabel(value: string): string {
  const tz = getTimezoneByValue(value)
  return tz ? `(${tz.offset}) ${tz.label}` : value
}

// Detect browser timezone
export function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return "America/New_York" // Default fallback
  }
}

// Check if a timezone value is valid
export function isValidTimezone(value: string): boolean {
  return TIMEZONE_OPTIONS.some((tz) => tz.value === value)
}

// Get the closest matching timezone from our list
export function getClosestTimezone(browserTimezone: string): string {
  // First, check if exact match exists
  if (isValidTimezone(browserTimezone)) {
    return browserTimezone
  }

  // Try to find a match in the same region
  // For example, if browser returns "America/Indiana/Indianapolis", find "America/New_York"
  const region = browserTimezone.split("/")[0]
  const regionTimezones = TIMEZONE_OPTIONS.filter((tz) => tz.value.startsWith(region))

  if (regionTimezones.length > 0) {
    return regionTimezones[0].value
  }

  // Default fallback
  return "America/New_York"
}
