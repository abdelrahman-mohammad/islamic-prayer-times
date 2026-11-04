import { z } from 'zod'

// Prayer times API validation
export const prayerTimesQuerySchema = z.object({
  lat: z.string().transform(Number),
  lon: z.string().transform(Number),
  method: z.string().transform(Number).optional().default('1'),
  date: z.string().optional(),
})

// City search API validation
export const citySearchQuerySchema = z.object({
  q: z.string().min(2, 'Query must be at least 2 characters'),
})

// Settings validation
export const settingsSchema = z.object({
  city: z.string().min(1),
  country: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
  calculationMethod: z.number().min(1).max(5),
  reminderMinutes: z.array(z.number().positive()).min(1),
  selectedPrayers: z.array(z.string()),
  targetCalendarId: z.string(),
  eventTitleTemplate: z.string().refine(s => s.includes('{prayer}'), {
    message: 'Template must include {prayer} placeholder',
  }),
  autoSync: z.boolean(),
  syncFrequency: z.enum(['daily', 'weekly', 'monthly']),
  autoDeleteEvents: z.boolean(),
  deleteEventsAfter: z.enum(['30min', 'end-of-day', 'end-of-week', 'end-of-month']),
  theme: z.enum(['light', 'dark', 'auto']),
  language: z.string(),
})

// Partial settings for updates
export const partialSettingsSchema = settingsSchema.partial()

// Calendar sync request validation
export const syncRequestSchema = z.object({
  date: z.string().optional(), // ISO date string
  force: z.boolean().optional().default(false),
})

// Setup wizard validation
export const setupLocationSchema = z.object({
  city: z.string().min(1),
  country: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
})

export const setupMethodSchema = z.object({
  calculationMethod: z.number().min(1).max(5),
})

export const setupRemindersSchema = z.object({
  reminderMinutes: z.array(z.number().positive()).min(1),
})

export const setupEventTitleSchema = z.object({
  eventTitleTemplate: z.string().refine(s => s.includes('{prayer}'), {
    message: 'Template must include {prayer} placeholder',
  }),
})

export const setupAutoDeleteSchema = z.object({
  autoDeleteEvents: z.boolean(),
  deleteEventsAfter: z.enum(['30min', 'end-of-day', 'end-of-week', 'end-of-month']),
})

export const setupCalendarSchema = z.object({
  targetCalendarId: z.string().min(1),
})

export const setupAutoSyncSchema = z.object({
  autoSync: z.boolean(),
  syncFrequency: z.enum(['daily', 'weekly', 'monthly']),
})