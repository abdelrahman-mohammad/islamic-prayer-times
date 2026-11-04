import { google } from 'googleapis'
import { type CalendarEvent, type UserSettings, type PrayerTimes } from '@/lib/types'
import { parseTimeToDate, isWithinMinutes, getCalculationMethodName } from '@/lib/utils'

/**
 * Create a Google Calendar event object for a prayer
 */
export function createPrayerEvent(
  prayer: string,
  prayerTime: Date,
  settings: UserSettings,
  date: Date = new Date()
): CalendarEvent {
  const eventTitle = settings.eventTitleTemplate.replace('{prayer}', prayer)
  const endTime = new Date(prayerTime.getTime() + 15 * 60000) // +15 minutes

  const reminders = settings.reminderMinutes.map(minutes => ({
    method: 'popup' as const,
    minutes,
  }))

  return {
    summary: eventTitle,
    description: [
      `Prayer time calculated using ${getCalculationMethodName(settings.calculationMethod)}`,
      `Location: ${settings.city}, ${settings.country}`,
      '',
      'Created by Prayer Times Calendar',
    ].join('\n'),
    start: {
      dateTime: prayerTime.toISOString(),
      timeZone: 'UTC',
    },
    end: {
      dateTime: endTime.toISOString(),
      timeZone: 'UTC',
    },
    location: `${settings.city}, ${settings.country}`,
    reminders: {
      useDefault: false,
      overrides: reminders,
    },
    extendedProperties: {
      private: {
        createdBy: 'prayer-times-calendar',
        prayerName: prayer,
        calculationMethod: settings.calculationMethod.toString(),
      },
    },
  }
}

/**
 * Check if an event is a prayer event created by our app
 */
export function isPrayerEvent(event: any, settings: UserSettings): boolean {
  // Check by extended properties first (most reliable)
  if (event.extendedProperties?.private?.createdBy === 'prayer-times-calendar') {
    return true
  }

  // Fallback: Check by title pattern
  const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha', 'Sunrise']
  for (const prayer of prayers) {
    const expectedTitle = settings.eventTitleTemplate.replace('{prayer}', prayer)
    if (event.summary === expectedTitle) {
      return true
    }
  }

  // Additional check: Description contains our signature
  if (event.description?.includes('Created by Prayer Times Calendar')) {
    return true
  }

  return false
}

/**
 * Find existing prayer events for a given date
 */
export async function findExistingPrayerEvents(
  calendar: any,
  calendarId: string,
  date: Date,
  settings: UserSettings
): Promise<any[]> {
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)

  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  try {
    const response = await calendar.events.list({
      calendarId,
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    })

    const events = response.data.items || []

    // Filter to only prayer events
    return events.filter(event => isPrayerEvent(event, settings))
  } catch (error) {
    console.error('Error fetching existing events:', error)
    return []
  }
}

/**
 * Check if a prayer event already exists at approximately the same time
 */
export function findDuplicateEvent(
  existingEvents: any[],
  prayerName: string,
  prayerTime: Date,
  settings: UserSettings
): any | null {
  const expectedTitle = settings.eventTitleTemplate.replace('{prayer}', prayerName)

  for (const event of existingEvents) {
    // Check title match
    if (event.summary === expectedTitle) {
      // Check time match (within 5 minutes)
      const eventTime = new Date(event.start.dateTime || event.start.date)
      if (isWithinMinutes(eventTime, prayerTime, 5)) {
        return event
      }
    }

    // Also check by extended properties
    if (event.extendedProperties?.private?.prayerName === prayerName) {
      const eventTime = new Date(event.start.dateTime || event.start.date)
      if (isWithinMinutes(eventTime, prayerTime, 5)) {
        return event
      }
    }
  }

  return null
}

/**
 * Sync prayer times for a specific date
 */
export async function syncPrayerTimesForDate(
  calendar: any,
  settings: UserSettings,
  prayerTimes: PrayerTimes,
  date: Date = new Date()
): Promise<{ created: number; updated: number; skipped: number }> {
  const results = {
    created: 0,
    updated: 0,
    skipped: 0,
  }

  // Fetch existing events for duplicate prevention
  const existingEvents = await findExistingPrayerEvents(
    calendar,
    settings.targetCalendarId,
    date,
    settings
  )

  // Process each selected prayer
  for (const prayerName of settings.selectedPrayers) {
    if (!prayerTimes[prayerName]) {
      console.warn(`Prayer time not found for ${prayerName}`)
      continue
    }

    const prayerTime = parseTimeToDate(prayerTimes[prayerName])

    // Set correct date (in case we're syncing for a different day)
    prayerTime.setFullYear(date.getFullYear())
    prayerTime.setMonth(date.getMonth())
    prayerTime.setDate(date.getDate())

    // Check for duplicates
    const existingEvent = findDuplicateEvent(
      existingEvents,
      prayerName,
      prayerTime,
      settings
    )

    if (existingEvent) {
      // Event exists - check if it needs updating
      const existingTime = new Date(existingEvent.start.dateTime)

      if (!isWithinMinutes(existingTime, prayerTime, 1)) {
        // Time has changed, update the event
        try {
          const updatedEvent = createPrayerEvent(prayerName, prayerTime, settings, date)

          await calendar.events.update({
            calendarId: settings.targetCalendarId,
            eventId: existingEvent.id,
            requestBody: updatedEvent,
          })

          results.updated++
        } catch (error) {
          console.error(`Failed to update ${prayerName}:`, error)
        }
      } else {
        // Event is up to date
        results.skipped++
      }
    } else {
      // Create new event
      try {
        const newEvent = createPrayerEvent(prayerName, prayerTime, settings, date)

        await calendar.events.insert({
          calendarId: settings.targetCalendarId,
          requestBody: newEvent,
        })

        results.created++
      } catch (error) {
        console.error(`Failed to create ${prayerName}:`, error)
      }
    }
  }

  return results
}

/**
 * Delete past prayer events based on user settings
 */
export async function cleanupPastEvents(
  calendar: any,
  settings: UserSettings
): Promise<number> {
  if (!settings.autoDeleteEvents) {
    return 0
  }

  let deletedCount = 0
  const now = new Date()
  let threshold: Date

  // Calculate deletion threshold based on settings
  switch (settings.deleteEventsAfter) {
    case '30min':
      // Events older than 45 minutes (30 min after 15 min duration)
      threshold = new Date(now.getTime() - 45 * 60000)
      break
    case 'end-of-day':
      // Yesterday's events
      threshold = new Date(now)
      threshold.setHours(0, 0, 0, 0)
      break
    case 'end-of-week':
      // Last week's events
      threshold = new Date(now)
      threshold.setDate(threshold.getDate() - 7)
      break
    case 'end-of-month':
      // Last month's events
      threshold = new Date(now)
      threshold.setMonth(threshold.getMonth() - 1)
      break
    default:
      return 0
  }

  try {
    // Fetch events to delete
    const response = await calendar.events.list({
      calendarId: settings.targetCalendarId,
      timeMax: threshold.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 100, // Batch size
    })

    const events = response.data.items || []

    // Filter and delete prayer events
    for (const event of events) {
      if (isPrayerEvent(event, settings)) {
        try {
          await calendar.events.delete({
            calendarId: settings.targetCalendarId,
            eventId: event.id,
          })
          deletedCount++
        } catch (error) {
          console.error(`Failed to delete event ${event.id}:`, error)
        }
      }
    }
  } catch (error) {
    console.error('Error during cleanup:', error)
  }

  return deletedCount
}