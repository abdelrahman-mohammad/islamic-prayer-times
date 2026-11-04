import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Utility function to merge Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a date to a readable string
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

/**
 * Format time to 12-hour format
 */
export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

/**
 * Calculate time difference in minutes between two dates
 */
export function minutesBetween(date1: Date, date2: Date): number {
  const diff = Math.abs(date1.getTime() - date2.getTime())
  return Math.floor(diff / (1000 * 60))
}

/**
 * Check if two times are within a specified number of minutes
 */
export function isWithinMinutes(date1: Date, date2: Date, minutes: number): boolean {
  return minutesBetween(date1, date2) <= minutes
}

/**
 * Get calculation method name from ID
 */
export function getCalculationMethodName(method: number): string {
  const methods: Record<number, string> = {
    1: 'ISNA (Islamic Society of North America)',
    2: 'Muslim World League',
    3: 'Umm Al-Qura (Saudi Arabia)',
    4: 'Egyptian General Authority',
    5: 'University of Islamic Sciences, Karachi',
  }
  return methods[method] || 'Unknown Method'
}

/**
 * Get prayer name in English
 */
export function getPrayerName(prayer: string): string {
  const prayers: Record<string, string> = {
    Fajr: 'Fajr (Dawn)',
    Sunrise: 'Sunrise',
    Dhuhr: 'Dhuhr (Noon)',
    Asr: 'Asr (Afternoon)',
    Maghrib: 'Maghrib (Sunset)',
    Isha: 'Isha (Night)',
  }
  return prayers[prayer] || prayer
}

/**
 * Generate a unique event ID for prayer events
 */
export function generateEventId(prayer: string, date: Date): string {
  const dateStr = date.toISOString().split('T')[0]
  return `prayer-${prayer.toLowerCase()}-${dateStr}`
}

/**
 * Parse time string (HH:MM) to Date object for today
 */
export function parseTimeToDate(timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number)
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return date
}

/**
 * Get deletion threshold based on user preference
 */
export function getDeleteThreshold(
  deleteAfter: string,
  prayerTime: Date
): Date {
  const threshold = new Date(prayerTime)

  switch (deleteAfter) {
    case '30min':
      // 30 minutes after prayer time + 15 min duration
      threshold.setMinutes(threshold.getMinutes() + 45)
      break
    case 'end-of-day':
      // End of the same day at 23:59
      threshold.setHours(23, 59, 59, 999)
      break
    case 'end-of-week':
      // End of the week (Sunday 23:59)
      const daysUntilSunday = (7 - threshold.getDay()) % 7
      threshold.setDate(threshold.getDate() + daysUntilSunday)
      threshold.setHours(23, 59, 59, 999)
      break
    case 'end-of-month':
      // Last day of the month at 23:59
      const lastDay = new Date(threshold.getFullYear(), threshold.getMonth() + 1, 0)
      threshold.setDate(lastDay.getDate())
      threshold.setHours(23, 59, 59, 999)
      break
  }

  return threshold
}

/**
 * Check if auto-sync should run based on frequency
 */
export function shouldSyncToday(
  lastSync: Date | null,
  frequency: string
): boolean {
  if (!lastSync) return true

  const now = new Date()
  const daysSinceSync = Math.floor(
    (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60 * 24)
  )

  switch (frequency) {
    case 'daily':
      return daysSinceSync >= 1
    case 'weekly':
      return daysSinceSync >= 7
    case 'monthly':
      return daysSinceSync >= 30
    default:
      return false
  }
}