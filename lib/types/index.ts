// Type definitions for the Prayer Times Calendar app

export interface PrayerTimes {
  Fajr: string
  Sunrise: string
  Dhuhr: string
  Asr: string
  Maghrib: string
  Isha: string
  [key: string]: string
}

export interface City {
  city: string
  country: string
  latitude: number
  longitude: number
  population?: number
}

export interface UserSettings {
  id: string
  userId: string
  city: string
  country: string
  latitude: number
  longitude: number
  calculationMethod: number
  reminderMinutes: number[]
  selectedPrayers: string[]
  targetCalendarId: string
  eventTitleTemplate: string
  autoSync: boolean
  syncFrequency: 'daily' | 'weekly' | 'monthly'
  autoDeleteEvents: boolean
  deleteEventsAfter: '30min' | 'end-of-day' | 'end-of-week' | 'end-of-month'
  theme: 'light' | 'dark' | 'auto'
  language: string
}

export interface SyncLog {
  id: string
  userId: string
  timestamp: Date
  status: 'success' | 'failure' | 'cleanup'
  eventsCreated: number
  eventsDeleted: number
  errorMessage?: string
}

export interface CalendarEvent {
  id?: string
  summary: string
  description?: string
  location?: string
  start: {
    dateTime: string
    timeZone?: string
  }
  end: {
    dateTime: string
    timeZone?: string
  }
  reminders?: {
    useDefault: boolean
    overrides?: Array<{
      method: 'email' | 'popup'
      minutes: number
    }>
  }
  extendedProperties?: {
    private?: Record<string, string>
    shared?: Record<string, string>
  }
}

export interface GoogleCalendar {
  id: string
  summary: string
  description?: string
  primary?: boolean
  backgroundColor?: string
  foregroundColor?: string
}

export interface SetupWizardStep {
  id: number
  title: string
  description: string
  component: React.ComponentType<any>
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

export interface PrayerTimesApiResponse {
  code: number
  status: string
  data: {
    timings: PrayerTimes
    date: {
      readable: string
      timestamp: string
      hijri: {
        date: string
        format: string
        day: string
        weekday: {
          en: string
          ar: string
        }
        month: {
          number: number
          en: string
          ar: string
        }
        year: string
      }
      gregorian: {
        date: string
        format: string
        day: string
        weekday: {
          en: string
        }
        month: {
          number: number
          en: string
        }
        year: string
      }
    }
  }
}

export interface GeoapifyFeature {
  type: string
  properties: {
    city?: string
    country?: string
    country_code?: string
    state?: string
    county?: string
    street?: string
    housenumber?: string
    postalcode?: string
    formatted?: string
    lat: number
    lon: number
    place_id?: string
    population?: number
  }
  geometry: {
    type: string
    coordinates: [number, number]
  }
}

export interface GeoapifyResponse {
  type: string
  features: GeoapifyFeature[]
}