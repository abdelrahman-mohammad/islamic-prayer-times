'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { UserSettings } from '@/lib/types'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

interface CalendarTabProps {
  settings: UserSettings
  onSave: (settings: Partial<UserSettings>) => void
}

export function CalendarTab({ settings, onSave }: CalendarTabProps) {
  const [targetCalendarId, setTargetCalendarId] = useState(settings.targetCalendarId || '')
  const [autoSync, setAutoSync] = useState(settings.autoSync || false)
  const [syncFrequency, setSyncFrequency] = useState<'daily' | 'weekly' | 'monthly'>(
    settings.syncFrequency || 'daily'
  )
  const [autoDeleteEvents, setAutoDeleteEvents] = useState(settings.autoDeleteEvents || false)
  const [deleteEventsAfter, setDeleteEventsAfter] = useState(
    settings.deleteEventsAfter || 'end-of-day'
  )

  // Fetch user's Google Calendars
  const { data: calendars, isLoading } = useQuery({
    queryKey: ['calendars'],
    queryFn: async () => {
      const response = await fetch('/api/calendar/list')
      if (!response.ok) {
        throw new Error('Failed to fetch calendars')
      }
      const result = await response.json()
      return result.data as Array<{
        id: string
        summary: string
        description?: string
        primary?: boolean
      }>
    },
  })

  const handleSave = () => {
    onSave({
      targetCalendarId,
      autoSync,
      syncFrequency,
      autoDeleteEvents,
      deleteEventsAfter,
    })
  }

  const hasChanges =
    targetCalendarId !== settings.targetCalendarId ||
    autoSync !== settings.autoSync ||
    syncFrequency !== settings.syncFrequency ||
    autoDeleteEvents !== settings.autoDeleteEvents ||
    deleteEventsAfter !== settings.deleteEventsAfter

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Calendar Settings</h2>
        <p className="text-white/70">
          Configure Google Calendar integration and sync preferences
        </p>
      </div>

      {/* Calendar Selection */}
      <div>
        <label className="block text-white font-medium mb-3">
          Target Calendar
        </label>
        {isLoading ? (
          <div className="flex items-center gap-2 text-white/70">
            <LoadingSpinner size="sm" />
            <span>Loading calendars...</span>
          </div>
        ) : calendars && calendars.length > 0 ? (
          <div className="space-y-2">
            {calendars.map((calendar) => (
              <label
                key={calendar.id}
                className={`flex items-start gap-3 p-4 rounded-lg cursor-pointer transition-all ${
                  targetCalendarId === calendar.id
                    ? 'bg-white/20 border border-islamic-green/50'
                    : 'bg-white/10 border border-transparent hover:bg-white/15'
                }`}
              >
                <input
                  type="radio"
                  value={calendar.id}
                  checked={targetCalendarId === calendar.id}
                  onChange={() => setTargetCalendarId(calendar.id)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <p className="text-white font-medium">
                    {calendar.summary}
                    {calendar.primary && (
                      <span className="ml-2 text-xs bg-islamic-green/30 px-2 py-1 rounded">
                        Primary
                      </span>
                    )}
                  </p>
                  {calendar.description && (
                    <p className="text-white/60 text-sm">{calendar.description}</p>
                  )}
                </div>
              </label>
            ))}
          </div>
        ) : (
          <div className="p-4 bg-white/10 rounded-lg">
            <p className="text-white/70">No calendars found</p>
            <p className="text-white/50 text-sm mt-1">
              Make sure you have granted calendar access permissions
            </p>
          </div>
        )}

        {/* Create New Calendar Option */}
        <button
          className="mt-3 glass-button px-4 py-2 text-white text-sm hover:bg-white/20"
          onClick={async () => {
            const response = await fetch('/api/calendar/create', {
              method: 'POST',
            })
            if (response.ok) {
              // Refresh calendars list
              window.location.reload()
            }
          }}
        >
          + Create "Prayer Times" Calendar
        </button>
      </div>

      {/* Auto Sync Settings */}
      <div>
        <label className="flex items-center gap-3 text-white font-medium">
          <input
            type="checkbox"
            checked={autoSync}
            onChange={(e) => setAutoSync(e.target.checked)}
            className="w-5 h-5"
          />
          Enable Automatic Sync
        </label>

        {autoSync && (
          <div className="mt-3 ml-8 space-y-2">
            <label className="block text-white/70 text-sm">Sync Frequency</label>
            <div className="flex gap-3">
              {(['daily', 'weekly', 'monthly'] as const).map((freq) => (
                <label
                  key={freq}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-all ${
                    syncFrequency === freq
                      ? 'bg-islamic-green/20 border border-islamic-green/30'
                      : 'bg-white/10 border border-transparent hover:bg-white/15'
                  }`}
                >
                  <input
                    type="radio"
                    value={freq}
                    checked={syncFrequency === freq}
                    onChange={() => setSyncFrequency(freq)}
                  />
                  <span className="text-white capitalize">{freq}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Auto Delete Settings */}
      <div>
        <label className="flex items-center gap-3 text-white font-medium">
          <input
            type="checkbox"
            checked={autoDeleteEvents}
            onChange={(e) => setAutoDeleteEvents(e.target.checked)}
            className="w-5 h-5"
          />
          Auto-delete Past Prayer Events
        </label>

        {autoDeleteEvents && (
          <div className="mt-3 ml-8">
            <label className="block text-white/70 text-sm mb-2">Delete events after</label>
            <div className="space-y-2">
              {[
                { value: '30min', label: '30 minutes after prayer', description: 'Delete each prayer 30 minutes after its time' },
                { value: 'end-of-day', label: 'End of day', description: 'Delete all prayers at 11:59 PM' },
                { value: 'end-of-week', label: 'End of week', description: 'Delete all prayers on Sunday night' },
                { value: 'end-of-month', label: 'End of month', description: 'Delete all prayers on the last day' },
              ].map((option) => (
                <label
                  key={option.value}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                    deleteEventsAfter === option.value
                      ? 'bg-white/20 border border-islamic-green/50'
                      : 'bg-white/10 border border-transparent hover:bg-white/15'
                  }`}
                >
                  <input
                    type="radio"
                    value={option.value}
                    checked={deleteEventsAfter === option.value}
                    onChange={() => setDeleteEventsAfter(option.value as any)}
                    className="mt-1"
                  />
                  <div>
                    <p className="text-white">{option.label}</p>
                    <p className="text-white/60 text-sm">{option.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={!hasChanges || !targetCalendarId}
          className="glass-button px-6 py-2 bg-islamic-green/20 text-white hover:bg-islamic-green/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save Calendar Settings
        </button>
      </div>
    </div>
  )
}